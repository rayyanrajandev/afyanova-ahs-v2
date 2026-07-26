# Inventory Module Audit — Stock Control → Create Inventory Item

A code-verified review of the item-creation workflow against modern ERP/HIS master-data practice: category architecture, dynamic form rendering, Clinical Catalog integration, packaging, compliance ownership, and the surrounding workflow. Every finding is traced to a file, migration, or model in this repository — nothing is inferred from convention alone.

**Scope:** Inventory → Stock Control → Create Item
**Method:** Static code + schema review
**Verdict:** Partially aligned with modern ERP/HIS practice

---

## Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Assessment](#2-architecture-assessment)
3. [UX Assessment](#3-ux-assessment)
4. [Domain Model Assessment](#4-domain-model-assessment)
5. [Identified Issues](#5-identified-issues)
6. [Recommended Improvements](#6-recommended-improvements)
7. [Priority Matrix](#7-priority-matrix)
8. [Proposed Refactoring Plan](#8-proposed-refactoring-plan)
9. [Suggested UI/UX Mock Workflow](#9-suggested-uiux-mock-workflow)
10. [Modern ERP/HIS Comparison](#10-modern-erphis-comparison)
11. [Field Ownership Audit](#11-field-ownership-audit)
12. [Master Data Strategy](#12-master-data-strategy)
13. [Final Verdict](#13-final-verdict)

---

## 1. Executive Summary

The workflow gets the pattern that matters most — category-driven dynamic rendering — structurally right, and its batch/lot ledger is properly separated from item master data. Where it falls short is one layer up: clinical master data (dosage, strength, cold-chain, controlled-substance status) is duplicated onto the transactional inventory row instead of living once in the Clinical Catalog, and a real multi-unit packaging model already exists in the schema but was never wired into the UI that would use it.

**Score card:** 2 High-priority findings · 4 Medium-priority findings · 2 Low-priority findings · 4 issues fixed during this engagement.

Four real gaps in dynamic rendering were found and fixed in the course of this engagement (the medicine-catalog picker leaking into non-pharmaceutical categories, an unfiltered medicine list, nine disabled fields cluttering the form after a catalog link, and a conversion-factor field locked for no reason). Those are noted as remediated below, not carried forward as open issues.

What remains is **domain-model** work, not UI polish: where clinical attributes are allowed to live, whether packaging is defined once and reused, and whether the two competing code paths that create inventory items (interactive dialog vs. bulk catalog sync) can drift apart. None of this is broken in a way that loses data today — it is architecture that will not comfortably scale past a single-facility deployment, which is the standard this audit was asked to hold it to.

---

## 2. Architecture Assessment

*Covers audit scope §1 (Category Architecture) and §2 (Dynamic Form Rendering).*

### Category: enum-backed, metadata-rich, not admin-configurable

Categories originate from a single PHP backed enum, `InventoryItemCategory` (14 cases: Pharmaceutical, Medical Consumable, Laboratory, Surgical Instrument, Medical Equipment, Linen & Textile, Food & Nutrition, Office & Admin, Cleaning & Sanitation, Blood Product, PPE, Dental, Radiology, Other). Each case carries real behavioral metadata — `formTemplate()`, `requiresExpiryTracking()`, `requiresColdChain()`, `supportsMedicineDetails()`, `supportsClinicalClassification()` — collapsed into four form templates via `optionMetadata()`. This is exposed to the client through `InventoryExtendedController::referenceData()`, scoped by department where relevant.

This is a legitimate, fairly modern pattern (metadata-driven field visibility, comparable to Dynamics 365 business rules) *and* it is fully consumed on the frontend to gate fieldsets — that part works. The gap is one layer up: there is no database table and no admin screen behind it. Adding "Prosthetics" as a fifteenth category means a PHP deploy, not a form submission. For a single-tenant hospital that may be an acceptable trade — enums are cheap to reason about and can't be corrupted by bad data entry — but it does not hold if this platform is meant to serve multiple facilities with different formularies and stock taxonomies, which the multi-tenant columns (`tenant_id`, `facility_id`) throughout the schema suggest is the intent.

Compounding this: the frontend keeps its own hardcoded copy of the same 14 categories (`DEFAULT_ITEM_CATEGORIES`) as an offline/error fallback. It is a fallback in name only — nothing enforces that it stays in sync with the backend enum, and the subcategory taxonomy already demonstrates this drift is real (see §4).

### Dynamic rendering: correct where it's wired, one path was not — now fixed

The rendering mechanism is metadata-driven end to end: `selectedCreateCategory` resolves the chosen category's flags, and fieldsets gate on them (`supportsMedicineDetails`, `supportsStorageFields`, `controlledSubstanceEligible`, `supportsClinicalClassification`). Backend enforcement in `StoreInventoryItemRequest` matches — catalog linking required for Pharmaceutical, rejected for everything else — and is reinforced at the **model** layer by `InventoryClinicalLinkGuard::assertModelCanPersist()`, a `booted()` save hook. That's defense in depth most Laravel codebases skip; it's a genuine strength.

One real divergence was found: the medicine-catalog picker rendered for *every* category whenever any formulary items existed, not only Pharmaceutical — so a user creating a Medical Consumable could pick a drug from the picker and only discover the mismatch at submit, when the backend rejected it. This has been corrected this session (gated on `supportsMedicineDetails`) and is listed as remediated in §5.

| Layer | Mechanism | Configurable without a deploy? |
|---|---|---|
| Category | `InventoryItemCategory` PHP enum | No |
| Category metadata (form behavior) | Enum methods, served via `referenceData()` | No |
| Subcategory | Hardcoded TS object, 2 of 14 categories covered | No — and not persisted as structured data at all |
| Field visibility rules | Vue computed props reading enum metadata | No, but correctly derived (single source once the frontend fallback list is retired) |

---

## 3. UX Assessment

*Covers audit scope §4 (Auto-Populated Fields), §5 (Medicine Profile), and the interactive parts of §8 (Workflow).*

### Auto-populated fields — remediated this session

Before this session, linking a clinical catalog medicine populated and then disabled **nine** separate fields (Item Code, Item Name, Generic Name, Dosage Form, Strength, Dispensing Unit, Stock Unit, MSD Code, NHIF Code) scattered across three fieldsets, each rendered as a full label + greyed input + "From clinical catalog" caption. That's a lot of inert surface area for information the user already confirmed by picking the medicine.

This has been replaced with a single compact read-only summary card shown once, directly under the picker, listing only the fields that actually have a value. The individual inputs now render only when nothing is catalog-linked (the true manual-entry path). **Conversion Factor** was found disabled-when-locked despite never being populated by the catalog selection — a dead end that made it permanently unfillable once a medicine was picked. It's now always editable, since nothing else populates it.

> **Fixed** — Auto-populated identity fields no longer clutter the form.
> Files: `SupplyChainInventoryOpsSheets.vue`, `SupplyChainItemDetailsSheet.vue` · Type: UX improvement

### Medicine Profile — now nearly empty for the common case, worth one more pass

With the summary-card fix applied, the "Medicine Profile" fieldset collapses to a single visible field (Conversion Factor) whenever a medicine is linked — which, per `InventoryClinicalLinkGuard`, is required for every Pharmaceutical item before it can save. In practice this means the fieldset is *almost always* down to one field in normal use, and a bordered box with a legend and one input reads oddly. The cleaner move — not done in this session, flagged as a follow-up — is to fold Conversion Factor into the "Stock Policy & Defaults" fieldset (where Stock Unit, Bin Location, and reorder settings already live) and retire the Medicine Profile fieldset entirely once catalog-linked, rather than leave a nearly-empty shell.

### Workflow: creation and first stock receipt are fully disconnected

Tracing `submitCreateItem()`: on success it calls `notifySuccess`, `closeCreateItemDialog()`, and `reloadAll()` — full stop. There is no offer to record opening stock, no chained "Receive first batch" step. The user has to locate the new item in the list and separately open the stock-movement flow. That's not automatically wrong — SAP (MM01 vs. MIGO) and most mature ERPs also keep "create material" and "post goods receipt" as distinct transactions — but distinct transactions and a *disconnected* workflow are different things. The absence of a lightweight bridge means items are structurally likely to sit at zero stock for a while after creation, which is exactly the kind of data-quality problem hospital inventory audits flag repeatedly. See §9 for a proposed bridge.

---

## 4. Domain Model Assessment

*Covers audit scope §3 (Clinical Catalog Integration), §6 (Handling & Compliance), §7 (Packaging & Conversion Factors), and §9 (Separation of Responsibilities).*

### Where each layer's data actually lives, verified against migrations

| Field | Correct owner (audit brief) | Actual owner (verified) | Assessment |
|---|---|---|---|
| Generic name, dosage form, strength | Clinical Catalog | `inventory_items` columns (also loosely in catalog's `metadata` JSON) | **Misplaced** |
| Storage conditions, cold-chain requirement | Clinical Catalog | `inventory_items` columns only — catalog table has none | **Misplaced** |
| Controlled-substance flag & schedule | Clinical Catalog | `inventory_items` columns only — catalog table has none | **Misplaced** |
| Conversion factor / dispensing unit | Clinical Catalog (or reusable packaging master) | Flat `inventory_items.conversion_factor` column, per item | **Misplaced, non-hierarchical** |
| Route, ATC classification, therapeutic class | Clinical Catalog | Not modeled anywhere as structured data | **Not implemented** |
| Batch number, lot, expiry, quantity, cost, supplier, warehouse | Batch/Lot | `inventory_batches` table — correctly separate, correctly keyed to item + warehouse | **Correct** |
| Reorder level, default warehouse, default supplier | Inventory (item master) | `inventory_items` columns — correct layer | **Correct** |
| Hazard information | Clinical Catalog / Compliance | Not present in any model, migration, or form — zero matches repo-wide | **Not implemented** |

### Clinical Catalog's own schema is thinner than the audit brief expects

`platform_clinical_catalog_items` (the Clinical Catalog table) has only `catalog_type`, `code`, `name`, `department_id`, `category`, `unit`, `description`, a JSON `metadata` blob, and `status`. Everything the audit brief lists as catalog-owned master data — dosage form, strength, route, ATC classification, cold-chain, controlled-substance — either lives on the *inventory* side instead, or is stuffed into the untyped `metadata` JSON with no enforced schema. The frontend already has to defensively read both `dosageForm` and `dosage_form` keys from that blob (`stringMetadataValue(metadata, 'dosageForm', 'dosage_form')`), which is a direct symptom of not having a typed column.

The FK that *does* exist — `inventory_items.clinical_catalog_item_id` — was retrofitted four migrations after the base table (`2026_04_23_…`), backfilled by fuzzy code/name matching against existing rows. That's evidence the catalog-first design was bolted on, not designed in from day one; it's now enforced going forward (correctly), but the historical duplication it was meant to replace was never cleaned up.

### Compliance ownership: not inherited, not gated

Cold-chain and controlled-substance status are re-entered per inventory item rather than sourced from the catalog (because the catalog has nowhere to store them). Category metadata supplies sensible *defaults* (Blood Product forces `requiresColdChain` client-side, for instance) but nothing stops a user from toggling Controlled Substance on for any category the enum marks eligible. Permission-wise, item creation — including these two flags — is gated by a single flat permission, `inventory.procurement.manage-items`. There is no separate, stricter permission for compliance-sensitive fields. In a hospital pharmacy context, controlled-substance classification is usually something a governance/compliance role owns, not something every inventory manager can set incidentally while creating stock.

### Packaging: the right model exists, and isn't used

This is the most striking finding. There *is* a proper multi-unit-of-measure model already built: `inventory_item_units` (migration `2026_06_20_000001`) — `unit_name`, `unit_code`, `base_quantity`, `is_base_unit`, `is_default_sales_unit`, `is_default_purchase_unit`, per-unit `barcode` — plus a working `InventoryUnitConversionService` and a full REST controller (`InventoryItemUnitController`). This is exactly the Tablet → Blister → Box → Carton hierarchy the audit brief asks about, and the backend can already resolve arbitrary units back to a base quantity.

It is not reachable anywhere in the Create/Edit Inventory Item UI. A repo-wide search of every page under `resources/js/pages/inventory-procurement/` for any reference to the item-units screen or endpoint returns nothing. The form users actually fill in only exposes the legacy flat pair, `conversion_factor` + `dispensing_unit` — a single ratio, no hierarchy, no purchase-vs-sale distinction. Two packaging systems exist in this codebase; only the weaker one is in front of users.

### Separation of responsibilities — mixed picture

| Module | Owns | Verified from | Assessment |
|---|---|---|---|
| Clinical Catalog | Drug/service definitions, formulary status | `platform_clinical_catalog_items` | Thin schema, JSON-heavy |
| Inventory (item master) | Stock policy, warehouse/supplier defaults, current stock | `inventory_items`, `EloquentInventoryItemRepository` | Also carries clinical fields it shouldn't |
| Batch/Lot | Batch number, expiry, quantity, receiving cost | `inventory_batches` | **Correctly separated** |
| Procurement/Consumption | Recipe/BOM linking a catalog item to inventory usage | `clinical_catalog_consumption_recipe_items` | **Well-modeled**, real FK, waste-factor field |
| Warehouse | Physical storage locations | `inventory_warehouses`, FK'd from items and batches | **Correct** |
| Pharmacy Administration | Compliance/formulary governance | No dedicated permission tier found | Not modeled as a distinct role |

The `clinical_catalog_item_id` FK convention is applied consistently platform-wide — it links Inventory, Billing (`billing_service_catalog_items`), and, as of a very recent migration, `chargeable_items`, replacing a fragile ID-reuse convention with a real foreign key. That's a genuinely good, deliberate pattern; the inventory module just doesn't yet lean on it fully, because it still keeps its own copies of the fields the FK should make unnecessary.

---

## 5. Identified Issues

Open items only. Four issues found and fixed during this engagement are listed separately at the end for the record.

### 🔴 HIGH — Clinical master data is duplicated onto `inventory_items`, and the one integrity guard doesn't cover it

**Failure scenario:** Four write paths can touch the same fields — the interactive Create/Edit dialog (UI-locked once catalog-linked), `BulkCreateInventoryItemsFromCatalogUseCase`, `ImportInventoryItemsUseCase` (CSV), and offline sync. `InventoryClinicalLinkGuard::assertModelCanPersist()` only checks `item_code`, `item_name`, `category`, and `clinical_catalog_item_id` — it never re-derives or locks `dosage_form`, `strength`, `requires_cold_chain`, or `is_controlled_substance`. A non-UI write path can persist a value for a linked item that disagrees with its own catalog entry, and nothing at the model layer will catch it.
**Files:** `InventoryClinicalLinkGuard.php`, `InventoryItemModel.php`, `2026_04_19_000700_extend_inventory_items_for_modern_hospital.php`
**Type:** Domain-model correctness

### 🔴 HIGH — A real multi-UOM packaging model exists but is disconnected from the item-creation UI

**Failure scenario:** A pharmacist creating "Amoxicillin 500mg" cannot record that it's dispensed as tablets but purchased in boxes-of-100 — the Create Item form only exposes one flat conversion factor. The correct table (`inventory_item_units`) and service (`InventoryUnitConversionService`) already exist and are fully functional via API, just never surfaced.
**Files:** `2026_06_20_000001_create_inventory_item_units_table.php`, `InventoryItemUnitController.php` — zero references in `resources/js/pages/inventory-procurement/`
**Type:** Architectural / feature-parity gap

### 🟠 MEDIUM — Category is hardcoded with no admin configurability, and duplicated on the frontend

**Failure scenario:** Adding a category requires a PHP deploy. The frontend's offline fallback list (`DEFAULT_ITEM_CATEGORIES`) is a second, hand-maintained copy of the backend enum with no build-time or test-time check that they match.
**Files:** `InventoryItemCategory.php`, `IndexV2.vue` (`DEFAULT_ITEM_CATEGORIES`)
**Type:** Architectural / scalability

### 🟠 MEDIUM — Subcategory is frontend-only free text, not master data

**Failure scenario:** No `inventory_subcategories` table exists. Only 2 of 14 categories have a curated list (Pharmaceutical, Medical Consumable); every other category falls back to a generic 4-item list. The taxonomy already disagrees with the Clinical Catalog's own therapeutic categories in places (e.g. `iv_fluids` here vs. `fluids_and_electrolytes` seeded on catalog items) — concrete evidence of the drift risk this creates. No cross-facility reporting rollup is possible on a free-text field.
**Files:** `IndexV2.vue` (`ITEM_SUBCATEGORY_OPTIONS`), `PharmacyClinicalCatalogSeeder.php`
**Type:** Domain-model correctness

### 🟠 MEDIUM — No bridge from item creation into first batch / opening stock

**Failure scenario:** `submitCreateItem()` closes the dialog and reloads the list on success — no prompt to record opening stock. New items default to zero stock with no nudge to correct that, which is a common hospital-inventory data-quality complaint.
**Files:** `IndexV2.vue` (`submitCreateItem`)
**Type:** UX / workflow

### 🟠 MEDIUM — No permission tier separates routine item creation from compliance-sensitive fields

**Failure scenario:** A single flat permission, `inventory.procurement.manage-items`, governs everything from setting a bin location to marking an item a controlled substance. Nothing requires a stricter, pharmacy-governance-level permission for the latter.
**Files:** `IndexV2.vue` (`canManageItems`, line ~2094)
**Type:** Domain-model / regulatory-adjacent

### 🔵 LOW — Two parallel code paths create pharmaceutical inventory items

**Failure scenario:** The interactive Create Item dialog and `BulkCreateInventoryItemsFromCatalogUseCase` ("Sync from Catalog") each independently implement the same catalog-link rules. Both currently agree, verified — but every future rule change has to be made twice.
**Files:** `CreateInventoryItemUseCase.php`, `BulkCreateInventoryItemsFromCatalogUseCase.php`
**Type:** Maintainability

### 🔵 LOW — "Hazard Information" has no implementation

**Failure scenario:** Zero matches for "hazard" anywhere under `app/Modules`. This is not a defect in existing code — it's an unbuilt requirement. Flagging per the audit brief's request rather than speculating on what it should look like; needs product scoping (what counts as a hazard, who classifies it, where it's sourced from) before any implementation judgment is possible.
**Files:** None found — additional inspection/requirements needed
**Type:** Not implemented

### ✅ Fixed during this engagement

- Clinical medicine picker rendered for every category, not just Pharmaceutical
- Medicine picker wasn't filtered by the chosen pharmaceutical subcategory
- Nine disabled fields shown individually after catalog-link, instead of one compact summary
- Conversion Factor field was locked despite never being populated by catalog selection

---

## 6. Recommended Improvements

Mapped 1:1 to the issues above. Each states why, the usability/maintainability impact, and what kind of change it is.

**Make the Clinical Catalog the sole source for clinical descriptors.** Add typed columns to `platform_clinical_catalog_items` for dosage form, strength, route, cold-chain requirement, and controlled-substance status (promoting them out of the untyped `metadata` blob and out of `inventory_items` entirely). Read them via the existing `clinical_catalog_item_id` relation at request time rather than copying them at creation time. *Why:* a drug's clinical profile shouldn't need re-entry per facility, and a single owner eliminates the drift four separate write paths currently make possible. *Impact:* removes an entire class of latent data-integrity bugs; lowers the surface area of `inventory_items` substantially. *Type:* domain-model correction.

**Wire the Create/Edit Item UI to `inventory_item_units` instead of the flat conversion factor.** Replace the single Conversion Factor input with a small packaging editor backed by the existing units API — base unit, purchase unit, sales unit, each with its own ratio. *Why:* the backend already supports this correctly; the UI is the only missing piece. *Impact:* unlocks real box/blister/carton receiving and dispensing math that pharmacy operations need and currently can't express. *Type:* UX improvement backed by an architectural fix (surfacing existing capability, not building new).

**Move category and subcategory to configurable master data — eventually.** A proper `inventory_categories`/`inventory_subcategories` pair (or fold subcategory into the Clinical Catalog's own `category` field for pharma, since the values should be the same taxonomy) with an admin CRUD screen. *Why:* removes the deploy-to-add-a-category friction and the duplicated hardcoded lists that already disagree in one place. *Impact:* real, but the enum's metadata-driven behavior (form templates, expiry rules) makes this a bigger lift than it looks — see Priority Matrix. *Type:* architectural improvement.

**Offer opening-stock entry immediately after item creation.** On successful create, instead of only closing the dialog, offer (not force) a "Record opening stock" step reusing the existing stock-movement flow. *Why:* closes the gap between "item exists" and "item is stockable," without merging two transactions that are legitimately separate in most ERPs. *Impact:* fewer zero-stock items sitting unnoticed. *Type:* UX improvement.

**Introduce a stricter permission for compliance-sensitive fields.** Gate `requiresColdChain` overrides and controlled-substance classification behind a narrower permission (e.g. `inventory.procurement.manage-compliance`) checked server-side, independent of general item-management rights. *Why:* matches how mature Pharmacy/HIS systems treat formulary governance as a distinct role from day-to-day stock management. *Impact:* closes a regulatory-adjacent gap without slowing down routine item creation. *Type:* domain-model / security correction.

**Consolidate the two item-creation code paths onto one rule set.** Extract the shared catalog-link validation into one service both `CreateInventoryItemUseCase` and `BulkCreateInventoryItemsFromCatalogUseCase` call, rather than two independent implementations that currently happen to agree. *Why:* removes a maintainability trap before it causes a real divergence. *Impact:* lower risk on future rule changes. *Type:* architectural improvement.

---

## 7. Priority Matrix

No finding in this audit is production-breaking or actively corrupting data today — the two High items are latent-integrity risks (multiple write paths, one guard), not live incidents.

| Priority | Item | Driven by |
|---|---|---|
| 🔴 High | Clinical data duplicated on `inventory_items`, uncovered by the integrity guard | Data integrity across 4 write paths |
| 🔴 High | Multi-UOM packaging model unused by the UI | Feature gap blocking real pharmacy packaging workflows |
| 🟠 Medium | Category hardcoded, duplicated on frontend | Scalability for multi-facility deployment |
| 🟠 Medium | Subcategory is frontend free text, not master data | Reporting rollups, cross-facility consistency |
| 🟠 Medium | No bridge to first batch after item creation | Data quality (zero-stock items) |
| 🟠 Medium | No permission tier for compliance fields | Regulatory-adjacent governance |
| 🔵 Low | Two divergent item-creation code paths | Maintainability |
| 🔵 Low | Hazard Information not implemented | Unscoped requirement, not a defect |

---

## 8. Proposed Refactoring Plan

Sequenced by dependency, not by priority — packaging and clinical-data consolidation both depend on decisions in phase 1.

**Phase 1 — Clinical Catalog schema hardening.** Add typed columns for dosage form, strength, route, cold-chain, controlled-substance status on `platform_clinical_catalog_items`. Backfill from existing `inventory_items` rows and the untyped `metadata` JSON where present. No UI change yet — this is purely the schema and data-migration foundation everything else builds on. *Blocks: Phase 2, the High-priority "duplicated clinical data" fix.*

**Phase 2 — Read clinical fields from the catalog relation; retire the duplicated columns.** Update `InventoryItemResponseTransformer` and the create/edit forms to read dosage/strength/cold-chain/controlled-substance through `clinicalCatalogItem` rather than local columns. Extend `InventoryClinicalLinkGuard` to cover these fields. Drop the now-redundant columns from `inventory_items` once all read paths are migrated. *Depends on Phase 1. Closes the High-priority data-integrity finding.*

**Phase 3 — Wire the Create/Edit Item UI to `inventory_item_units`.** Replace the flat Conversion Factor field with a packaging editor against the existing units API. Independent of Phases 1–2; can run in parallel. *Closes the second High-priority finding.*

**Phase 4 — Category/subcategory master data + admin screen.** Larger lift: requires preserving the enum's behavioral metadata (form templates, expiry/cold-chain rules) as data rather than code — likely a rules table keyed by category, not just a name/label table. *Independent; can be deferred behind Phases 1–3.*

**Phase 5 — Workflow + permission polish.** Opening-stock bridge after item creation; new compliance-field permission; consolidate the two item-creation code paths onto shared validation. *Independent; lowest technical risk, can run any time.*

---

## 9. Suggested UI/UX Mock Workflow

Keeps item creation and stock receipt as distinct transactions (correctly, per the workflow assessment in §3) while closing the gap between them.

1. **Select category** — form renders only the fieldsets that category's metadata supports (already correct today).
2. **Select Clinical Catalog item, if Pharmaceutical** — medicine list now filters by subcategory (fixed this session).
3. **Master data populates from the catalog relation** — post-Phase 2: read live from Clinical Catalog, not copied at save time.
4. **Compact summary card shown** — one card, not nine disabled fields (fixed this session).
5. **Only editable inventory fields remain visible** — warehouse, supplier, reorder level, bin location, packaging (post-Phase 3).
6. **Save inventory item** — existing submit, unchanged.
7. **New: Offer to record opening stock** — dismissible prompt into the existing Receive Stock flow, not a forced merge of the two transactions.

Step 7 is the only new screen. Everything above it is either already correct or already fixed this session — the mock workflow in the audit brief is closer to this codebase's current state than it might appear.

---

## 10. Modern ERP/HIS Comparison

| Concern | SAP / Oracle / Dynamics 365 / Odoo pattern | This system | Alignment |
|---|---|---|---|
| Material/item master as single source of physical & clinical truth | One material master record, referenced everywhere (SAP MARA, Odoo `product.template`) | Split across Clinical Catalog + duplicated columns on Inventory | Partial |
| UOM/packaging defined once, reused across plants/warehouses | SAP MARM, Odoo `uom.uom` categories — defined once | Proper table exists (`inventory_item_units`) but keyed per inventory item, not per catalog item, and unused by the UI | Deviates |
| Category-driven dynamic form behavior | Field-level business rules (Dynamics 365), material type config (SAP) | Enum metadata drives field visibility consistently | Follows |
| Batch/lot as a distinct transactional layer | SAP batch management, Odoo `stock.lot` | `inventory_batches`, correctly separated and FK'd | Follows |
| Formulary/compliance governance as a distinct role | Pharmacy & Therapeutics committee ownership in mature HIS (e.g. Oracle Health, Epic Willow) | Single flat permission covers all item management | Deviates |
| Item creation → goods receipt as linked but distinct steps | Distinct transactions, often with a "continue to receiving" shortcut | Distinct, but no shortcut — fully manual reconnection | Partial |

---

## 11. Field Ownership Audit

Every field in the Create Inventory Item form (`createEmptyItemForm()`, `IndexV2.vue`), mapped 1:1 against `inventory_items` columns. "Recommended treatment" is the target state under the Phase 1–3 refactor in §8, not necessarily what's implemented today — where today already matches the target, it's called out as correct.

| # | Field | Authoritative owner | Recommended treatment | Justification |
|---|---|---|---|---|
| 1 | `clinicalCatalogItemId` | Clinical Catalog | **Editable** (selector) | The join key everything else depends on. Must stay an active, first-class choice for Pharmaceutical — it's the trigger, not a derived value. |
| 2 | `itemCode` | Clinical Catalog (pharma) / Inventory (non-catalog) | **Auto-populated + read-only** when linked; **Editable** otherwise | Already correct today. |
| 3 | `itemName` | Clinical Catalog (pharma) / Inventory (non-catalog) | **Auto-populated + read-only** when linked; **Editable** otherwise | Already correct today. |
| 4 | `genericName` | Clinical Catalog | **Read-only, sourced live from the catalog relation** — not stored on `inventory_items` post-refactor | A drug's generic name doesn't vary by facility; storing it per inventory row is what created the drift risk in §5. |
| 5 | `dosageForm` | Clinical Catalog | **Read-only**, catalog relation | Same reasoning as generic name. |
| 6 | `strength` | Clinical Catalog | **Read-only**, catalog relation | Same reasoning. |
| 7 | `category` | Inventory Category | **Editable** (required selector), **Configurable** long-term | Genuinely an inventory/physical-stock concept, distinct from clinical classification — correctly owned here. |
| 8 | `subcategory` | Clinical Catalog (pharma, mirrors therapeutic class) / Inventory Category (non-pharma) | **Auto-populated + read-only** for Pharmaceutical (already partially wired — `selectClinicalCatalogItem` sets it from the catalog's `category`); **Configurable** selection (not free text) for everything else | For pharma the value already originates from the catalog at selection time; letting it also be freely hand-edited afterward is how it can drift from the source it was just copied from. |
| 9 | `venClassification` | Inventory (facility-level formulary policy) | **Editable**, **Configurable** options | WHO's VEN classification legitimately varies by facility/site, unlike dosage or strength — correctly kept at this layer. |
| 10 | `abcClassification` | Inventory (consumption-driven) | **Editable** today; ideally **auto-computed** from consumption data | Out of scope to design here — flagging as a future system-computed field, not a defect. |
| 11 | `unit` (Stock Unit) | Packaging Definition | **Auto-populated + read-only** for catalog-linked items; **Configurable** selection (from the item's defined base unit) otherwise | This is exactly what `inventory_item_units.is_base_unit` represents — a free-text duplicate invites mismatches with the real base unit. |
| 12 | `dispensingUnit` | Clinical Catalog / Packaging Definition | **Auto-populated + read-only** for pharma | Dispensing unit is a clinical/dispensing-practice attribute of the drug, already sourced from the catalog at selection time. |
| 13 | `conversionFactor` | Packaging Definition | **Removed** from this flat form; replaced by a packaging editor (§8 Phase 3) | A single scalar can't express a Tablet → Blister → Box hierarchy; `inventory_item_units.base_quantity` already models this correctly and should be the only source. |
| 14 | `binLocation` | Warehouse (per warehouse-item pairing) | **Configurable** per warehouse, not a single global default on the item | The same item sits in different bins in different warehouses; one global text field on the item master breaks down the moment an item is stocked in more than one location — a real modeling gap worth naming even though it wasn't raised in the original brief. |
| 15 | `manufacturer` | Batch/Lot (with an item-level default) | **Editable** default at item level is acceptable; **should also be capturable per batch** | Generics are routinely sourced from different manufacturers across purchase orders — fixing manufacturer once at the item level loses that. `inventory_batches` currently has no manufacturer column at all. |
| 16 | `storageConditions` | Clinical Catalog | **Auto-populated + read-only** for catalog-linked pharma; category-driven default for everything else | Storage requirements are a formulary/pharmacology attribute of the product, not a per-facility choice. |
| 17 | `requiresColdChain` | Clinical Catalog | **Auto-populated + read-only**, editable only via catalog/formulary administration | Cold-chain need is a property of the drug itself — see §4 Compliance Ownership. |
| 18 | `isControlledSubstance` | Clinical Catalog / Regulatory | **Auto-populated + read-only**, editable only by a pharmacy-admin/compliance role at the catalog level | Legal/regulatory classification of the drug, not a per-item toggle any inventory manager should set incidentally. |
| 19 | `controlledSubstanceSchedule` | Clinical Catalog / Regulatory | Same as above | Same reasoning. |
| 20 | `msdCode` | Clinical Catalog (national formulary code) | **Auto-populated + read-only** when linked (already correct post this session's summary-card fix) | Standards code belongs to the drug definition, not the local inventory row. |
| 21 | `nhifCode` | Clinical Catalog (billing/insurance code) | **Auto-populated + read-only** when linked (already correct) | Same reasoning. |
| 22 | `barcode` | Packaging Definition (per unit) | **Editable** as an interim base-unit convenience field; ideally read through from the unit's own `barcode` | `inventory_item_units` already has its own per-unit barcode column — a box and a strip legitimately have different barcodes. |
| 23 | `reorderLevel` | Inventory Item (facility default) | **Editable** | Correct as-is; note mature multi-warehouse systems often vary this per warehouse — flagged as a watch item, not a current defect. |
| 24 | `maxStockLevel` | Inventory Item (facility default) | **Editable** | Correct as-is, same caveat as above. |
| 25 | `defaultWarehouseId` | Inventory Item, sourced from Warehouse | **Editable** (required selector) | Correct as-is. |
| 26 | `defaultSupplierId` | Inventory Item, sourced from Supplier | **Editable** (optional selector) | Correct as-is. |

**Net effect if the target column is followed:** 11 of 26 fields (generic name, dosage form, strength, dispensing unit, conversion factor, storage conditions, cold chain, controlled-substance flag + schedule, MSD code, NHIF code) stop being independently entered or stored per inventory item at all — they become read-only projections of the Clinical Catalog and Packaging Definition. That's the concrete shape of the "duplicated data" finding in §5 turned into a field-by-field plan.

## 12. Master Data Strategy

Every attribute currently touched by inventory item creation, assigned to the layer that should own it. "Today" reflects what's verified in the schema; "Target" is the recommended end state.

| Attribute group | Examples | Today | Target owner | Why |
|---|---|---|---|---|
| Clinical identity | Generic name, dosage form, strength, route | `inventory_items` columns (+ loosely in Clinical Catalog's `metadata` JSON) | **Clinical Catalog** — as typed columns, not JSON | One drug, one definition, reused by every facility's inventory row via `clinical_catalog_item_id`. |
| Compliance flags | Cold-chain requirement, controlled-substance flag + schedule | `inventory_items` columns only — Clinical Catalog has no equivalent columns | **Clinical Catalog**, admin-gated | These are properties of the drug, not a per-facility choice; see the permission gap in §5. |
| Standards codes | MSD code, NHIF code | `inventory_items` columns, auto-populated from catalog `codes` JSON at link time | **Clinical Catalog** | Already sourced from the catalog at selection time — storing a separate copy is redundant, not additive. |
| Physical/stock classification | Category, form-template behavior flags | PHP enum (`InventoryItemCategory`) | **Inventory Category** — promoted to configurable master data (§8 Phase 4) | Genuinely an inventory-layer concept (how the *item* is handled physically), distinct from clinical classification. |
| Facility formulary classification | VEN, subcategory (non-pharma) | `inventory_items` columns / frontend-only free text | **Inventory Category** (structured, not free text) | Legitimately facility-specific, but still needs to be a controlled vocabulary, not hand-typed strings. |
| Packaging hierarchy | Base/purchase/sales unit, conversion ratios, per-unit barcode | `inventory_item_units`, correctly modeled but keyed to `item_id` and unused by the UI | **Packaging Definition**, ideally keyed to the catalog product so it's defined once and reused across every facility's copy of the same item | This is the single biggest scalability gap found: the right table exists, but every facility currently has to redefine packaging from scratch for the same drug. |
| Stock policy | Reorder level, max stock level, current stock, status | `inventory_items` columns | **Inventory Item** | Correctly owned today — this is genuinely per-facility operational data. |
| Location defaults | Default warehouse, bin location | `inventory_items` columns (single global bin location) | Default warehouse: **Inventory Item**. Bin location: **Warehouse** (per warehouse-item pairing) | A default warehouse preference is reasonably item-level; a bin location is not — see row 14 in §11. |
| Party defaults | Default supplier | `inventory_items` column, FK to `inventory_suppliers` | **Inventory Item** (preference), **Supplier** (identity/contact/banking) | Correctly split today — the item only stores a preference, not supplier detail. |
| Vendor identity | Supplier code, name, TIN, bank account, contact | `inventory_suppliers` | **Supplier** | Correctly modeled, not duplicated elsewhere. |
| Warehouse identity | Warehouse code, name, type, location, contact | `inventory_warehouses` | **Warehouse** | Correctly modeled, not duplicated elsewhere. |
| Receipt-specific facts | Batch/lot number, manufacture/expiry date, quantity, unit cost, actual supplier, actual warehouse | `inventory_batches` | **Batch/Lot** | Correctly modeled today — the one layer that's fully right. |
| Manufacturer (actual) | Which manufacturer supplied *this* batch | Not modeled — only an item-level default exists | **Batch/Lot** (new column) | Follows from row 15 in §11 — generics vary by purchase order. |

### Recommended target architecture, in one paragraph

Clinical Catalog becomes the single owner of everything that describes *what the drug or product is* — identity, dosage, strength, storage/compliance requirements, standards codes — as typed columns, not JSON. A Packaging Definition layer (the already-built `inventory_item_units` table, re-keyed to the catalog product rather than the per-facility inventory row) owns *how it's packaged and converted between units*, defined once and inherited everywhere. Inventory Category owns *how the item is physically handled and classified* for stock purposes — a promoted, configurable version of today's enum. Inventory Item shrinks to just *facility operational policy*: current stock, reorder thresholds, default warehouse/supplier preferences, status. Warehouse and Supplier stay exactly as they are today (already correctly scoped). Batch/Lot stays the record of *what actually happened on receipt* — and gains a manufacturer column, since that's a receipt-time fact, not a product-definition fact. The result: every attribute has exactly one place it can be edited, and every other layer reads it through a foreign key instead of copying it.

## 13. Final Verdict

**Partially aligned with modern ERP/HIS practice.** The parts of this workflow that are hardest to get right — metadata-driven dynamic rendering, and a properly separated batch/lot ledger — are already correct, and this session closed the four concrete UI bugs that were undermining the first of those. What's left is not a rendering problem; it's that clinical master data hasn't fully moved into the Clinical Catalog it's supposed to live in, and a genuinely good packaging model was built and then never connected to the screen that needs it.

Neither of those two High-priority items is urgent in the sense of active data loss — they're the kind of debt that is cheap to fix now and expensive once more facilities, more write paths, and more historical data accumulate on top of it. Recommend Phase 1–3 of the refactoring plan before this module is extended to additional facilities or additional inventory categories.

*This report reflects only what could be verified in the repository at the time of review — migrations, models, requests, guards, and the Vue implementation of the Create/Edit Inventory Item workflow. Where something could not be confirmed from code (Hazard Information), it is stated as unimplemented rather than assumed.*
