# RBAC & Authorization Security Audit Report

**System:** Afyanova AHS v2 — Laravel 12 + Inertia.js/Vue 3 hospital management system
**Audit date:** 2026-07-23
**Auditor role:** Senior Laravel Security Architect / RBAC Auditor
**Methodology:** Static code audit only (no runtime/dynamic testing, no database inspection). Every finding below is backed by a file path and, where practical, a line number. Anything not directly verified in code is explicitly marked as such.

---

## 1. Executive Summary

This system implements a **fully custom, database-backed RBAC system** — there is no Spatie Permission package or other third-party ACL library (confirmed: `composer.json` has no `spatie/laravel-permission` dependency). Authorization is built from four Eloquent tables (`roles`, `permissions`, `role_user`, `permission_role`), a `User::hasPermissionTo()` method, Laravel Gates/Policies for a subset of domain models, and ~940 HTTP routes gated mostly by a `can:<permission-name>` middleware convention that piggybacks on a global `Gate::before()` hook.

The architecture is, in the main, coherent and reasonably disciplined: permission names are consistently dot-namespaced, ~92% of API routes carry explicit per-route permission middleware, broadcast channels are correctly scoped, and there is a genuine, centralized frontend permission layer (not just cosmetic UI hiding). A defense-in-depth "privileged change control" (approval-case requirement for sensitive RBAC/user-admin actions, `config/platform_user_admin.php`) is a notable positive.

However, the audit found **one critical, system-wide privilege-escalation-adjacent defect** and several **high-severity authorization gaps**:

- **Critical:** `App\Models\User::isFacilitySuperAdmin()` grants universal admin bypass (`hasUniversalAdminAccess()` → `hasPermissionTo()` always returns `true`) to *any* user holding a role with code `ADMIN.FACILITY` — **with no check that the role is active, unexpired, or unrevoked**, and this bypass applies to all ~724 `routes/api.php` routes (the `user.has-role` active-role gate is only applied in `routes/web.php`). A single stale or revoked "Hospital Administrator" role assignment is therefore a permanent, system-wide, cross-tenant super-admin key over the API. See §11 and §14.
- **High:** Three write endpoints have no authorization check anywhere in the stack (route, controller, or use case): invoice status transitions (`PATCH billing/{id}/status`), billing service-catalog create/update/publish, and clinical-privilege-grant status transitions (`PATCH staff/{id}/privileges/{privilegeId}/status`).
- **High:** Two independent, fully-diverging sources of role/permission truth exist in the codebase (`config/roles.php` vs. `database/seeders/RoleHierarchySeeder.php`); the seeder is dead code today, but its mere presence is a maintenance hazard.
- **High:** Several permissions are checked in live route middleware (an entire ~13-route NHIF/insurance billing group, plus 6 service-catalog write endpoints) but are **never granted to any role** in any seed source — meaning the intended-least-privilege staff (Insurance Officer, Finance Officer) can never use these features; only the Critical-finding super-admin bypass can.

Overall risk rating: **High** (see §17), driven primarily by the Super Admin bypass defect. The rest of the system's authorization posture is comparatively mature.

> **Correction added 2026-07-23 (during Phase 3 remediation):** three of this report's four §7.3/§7.4/§15 "zero authorization" / "no permission floor" findings were **false positives**. Re-verification while implementing fixes (reading the actual `FormRequest::authorize()` implementations, not just the Controller/UseCase files the original session-limited manual pass checked) found:
> - Billing service-catalog write endpoints (§7.3): already protected — each `FormRequest` checks `billing.service-catalog.manage` **OR** the granular `manage-identity`/`manage-pricing` variant, and the latter *is* granted to real roles. The original pass only noticed the orphaned half of the OR.
> - Staff privilege-grant status endpoint (§7.3): already protected — `UpdateStaffPrivilegeGrantStatusRequest::authorize()` maps each target status to the correct permission via `Gate::forUser($user)->allows(...)`.
> - Medical-record/encounter status transitions (§7.4): already have a real permission floor (`medical.records.read` plus `finalize`/`amend`/`archive` depending on target status) in `UpdateMedicalRecordStatusRequest`/`UpdateEncounterStatusRequest`, layered *underneath* the ownership check §7.4 correctly identified — the ownership check was never a substitute for it.
>
> Only the billing invoice status endpoint (`PATCH billing/{id}/status`) had a genuine gap, and it was narrower than reported: `issued`/`voided`/`cancelled` were already checked correctly; only `paid`/`partially_paid`/`draft` fell through an unconditional `return true`. All three false positives were confirmed via already-passing (or newly added) tests, not just re-reading code. See `RBAC_Remediation_Plan.md` Phase 3 for full detail. Root cause of the original errors: the two research agents that produced this section hit an API session-limit failure partway through (see §3 Methodology) and had to be finished via a faster, less thorough manual grep pass that checked Controllers/UseCases but consistently missed the FormRequest layer, which turns out to be where real authorization lives for several endpoints in this codebase (inconsistently — sometimes a stub, sometimes real logic). Sections 7.3, 7.4, 15, and the Executive Summary below are left as originally written for the audit-trail record; treat the three items above as corrected by this note, not by silent edits.

---

## 2. Audit Scope

- Full `app/` tree (24 DDD-style modules under `app/Modules/*`, plus `app/Http`, `app/Policies`, `app/Providers`, `app/Support`, `app/Console`, `app/Models`).
- All route files: `routes/web.php` (142 routes), `routes/api.php` (724 routes), `routes/billing-phase1.php` (67 routes), `routes/settings.php` (8 routes), `routes/channels.php` (4 broadcast channels), `routes/console.php` (confirmed CLI-only, 0 HTTP routes).
- `database/migrations` (307 files) and `database/seeders` (20 files) for role/permission provisioning.
- `config/roles.php`, `config/billing_permissions.php`, `config/platform_user_admin.php`.
- Frontend: `resources/js` — Inertia shared props, `usePlatformAccess` composable, navigation/sidebar filtering, sampled page components.
- Out of scope / not verified: live database state, runtime behavior, non-RBAC security concerns (SQLi, XSS, CSRF config), infrastructure/deployment config, and third-party package internals (Fortify, Inertia core).

---

## 3. Methodology

Static analysis via direct file reads and targeted `grep` across the repository. Two parallel research passes were used:
1. Direct reading of core authorization primitives (`User` model, `Permission`/`RoleModel`, all 7 Policies, `AppServiceProvider`, all middleware, `bootstrap/app.php`, `HandleInertiaRequests`, RBAC-relevant config and seeders).
2. Delegated deep-dives for the large mechanical surfaces: a full route-by-route audit of all route files, and a frontend authorization audit. (Two additional delegated passes — controller-level enforcement and an automated permissions dead-code diff — were interrupted by an API session-limit error partway through; that ground was subsequently covered directly via targeted greps and manual verification, documented inline where used. Coverage is described honestly per section; anything not fully verified is flagged.)

No permission or role name is reported as "unused" or "orphaned" without an explicit `grep` confirming zero matches on both the seed side and the check side.

---

## 4. RBAC Architecture

### 4.1 Mechanisms in use

| Mechanism | Used? | Where |
|---|---|---|
| Spatie Permission | **No** | Not in `composer.json` |
| Custom DB-backed RBAC | **Yes** (primary mechanism) | `roles`, `permissions`, `role_user`, `permission_role` tables; `App\Models\User`, `App\Models\Permission`, `App\Modules\Platform\Infrastructure\Models\RoleModel` |
| Laravel Gates | **Yes** (hybrid) | `Gate::before()` global hook + 5 explicit `Gate::define()` composite abilities, all in `app/Providers/AppServiceProvider.php` |
| Laravel Policies | **Yes** (partial — 7 of many domain models) | `app/Policies/*.php`, registered in `AppServiceProvider::boot()` |
| Route middleware (`can:`) | **Yes** (dominant enforcement point) | ~92% of `api.php`/`billing-phase1.php` routes |
| Department-scoped custom resolver | **Yes** (inventory only) | `App\Support\Auth\DepartmentScopedPermissionResolver` / `InventoryPermission` facade |
| Hardcoded role-name checks | **Minimal** | Only in `App\Policies\PatientPolicy::isClinicalRole()` and `App\Support\Auth\ConsultationProviderAuthorization` (role-code allow/deny lists as a *fallback* to a staff-profile-based check) — **zero** instances found in any Controller across all 24 modules (confirmed via grep, see §5) |
| FormRequest-level `authorize()` | **Yes, but mostly a no-op** | Nearly every `FormRequest::authorize()` sampled returns `$this->user() !== null` — i.e. "any authenticated user." Real authorization for these endpoints lives in route middleware, not the FormRequest. This is a consistent (if confusingly named) pattern, not a per-instance bug — confirmed the corresponding routes do carry `can:` middleware in the cases checked (§10). |
| Deprecated/dead middleware | `inventory.access` (`InventoryAccessMiddleware`) | Registered as an alias in `bootstrap/app.php:46`, marked `@deprecated`, applied to **zero** routes (confirmed) |
| Multi-tenant/facility isolation | **Yes** (orthogonal to RBAC) | `EnforceTenantIsolationWhenEnabled`, `ResolvePlatformScopeContext`, `EnsureMappedFacilitySubscriptionEntitlement`, `EnsureFacilitySubscriptionEntitlement(Any)` — subscription/tenant scoping, not permission checking |

### 4.2 How the pieces fit together

1. Every route requiring authorization carries `->middleware('can:<permission.name>')`, e.g. `routes/api.php:170-171`.
2. Laravel resolves `can:` via the Gate. `Gate::before()` (`app/Providers/AppServiceProvider.php:96-108`) intercepts **every** ability check: if no explicit `Gate::define()` exists for that ability name, it falls through to `$user->hasPermissionTo($ability)`. This means **any permission name in the `permissions` table can be used directly as a Gate ability / route `can:` string with zero extra wiring** — a deliberate, low-ceremony design.
3. `User::hasPermissionTo()` (`app/Models/User.php:124-147`) checks, in order: (a) universal admin bypass, (b) direct user↔permission grant, (c) permission via any of the user's roles (`role_user` → `roles` → `permission_role` → `permissions`).
4. For 7 specific domain models (Patient, MedicalRecord, LaboratoryOrder, PharmacyOrder, RadiologyOrder, Appointment, InventoryDepartmentRequisition), a full Laravel Policy additionally encodes *state-dependent* rules (e.g. "can't verify your own lab order," "can only dispense after verification") layered on top of the base permission check.
5. Inventory department-scoped access is a **parallel, second system** (`DepartmentScopedPermissionResolver`) that adds department/facility/cross-facility scoping on top of `hasPermissionTo()` — used only for `InventoryDepartmentAccessController`.
6. The frontend receives a resolved snapshot of the user's effective permission names + role codes via Inertia shared props (`HandleInertiaRequests::share()`), computed through `EffectivePermissionNameResolver`, which also computes ~25 composite Gate-derived abilities not stored as raw DB permissions.

---

## 5. Roles Inventory

**Authoritative source:** `config/roles.php` (30 role definitions). This is the source used by the live provisioning path — the `php artisan roles:sync` command (`app/Console/Commands/SyncRolesFromConfig.php`) and migration `database/migrations/2026_07_16_000003_sync_roles_from_config.php` both read `config('roles')` directly and write role rows keyed by `code`.

⚠️ **A second, conflicting role/permission catalog exists** in `database/seeders/RoleHierarchySeeder.php` (hardcoded `DISPLAY_NAMES`, `DESCRIPTIONS`, `ROLE_META`, and a `rolePermissionProfiles()` method with its own permission lists per role code). For roles present in both files, the permission sets **materially differ** — e.g. `config/roles.php`'s `CLINICAL.GENERAL` grants `patients.read, patients.create, appointments.read, appointments.create, admissions.read, ...` (`config/roles.php:56-76`) while `RoleHierarchySeeder`'s `CLINICAL.GENERAL` profile grants a different set including `medical.records.update`, `inpatient.ward.create-round-note`, `inventory.procurement.create-request` (`database/seeders/RoleHierarchySeeder.php:770-787`) that does not appear in the config version at all. **This seeder is never invoked** — not from `DatabaseSeeder::run()` (verified — it calls 15 unrelated catalog/reference seeders, `database/seeders/DatabaseSeeder.php:24-38`), not from any Console Command, not from any other seeder (`grep -rn "RoleHierarchySeeder"` returns only its own class declaration). It is dead code today, but its divergence from `config/roles.php` makes it a latent trap for any future developer who runs `php artisan db:seed --class=RoleHierarchySeeder` expecting it to be equivalent to the config file.

Two further seeders, `InventoryAccessRolesSeeder.php` and `InventoryPermissionsSeeder.php`, are similarly **never invoked anywhere** (confirmed via grep) — superseded by `config/roles.php` + `InventoryPermissionsSeeder`'s permission list has since been folded into `RoleHierarchySeeder::ensurePermissionsExist()`, itself unused.

### 5.1 Roles table (from `config/roles.php`, the live/authoritative source)

| Config key | Code | Display name | Access level | Scope | Status |
|---|---|---|---|---|---|
| platform-super-admin | `PLATFORM.SUPER.ADMIN` | System Administrator | manage | cross_facility | Active (system) |
| platform-user-admin | `PLATFORM.USER.ADMIN` | Platform User Administrator | manage | cross_facility | Active (system) |
| platform-rbac-admin | `PLATFORM.RBAC.ADMIN` | Platform RBAC Administrator | manage | cross_facility | Active (system) |
| platform-subscription-admin | `PLATFORM.SUBSCRIPTION.ADMIN` | Subscription Administrator | manage | cross_facility | Active (system) |
| clinical-officer | `CLINICAL.GENERAL` | Clinical Officer | request | facility | Active (system) |
| medical-officer | `CLINICAL.PHYSICIAN` | Medical Officer | manage | facility | Active (system) |
| surgeon | `CLINICAL.SURGEON` | Surgeon | manage | facility | Active (system) |
| nurse-officer | `CLINICAL.NURSE` | Nurse Officer | request | facility | Active (system) |
| nurse-midwife | `CLINICAL.NURSE.MIDWIFE` | Nurse Midwife | request | facility | Active (system) |
| lab-technologist | `LAB.STAFF` | Laboratory Technologist | request | own_department | Active (system) |
| lab-supervisor | `LAB.SUPERVISOR` | Chief Laboratory Technologist | approve | own_department | Active (system) |
| lab-manager | `LAB.MANAGER` | Laboratory Manager | manage | own_department | Active (system) |
| dispenser | `PHARMACY.STAFF` | Dispenser | request | own_department | Active (system) |
| pharmacist | `PHARMACY.SUPERVISOR` | Pharmacist-in-Charge | approve | own_department | Active (system) |
| radiographer | `RADIOLOGY.STAFF` | Radiographer | request | own_department | Active (system) |
| radiographer-senior | `RADIOLOGY.SUPERVISOR` | Senior Radiographer | approve | own_department | Active (system) |
| cashier | `FINANCE.CASHIER` | Cashier | request | facility | Active (system) |
| receptionist | `ADMIN.REGISTRATION` | Health Records Officer | request | facility | Active (system) |
| hospital-admin | **`ADMIN.FACILITY`** | Hospital Administrator | manage | facility | Active (system) — **see §11, treated as universal super-admin in code, contrary to its declared facility scope** |
| nutritionist | `ALLIED.NUTRITIONIST` | Nutritionist | request | facility | Active (system) |
| counselor | `ALLIED.COUNSELOR` | Counselor | request | facility | Active (system) |
| community-health-worker | `ALLIED.COMMUNITY.HEALTH.WORKER` | Community Health Worker | view | facility | Active (system) |
| medical-attendant | `SUPPORT.MEDICAL.ATTENDANT` | Medical Attendant | view | facility | Active (system) |
| health-secretary | `SUPPORT.HEALTH.SECRETARY` | Health Secretary | view | facility | Active (system) |
| dental-officer | `CLINICAL.DENTAL.OFFICER` | Dental Officer | request | facility | Active (system) |
| emergency-nurse | `CLINICAL.EMERGENCY` | Casualty Nurse | request | facility | Active (system) |
| accountant | `FINANCE.OFFICER` | Accountant | request | facility | Active (system) |
| finance-manager | `FINANCE.CONTROLLER` | Finance Manager | manage | facility | Active (system) |
| insurance-officer | `FINANCE.CLAIMS` | Insurance Claims Officer | request | facility | Active (system) — **see §7/§13, cannot use the NHIF insurance routes it should own** |
| storekeeper | `INVENTORY.STAFF` | Storekeeper | request | own_department | Active (system) |
| senior-storekeeper | `INVENTORY.SUPERVISOR` | Senior Storekeeper | approve | own_department | Active (system) |
| procurement-officer | `INVENTORY.MANAGER` | Procurement Officer | manage | own_department | Active (system) |
| theatre-nurse | `THEATRE.STAFF` | Theatre Nurse | request | own_department | Active (system) |
| theatre-nurse-in-charge | `THEATRE.SUPERVISOR` | Theatre Nurse-in-Charge | approve | own_department | Active (system) |
| theatre-manager | `THEATRE.MANAGER` | Theatre Manager | manage | own_department | Active (system) |

(30 role definitions total in the file, each `is_system: true`, `status: active`. Per-role permission lists are extensive — full detail in `config/roles.php:1-678`; representative samples are in §7/§13.)

**Dead/superseded role catalogs** (not authoritative, never invoked, listed for completeness): `RoleHierarchySeeder` defines an overlapping but non-identical set including `ADMIN.HR`, `ADMIN.MEDICAL.RECORDS`, additional department-tier `LAB.MANAGER`/`RADIOLOGY.MANAGER`/`PHARMACY.MANAGER`/`THEATRE.MANAGER`/`INVENTORY.MANAGER` variants with different permission grants than `config/roles.php`'s equivalents.

---

## 6. Permissions Inventory

There is **no single authoritative permission catalog file** (no `config/permissions.php`). Permission strings are created as `permissions` table rows via: (a) the permission arrays embedded in each role definition in `config/roles.php`, synced via `permission_role`; (b) ~20 individual "seed a permission" migrations (e.g. `2026_04_30_000001_seed_patient_create_permission.php`, `2026_07_16_132335_insert_missing_module_access_permissions.php`); (c) dead seeders (`RoleHierarchySeeder::ensurePermissionsExist()`, `InventoryPermissionsSeeder`). `config/billing_permissions.php` is a **documentation/reference file** (an `implemented` vs. `rollout_recommended` profile list) used for planning — it is not itself a seed source and does not create permission rows.

A full literal-string extraction across `database/migrations/*.php`, `database/seeders/*.php`, and `config/roles.php` yields **~300+ distinct dot-namespaced permission strings** (exhaustive enumeration in the Appendix is impractical to guarantee complete via static grep alone — flagged as a methodology limit). The role-permission table in §5/§13 constitutes the practically-complete list of permissions that are actually reachable by a normal (non-bypass) user today, since every permission not attached to some role in `config/roles.php` is currently unobtainable outside the Critical-finding bypass.

### 6.1 Confirmed naming-inconsistency defect (module-separator drift)

`database/migrations/2026_07_23_000002_fix_clinical_procedure_orders_permission_naming.php` is a **self-documenting bugfix migration** — its own comment states: *"the previous migration seeded these with the wrong module-name separator — every enforcement call site (routes, form requests, frontend) uses the hyphenated form."* It renames `clinical_procedure.orders.read/create/update/update-status/view-audit-logs` (underscore) → `clinical-procedure.orders.*` (hyphen). This confirms that this exact class of bug — a permission seeded with one separator style while checked with another, silently making the permission unreachable for every role until a follow-up migration corrects it — has already occurred at least once in this codebase. Recommend a lint/CI check enumerating permission literals used in `can:`/`hasPermissionTo(`/`authorize(` and diffing against seeded names (see §16).

### 6.2 Confirmed orphaned permission checks (checked in code, never granted to any role)

Verified by grepping every permission literal checked via `hasPermissionTo(`, `->authorize(`/`->can(`, `Gate::allows/define(`, and route `can:` middleware against every permission literal appearing in `config/roles.php`, all `database/migrations/*.php`, and all `database/seeders/*.php`:

| Permission | Checked at | Ever granted to a role? |
|---|---|---|
| `billing.insurance.read` | `routes/billing-phase1.php:185,188,191,216,219,239,245,248,260,263` (7 routes) | **No** — absent from `config/roles.php`, all migrations, all seeders |
| `billing.insurance.manage` | `routes/billing-phase1.php:213,242,257` (3 routes) | **No** |
| `billing.payments.read` | `routes/billing-phase1.php:175,201,204,229,232,279` (6 routes) | **No** |
| `billing.service-catalog.manage` | `app/Modules/Billing/Presentation/Http/Requests/{StoreBillingServiceCatalogItemRequest,UpdateBillingServiceCatalogItemRequest,StoreBillingServiceCatalogItemRevisionRequest,UpdateBillingServiceCatalogItemStatusRequest,BulkUpdateBillingServiceCatalogItemStatusRequest,BulkSyncFromClinicalCatalogRequest}.php` (6 FormRequest `authorize()` methods) | **No** — only the granular `billing.service-catalog.manage-identity` / `.manage-pricing` variants are ever granted (e.g. `config/roles.php:629-632`) |

All four permissions are referenced only in `config/billing_permissions.php` as documentation of an "implemented"/"rollout_recommended" profile — they were evidently intended to be wired into a role at some point but never were. **Practical effect: an entire NHIF/insurance-claims billing route group (~13 routes) and 6 service-catalog write endpoints can never be used by a normal Insurance Officer or Finance Officer** — the only users who can currently pass these checks are those hitting the Critical-finding universal-admin bypass (§11). This is very likely an unintentional functional/security gap rather than a deliberate "super-admin-only" design, given the existence of a dedicated `insurance-officer` role (`FINANCE.CLAIMS`) whose entire purpose is insurance-claims processing.

### 6.3 Confirmed unused/dead permissions (seeded, never checked anywhere)

Verified via `grep` for zero matches in `app/` and `routes/`:

| Permission | Seeded at | Granted to |
|---|---|---|
| `inventory.approve-requisition-high-value` | `database/seeders/InventoryPermissionsSeeder.php:30` (dead seeder, but permission name also never checked) | Not granted to any role in `config/roles.php` |
| `inventory.manage-warehouse-all` | `InventoryPermissionsSeeder.php:35` | `RoleHierarchySeeder`'s dead `INVENTORY.MANAGER` profile only |
| `inventory.audit-view-all-items` | `InventoryPermissionsSeeder.php:46` | `RoleHierarchySeeder`'s dead `INVENTORY.MANAGER` profile only |
| `inventory.audit-view-all-requisitions` | `InventoryPermissionsSeeder.php:47` | same |
| `inventory.audit-view-all-transfers` | `InventoryPermissionsSeeder.php:48` | same |
| `inventory.dispose-items-controlled-substance` | `InventoryPermissionsSeeder.php:43` | `RoleHierarchySeeder`'s dead `PHARMACY.MANAGER` profile only |

These read as aspirational/planned permissions from the Phase-1/2 inventory RBAC effort that were never wired to an enforcement point. Low risk (they fail closed — nobody can be authorized *by* them because nothing checks them — but they add catalog noise and false confidence that these controls exist).

---

## 7. Authorization Enforcement Matrix

### 7.1 Module-by-module summary

Controller inventory and presence of in-controller authorization calls (`authorize(`, `Gate::`, `hasPermissionTo(`, `->can(`), confirmed via grep across every `*Controller.php` under `app/Modules/*/Presentation`:

| Module | Controllers | With explicit in-controller authz call | Dominant pattern |
|---|---|---|---|
| Billing | 24 | 2 | Route-level `can:` (mostly); **2 write-endpoint groups have no check anywhere — §7.3** |
| Platform | 13 | 2 | Route-level `can:` (see full route breakdown, §10) |
| Staff | 8 | 1 | Route-level `can:`; **one action (privilege-grant status) has no check anywhere — §7.3** |
| InventoryProcurement | 10 | 1 | Route-level `can:` + `DepartmentScopedPermissionResolver` for department-scoped endpoints |
| Encounter | 4 | 0 | Route-level `can:` mostly; two status-transition endpoints are ownership-gated only, not permission-gated (§7.3) |
| MedicalRecord | 2 | 2 | Explicit `Gate::authorize()` against `MedicalRecordPolicy` (correct pattern, contrasted with ClinicalProcedure below) |
| ClaimsInsurance | 2 | 0 | Route-level `can:` |
| InpatientWard | 2 | 0 | Route-level `can:` |
| Patient | 2 | 1 | Route-level `can:patient.demographics.update` **plus** explicit `Gate::authorize('updateDemographics', ...)` against `PatientPolicy` — genuine, correct defense-in-depth layering (`app/Modules/Patient/.../PatientController.php:230`) |
| Pos | 3 | 0 | Route-level `can:` |
| Admission, Appointment*, Authentication, ClinicalProcedure*, Department, EmergencyTriage, Laboratory, Notifications, PatientFlow, PatientVitals*, Pharmacy*, Radiology*, Reception, ServiceRequest, TheatreProcedure* | 1 each | 0–1 each | Route-level `can:`; starred modules (Appointment, ClinicalProcedure, PatientVitals, Pharmacy, Radiology, TheatreProcedure) additionally call `Gate::any([...])` or `Gate::authorize()` inline for one or more actions |

**Zero controllers, across all 24 modules, contain hardcoded role-code branching** (`roleCodes()`/`in_array(..., ['ADMIN...'])` inside a Controller) — confirmed via grep. Role-code-based logic is confined to two places: `PatientPolicy::isClinicalRole()` (a legitimate, narrow exception list used only to decide *which additional ownership check* applies, not to grant/deny outright) and `ConsultationProviderAuthorization` (role-code allow/deny lists used only as a *fallback* when a staff-profile job-title lookup is unavailable). This is a positive finding — permission-string checks are the norm, not scattered ad-hoc role checks.

### 7.2 Policy invocation consistency

7 Policies are registered (`AppServiceProvider.php:84-90`): `PatientPolicy`, `MedicalRecordPolicy`, `LaboratoryOrderPolicy`, `PharmacyOrderPolicy`, `RadiologyOrderPolicy`, `AppointmentPolicy`, `InventoryPolicy`.

- **`InventoryPolicy` is dead code.** It is registered against `InventoryDepartmentRequisitionModel`, but `grep -rn "InventoryPolicy\b" app/` finds only the registration line itself — nothing ever calls `Gate::authorize()`/`$user->can()` against its abilities (`createRequisition`, `approveRequisition`, `viewRequisition`). The live enforcement path for inventory requisitions is the separate `DepartmentScopedPermissionResolver` class, which duplicates similar department-scoping logic. Two parallel, non-integrated inventory authorization systems exist; one (`InventoryPolicy`) is unused.
- **Broken post-write authorization in `ClinicalProcedureOrderController::updateStatus`** (`app/Modules/ClinicalProcedure/Presentation/Http/Controllers/ClinicalProcedureOrderController.php:194`): calls `Gate::authorize('perform', $order)` **after** the status-change use case has already executed and committed. No `Gate::policy()` is registered for `ClinicalProcedureOrderModel`, and no `Gate::define('perform', ...)` exists — so this ability can never resolve to `true` for anyone, and the call unconditionally throws `AuthorizationException` *after the write already happened*. Because the route itself is separately, correctly protected by `->middleware('can:clinical-procedure.perform')` (`routes/api.php:1424-1426`), this is not an actual authorization bypass — it is dead/misleading code that produces a spurious 403 on every legitimate call. The developer explicitly flagged this exact anti-pattern elsewhere (comment "*A post-write `Gate::authorize('updateDraft', $record)` is wrong here*" — `app/Modules/MedicalRecord/.../MedicalRecordController.php:175`) and avoided it correctly for `RadiologyOrderController::perform` (`RadiologyOrderPolicy::perform()` is a real, registered policy method) — the Clinical Procedure controller was evidently copy-pasted from the Radiology pattern without registering the corresponding policy.

### 7.3 Missing authorization — confirmed gaps (route + controller + use case, no check anywhere)

| Endpoint | File:line | What's missing |
|---|---|---|
| `PATCH billing/{id}/status` | `routes/api.php:1028-1030` → `BillingInvoiceController::updateStatus` → `UpdateBillingInvoiceStatusUseCase.php` | No `can:` middleware, no in-controller check, no use-case check. Any authenticated user can transition an invoice's status (e.g. void/cancel). Sibling actions on the same controller (`update`, `record-payment`, `reverse-payment`) are all correctly gated. |
| `POST/PATCH billing-service-catalog/*` (store, revisions, bulk-status, bulk-sync, update, update-status) | `routes/api.php:1199-1212` → `BillingServiceCatalogController` → 6 Use Cases | No `can:` middleware; the FormRequest `authorize()` checks the orphaned `billing.service-catalog.manage` permission (§6.2), which is granted to nobody — so in practice this endpoint is either permanently broken for real staff, or (should that check ever be "fixed" to `return true` without also seeding the permission) wide open to any authenticated user. |
| `PATCH staff/{id}/privileges/{privilegeId}/status` | `routes/api.php:2184-2186` → `StaffPrivilegeGrantController::updateStatus` → `UpdateStaffPrivilegeGrantStatusUseCase.php` | No permission check anywhere — only a state-machine validity check and a credentialing-readiness check. This endpoint activates/suspends a clinician's practicing privileges; any authenticated user can currently drive that transition. |

### 7.4 Ownership-only gates (no permission floor) — medium severity

`medical-records/{id}/status` (`routes/api.php:859`) and `encounters/{id}/status` (`routes/api.php:899`) carry no `can:` middleware; the underlying use cases (`AcceptMedicalRecordHandoffUseCase`, `UpdateEncounterStatusUseCase`) instead check that the caller is the recorded consultation owner or handoff recipient (with an `isFacilitySuperAdmin` bypass). This means a user with **zero** clinical permissions who happens to be recorded as the consultation owner can still transition status — the check is identity-based, not capability-based. Lower severity than §7.3 because it does require a specific prior data relationship, not "any authenticated user."

### 7.5 Console commands / jobs

No `app/Console/Commands/*.php` file contains any authorization check (confirmed via grep for `hasPermissionTo`/`authorize(`/`Gate::`). This is standard and acceptable for CLI tooling that requires server/shell access to invoke — it is not a web-exposed attack surface. `SyncRolesFromConfig` (`roles:sync`) and the inventory backfill/reconciliation commands should nonetheless be restricted to trusted deployment/ops accounts by infrastructure controls (not verified — outside this audit's scope).

---

## 8. Route Protection Audit

*(Full detail from the dedicated route audit; console.php confirmed to contain zero `Route::` definitions — 20 `Artisan::command()` + 7 `Schedule::` entries only, i.e. no HTTP surface.)*

### 8.1 Route counts

| File | HTTP routes | Outer middleware |
|---|---|---|
| `routes/api.php` | 724 | `['web','auth', ResolvePlatformScopeContext::class, EnforceTenantIsolationWhenEnabled::class, EnsureMappedFacilitySubscriptionEntitlement::class]` (`api.php:65`), plus a small `['agent.token']` group (2 routes, static-secret device auth, `api.php:2274-2279`) |
| `routes/web.php` | 142 | `['user.has-role']` (`web.php:45`) wraps almost everything; each route additionally layers `auth`/`verified`/`can:`/`facility.entitlement*` |
| `routes/billing-phase1.php` | 67 | Same 5-middleware stack as `api.php` (`billing-phase1.php:17`), loaded via `Billing`'s own service provider, not `bootstrap/app.php` |
| `routes/settings.php` | 8 | `auth` / `auth+verified` |
| `routes/channels.php` | 4 broadcast channels | Per-channel authorizer callbacks |
| `routes/console.php` | 0 (CLI-only) | n/a |
| **Total HTTP routes** | **941** | |

Largest `api.php` path groups: `platform/*` (185 routes), `inventory-procurement/*` (92), `staff/*` (51), `patients/*` (29), `appointments/*` / `inpatient-ward/*` (27 each), `pos/*` (25), `billing/*` (24), `pharmacy-orders/*` (23), `billing-payer-contracts/*` / `theatre-procedures/*` (21 each), `laboratory-orders` (18).

### 8.2 Public routes (no auth middleware)

Only 6 across all files, **all legitimate**: `branding/logo`, `branding/icon`, `auth/csrf-token` (web), `/` (welcome page), `v1/auth/csrf-token` (api, rate-limited 30/min), and Laravel's default `/up` health probe. No unintended public route was found.

### 8.3 Coverage

- `api.php`: 667 of 724 routes carry explicit `can:X`; `billing-phase1.php`: all 67 do. The remaining 57 `api.php` routes are auth-only at the route level — of these, the majority delegate to an in-controller `Gate::any()`, ownership check, or `DepartmentScopedPermissionResolver` call (verified per-route, §7.4/§8.4); a small number are genuine gaps already listed in §7.3.
- `web.php`: ~119 of 142 routes carry `auth, verified, can:X` (plus the blanket outer `user.has-role`); 19 internal documentation/markdown-contract pages carry `auth, verified` only, no `can:` — low sensitivity (no PHI), but inconsistent with the rest of the file's convention.
- `inventory.access` middleware: confirmed applied to **zero** routes (dead, consistent with its `@deprecated` comment in `bootstrap/app.php:46`).

### 8.4 Auth-only routes verified safe by deeper mechanisms

`dashboard/context`, `auth/me*`, `notifications/*` (self-scoped to the requester); `patient-vitals/*`, `theatre-procedures/clinician-directory|room-registry` (inline `Gate::any([...])`); `inventory-department/*` (9 routes, `DepartmentScopedPermissionResolver::hasPermissionInDepartment()` per action); `platform/audit-export-jobs/health*` (per-module `$user->can()` self-filtering). Lower-sensitivity auth-only reads with genuinely no permission check: `platform/access-scope`, `platform/country-profile`, `platform/feature-flags*`, `platform/operational-flags`, clinical-catalog listing endpoints — open to any authenticated user, low impact (reference/config data, not PHI or financial writes).

### 8.5 Broadcast channels (`routes/channels.php`) — all correctly scoped

| Channel | Check |
|---|---|
| `App.Models.User.{id}` | `(int)$user->id === (int)$id` |
| `patient-flow.{facilityId}` | `PatientFlowBoardChannelAuthorizer`: `appointments.read` permission → super-admin bypass → `facility_user` active-membership check |
| `notifications.{userId}` | `$user->id === $userId` |
| `billing-queue.{facilityId}` | `BillingQueueChannelAuthorizer`: identical pattern, `billing.invoices.read` |

No gaps found in broadcast channel authorization.

---

## 9. Frontend Authorization Audit

**Shared auth context** (`app/Http/Middleware/HandleInertiaRequests.php:53-60`): every Inertia page load receives `auth.user`, `auth.permissions` (via `EffectivePermissionNameResolver`, which folds in ~25 composite Gate-derived abilities alongside raw DB grants — `app/Support/Auth/EffectivePermissionNameResolver.php:13-43`), `auth.roleCodes`, `auth.isFacilitySuperAdmin`, `auth.isPlatformSuperAdmin`, `auth.hasFacilityAssignments`.

**Centralized composable:** `resources/js/composables/usePlatformAccess.ts` wraps these props (`hasPermission()`, `permissionState()`, `hasFacilityEntitlement()`) and is used by **93 files** — this is a real, systemic frontend authorization layer, not scattered ad-hoc checks.

**Navigation filtering:** `AppSidebar.vue` combines a static nav catalog with a server-built `moduleNavCatalog` and filters via `resources/js/lib/routeAccess.ts`, which maintains a **hand-written mirror** of backend route permission requirements (`routeAccessRules`, ~50 entries) for hiding sidebar/search/command-palette items. This table is a manually-synced duplicate of route middleware with no automated check that it stays accurate — a drift risk, though the impact of drift is limited to nav *visibility*, since the backend `can:` middleware remains the real gate. Spot-checked entries matched their corresponding route middleware.

**No client-side route guard exists** — only nav-item hiding. Direct URL navigation to a hidden page is not blocked client-side; the backend route middleware is the actual control (confirmed present for the sampled routes).

**Action-button gating — inconsistent by page generation:**
- Newer/"V2" pages (`billing/IndexV2.vue`, `billing/CashV2.vue`, `pharmacy-orders/IndexV2.vue`, `platform/admin/roles/Index.vue`, `platform/admin/users/IndexV2.vue`) consistently gate write/approve/void actions with `hasPermission()`/`permissionState()` per action.
- **Legacy, still-routed pages have no client-side gating at all**: `billing/Refunds.vue`, `billing/DailyClose.vue`, `billing/WriteOffs.vue`, `billing/Cash.vue` render "New refund" / "Close day" / "New write-off" / "New account" buttons unconditionally, with zero `usePlatformAccess` usage. Confirmed the backend does enforce a distinct, finer-grained write permission for at least one of these (`billing.refunds.create` vs. the page's own read-gate `billing.refunds.read`, `routes/billing-phase1.php:93-95` vs. `routes/web.php:372-374`) — so a read-only user sees a fully clickable "New refund" button and only discovers denial on submit. This is a UX/defense-in-depth gap, not a security hole (assuming backend enforcement holds), but it is a real, verifiable client/server mismatch.

**Permission snapshot staleness:** the primary mechanism (static Inertia shared props) is recomputed only on full page navigation — an admin revoking a role mid-session does not update an already-open tab's permission set until the next navigation. A separate live-fetch endpoint (`GET /auth/me/permissions`, 5-minute cache via TanStack Query) exists but is used in only two places (`encounters/WorkspaceV2.vue`, `useEncounterOrdering.ts`).

---

## 10. Data Access Audit (by domain area)

| Domain | Primary enforcement mechanism | Notable gap |
|---|---|---|
| Patients | `patients.read`/`patients.create`/`patient.demographics.update` route + `PatientPolicy` (clinical-ownership rule for demographic updates) | None found |
| Billing (invoices, payments, service catalog) | `billing.invoices.*`, `billing.payments.*`, `billing.service-catalog.*` route `can:` | **Invoice status transitions and service-catalog writes have no check at all — §7.3** |
| Billing (NHIF/insurance claims) | `billing.insurance.read/manage`, `billing.payments.read` route `can:` | **These permissions are granted to no role — §6.2; feature is effectively inaccessible to its intended owner (Insurance Officer)** |
| Laboratory | `LaboratoryOrderPolicy` (state-machine-aware: sample collection → test → result entry → verify → release), `lab.*` permissions | Verifier-is-not-orderer check present and correct (`LaboratoryOrderPolicy::verifyResult`) |
| Pharmacy | `PharmacyOrderPolicy` (verified-before-dispense, cannot dispense/cancel already-dispensed orders), `medication.*`/`dispense.*` permissions | None found |
| Radiology | `RadiologyOrderPolicy` (orderer-cannot-verify-own-order), `imaging.*` permissions | None found |
| Inventory/Procurement | `DepartmentScopedPermissionResolver` (own_department / related_departments / facility / cross_facility scope tiers) layered on `hasPermissionTo()` | `InventoryPolicy` (the "official" Gate policy) is dead code, superseded in practice by the resolver — confusing but not a gap since the resolver is the live path |
| Appointments | `AppointmentPolicy` (status-aware reschedule/cancel/check-in/check-out), `ConsultationProviderAuthorization` (job-title/role-code based provider-session gate) | None found |
| Staff/HR | `staff.*` permissions, `ADMIN.HR` role | **Privilege-grant status transitions unauthorized — §7.3** |
| Reports/Cross-tenant Administration | `platform.cross-tenant.*`, `platform.rbac.*` permissions, all route-gated | Read-only feature-flag/config endpoints open to any authenticated user (low sensitivity) |

Multi-tenant/multi-facility data isolation itself (row-level `tenant_id`/`facility_id` scoping in queries) was **not exhaustively verified** for every module — this audit focused on permission/role gating, not query-level tenant isolation, which is a distinct concern partially covered by `EnforceTenantIsolationWhenEnabled` middleware (present in the `api.php` outer group) and `CurrentPlatformScopeContextInterface` scope-matching used in a few policies (`MedicalRecordPolicy::matchesScope`).

---

## 11. Super Admin Audit — Critical Finding

`App\Models\User::hasUniversalAdminAccess()` (`app/Models/User.php:240-243`) is the single choke point that every permission check ultimately passes through (`hasPermissionTo()` line 126: `if ($this->hasUniversalAdminAccess()) return true;`, and `permissionNames()` line 164: returns *every* permission in the database). It is `true` if **either**:

1. **`isPlatformSuperAdmin()`** (`User.php:245-269`) — `is_platform_admin` flag, or an **active** role with code `PLATFORM.SUPER.ADMIN`/`SYSTEM.SUPER.ADMIN` (both code paths through this method explicitly filter `where('status', 'active')` or check `$status === 'active'`). This is correctly scoped.
2. **`isFacilitySuperAdmin()`** (`User.php:271-280`):
   ```php
   private function isFacilitySuperAdmin(): bool
   {
       try {
           return $this->roles()->where('code', 'ADMIN.FACILITY')->exists();
       } catch (QueryException) { return false; }
   }
   ```
   **This query has no `status`, `revoked_at`, or `effective_until` filter at all.** Contrast directly with `isPlatformSuperAdmin()`'s DB-query fallback three lines above it in the same file, which does filter `->where('status', 'active')`.

### Why this is Critical

- `ADMIN.FACILITY` ("Hospital Administrator") is defined in `config/roles.php:363-390` as a **facility-scoped** role (`scope_type: facility`) with a specific, bounded permission list of ~40 named permissions for facility administration — patients, appointments, staff, departments, catalogs, and *facility-scoped* platform-user management. It is explicitly **not** described or intended as a cross-tenant, all-permissions role.
- Yet any user holding this role — **even if the role row's `status` has been set to anything other than `active`, or `revoked_at` has been set, or `effective_until` has passed** — is treated by `hasUniversalAdminAccess()` identically to a platform-wide `PLATFORM.SUPER.ADMIN`: every `hasPermissionTo()` call returns `true`, `permissionNames()` returns the entire permission catalog, and every Policy that checks `isFacilitySuperAdminAccess()`/`hasUniversalAdminAccess()` (Patient, MedicalRecord, and the `Gate::before()`-driven composite abilities in `AppServiceProvider`) is bypassed outright.
- **The mitigating middleware does not cover this.** `EnsureUserHasActiveRole` (`app/Http/Middleware/EnsureUserHasActiveRole.php`) — the one place in the codebase that checks "does this user have at least one *active* role" — explicitly exempts only `isPlatformSuperAdminAccess()` from its active-role requirement, not `isFacilitySuperAdminAccess()`. So in principle a revoked-`ADMIN.FACILITY` user *would* get redirected to `pending-setup` by this middleware if it applied everywhere.
- **But it doesn't apply everywhere.** The `user.has-role` middleware alias (`EnsureUserHasActiveRole`) is only attached to the outer group in `routes/web.php:45`. It is **confirmed absent** from the outer middleware group in both `routes/api.php:65` and `routes/billing-phase1.php:17` (`['web','auth', ResolvePlatformScopeContext::class, EnforceTenantIsolationWhenEnabled::class, EnsureMappedFacilitySubscriptionEntitlement::class]` — no `user.has-role`). Since **724 of the system's 941 routes live in `api.php`** (plus 67 more in `billing-phase1.php`), the active-role gate simply does not run for the vast majority of the application's HTTP surface.

### Net effect

A user whose *only* role assignment is a stale, deactivated, or time-expired `ADMIN.FACILITY` grant retains **permanent, unconditional, cross-tenant super-admin access to ~84% of the application's routes** (everything under `api.php`/`billing-phase1.php`), with no active-status check anywhere in that call path. This is functionally indistinguishable from a permanent backdoor for any account that was ever granted the (extremely common, facility-level) Hospital Administrator role and later had it revoked through normal offboarding — the revocation does not revoke the bypass.

**This is the single highest-priority fix in this audit.**

---

## 12. Role Assignment Flow

1. **Registration**: `Laravel\Fortify` + `App\Actions\Fortify\CreateNewUser::create()` (`app/Actions/Fortify/CreateNewUser.php:20-32`) creates a bare `User` row with **no role and no permissions** assigned.
2. **Gate to app access**: `EnsureUserHasActiveRole` (web routes only, §11) checks for at least one active role; if the user's email is verified and they have none, they are redirected to a `pending-setup` page instead of the app shell.
3. **Provisioning role rows**: Role rows themselves (one per tenant/facility/department combination per `config/roles.php` entry) are created/kept in sync by running `php artisan roles:sync` (`SyncRolesFromConfig`), which loops every facility and role definition and upserts into `roles` + `permission_role` (confirmed this is idempotent and config-driven — `app/Console/Commands/SyncRolesFromConfig.php:15-61`). This is a manually/deployment-triggered command, not something that runs automatically on every deploy or `db:seed` (verified: not present in any `composer.json` script hook or `DatabaseSeeder`).
4. **Assigning a role to a user**: An operator holding `platform.rbac.manage-user-roles` calls `PATCH platform/admin/users/{userId}/roles` (`routes/api.php:215-217`, `PlatformRbacController::syncUserRoles`) or the bulk variant (`platform.rbac.manage-user-roles`, `api.php:188-190`). Creating the user account itself requires `platform.users.create` (`api.php:176-178`, `PlatformUserAdminController::store`) and can optionally set initial `roleIds` in the same request (`StorePlatformUserRequest.php:22-23` requires at least one role ID).
5. **Facility assignment** (separate from role assignment) is via `platform.users.manage-facilities` (`api.php:200-202`), governing `facility_user` pivot membership — this also gates broadcast-channel access (§8.5) independent of RBAC permissions.
6. **Defense-in-depth**: `config/platform_user_admin.php`'s `privileged_change_controls` requires an `approvalCaseReference` for a specific list of sensitive permission-driven actions (`platform.rbac.manage-roles`, `platform.rbac.manage-user-roles`, `platform.users.update-status`, `platform.users.manage-facilities`, `platform.users.reset-password`, `platform.feature-flag-overrides.manage`, and anything prefixed `platform.cross-tenant.`) — a genuine secondary control layered on top of the base permission check. This is a positive architectural finding.

No self-service role escalation path was found — every role/permission mutation endpoint sampled requires a distinct `platform.rbac.*`/`platform.users.*` permission (subject to the Critical §11 bypass, which supersedes all of this).

---

## 13. Permission Assignment Flow

- Permissions attach to roles via `permission_role` (many-to-many). Users inherit permissions transitively through `role_user` → `roles` → `permission_role` → `permissions` (`User::hasPermissionTo()`, `app/Models/User.php:140-146`).
- **Direct user-level grants** are also supported (`User::permissions()` belongs-to-many, `User::givePermissionTo()`, `app/Models/User.php:79-82,149-157`) — this method exists on the model but was **not observed being called from any controller/use-case** in the areas read; it appears to be an available-but-rarely/never-exercised code path today (not exhaustively verified across all 24 modules).
- **Changing a role's permission set**: `PATCH platform/admin/roles/{id}/permissions` (`routes/api.php:167-169`, gated `can:platform.rbac.manage-roles`) → `PlatformRbacController::syncRolePermissions` → validated by `SyncPlatformRolePermissionsRequest`, which requires every submitted permission name to already `exist:permissions,name` (`app/Modules/Platform/.../SyncPlatformRolePermissionsRequest.php:20-21`) — this prevents an admin from typo-ing a brand-new nonexistent permission string through the UI, though it does nothing to catch the naming-drift class of bug in §6.1 (which originates in migrations, not this endpoint).
- **No permission-inheritance hierarchy** beyond the flat role→permission model exists, except: (a) the department-scoping dimension layered on top for inventory (`own_department` / `related_departments` / `facility` / `cross_facility` `scope_type`, resolved by `DepartmentScopedPermissionResolver`), and (b) the universal-admin bypass (§11), which is effectively "inherits everything."
- `EffectivePermissionNameResolver` (§9) additionally computes ~25 **composite** abilities purely at read time for the frontend (never stored as grants) by evaluating `Gate::allows()` for things like `appointments.start-consultation`, `lab.result.verify`, `medication.dispense` — these resolve through the underlying real permissions plus role-specific composite logic (e.g. `ConsultationProviderAuthorization`), so they are a derived view, not a separate assignable unit.

---

## 14. Dead Code Analysis

| Item | File | Status |
|---|---|---|
| `InventoryAccessMiddleware` (`inventory.access` alias) | `app/Http/Middleware/InventoryAccessMiddleware.php`, aliased `bootstrap/app.php:46` | Confirmed applied to zero routes; explicitly marked `@deprecated` in its own alias comment |
| `InventoryPolicy` | `app/Policies/InventoryPolicy.php`, registered `AppServiceProvider.php:90` | Registered but never invoked (§7.2) — superseded by `DepartmentScopedPermissionResolver` |
| `RoleHierarchySeeder` | `database/seeders/RoleHierarchySeeder.php` | Never invoked anywhere; contains a divergent, conflicting role/permission catalog vs. `config/roles.php` (§5) |
| `InventoryAccessRolesSeeder` | `database/seeders/InventoryAccessRolesSeeder.php` | Never invoked anywhere |
| `InventoryPermissionsSeeder` | `database/seeders/InventoryPermissionsSeeder.php` | Never invoked anywhere; the 6 permissions it defines that are also never *checked* anywhere are listed in §6.3 |
| 6 specific permissions (`inventory.approve-requisition-high-value`, `.manage-warehouse-all`, `.audit-view-all-items`, `.audit-view-all-requisitions`, `.audit-view-all-transfers`, `.dispose-items-controlled-substance`) | Various | Seeded (via dead seeders and/or `config/roles.php`-adjacent sources) but never checked by any route/controller |
| `ClinicalProcedureOrderController::updateStatus`'s post-write `Gate::authorize('perform', ...)` call | `app/Modules/ClinicalProcedure/.../ClinicalProcedureOrderController.php:194` | Effectively dead — can never resolve `true`, always throws after the write; functionally redundant since the route already enforces the equivalent permission |

---

## 15. Security Findings (ranked)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | **Critical** | `User::isFacilitySuperAdmin()` grants universal permission bypass for any (including revoked/inactive/expired) `ADMIN.FACILITY` role, and the one middleware that could catch inactive roles (`EnsureUserHasActiveRole`) is not applied to `api.php`/`billing-phase1.php` (791 of 941 routes) | `app/Models/User.php:271-280`, `bootstrap/app.php:46-47`, `routes/api.php:65`, `routes/billing-phase1.php:17`, `routes/web.php:45` |
| 2 | High | `PATCH billing/{id}/status` — no authorization check anywhere; any authenticated user can transition invoice status | `routes/api.php:1028-1030` |
| 3 | High | Billing service-catalog create/update/publish endpoints — no `can:` middleware; FormRequest checks an orphaned, never-granted permission | `routes/api.php:1199-1212`, §6.2 |
| 4 | High | `PATCH staff/{id}/privileges/{privilegeId}/status` — no authorization check anywhere; governs clinical privilege activation | `routes/api.php:2184-2186` |
| 5 | High | Two divergent role/permission catalogs (`config/roles.php` vs. `RoleHierarchySeeder`) for overlapping role codes — latent trap if the dead seeder is ever run | §5 |
| 6 | High | `billing.insurance.read/.manage`, `billing.payments.read` gate 13 live NHIF routes but are granted to no role — intended-owner role (`FINANCE.CLAIMS`) cannot use them | §6.2 |
| 7 | Medium | `medical-records/{id}/status`, `encounters/{id}/status` — ownership-only, no permission floor | §7.4 |
| 8 | Medium | Broken post-write `Gate::authorize('perform', ...)` in Clinical Procedure — dead code, spurious 403, not exploitable but indicates copy-paste risk in the authorization pattern | §7.2 |
| 9 | Medium | Legacy billing pages (Refunds/DailyClose/WriteOffs/Cash) render write-action buttons with zero client-side permission gating | §9 |
| 10 | Low | Platform feature-flag/config/catalog read endpoints open to any authenticated user | §8.4 |
| 11 | Low | 19 `web.php` documentation routes lack `can:` (auth+verified only) — low sensitivity | §8.3 |
| 12 | Low | `inventory.access` middleware and `InventoryPolicy` Gate policy are dead code — maintenance/confusion risk | §14 |
| 13 | Low | Naming-drift class of bug (dot vs. underscore vs. hyphen in permission names) has already caused one production defect; no CI guard exists to catch a recurrence | §6.1 |

No evidence of: SQL-injectable authorization logic, direct unauthenticated model access to PHI, or a working privilege-escalation *self-service* path (a normal user cannot grant themselves permissions) — the Critical finding is a bypass condition triggered by role lifecycle mismanagement (failing to fully revoke/delete a stale `ADMIN.FACILITY` assignment), not a directly user-triggerable escalation.

---

## 16. Architecture Evaluation

- **Maintainability**: Mixed. The `can:<permission>` + `Gate::before()` convention is simple and consistent, and the 93-file frontend composable pattern is a genuine maintainability win. Against that: two competing role/permission catalogs (§5), a documentation-only config file (`billing_permissions.php`) that looks like a seed source but isn't, and no single canonical permission enumeration make it easy for a permission to be checked without ever being seeded (§6.1, §6.2) — this has already happened at least twice (the clinical-procedure rename fix, and the insurance/service-catalog orphans found in this audit).
- **Scalability**: The department/facility/tenant scoping model (`scope_type`: `own_department`/`related_departments`/`facility`/`cross_facility`) is a reasonable design for a multi-facility deployment, though it is currently implemented twice for inventory (`InventoryPolicy` dead, `DepartmentScopedPermissionResolver` live) rather than once.
- **Consistency**: Route-level `can:` middleware is applied consistently (~92%+ coverage) across the two largest route files; the handful of gaps found are exceptions, not the pattern. Controller-level authorization patterns are also broadly consistent (defense-in-depth `Gate::authorize()` only where genuinely needed, e.g. `PatientPolicy`/`MedicalRecordPolicy`) — apart from the one broken copy-paste in Clinical Procedure.
- **Separation of concerns**: Good — Policies encapsulate state-dependent business rules, permission strings encapsulate coarse-grained capability, and the department resolver encapsulates a distinct scoping dimension. The exception is the `ADMIN.FACILITY`/super-admin bypass logic, which is scattered across `User`, `AppServiceProvider`, and individual Policies via `isFacilitySuperAdminAccess()`/`hasUniversalAdminAccess()` checks rather than centralized in one place — this scattering is part of why the status-check omission (§11) is easy to miss.
- **Laravel best practices**: Largely idiomatic (Gates, Policies, FormRequests, route middleware). The `Gate::before()` "any permission name is automatically a valid ability" pattern is a deliberate but somewhat unusual choice — it trades a small amount of "what abilities exist" discoverability for reduced boilerplate; that tradeoff is reasonable here given the scale (~300+ permissions) and is not itself a defect.
- **Principle of Least Privilege**: **Undermined at the top by the Critical finding** — no facility-scoped role should ever be able to obtain cross-tenant/all-permission access, by design or by defect. Everywhere else, per-role permission lists are deliberately narrow and well-matched to job function (§5 table).
- **Defense in Depth**: Present and genuine in several places — the approval-case requirement for sensitive RBAC actions (§12), the layered Policy-on-top-of-permission pattern for Patient/MedicalRecord, and the broadcast-channel authorizer pattern. Undermined by the legacy-page frontend gaps (§9) and by the complete absence of any check at all (not even a weaker one) for the three §7.3 endpoints.

---

## 17. Recommendations

| Priority | Problem | Evidence | Risk | Recommended solution | Effort |
|---|---|---|---|---|---|
| **Critical** | `isFacilitySuperAdmin()` bypasses all permission checks for any `ADMIN.FACILITY` role regardless of status/expiry, and the one active-role gate that exists isn't applied to `api.php` | `User.php:271-280`; `routes/api.php:65` | Permanent, silent super-admin access surviving role revocation, across ~84% of routes | (1) Add `->where('status','active')->where(fn expiry/revoked_at checks)` to `isFacilitySuperAdmin()`, matching `isPlatformSuperAdmin()`'s pattern. (2) Apply an active-role check to the `api.php`/`billing-phase1.php` outer middleware group, not just `web.php`. (3) Audit whether `ADMIN.FACILITY` should ever imply universal bypass at all — consider replacing this shortcut with the role's actual (already-defined) permission list plus explicit facility-scoped elevated checks where truly needed. | Medium (1 model method + 1 middleware group change + regression testing across every permission-gated route) |
| High | Three endpoints have no authorization anywhere (invoice status, service-catalog writes, privilege-grant status) | §7.3 | Any authenticated user can perform a financially/clinically sensitive write | Add `can:` middleware matching the sibling endpoints' convention on each route (e.g. `billing.invoices.void`/appropriate status permission, `billing.service-catalog.manage-*`, `staff.privileges.update-status` or similar) and seed that permission to the correct roles | Low (route-file edits + 1 migration to seed missing grants) |
| High | Two conflicting role/permission catalogs exist (`config/roles.php` vs. dead `RoleHierarchySeeder`) | §5 | Any future accidental invocation of the seeder silently overwrites production role permissions with a different, undocumented set | Delete `RoleHierarchySeeder.php`, `InventoryAccessRolesSeeder.php`, `InventoryPermissionsSeeder.php` (confirmed unreferenced), or if any historical value is needed, move to a clearly-marked `_archive`/documentation location outside the autoloaded seeders path | Low |
| High | `billing.insurance.*`/`billing.payments.read` gate live routes but are granted to no role | §6.2 | Insurance/claims workflow is unusable by its intended role; only reachable via the Critical-finding bypass today | Seed these permissions to `FINANCE.CLAIMS` (and `FINANCE.OFFICER` where appropriate) in `config/roles.php` + run `roles:sync` | Low |
| Medium | Ownership-only gates on medical-record/encounter status transitions | §7.4 | A zero-permission user who happens to be recorded as owner can still transition clinical state | Add a baseline permission check (e.g. require `medical.records.update` or equivalent) in addition to the existing ownership check | Low |
| Medium | Broken post-write `Gate::authorize()` call in Clinical Procedure controller | §7.2 | Every legitimate call gets a spurious 403 after the write already committed; masks that no real policy exists | Either register a `ClinicalProcedureOrderPolicy`/`Gate::define('perform', ...)` matching `RadiologyOrderPolicy::perform()`'s pattern, or remove the redundant post-write call entirely since the route already enforces `can:clinical-procedure.perform` | Low |
| Medium | Legacy billing pages have no client-side permission gating on write actions | §9 | UX confusion (clickable buttons that 403 on submit); defense-in-depth gap | Apply the same `usePlatformAccess`/`hasPermission()` pattern already used in the V2 equivalents of these pages | Low–Medium (4 Vue files) |
| Low | No CI/lint check diffing permission literals used in code against seeded permission names | §6.1 | This exact bug class has already shipped once (clinical-procedure naming) | Add a small Artisan command or test that greps all `can:`/`hasPermissionTo(`/`authorize(` literals and asserts each exists in the `permissions` table (or a static allow-list for Gate-only composite abilities) | Low–Medium |
| Low | `inventory.access` middleware and `InventoryPolicy` are dead code | §14 | Maintenance confusion; a future developer may wire something to the wrong (dead) mechanism | Delete both, or replace `InventoryPolicy`'s logic into `DepartmentScopedPermissionResolver` if any of its rules (e.g. controlled-substance approval) aren't already covered there | Low |
| Low | Platform feature-flag/config read endpoints open to any authenticated user | §8.4 | Minor information exposure (feature flags, config) to any logged-in user regardless of role | Add a low-bar `can:platform.*.read`-style gate if this data shouldn't be universally visible; otherwise document as an intentional exception | Low |

---

## 18. Overall Risk Rating: **HIGH**

Driven almost entirely by the single Critical finding (§11/§15#1), which converts routine role-lifecycle hygiene (failing to hard-delete, rather than soft-revoke, a facility administrator's role assignment) into a permanent, undetectable, cross-tenant super-admin condition across the majority of the application's HTTP surface. Absent that one defect, the system's authorization posture would rate **Medium** — a handful of real gaps (§15 #2–4, #6) alongside a generally consistent, well-namespaced, defense-in-depth-aware design.

**Immediate action recommended**: patch `isFacilitySuperAdmin()`'s status check and extend the active-role gate to `api.php`/`billing-phase1.php` before any other item on this list.

---

## Appendix

### A. Roles table
See §5.1 (full 30-role table from `config/roles.php`). Per-role permission lists are in `config/roles.php:1-678`.

### B. Permissions table
No single canonical file exists (§6). The role-permission associations in `config/roles.php` constitute the practically-authoritative list of ~250 distinct permission grants actually reachable by non-bypass users. Confirmed anomalies are tabulated in §6.1–6.3.

### C. Enforcement matrix
See §7.1 (module summary) and §7.2–7.5 (specific mechanisms and gaps).

### D. Route matrix
See §8.1 (counts by file and path prefix) and §8.2–8.4 (public/gapped/verified-safe routes).

### E. File reference index (key files cited throughout this report)

| File | Role in RBAC |
|---|---|
| `app/Models/User.php` | Core permission/role check methods; **Critical finding location** |
| `app/Models/Permission.php` | Permission Eloquent model |
| `app/Modules/Platform/Infrastructure/Models/RoleModel.php` | Role Eloquent model (tenant/facility/department/status/scope_type) |
| `app/Providers/AppServiceProvider.php` | Policy registration, `Gate::before()`, 5 composite `Gate::define()`s |
| `app/Policies/*.php` (7 files) | Patient, MedicalRecord, LaboratoryOrder, PharmacyOrder, RadiologyOrder, Appointment, Inventory policies |
| `app/Http/Middleware/EnsureUserHasActiveRole.php` | Active-role gate — **only applied to `web.php`, not `api.php`** |
| `app/Http/Middleware/InventoryAccessMiddleware.php` | Dead/deprecated middleware |
| `app/Support/Auth/DepartmentScopedPermissionResolver.php` | Live inventory department-scoping logic |
| `app/Support/Auth/EffectivePermissionNameResolver.php` | Frontend-facing composite ability resolution |
| `app/Support/Auth/ConsultationProviderAuthorization.php` | Job-title/role-code fallback authorization |
| `app/Http/Middleware/HandleInertiaRequests.php` | Frontend auth context sharing |
| `bootstrap/app.php` | Middleware aliasing and route-file registration |
| `config/roles.php` | **Authoritative** role/permission catalog |
| `config/billing_permissions.php` | Documentation-only billing permission profile (not a seed source) |
| `config/platform_user_admin.php` | Privileged-change approval-case control list |
| `database/seeders/RoleHierarchySeeder.php` | Dead, conflicting role/permission catalog |
| `database/seeders/InventoryAccessRolesSeeder.php`, `InventoryPermissionsSeeder.php` | Dead seeders |
| `app/Console/Commands/SyncRolesFromConfig.php` (`roles:sync`) | Live role-provisioning command |
| `database/migrations/2026_07_16_000003_sync_roles_from_config.php` | Migration-time role/permission sync from config |
| `database/migrations/2026_07_23_000002_fix_clinical_procedure_orders_permission_naming.php` | Self-documented naming-drift bugfix (evidence for §6.1) |
| `routes/web.php`, `routes/api.php`, `routes/billing-phase1.php`, `routes/settings.php`, `routes/channels.php` | Route-level enforcement |
| `resources/js/composables/usePlatformAccess.ts` | Central frontend permission composable |
| `resources/js/lib/routeAccess.ts` | Frontend nav-visibility route/permission mirror |

