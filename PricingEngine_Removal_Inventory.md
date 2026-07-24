# Removal Inventory: Unified Pricing Engine

Companion to `PricingEngine_RFC.md`, `PricingEngine_Technical_Design.md`, `PricingEngine_Migration_Plan.md`. This is the explicit answer to "what gets deleted" — nothing here is removed before its corresponding Migration Plan phase gate passes. Every entry is marked **DELETE** (removed outright), **REWORK** (kept but changed — not a clean delete, noted so it isn't mistaken for one), or **ARCHIVE** (data retained for compliance/audit, live table/path retired).

**Migration files are a separate question from tables, and the answer is fixed, not "TBD":** every row below that says a table is dropped or archived means a **new** migration is written to do that (`Schema::dropIfExists` / data export). The **original migration file that created the table is never deleted or edited**, once it has run in any real environment — Laravel replays the full migration history on any fresh install, and rewriting history desyncs a fresh install from what production's `migrations` ledger already recorded as run. This repo already follows that rule (`2026_07_23_000002_fix_clinical_procedure_orders_permission_naming.php` corrected forward with a new file rather than editing the original seed migration) — the pricing engine's table drops follow the same precedent in Phase 5. So: **old migration files are permanent, non-deletable historical record — nothing to decide later.** Only the live table/column is removed, via a new forward migration.

---

## Backend — DELETE

| Item | File | Removed in phase | Why it can go |
|---|---|---|---|
| `findActivePricingByServiceCodes()` (use-case private helper) | `app/Modules/Billing/Application/UseCases/ListBillingChargeCaptureCandidatesUseCase.php` (~line 829-845) | 5, per-domain as each cuts over | Replaced by `ChargeResolver::resolvePrice()` joining on `chargeable_item_id` |
| `normalizeServiceCodeCandidates()` | same file | 5 | Only existed to build multi-candidate string arrays for the string-matcher |
| `resolveServiceCode()` | same file | 5 | Same — candidate-code assembly for string matching |
| `consultationServiceCodes()`, `consultationServiceCodes` building logic (the `CONSULT-{tier}-{dept}` string assembly) | same file | 5 (Consultation cutover) | Replaced by direct `appointments.consultation_chargeable_item_id` read |
| `bedDayCandidatesForAdmission()`'s `BED-{WARD_TOKEN}` / `BED-DAY` string construction | same file (added this week) | 5 (Bed-day cutover) | Replaced by direct `facility_resources.chargeable_item_id` read |
| `serviceCodeToken()` | same file | 5 — **only if** nothing else still needs it after the above three are gone (check call sites at delete time) | Was purely in service of string-code assembly |
| `findActivePricingByServiceCode()` / `findActivePricingByServiceCodes()` (repository, string-code versions) | `app/Modules/Billing/Infrastructure/Repositories/EloquentBillingServiceCatalogItemRepository.php` (~line 101-182) | 5 | Replaced by a new `findActivePriceForChargeableItem()` method |
| `ClinicalSourceKind::catalogFk()` / `modelClass()` throw-branches for `APPOINTMENT_CONSULTATION` / `ADMISSION_BED_DAY` | `app/Modules/Platform/Domain/ValueObjects/ClinicalSourceKind.php` | 3, once those two domains have real FKs | No longer exceptional cases once every kind has a uniform FK |

## Backend — REWORK (not a clean delete — flagging so it isn't lost)

| Item | File | Phase | What changes |
|---|---|---|---|
| `ConsultationMappingModel` | `app/Modules/Billing/Infrastructure/Models/ConsultationMappingModel.php` | 3 (Consultation) | Output column changes from producing a service-code string to a direct `chargeable_item_id` FK. The mapping *concept* (tier + department → rate) survives — it's a real business rule, not dead code. |
| `ConsultationMappingController.php` + `Store`/`UpdateConsultationMappingRequest.php` | `app/Modules/Billing/Presentation/Http/Controllers/`, `.../Requests/` | 3 | Validation/payload shape changes to accept `chargeable_item_id` instead of a catalog/service-code reference |
| `ConsultationMappingSeeder.php` | `database/seeders/ConsultationMappingSeeder.php` | 3 | Rewritten to seed chargeable-item-backed mappings |
| `billing_service_catalog_items.service_code` (column) | table | 5 | Not dropped — kept as a display label on `chargeable_items.code` instead; column itself retired along with the whole table (see Archive section) |
| `InventoryClinicalLinkGuard` | `app/Support/CatalogGovernance/InventoryClinicalLinkGuard.php` | 3 (Pharmacy) | Validates against `chargeable_items` instead of `platform_clinical_catalog_items` — same guard, new target |
| `CatalogPlacementAuditor` | `app/Support/CatalogGovernance/CatalogPlacementAuditor.php` | 6 | **Not deleted.** Downgraded from "actively needed repair job" to a periodic defense-in-depth check, since write-time validation should make the drift it currently fixes structurally rare |

## Backend — ARCHIVE (financial/audit data — do not hard-delete without Finance sign-off)

| Item | Table | Phase | Handling | Migration file |
| --- | --- | --- | --- | --- |
| `billing_payer_contract_price_overrides` + its audit log | tables | 5 | Data folded into `price_book_entries.payer_contract_id`; export old table to cold storage before dropping live table — confirm retention requirement with Finance first (RFC §8) | **New** `Schema::dropIfExists` migration. `2026_03_02_000092/93` (original create migrations) stay in the repo untouched, permanently. |
| `billing_service_catalog_items` (whole table) | table | 5 | Confirmed safe to retire only after verifying no live query depends on it (already-issued invoices snapshot line items as JSON at issue time, not a live FK — but confirm before dropping, per RFC §8 open question 3) | **New** `Schema::dropIfExists` migration. `2026_03_02_000090_create_billing_service_catalog_items_table.php` and every later `add_*_to_billing_service_catalog_items_table.php` alter-migration stay in the repo untouched, permanently — they're accurate history of a table that existed and is later dropped by a new migration, which is the normal, correct shape of a fully-retired table's migration history. |

**General rule applying to every row in this document that mentions dropping a table or column:** the change is always a **new** migration; the migration file(s) that originally created that table/column are never deleted or edited. This applies identically to `chargeable_item_id` columns added to domain tables in Phase 1 if any of them are later reworked — additive migrations only, no rewriting history.

---

## Frontend — DELETE

| Item | File | Phase | Why it can go |
|---|---|---|---|
| Consultation Mappings page | `resources/js/pages/billing/ConsultationMappings.vue` | 4 | Folded into the reworked Service Catalog / chargeable-item admin UX, or replaced by a simpler mapping editor that picks a chargeable item directly — either way this exact page's current string/catalog-item-option flow goes |
| `ConsultationMappingEditSheet.vue`, `ConsultationMappingCreateSheet.vue` | `resources/js/components/billing/` | 4 | Same — rebuilt against the new `chargeable_item_id`-based API, old sheets don't carry over as-is |
| `useConsultationMappings.ts`, `useCreateConsultationMapping.ts`, `useUpdateConsultationMapping.ts`, `useDeleteConsultationMapping.ts` + their `.spec.ts` tests | `resources/js/composables/consultationMappings/` | 4 | Same reasoning — API contract changes underneath them |
| `useConsultationMappingCatalogItemOptions.ts`, `useConsultationMappingDepartmentOptions.ts` | `resources/js/composables/consultationMappings/` | 4 | Options-fetching for the old catalog-item/service-code driven picker; replaced by a chargeable-item options composable |
| Free-text "Service Code" field as the primary create input | `resources/js/components/service-catalog/ServiceCatalogCreateItemSheet.vue` | 4 | Replaced by a required "Chargeable item" search/select picker; code field becomes read-only/derived, not user-typed |
| Build artifact `ConsultationMappings-*.js` | `public/build/assets/` | 4 | Not hand-deleted — disappears naturally on next `vite build` once source is gone. Noted only so it isn't mistaken for a leftover if seen in a diff. |

## Frontend — REWORK (kept, internals change)

| Item | File | Phase | What changes |
|---|---|---|---|
| Service Catalog pages | `resources/js/pages/billing/ServiceCatalogV2.vue`, `ServicePriceWorkspaceV2.vue` | 4 | Become Price Book editors — "Add service price" requires selecting an existing chargeable item first |
| Charges tab / charge-capture panel and siblings | `resources/js/pages/billing/workspace/tabs/ChargesTab.vue`, `resources/js/pages/billing/components/BillingCreateChargeCapturePanel.vue`, `BillingCreateContextSummary.vue`, `BillingCreateFinalizePanel.vue`, `BillingCreateLineItemsFallback.vue`, `BillingCreateLineItemsSidebar.vue`, `BillingCreateSelectedLineEditor.vue` | 4 | Internal data-fetching swaps to `chargeableItemId`-keyed responses; visible labels/badges barely change since the API keeps `serviceCode` as a display field (Technical Design §7) — this is mostly an invisible plumbing change, not a redesign |
| `useBillingPatientInvoices.ts`, `useBillingPatientWorkspace.ts`, `useEncounterCharges.ts`, `billingInlineCharge.ts`, `billingServiceCatalog.ts` | `resources/js/composables/`, `resources/js/lib/` | 4 | Type definitions gain `chargeableItemId`; nothing structural removed |
| Ward/bed admin screen | `resources/js/pages/platform/admin/ward-beds/IndexV2.vue`, `resources/js/components/admissions/WardBedPicker.vue` | 3 (Bed-day) | Gains one new field: "Pricing item" (assigns `chargeable_item_id`) |
| Service-point admin screen | `resources/js/pages/platform/admin/service-points/Index.vue` | 3 (Bed-day/service-point) | Same — gains "Pricing item" field |
| "Sync from Clinical Catalog" dialog | `resources/js/pages/billing/BillingServiceCatalogSyncDialog.vue` | 4 | Kept — this is actually well-aligned with the new design (bulk-creating price rows from catalog items). Reworked to require the chargeable-item link it already conceptually implies, rather than optionally producing a service-code-only row |

## What is explicitly NOT touched (confirm this list stays accurate as work proceeds)

- Invoice, payment, refund, and cashier-queue UI/backend — consume a priced line, don't care how it was resolved (RFC non-goals).
- `inventory_item_unit_prices` and all Inventory stock-cost tracking — different concern by design (Technical Design §6).
- `patient_vital_sets`, clinical documentation, ward round-notes — unrelated to pricing.
- Dedup mechanism (`invoicedSourceIndex()`, `sourceWorkflowKind`/`sourceWorkflowId` on invoice line items) — stays exactly as-is (Technical Design §3); the pricing engine changes *how a price is found*, not *how "already billed" is detected*.
