# DSK Formulary Seeders — Blueprint

## Overview

Three seeders + one migration compose the formulary master data for the DSK
private dispensary. They must run **in order** because each depends on the
previous.

---

## Order of Execution

```bash
php artisan db:seed --class=DskFormularyClinicalCatalogSeeder --force
php artisan db:seed --class=DskFormularyPackagingTemplateSeeder --force
```

The migration runs separately because it targets *production* databases that
already ran the old seeder (pre-clinical-descriptor-columns) and need a
one-time backfill.

---

## 1. `DskFormularyClinicalCatalogSeeder`

**File:** `database/seeders/DskFormularyClinicalCatalogSeeder.php`

Creates 185 formulary items for the DSK facility in the
`platform_clinical_catalog_items` table (`catalog_type = 'formulary_item'`).

### What it sets

| Column | Source |
|---|---|
| `name`, `code`, `category`, `unit`, `description` | Hardcoded 185-item array |
| `generic_name` | Derived from `name` (strips strength, brand parens, trailing form words) or explicit override for combinations |
| `strength` | Parsed from `name` via regex or explicit override (null for combos without a clear strength) |
| `dosage_form` | Derived from `unit` + `name` — name-aware for `each`/`tube`/`bottle` units. Produces values matching the `dosageFormOptions` dropdown: `tablet`, `capsule`, `syrup`, `suspension`, `solution`, `injection`, `cream`, `ointment`, `gel`, `lotion`, `eye drops`, `ear drops`, `nasal drops`, `suppository`, `pessary`, `powder` |
| `route` | Derived from `dosage_form` + `name` name checks (IV→intravenous, eye→ophthalmic, etc.) |
| `storage_conditions` | Default vs cold-chain (2–8°C) for `MED-TETAN-05IM` |
| `requires_cold_chain` | `true` only for `MED-TETAN-05IM` |
| `is_controlled_substance` | `true` for tramadol, diazepam, pregabalin codes |
| `controlled_substance_schedule` | `schedule_IV` for controlled codes |
| `generic_group_code` | Uppercased slug of `generic_name` |
| `metadata` | JSON object with `strength`, `dosageForm`, `route`, `otcAllowed`, `packSize`, `stockUnit`, `conversionFactor`, `purchaseUnit`, `purchaseUnitQuantity` |

### Override mechanism

60+ codes have explicit overrides for `generic_name` and/or `strength`.
Combination drugs (e.g. "Artemether + Lumefantrine", "Amoxicillin +
Clavulanate") and non-standard products (e.g. "Cough syrup", "Gripe water")
rely on these overrides. The override uses `array_key_exists` (not `??`) so
that `null` values are respected.

### Idempotency

Uses `updateOrCreate` keyed on `(facility_id, catalog_type, code)` —
safe to re-run.

---

## 2. `DskFormularyPackagingTemplateSeeder`

**File:** `database/seeders/DskFormularyPackagingTemplateSeeder.php`

Creates reusable pack-size templates in
`clinical_catalog_item_packaging_templates` for every formulary item.

### What it creates per item

| Template | `unit_name` | `base_quantity` | Flags |
|---|---|---|---|
| Base unit | Item's `metadata.stockUnit` | 1 | `is_base_unit=true`, `is_default_sales_unit=true` |
| Purchase unit | Item's `metadata.purchaseUnit` | `metadata.purchaseUnitQuantity` | `is_default_purchase_unit=true` |

A purchase-unit template is skipped when stock and purchase units are the
same (e.g. both `bottle`).

### Example output

| Item | Base template | Purchase template |
|---|---|---|
| Paracetamol 500 mg tablet | tablet x1 [base, sales] | box x100 [purchase] |
| Tramadol 50 mg capsule | capsule x1 [base, sales] | box x100 [purchase] |
| Amoxicillin syrup 100 ml | bottle x1 [base, sales] | box x12 [purchase] |
| Ceftriaxone 1 g injection | ampoule x1 [base, sales] | box x50 [purchase] |
| Paracetamol suppository | each x1 [base, sales] | box x100 [purchase] |

### Idempotency

Uses `updateOrCreate` keyed on `(clinical_catalog_item_id, unit_name)` —
safe to re-run.

### Dependency

Requires `DskFormularyClinicalCatalogSeeder` to have run first (items must
exist with populated `metadata`).

---

## 3. Backfill Migration

**File:**
`database/migrations/2026_07_26_000012_backfill_null_clinical_descriptors_for_formulary_catalog.php`

One-time migration for production databases that ran the *old* version of
`DskFormularyClinicalCatalogSeeder` (which only set basic fields —
no `generic_name`, `dosage_form`, etc.).

### What it does

1. Finds all formulary items where `dosage_form` is not in the valid
   dropdown list (covers both never-backfilled items with NULL and
   previously-backfilled items with old values like `oral_solution`,
   `infusion`, `ophthalmic_solution`).
2. Re-derives all clinical descriptor fields from the existing `name`,
   `unit`, `code` using the same derivation engine as the seeder.
3. Updates the typed columns and the `metadata` JSON.

### Rollback

`down()` is a no-op — reversing would discard clinical data.

### When to run

```bash
php artisan migrate --force
```

Only needed on databases that existed before the clinical descriptor columns
were added. Fresh installations through the full seeder sequence do not need
this migration.

---

## 4. `DskClinicalCatalogConsumptionRecipeSeeder`

**File:** `database/seeders/DskClinicalCatalogConsumptionRecipeSeeder.php`

Creates consumption-recipe lines (links between clinical catalog items and
inventory items) in the `clinical_catalog_consumption_recipe_items` table for
laboratory tests, radiology procedures, and clinical procedures.

### What it seeds

~170 recipe lines across 43 catalog items:

| Catalog type | Items | Lines (avg) |
|---|---|---|
| Lab tests (16) | LAB-MRDT-001 .. LAB-URA-001 | 3–6 per test |
| Radiology (2) | RAD-US-ABD/PEL-001 | 3 per procedure |
| Clinical procedures (25) | CLN-WOUND-CLEAN-001 .. CLN-ASTHMA-NEB-001 | 1–9 per procedure |

### Recipe fields

| Column | Source |
|---|---|
| `clinical_catalog_item_id` | Resolved from `facility_id` + catalog `code` |
| `inventory_item_id` | Resolved from `facility_id` + inventory `item_code` |
| `quantity_per_order` | Hardcoded per recipe line |
| `unit` | Matches the inventory item's dispensing unit |
| `waste_factor_percent` | Defaults to 0 |
| `consumption_stage` | `sample_collection`, `processing`, or `procedure_completion` |

### Idempotency

Uses `firstOrCreate` keyed on the unique index
`(clinical_catalog_item_id, inventory_item_id)` — safe to re-run.

### Dependencies

Requires all four clinical-catalog seeders + inventory seeder to have run
first so that both catalog and inventory items exist:

```bash
php artisan db:seed --class=DskLabClinicalCatalogSeeder --force
php artisan db:seed --class=DskRadiologyClinicalCatalogSeeder --force
php artisan db:seed --class=DskClinicalClinicalCatalogSeeder --force
php artisan db:seed --class=DskInventoryItemsSeeder --force
php artisan db:seed --class=DskClinicalCatalogConsumptionRecipeSeeder --force
```

---

## 5. `DskInventoryItemsSeeder` — Extra consumables

**File:** `database/seeders/DskInventoryItemsSeeder.php`

In addition to the original 222 items, the seeder now creates ~40 extra
items in three groups:

| Group | Count | Examples |
|---|---|---|
| Laboratory supplies | 14 | Lancets, EDTA capillary tubes, vacutainer needles, urine dipsticks, KOH, normal saline, spatulas, surgical spirit, cotton swabs, povidone iodine |
| Medical consumables | 24 | Sterile gauze, bandages, adhesive tape, scalpel blades, lidocaine injection, suture material, MVA kit, implant rods, nebulisation masks, IV accessories, separate hypodermic needles (21G/23G/26G), 1 ml syringes |
| Radiology supplies | 2 | Ultrasound gel, probe covers |

These items are referenced by `DskClinicalCatalogConsumptionRecipeSeeder` and
were added to fill the gap between what procedures consume and what was in
stock.

---

## Running the Full Sequence (Cloud / Fresh Install)

```bash
php artisan migrate --force
php artisan db:seed --class=DskFormularyClinicalCatalogSeeder --force
php artisan db:seed --class=DskFormularyPackagingTemplateSeeder --force
php artisan db:seed --class=DskClinicalCatalogConsumptionRecipeSeeder --force
```
