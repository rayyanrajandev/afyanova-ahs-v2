# Inventory Master Data — ERP/HIS Alignment Plan

Companion document to [`Inventory_CreateItem_Architecture_Audit.md`](./Inventory_CreateItem_Architecture_Audit.md). That audit identified two High and four Medium findings, all rooted in one thing: clinical, packaging, and taxonomy data living on the wrong layer. This plan turns those findings into a sequenced, shippable engineering plan to close every gap in the audit's §10 Modern ERP/HIS Comparison table.

Every phase is independently shippable, additive-first (expand → migrate → contract), and reversible up to the point columns are actually dropped. Where the plan depends on something not yet verified in this codebase, it says so explicitly rather than assuming.

---

## Definition of "100% aligned"

Taken directly from the audit's ERP comparison table — every row must read **Follows** when this plan is complete.

| Concern | Today | Done when |
|---|---|---|
| Material/item master as single source of clinical truth | Partial | Clinical descriptors read only from Clinical Catalog; `inventory_items` no longer stores its own copy |
| UOM/packaging defined once, reused | Deviates | Packaging lives on a catalog-level template, instantiated per facility, and the Create/Edit Item UI uses it |
| Category-driven dynamic form behavior | Follows | No change required — already correct |
| Batch/lot as distinct transactional layer | Follows | No change required — already correct |
| Formulary/compliance governance as a distinct role | Deviates | Compliance-sensitive fields gated by a dedicated permission, not the general item-management permission |
| Item creation → goods receipt as linked but distinct steps | Partial | A dismissible bridge connects the two without merging the transactions |

Two audit findings sit outside this table and are handled separately: the two divergent item-creation code paths (maintainability, not ERP alignment — Phase 9) and Hazard Information (unscoped requirement — listed in "Out of scope" below, not a phase).

---

## Data ownership matrix (simple)

A quick-reference summary — one row per module, not per field. The audit's full 26-field and 13-attribute-group breakdowns still stand as the detailed source; this is the compact version each phase below implements against.

| Module | Owns | Never stores |
|---|---|---|
| **Clinical Catalog** | Drug/product identity: name, generic name, dosage form, strength, route, storage conditions, cold-chain flag, controlled-substance flag + schedule, MSD/NHIF standard codes | Facility stock levels, warehouse/supplier preferences, batch data |
| **Packaging** (catalog template + per-facility instance) | Unit hierarchy (base/purchase/sales), conversion ratios, per-unit barcode | Clinical descriptors, stock quantities |
| **Inventory Category** | Category/subcategory taxonomy, form-template behavior flags | Anything item- or facility-specific |
| **Inventory Item** | Facility-level stock policy: current stock, reorder/max levels, default warehouse, default supplier preference, VEN/ABC classification, status | Clinical descriptors (post-Phase 3), packaging ratios (post-Phase 4) |
| **Warehouse** | Physical location identity | Item-specific data |
| **Supplier** | Vendor identity, contact, banking | Item-specific data, pricing |
| **Batch/Lot** | Receipt-specific facts: batch/lot number, dates, quantity, unit cost, actual supplier, actual warehouse, actual manufacturer (Phase 7) | Anything true across every receipt (that belongs on Clinical Catalog or Inventory Item instead) |

---

## Guiding principles

1. **One attribute, one owner.** Every field ends up writable in exactly one place; every other layer reads it through a foreign key.
2. **Expand → migrate → contract.** Add the new column/table first, dual-read/dual-write while both exist, cut reads over, only then drop the old column. Nothing gets deleted in the same phase it's replaced.
3. **Feature-flag the risky cutovers.** This codebase already gates platform-scoping behavior behind `FeatureFlagResolverInterface` (see `isPlatformScopingEnabled()` in `StoreInventoryItemRequest`). Reuse that mechanism for the Phase 2 read cutover so it can be switched off instantly without a deploy if something regresses.
4. **No silent permission lockouts.** Any new permission (Phase 6) ships with a migration that grants it to whichever roles already have the capability today, following the same pattern as `2026_04_26_000001_seed_inventory_requisition_permissions_to_roles.php`.
5. **Confirm before assuming.** Two phases below (8 and part of 1) depend on facts this audit did not verify — they're marked as needing a short spike before they're scheduled, not committed to a migration shape yet.

---

## Phase 1 — Clinical Catalog schema hardening (expand)

Add the columns Clinical Catalog is missing. Purely additive — no read path changes yet, nothing else in the system is affected.

- **Migration:** add typed, nullable columns to `platform_clinical_catalog_items` — `generic_name`, `dosage_form`, `strength`, `route`, `storage_conditions`, `requires_cold_chain` (bool), `is_controlled_substance` (bool), `controlled_substance_schedule`. `msd_code`/`nhif_code` already have a home in the model's existing `codes` JSON column (the frontend already reads `codes.MSD` / `codes.NHIF` off catalog items) — for this phase, formalize that as a validated shape rather than adding new columns; promote to real columns in Phase 1 only if the validation-only approach proves insufficient in practice.
- **Backfill migration:** for every `platform_clinical_catalog_items` row with at least one linked `inventory_items.clinical_catalog_item_id`, copy `dosage_form`/`strength`/`storage_conditions`/`requires_cold_chain`/`is_controlled_substance`/`controlled_substance_schedule`/`generic_name` from the linked inventory row into the new catalog columns (inventory-side data is the more complete, pharmacist-curated dataset historically). Where multiple inventory items link to the same catalog item and disagree, log the conflict for manual review rather than guessing which is correct.
- **Model:** extend `ClinicalCatalogItemModel::$fillable` and `casts()` for the new columns.
- **Validation:** extend `StoreClinicalCatalogItemRequest` / `UpdateClinicalCatalogItemRequest`.
- **Admin UI:** expose the new structured fields in the Clinical Catalog admin screens in place of (or alongside, during transition) the freeform `metadata` entry.
- **Route/ATC classification:** the audit's brief lists these as catalog attributes, but this codebase has no existing convention for either (no WHO-ATC integration, no route enum anywhere). Confirm with pharmacy stakeholders which coding standard is wanted before adding columns for these two — everything else in this phase should ship without waiting on that answer.
- **(Optional, deferred) variant grouping:** add a nullable, self-referencing `generic_group_code` (or `parent_catalog_item_id`) column so multiple strength/form variants of the same drug can be queried as a set later. Not required for this phase to ship — see Item Identity Model below for why.

**Acceptance:** existing catalog CRUD behavior unchanged; 100% of formulary items with a linked inventory item have the new columns populated; conflict log reviewed and resolved to zero before Phase 2 starts.

---

## Phase 2 — Cut inventory reads over to the catalog relation (migrate)

- Update `InventoryItemResponseTransformer` to read `dosage_form`, `strength`, `storage_conditions`, `requires_cold_chain`, `is_controlled_substance`, `controlled_substance_schedule` through the `clinicalCatalogItem` relation when `clinical_catalog_item_id` is set, falling back to the local column for un-linked (non-pharma) items.
- Gate this behind a feature flag (e.g. `inventory.catalog_first_reads`) per Guiding Principle 3.
- Extend `InventoryClinicalLinkGuard::assertModelCanPersist()` to flag (not silently accept) writes to the now-catalog-owned fields on a catalog-linked model — this is the piece that closes the audit's top High-priority finding, since today the guard doesn't look at these fields at all.
- Update `BulkCreateInventoryItemsFromCatalogUseCase` and `ImportInventoryItemsUseCase` to stop writing the catalog-owned fields for catalog-linked rows (still fine to write them for manually-entered, non-catalog categories).
- Snapshot/contract test: capture `InventoryItemResponseTransformer` output for a representative sample of linked pharma items before the flag flips, assert identical output after — the field names and shape in the API response don't change, only where the values come from.

**Acceptance:** flag can be toggled in either direction with zero API shape change; guard rejects a deliberately-divergent write in a test case; contract test green.

---

## Item Identity Model *(new — read before Phase 3)*

Phase 3 deletes columns on the assumption that every remaining consumer knows where to read the same data instead. That assumption only holds if the relationship between the four entities the data moves between is unambiguous. It's a short model, not a new phase — nothing here requires its own migration beyond what Phases 1, 4, and 7 already do.

**How the four relate:**

```text
Clinical Catalog Item  (1) ──▶ (many) Inventory Item          [one per facility, via clinical_catalog_item_id]
        │                              │
        │                              └──▶ (many) Packaging/Unit rows   [inventory_item_units — per-facility instance]
        │
        └──▶ (0..1) Packaging Template          [Phase 4 — seeds the row above, once, at link time]

Supplier ──▶ (default/preference) Inventory Item.default_supplier_id
Supplier ──▶ (actual, per receipt) Batch/Lot.supplier_id
Supplier ──╳── Clinical Catalog Item    [no relationship — see below]
```

- **Clinical Catalog Item → Inventory Item:** one catalog item can back many inventory items (one per facility that stocks it), via the existing `clinical_catalog_item_id` FK. Direction of truth for clinical descriptors flows catalog → inventory, never the reverse (that's what Phase 2 enforces).
- **Clinical Catalog Item → Packaging:** one catalog item has at most one packaging *template* (Phase 4), which seeds — but does not live-bind — each inventory item's own packaging rows. After seeding, a facility's packaging can diverge (different local pack sizes) without touching the template.
- **Supplier Item:** confirmed not modeled as a distinct entity anywhere in this codebase — no supplier-SKU or supplier-price-list table exists (`InventoryItemUnitPriceModel` is a payer/billing price book, not a procurement price book). Today "supplier" only ever attaches at two points: a *preference* on Inventory Item, and an *actual fact* on Batch/Lot. That split is already correct and doesn't need to change for this plan. A supplier never attaches to a Clinical Catalog Item directly — which supplier stocks a drug is facility/market data, not a property of the drug's definition. **Out of scope for this plan:** if a real supplier catalog (supplier SKU codes, supplier price lists per pack size) is ever needed, it would be a new `supplier_item_packaging_prices`-style table sitting between Supplier and Packaging — flagged here as a future phase, not committed to, since no current audit finding calls for it.
- **Variant strategy (strength/dosage form/route):** checked against the existing seed data — catalog rows are already one-row-per-specific-variant today (`"Paracetamol 500mg"` and a hypothetical `"Paracetamol 250mg/5ml Syrup"` are, and should remain, separate rows — not one row with multi-value strength/form fields). That's the correct pattern; nothing needs redesigning here. The one real gap is that there's no way to query "every strength of Paracetamol" as a set. Phase 1's optional `generic_group_code` column closes that gap without merging rows or complicating Phase 2/3's column-level cutover.

**Why this matters for Phase 3:** the column drop is only safe because every consumer reads clinical descriptors through exactly one path (the catalog relation) and packaging through exactly one path (per-facility `inventory_item_units`, seeded but not fed by the template). If either relationship were ambiguous, Phase 3 would be deleting data some code path still depends on. It isn't, but that's now documented rather than assumed.

---

## Phase 3 — Drop the duplicated columns (contract)

**Correction found during implementation, verified against `InventoryItemCategory`'s own metadata methods before any code changed:** the original plan to drop all seven duplicated columns was too broad. `isControlledSubstanceEligible()` and `supportsMedicineDetails()` both return true for `PHARMACEUTICAL` only — and Pharmaceutical items are *required* to be catalog-linked (`InventoryClinicalLinkGuard` rejects a Pharmaceutical item with no `clinical_catalog_item_id`). So `generic_name`, `dosage_form`, `strength`, `is_controlled_substance`, and `controlled_substance_schedule` are safe to drop: every row that ever populated them has a catalog to read them from instead.

`supportsStorageFields()` is different — it returns true for `PHARMACEUTICAL`, `BLOOD_PRODUCT`, `LABORATORY`, and `FOOD_NUTRITION`, and only the first of those four can catalog-link. Blood Product, Laboratory, and Food & Nutrition inventory items have no Clinical Catalog entry to fall back to at all. Dropping `storage_conditions` and `requires_cold_chain` would have deleted the only place those three categories can record cold-chain and storage data. **Those two columns stay on `inventory_items`, permanently** — they're genuinely, correctly owned by Inventory for three of the four categories that use them, and only *preferentially read from the catalog* (Phase 2's existing behavior, unchanged) for the fourth (Pharmaceutical).

Only once Phase 2 has run long enough with the flag on, the Item Identity Model above hasn't turned up a consumer reading a path other than the catalog relation, and a repo-wide grep confirms nothing still reads `inventory_items.dosage_form` / `.strength` / `.generic_name` / `.is_controlled_substance` / `.controlled_substance_schedule` directly for catalog-linked rows:

- **Migration:** drop `generic_name`, `dosage_form`, `strength`, `is_controlled_substance`, `controlled_substance_schedule` from `inventory_items`. Keep `storage_conditions` and `requires_cold_chain` (see correction above), `manufacturer` (becomes a default only — see Phase 7), `dispensing_unit`/`conversion_factor` (superseded by Phase 4, drop there instead), and everything genuinely inventory-owned (`item_code`, `item_name` for non-catalog items, `category`, `subcategory`, `unit`, `bin_location`, `reorder_level`, `max_stock_level`, `default_warehouse_id`, `default_supplier_id`, `current_stock`, `status`, `ven_classification`, `abc_classification`).
- Update `InventoryItemModel::$fillable`/`casts()`, `InventoryClinicalLinkGuard`'s catalog-owned-field lists, `CreateInventoryItemUseCase`/`UpdateInventoryItemUseCase`, `InventoryItemResponseTransformer` (these five fields become catalog-only reads, no more item-column fallback), and `EloquentInventoryItemRepository`'s search/sort (currently searches/sorts `inventory_items.generic_name`/`dosage_form` directly by raw column — needs to search through the `clinicalCatalogItem` relation instead once the local columns are gone).

**Acceptance:** full test suite green; grep for the five dropped column names across `app/` and `resources/js/` returns nothing outside migration history; search-by-generic-name and sort-by-generic-name still work for pharmaceutical items via the catalog relation.

---

## Phase 4 — Packaging: catalog template + per-facility instance

The audit's original recommendation ("re-key `inventory_item_units` to the catalog item") is close but not quite right in isolation — some facilities legitimately buy different pack sizes from different local distributors, so packaging can't be *purely* shared. The correct shape is a **reusable default at the catalog level**, instantiated (and overridable) per facility, which is exactly the expand step this phase performs and exactly the relationship documented in the Item Identity Model above:

- **New table** `clinical_catalog_item_packaging_templates`: `catalog_item_id` (FK), `unit_name`, `unit_code`, `base_quantity`, `is_base_unit`, `is_default_purchase_unit`, `is_default_sales_unit`. Reusable, edited once per drug.
- When an inventory item is linked to a catalog item (creation or later linking), auto-seed `inventory_item_units` rows from the template as a **one-time copy**, not a live reference — local overrides after that point are expected and fine.
- **UI:** replace the flat Conversion Factor field in Create/Edit Item with a packaging editor backed by the existing `InventoryItemUnitController` API — table of unit name / base quantity / purchase-or-sales flag / barcode, pre-filled from the template when catalog-linked, freely editable otherwise.
- **Backfill:** for existing items with a non-null `conversion_factor`, create a base `inventory_item_units` row (the current `unit`, `base_quantity = 1`) plus a second row derived from `conversion_factor`/`dispensing_unit`, so no packaging data is lost when Phase 3 (or a later cleanup) drops the flat columns.
- Update stock-movement and batch-receiving flows that currently reference the flat fields to resolve units through `InventoryUnitConversionService` instead.

**Acceptance:** creating a linked pharma item auto-populates a sensible default packaging editable in the same screen; an unlinked item still lets a user define packaging manually; batch receiving can select any active unit for the item.

**Implementation status:** shipped and verified end-to-end (migration, model, `CreateInventoryItemUseCase` seed-on-link with fallback to the original single/dual-unit logic when no template exists, backfill for the 26 of 28 existing items that had no unit row at all, template CRUD API). One find worth recording: the per-item packaging editor UI wasn't missing because it needed to be built — the full create/edit/deactivate logic (`itemUnits`, `openCreateUnitDialog`, `openEditUnitDialog`, `submitDeactivateUnit`, and a complete dialog already rendered in `IndexV2.vue`) already existed and was already wired into the page's exported API, just never rendered anywhere. This is the exact same "backend exists, UI never surfaced" pattern the original audit flagged for the subsystem as a whole, one level more specific than expected. Added the missing piece — a "Packaging Units" list-and-actions section — to `SupplyChainItemDetailsSheet.vue`'s maintenance tab; the existing dialog needed no changes. **Not done:** a packaging editor in the *Create* Item flow (item has no ID to attach units to until after creation — the flat Conversion Factor field plus template auto-seed remains the create-time mechanism, which is a reasonable permanent split, not a gap) and a template-management UI on the Clinical Catalog admin side (that admin page is a 3,600+ line, five-domain file — added a new field with no existing UI equivalent there carries real regression risk without the ability to test in a browser, so the template API is complete and correct but currently only reachable directly, not from the admin UI; same scoping call made for Phase 1's Clinical Catalog fields).

---

## Phase 5 — Category & subcategory as configurable master data

Independent of Phases 1–4; can run in parallel.

- **New tables:** `inventory_categories` (id, code, label, form_template, requires_expiry_tracking, requires_cold_chain, controlled_substance_eligible, supports_medicine_details, supports_storage_fields, supports_clinical_classification, is_active, sort_order) and `inventory_subcategories` (id, category_id FK, code, label, is_active).
- **Seed migration:** populate both tables from the current `InventoryItemCategory` enum and `ITEM_SUBCATEGORY_OPTIONS`, preserving every existing value and flag exactly — this must be a lossless, behavior-preserving migration, not a redesign.
- Update `InventoryExtendedController::referenceData()` to read `categoryOptions` from the new tables.
- Build an admin CRUD screen for categories/subcategories, consistent with the existing Clinical Catalog admin pattern.
- Retire `DEFAULT_ITEM_CATEGORIES` and `ITEM_SUBCATEGORY_OPTIONS` as hand-maintained fallbacks once the API path is proven reliable in production; if an offline fallback is still wanted, generate it from the DB seed at build time rather than hand-editing a second copy.
- Pharmaceutical subcategory keeps its existing behavior unchanged: auto-populated from the linked catalog item's `category` and locked, no separate curation needed.

**Acceptance:** every existing category/subcategory combination renders identically pre/post cutover; adding a 15th category is a database row, not a deploy.

**Implementation status:** shipped and verified. `inventory_categories`/`inventory_subcategories` created and seeded — categories seeded directly from `InventoryItemCategory::optionMetadata()` (the live enum, not hand-transcribed, so zero drift risk on this pass) and verified field-for-field against it (14/14 categories, zero mismatches); subcategories hand-transcribed from `ITEM_SUBCATEGORY_OPTIONS`/`GENERAL_SUBCATEGORY_OPTIONS` (66 rows: pharmaceutical's 12, medical_consumable's 6, the general 4 applied per-category to the other 12). `InventoryExtendedController::referenceData()` now reads both from the tables — verified via the existing `assertJsonFragment` test that the response shape for `categoryOptions` is byte-for-byte unchanged. Added `subcategoryOptions` to the same response (new key, additive); the frontend's `subcategoryOptionsForCategory()` now prefers it when present, falling back to the hardcoded map otherwise, so nothing breaks if the API is unreachable. **Not done:** an admin CRUD screen — the tables are genuinely configurable (a new category is a database row, per the acceptance criterion), just not yet manageable through a UI; same scoping call as the Clinical Catalog and packaging-template admin gaps in Phases 1 and 4.

**Methodology note, for the record:** this phase surfaced a real flaw in how "clean baseline" was being checked earlier in this plan's execution. `git stash` (no flag) does not stash *untracked* files, and every migration in Phases 1–5 was a new, untracked file — so prior "baseline" comparisons in this document's execution log were unknowingly running old application code against a database schema that already had the new migrations applied. For additive migrations this mostly self-corrected (unused new columns/tables don't break old code), but it's not a sound comparison in general. Switched to `git stash -u` from this phase onward, which stashes untracked files too. Re-running Phase 5's comparison this way surfaced one genuine, expected discrepancy — a test asserting an exact feature-flag count (8) that needed updating to 9 after Phase 2 added `inventory.catalog_first_reads` — fixed directly. After the fix, the `-u` comparison is exact: 57 failed / 335 passed on both sides.

---

## Phase 6 — Compliance permission tier

- **New permission:** `inventory.procurement.manage-compliance`, added via a migration in the same style as `2026_04_26_000001_seed_inventory_requisition_permissions_to_roles.php`, granted to whichever roles hold `inventory.procurement.manage-items` today so nobody loses capability on deploy.
- Gate cold-chain overrides and controlled-substance editing behind this permission — both server-side (FormRequest authorization, `InventoryClinicalLinkGuard`) and client-side (hide/disable the controls).
- Since Phase 2 already makes these fields read-only for catalog-linked pharma items, this permission's real surface is: (a) the Clinical Catalog admin screens where they're now actually edited, and (b) the local-override path for non-catalog categories (e.g. manually flagging a non-formulary item cold-chain-sensitive).
- Audit current role → permission assignments before the grant migration runs, so the "keep existing capability" grant is accurate rather than assumed.

**Acceptance:** a user with only `manage-items` can create/edit items but cannot toggle cold-chain or controlled-substance status on a non-catalog item, or edit those fields on a Clinical Catalog entry; existing pharmacy/inventory admin roles retain full capability with zero manual re-grant needed post-deploy.

---

## Phase 7 — Batch/Lot: manufacturer + opening-stock bridge

Two independent, low-risk UX/data fixes; ship separately or together.

- **Migration:** add nullable `manufacturer` to `inventory_batches`.
- Update `StoreInventoryBatchRequest` and the batch-receiving UI to optionally capture the actual manufacturer per receipt, defaulting to the item's manufacturer default when left blank.
- Update `submitCreateItem()`'s success path to offer (not force) a "Record opening stock" step into the existing receive-stock flow, pre-filled with the new item — closes the audit's workflow finding without merging two legitimately distinct transactions.

**Acceptance:** two receipts of the same item from different manufacturers are each recorded correctly; a new item's create-success toast offers a one-click path into opening stock.

**Implementation status:** shipped and verified. `manufacturer` added to `inventory_batches`; found that batch creation actually happens through **two** independent code paths, not one — `CreateInventoryBatchUseCase` (the direct batch API) and `InventoryBatchStockService::performReceive()` (the interactive Receive Stock flow, which upserts into an existing open batch or creates a new one). Both needed the fix, with matching semantics: an explicit manufacturer on the receipt always wins; blank falls back to the item's manufacturer preference on create, and to the existing batch's already-recorded manufacturer on a repeat receipt into the same batch (never silently overwritten by a blank field). Verified all three paths directly via tinker against real records — explicit override, default-from-item, and preserve-on-repeat-receipt all correct.

For the opening-stock bridge: found the backend and the dialog-opening logic (`isOpeningStock` flag, `inventory.procurement.set-opening-stock` permission, `openStockMovementDialog()` with built-in permission gating and pre-fill) already existed and were already wired together — the only missing piece was calling it from the create-item success path. Used Sonner's native action-button support directly (`toast.success(..., { action: { label, onClick } })`) for a genuinely dismissible offer, rather than a forced redirect or a new modal.

**Not part of this phase, flagged for Phase 9:** fixing the manufacturer/opening-stock paths required opening `InventoryBatchStockService`, which surfaced that `CatalogDownstreamSyncService::syncToInventory()` (found and partially fixed in Phase 6) makes this the *third* place inventory items or batches get created outside `CreateInventoryItemUseCase`. Phase 9's scope needs to grow from "two paths" to at least three.

---

## Phase 8 — Bin location per warehouse *(needs a design spike first — not yet scheduled)*

The audit flagged `bin_location` as wrongly item-global, but pulling that thread surfaces a bigger open question this engagement did not verify: whether `current_stock` itself is tracked per warehouse anywhere today. A scan of stock-related migrations found `inventory_stock_movements` (a ledger) and `inventory_stock_reservations`, but no materialized per-(item, warehouse) balance table — `inventory_items.current_stock` appears to be a single global aggregate. If that's confirmed accurate, bin location can't be fixed in isolation: it's entangled with whether this system tracks warehouse-level stock at all, which is a materially bigger design question than the audit scoped.

**Before scheduling this phase:** confirm with a short spike (1) whether per-warehouse stock is derived on read from `inventory_stock_movements` rather than stored, and (2) whether that's sufficient for a per-warehouse bin-location table to hang off, or whether a proper stock-balance table is needed first. Do not commit to a migration shape until that's answered.

### Spike findings — answered, no code committed

**(1) Per-warehouse stock is neither derived nor stored, uniformly — it's split by category.** No aggregation anywhere in the codebase sums `inventory_stock_movements` by warehouse to derive a live balance; that hypothesis was wrong. What actually exists:

- **Batch-tracked categories** (Pharmaceutical, Blood Product, Laboratory, Food & Nutrition — `requiresExpiryTracking()` true): `inventory_batches` already has both `warehouse_id` and `bin_location` columns (present since the original `2026_04_19_000701` migration, not something this plan added). Per-warehouse stock for these categories is already directly queryable today: `SUM(quantity) GROUP BY warehouse_id` on `inventory_batches` for a given item. **The audit's "bin_location is wrongly item-global" finding does not actually apply to this majority of tracked value** — a Paracetamol batch received into Warehouse A already carries its own `warehouse_id` and `bin_location`, independent of any other batch of the same drug sitting in Warehouse B. `inventory_items.bin_location` for these categories is just a UI convenience default, not the operative location.
- **Non-batch-tracked categories** (Medical Consumable, Equipment, Surgical Instrument, PPE, etc.): these categories never create `inventory_batches` rows at all — `InventoryBatchStockService::issue()`/receive logic for them adjusts `inventory_items.current_stock` directly, a single global counter with no warehouse dimension whatsoever. For this group, the audit's finding is fully correct: there is no way today to know how many gloves are in Warehouse A versus Warehouse B, and `bin_location` genuinely is a single, wrongly-shared field.

**(2) A proven pattern for the fix already exists in this codebase, unused for warehouses.** `department_stock_balances` — a materialized `(tenant_id, department_id, item_id, batch_id) → quantity_on_hand` table, maintained transactionally by `DepartmentStockService` (`recordIssue`/`recordConsumption`/`recordReturn`/`recordWastage`) alongside a parallel `department_stock_movements` ledger — is exactly the shape a `warehouse_stock_balances` table would need for non-batch-tracked categories. This isn't a new pattern to invent; it's one to mirror.

**Recommendation, not yet actioned:** scope the real Phase 8 as "extend warehouse-level stock tracking to non-batch-tracked categories," not "add a bin-location column." Two options, in order of preference:
- **(a)** A `warehouse_stock_balances` table mirroring `department_stock_balances` exactly, maintained by an analogous `WarehouseStockService`, used only for the categories that don't already get this for free via `inventory_batches`.
- **(b)** Extend batch tracking to every category (even a Medical Consumable receipt becomes a lightweight, non-expiring "lot"), unifying the two paths instead of running them in parallel — bigger behavior change, cleaner long-term, not evaluated in depth here.

Either way, this is real design work — a new service, a new table, and a decision on (a) vs (b) — not a quick follow-on to this plan's other phases. Left unscheduled, as originally intended, but now with a concrete shape instead of an open question.

---

## Phase 9 — Consolidate the two item-creation code paths

Independent, lowest-risk, can run any time.

- Extract the shared catalog-link + category validation currently duplicated between `StoreInventoryItemRequest`/`InventoryClinicalLinkGuard` and `BulkCreateInventoryItemsFromCatalogUseCase` into one service both call.
- Point `ImportInventoryItemsUseCase` (CSV import) at the same service.

**Acceptance:** a rule change (e.g. a new required field for pharma items) only needs to be written once and all three creation paths pick it up.

**Implementation status:** shipped and verified, with a corrected scope. The catalog-link/category *validation* rule turned out to already be unified — it's enforced once, at the `InventoryItemModel` save hook (`InventoryClinicalLinkGuard::assertModelCanPersist`), which every write path runs through regardless of which use case triggered the save. Nothing to extract there. What actually was duplicated four times (not two) was the *identity derivation* — reading unit, dispensing unit, conversion factor, subcategory, and standards codes off a catalog item. Extracted into `CatalogIdentityResolver`, now used by `CreateInventoryItemUseCase`, `UpdateInventoryItemUseCase`, `BulkCreateInventoryItemsFromCatalogUseCase`, and `CatalogDownstreamSyncService` (the third creation path found in Phase 6). `ImportInventoryItemsUseCase` confirmed to still have zero catalog-linking support — nothing to point at the shared service there, consistent with the earlier finding. Verified all four consumers resolve cleanly through the container and the resolver's output is correct against a real catalog item; full suite unchanged (57 failed/337 passed).

---

## Sequencing

```text
Phase 1 (Catalog schema) ──▶ Phase 2 (read cutover) ──▶ Item Identity Model (docs, no code) ──▶ Phase 3 (drop columns)
Phase 4 (Packaging)        — independent, parallel to 1–3; shares its data model with Item Identity Model
Phase 5 (Category/Subcat)  — independent, parallel to 1–4
Phase 6 (Permission)       — independent, benefits from Phase 2 being live first
Phase 7 (Batch mfr + bridge) — independent, ship anytime
Phase 8 (Bin per warehouse)  — blocked on a design spike, not yet scheduled
Phase 9 (Consolidate paths)  — independent, ship anytime
```

Only 1 → 2 → (Item Identity Model) → 3 is a hard chain, and the Item Identity Model step is a documentation checkpoint, not new engineering work — it doesn't add calendar time on its own, it just gates Phase 3 on the relationships above actually holding. Everything else can be sequenced by team bandwidth, not technical dependency.

---

## Testing & rollback strategy

- Every schema change through Phase 3 follows expand → migrate → contract; nothing is destructive until the explicit "drop columns" step, which itself only runs after a grep-verified zero-reads check.
- Phase 2's read cutover sits behind a feature flag for instant rollback without a deploy.
- Each phase gets a contract/snapshot test on the relevant API response shape before its cutover ships, so a regression is caught by CI rather than in the field.
- Backfill migrations that encounter ambiguous data (Phase 1's conflict case) log and stop rather than guessing — no phase silently overwrites disagreeing data.

---

## Out of scope for this plan

- **Hazard Information** — confirmed zero implementation anywhere in the audit. Needs product/requirements scoping (what counts as a hazard, who classifies it, where it's sourced from) before it can even be sized, let alone planned. Not included as a phase.
- **ATC classification / route** — see Phase 1's note; deferred pending a decision on coding standard.
- **Warehouse-level stock balances** — see Phase 8; may turn out to be a prerequisite for Phase 8 rather than something this plan can currently size.
