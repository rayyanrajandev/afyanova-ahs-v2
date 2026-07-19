# Multi-Tenant / Multi-Facility Scoping — Rollout Readiness

**Context**: the UI/UX & scalability audit (`reports/opd-workflow-ui-ux-audit.md`) flagged that `platform.multi_facility_scoping` and `platform.multi_tenant_isolation` (`config/feature_flags.php`) both ship **disabled by default**, and that flipping them should be an explicit release gate rather than an implicit default — since 77 files across the codebase inject the shared `PlatformScopeQueryApplier` helper and gate their query scoping behind these two flags, and one confirmed bug (`ListCashierQueueUseCase`, already fixed) showed that "injects the scoper" doesn't guarantee "actually scopes correctly."

**Method**: 4 parallel audits covering all 77 files, each checking 3 precise, mechanical criteria: (1) is the scoper injected but never actually called (dead code, same bug class as `ListCashierQueueUseCase`), (2) within an otherwise-scoped class, are there methods that silently skip scoping, (3) does any call against a table lacking a `facility_id` column omit the required `facilityColumn: null` override (which would crash with a SQL error the moment facility scoping is active). Confirmed via migration audit: only `patients` and `staff_profiles` lack `facility_id` (every other clinical/operational table has it); an initially-suspected third table, `inpatient_ward_census`, doesn't actually exist as a real table.

---

## Fixed this pass (10 locations)

### Wrong/nonexistent flag key — scoping was silently dead code regardless of flag state (6 locations)

The most serious class of bug: these all check a flag name that isn't registered in `config/feature_flags.php`. `RequestScopedFeatureFlagResolver::isEnabled()` returns `false` for any unrecognized key — so even with both real flags fully enabled in production, scoping in these files would never actually activate.

| File | Wrong key checked |
|---|---|
| `app/Modules/Billing/Application/UseCases/BulkCreateBillingServiceCatalogItemsFromCatalogUseCase.php` | `'multi_facility_isolation'` |
| `app/Modules/InventoryProcurement/Infrastructure/Repositories/EloquentInventoryWarehouseTransferRepository.php` | `'inventory_procurement_platform_scoping'` |
| `app/Modules/InventoryProcurement/Infrastructure/Repositories/EloquentInventoryMsdOrderRepository.php` | same |
| `app/Modules/InventoryProcurement/Infrastructure/Repositories/EloquentInventoryDispensingClaimLinkRepository.php` | same |
| `app/Modules/InventoryProcurement/Infrastructure/Repositories/EloquentInventorySupplierLeadTimeRepository.php` | same |
| `app/Modules/InventoryProcurement/Presentation/Http/Controllers/InventoryAnalyticsController.php` | same (affects all 4 of its analytics endpoints) |

**Fix**: all 6 now check `platform.multi_facility_scoping` OR `platform.multi_tenant_isolation`, matching the convention used everywhere else in the codebase. Confirmed via `grep` that no other file references either wrong key anymore.

### Partial scoping within an otherwise-scoped class (4 locations)

- **`EloquentPlatformRbacRepository::syncUserRoles()`** — attached whatever `$roleIds` were passed in with zero scope validation (only the *detach* half of the sync was scoped), so once scoping is active, a caller could attach a role id belonging to a different tenant. Fixed by scoping the role-lookup query used to build the attach list, so out-of-scope role ids are silently excluded from what gets attached (and from the response payload). **Verified live**: with a fake tenant-scoped context and flags forced on, attaching `[roleA (same tenant), roleB (different tenant)]` now correctly attaches only `roleA`; with flags off, both attach unchanged (confirmed in an isolated process — an earlier combined test script showed a misleading result from rebinding the container mid-script, corrected by testing each flag state in its own process).
- **`DepartmentRequisitionScopeResolver::assertItemIsRequestableForDepartment()`** — the category-based fallback validation queried `InventoryItemModel` by id with no scope, so a requisition could validate against another tenant/facility's catalog item. Fixed by applying the class's own existing `applyDepartmentScopeIfEnabled()` to that query — the identical, already-proven-correct mechanism used by every other method in the class.
- **`InventoryExtendedController::lookupByBarcode()`** — queried `InventoryItemModel` directly with no scoping, inconsistent with every other item-lookup path in the same controller. Fixed by adding the controller's own existing `isPlatformScopingEnabled()`/`apply()` pattern (already used in `departmentStock()` and `clinicalCatalogItems()`).
- **`EloquentInventoryStockMovementRepository::findById()`** — returned a full stock-movement record by id with no scoping, unlike `search()`/`summary()` in the same class. Fixed by adding the class's existing `applyPlatformScopeIfEnabled()` call.

All 4 fixes reuse a scoping helper the same class already defines and already uses elsewhere — none introduce new scoping logic, and all are no-ops with the flags in their current default-off state, so there's no behavior change today.

---

## Investigated and resolved: `EloquentPlatformUserAdminRepository::syncUserFacilitiesInScope()`

This was flagged by the mechanical audit as a write-path gap — an "unscoped user lookup before mutating facility assignments" — because it has no call to the class's own `applyUserScopeIfEnabled()` helper, unlike every read method in the same class. A deliberate follow-up traced the full call chain (`SyncPlatformUserFacilitiesUseCase` → this repository method) rather than patching it mechanically, and found it's **already correctly protected, by design, through a different mechanism than the pattern-match expected**:

- **The route is permission-gated**: both `PATCH platform/admin/users/{id}/facilities` and the bulk variant require `can:platform.users.manage-facilities` (`routes/api.php:178,196`).
- **The "attach" side is validated upstream, before this method ever runs**: `SyncPlatformUserFacilitiesUseCase::execute()` calls `resolveExistingFacilityIdsInScope()` on every submitted facility id and throws `UnknownPlatformUserFacilityException` if any resolve outside the caller's own scope (`SyncPlatformUserFacilitiesUseCase.php:45-50`).
- **The "detach" side is already scoped**: `listScopedFacilityIdsForUser()` (used to compute what to remove) applies `applyFacilityScopeToFacilityUserQueryIfEnabled()`, so a caller can only ever detach facility assignments already within their own scope.
- **The remaining tenant check on the target user is deliberately tenant-only, not facility-scoped** — and that's correct, not a gap: this method's whole purpose is granting a user access to a facility they may not have yet, so restricting the lookup the way `applyUserScopeIfEnabled()` does (target user must already have a `facility_user` row in the caller's facility) would make first-time onboarding to that facility impossible. A facility scope always carries a matching tenant (`ResolvePlatformAccessScopeUseCase.php` — a resolved facility always sets `tenant` from the same matched assignment), so the single tenant check already covers both the tenant-scoped and facility-scoped caller cases correctly.

**Verified live**: with a fake facility-scoped context (tenant A / facility A) and scoping active, submitting `[facility A (own), facility B (a different tenant's facility)]` together correctly threw `UnknownPlatformUserFacilityException` before reaching the repository at all; submitting `facility A` alone for a brand-new user with zero prior facility assignments succeeded, confirming legitimate onboarding still works.

**Change made**: none to the authorization logic — it was already correct. Added an explanatory comment directly above the tenant check (`EloquentPlatformUserAdminRepository.php:347-360`) documenting why it's deliberately tenant-only and where the rest of the protection actually lives, so a future reader (or another mechanical audit) doesn't re-flag this as a mystery gap.

---

## Findings that need a product decision, not fixed here

### The pervasive "exists-by-number/code" uniqueness-check pattern (~25 methods, most modules)

Nearly every module has a consistent pattern: methods like `existsByAppointmentNumber()`, `existsByOrderNumber()`, `existsByCaseNumber()`, `existsByInvoiceNumber()`, `existsBySaleNumber()`, `existsByRequestNumber()`, `existsByEmployeeNumber()`, etc. — used as pre-save duplicate checks — consistently skip scoping, while every other method in the same class scopes correctly. This is too widespread and too consistent to be an accident; it reads as a deliberate choice that business-document numbers (order numbers, case numbers, invoice numbers) should be **globally** unique across tenants/facilities, not per-tenant.

**This needs an explicit product decision before the flags go on**: if global uniqueness is intended, no change is needed — these are correctly unscoped by design. If numbers were meant to only need to be unique *within* a tenant/facility, all ~25 of these are latent bugs that would start rejecting legitimate duplicate-looking-but-different-tenant numbers the moment scoping is enabled. Given the volume and the fact that changing this affects real uniqueness-constraint behavior, this should not be decided as a side effect of a scoping bug-fix pass.

Representative locations (not exhaustive — see the 4 audit passes for the complete list): `EloquentAppointmentRepository`, `EloquentAppointmentReferralRepository`, `EloquentMedicalRecordRepository`, `EloquentAdmissionRepository`, `EloquentServiceRequestRepository`, `EloquentStaffProfileRepository`, `EloquentLaboratoryOrderRepository`, `EloquentPharmacyOrderRepository`, `EloquentRadiologyOrderRepository`, `EloquentTheatreProcedureRepository`, `EloquentEmergencyTriageCaseRepository`, `EloquentEmergencyTriageCaseTransferRepository`, `EloquentInpatientWardCarePlanRepository`, `EloquentInpatientWardTaskRepository`, `EloquentClaimsInsuranceCaseRepository`, `EloquentBillingInvoiceRepository`, `EloquentInventoryProcurementRequestRepository`, `EloquentPosSaleRepository` (x2), `EloquentPosSaleAdjustmentRepository`, `EloquentPosRegisterSessionRepository`. Also folds in `EloquentInventoryItemRepository::listExistingItemCodes()`/`listLinkedByClinicalCatalogIds()` (used for the same kind of dedup check during bulk catalog-to-inventory item creation) and the lower-confidence `EloquentPlatformUserAdminRepository::emailExists()` (email uniqueness is very commonly global by design).

### `EloquentAdmissionRepository::activeAdmissionsByBedResourceIds()` — confirmed gap, needs a signature change

Unlike its siblings `hasActivePlacementConflict()`/`hasActiveBedResourceConflict()` (which take explicit `?string $tenantId, ?string $facilityId` parameters and scope manually), this method takes no scope parameters at all and applies no scoping whatsoever. Fixing it requires adding `tenantId`/`facilityId` parameters to its signature and updating the interface (`AdmissionRepositoryInterface`) plus every caller — a real but contained follow-up, not done in this pass since it's a breaking signature change rather than an internal-only fix.

### `EloquentEncounterRepository::latestMedicalRecordsByEncounterId()` — low risk, documented only

A private helper that queries `MedicalRecordModel` by a list of `$encounterIds` with no scoping — but those IDs are always produced by an already-scoped upstream query (`search()`), so this can't actually return out-of-scope data in practice. Left as-is; noted for awareness only.

---

## Release-gate checklist

Before enabling `platform.multi_facility_scoping` and/or `platform.multi_tenant_isolation` in any environment beyond local development:

1. **Done** — All 6 wrong-flag-key locations fixed (scoping was previously dead code in these files regardless of flag state).
2. **Done** — The 4 confirmed partial-scoping gaps mechanically fixable within this audit's scope are fixed and verified.
3. **Done** — `syncUserFacilitiesInScope()`'s facility-assignment authorization model investigated in full and confirmed already correct (protected by upstream facility-id validation, scoped detach, and a deliberately tenant-only check) — no code change needed, documented in place for future readers.
4. **Needs a decision** — Confirm intent on the exists-by-number/code uniqueness pattern (global vs. per-tenant uniqueness) across the ~25 methods listed above.
5. **Needs follow-up work** — `activeAdmissionsByBedResourceIds()` needs a signature change (add scope parameters) plus caller updates.
6. **Recommend staging the rollout**: enable `platform.multi_tenant_isolation` first — tenant scoping is the more consistently and completely implemented of the two across the audited files — before `platform.multi_facility_scoping`, given `patients` and `staff_profiles` only ever had tenant-level scoping designed for them in the first place.
7. **Out of scope for this audit, verify separately before go-live**: this pass only covered read-path query scoping in files that already inject `PlatformScopeQueryApplier`. It did not verify (a) that every module's *write* path (row creation) correctly stamps `tenant_id`/`facility_id` at insert time, (b) frontend behavior once scoping is live (e.g., stale cross-facility data cached client-side), or (c) queued jobs/console commands that run outside a normal request's resolved platform-scope context.

---

## Files confirmed clean (no issues found)

The remaining ~63 of the 77 audited files correctly call their injected `PlatformScopeQueryApplier` from every relevant query method, gated on the correct flag names, with `facilityColumn: null` used everywhere a facility-id-less table (`patients`, `staff_profiles`) is touched. This includes `EloquentPatientRepository`, `EloquentClinicalCatalogItemRepository`, and `ListCashierQueueUseCase` (all fixed in earlier passes this session) plus the full Encounter, Appointment, MedicalRecord, Admission, Department, Staff (aside from the one exists-check noted above), Laboratory, Pharmacy, Radiology, TheatreProcedure, EmergencyTriage, InpatientWard, ClaimsInsurance, Billing, and remaining Inventory/POS repositories and services.
