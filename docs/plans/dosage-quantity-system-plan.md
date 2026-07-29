# Structured Dosage & Quantity System Plan

## Problem

Clinicians prescribe injections using free-text `dosageInstruction` and a raw `quantityPrescribed` that defaults to `"1"` — with no connection to the medication's catalog-defined strength/concentration. For example:

| Medication | Catalog Strength | Catalog Unit | Clinician Prescribes | Should Be |
|---|---|---|---|---|
| Tramadol 100 mg/2 ml injection | `100 mg/2 ml` | `ampoule` | `1` `ml` | `2` `ml` (or `1` `ampoule`) |
| Hydrocortisone 100 mg injection | `100 mg` | `vial` | `1` `ml` | `1` `vial` |

No conversion or validation exists between the therapeutic dose (what the clinician intends) and the dispense quantity (what the pharmacy prepares).

### Root Causes

1. **`ClinicalCatalogItem` TypeScript type is missing `strength`, `genericName`, `dosageForm`, `route`** — even though the API returns them (`ClinicalCatalogItemResponseTransformer.php:23`).
2. **No strength display** when clinician picks a medication — the picker shows name + code only.
3. **`doseQuantity`/`doseUnit` fields exist in the backend model (`PharmacyOrderModel`, added in migration `2026_06_20_000001`) but have no frontend UI** — neither `EncounterInlineOrderPanel.vue` nor `PharmacyOrderCreateSheet.vue` renders them.
4. **`PharmacyInlineOrderInput` TypeScript type does not include `doseQuantity` or `doseUnit`** (`encounterInlineOrders.ts:215-228`).
5. **No concentration-to-volume conversion logic exists anywhere** — no code understands that `"100 mg/2 ml"` means `100 mg = 2 ml`.
6. **`prescribedUnit` is a free-text input** with no dropdown, no validation against the catalog's `unit` field.

## Solution Overview

Build a structured dosage system where:
- The catalog `strength` is visible throughout the prescribing flow
- Clinicians enter a **therapeutic dose** (e.g. `100` `mg`) and the system derives the **dispense quantity** (e.g. `2` `ml` or `1` `ampoule`)
- `doseQuantity`/`doseUnit` are first-class fields in both the UI and API payload
- `quantityPrescribed` is either auto-calculated or manually overridable
- Free-text `dosageInstruction` remains as a supplementary note, not the primary dosage record

## Architecture Decisions

### Strength Representation

The catalog's `strength` field is a human-readable string (e.g. `"100 mg/2 ml"`, `"500 mg"`, `"250 mg/5 ml"`). This needs a structured parser on both backend and frontend.

**Decision:** Add a computed/converted `strength_numerator_value`, `strength_numerator_unit`, `strength_denominator_value`, `strength_denominator_unit` to the catalog API response, derived from the existing `strength` text field. This avoids a migration on the catalog table.

For single-value strengths (e.g. `"100 mg"`), denominator = `1`.

### Dose Entry Paradigm

**Decision:** Two modes, user-switchable:
1. **Simple mode:** Clinician enters `quantityPrescribed` + `prescribedUnit` (as now, but with catalog-aware unit dropdown)
2. **Dose mode:** Clinician enters `doseQuantity` + `doseUnit` + optional `frequency` + `duration`; system calculates `quantityPrescribed`

Default to **Dose mode** for injections, Simple mode for tablets/syrups (configurable per catalog item).

### Conversion Logic

Located in a shared utility `dosageCalculator.ts` (frontend) and `DosageConverter` service class (backend). Pure functions:

```
Input:  desiredDose: { value: number, unit: string }
        strength: { numerator: { value, unit }, denominator: { value, unit } }
Output: dispenseQuantity: number
        dispenseUnit: string
```

Formula: `dispenseQuantity = (desiredDose.value / numeratorValue) * denominatorValue`

Example: desired `100 mg`, strength `100 mg / 2 ml` → `(100 / 100) * 2 = 2 ml`

## Implementation Phases

### Phase 1: Catalog Strength in API & TypeScript

**Files to change:**

| File | Change |
|---|---|
| `resources/js/lib/encounterInlineOrders.ts` (lines 19-28) | Add `strength`, `strengthNumeratorValue`, `strengthNumeratorUnit`, `strengthDenominatorValue`, `strengthDenominatorUnit`, `genericName`, `dosageForm`, `route` to `ClinicalCatalogItem` type |
| `resources/js/composables/pharmacyOrders/usePharmacyOrders.ts` (lines 82-83) | Verify `doseQuantity`/`doseUnit` are already in the `PharmacyOrder` response type |
| `app/Modules/Platform/Presentation/Http/Transformers/ClinicalCatalogItemResponseTransformer.php` | Add computed fields: `strengthNumeratorValue`, `strengthNumeratorUnit`, `strengthDenominatorValue`, `strengthDenominatorUnit` |
| `app/Modules/Platform/Infrastructure/Models/ClinicalCatalogItemModel.php` | Add accessors or a `parsedStrength(): array` method |

**Backend parser logic** (in `ClinicalCatalogItemModel` or a dedicated service):

```php
public function parsedStrength(): array
{
    // "100 mg/2 ml" → [100, 'mg', 2, 'ml']
    // "500 mg" → [500, 'mg', 1, null]
    // null → null
    if (empty($this->strength)) return null;
    
    if (str_contains($this->strength, '/')) {
        [$num, $den] = explode('/', $this->strength, 2);
        $numValue = match, $numUnit = match...
        $denValue = match, $denUnit = match...
    } else {
        // single value
        $numValue = match, $numUnit = match...
        $denValue = 1, $denUnit = null;
    }
}
```

### Phase 2: Medication Picker Shows Strength

**Files to change:**

| File | Change |
|---|---|
| `resources/js/components/pharmacyOrders/PharmacyOrderCatalogSearch.vue` (or equivalent catalog search component) | Display `strength`, `dosageForm`, `unit`, `genericName` in search results |
| `resources/js/components/domain/clinical/encounter-orders/EncounterInlineOrderPanel.vue` (pharmacy section) | Show selected medication's `strength`, `unit`, `dosageForm` in a readonly info panel after selection |

**UX:**
- Search results show: `Tramadol hydrochloride 100 mg/2 ml injection — ampoule`
- After selection, a readonly info card shows:
  ```
  Tramadol hydrochloride 100 mg/2 ml injection
  Form: Injection | Route: Intramuscular | Unit: Ampoule
  Strength: 100 mg per 2 ml (50 mg/ml)
  ```

### Phase 3: Dose & Quantity UI Fields

**Files to change:**

| File | Change |
|---|---|
| `resources/js/components/pharmacyOrders/PharmacyOrderCreateSheet.vue` | Add `doseQuantity` (number input) + `doseUnit` (dropdown: mg, mcg, g, IU, ml) + mode toggle |
| `resources/js/components/domain/clinical/encounter-orders/EncounterInlineOrderPanel.vue` | Same dose fields in the pharmacy section |
| `resources/js/lib/encounterInlineOrders.ts` (lines 215-228) | Add `doseQuantity`, `doseUnit` to `PharmacyInlineOrderInput` |
| `resources/js/lib/encounterInlineOrders.ts` (lines 435-474) | Send `doseQuantity`, `doseUnit` in the POST body |

**Form layout (Dose mode):**

```
Desired dose: [___100___] [mg ▼]   ← doseQuantity + doseUnit dropdown
Frequency:    [___q8h___]          ← free text (existing)
Duration:     [___5____] [days ▼]  ← durationValue + durationUnit (existing)
Route:        [Intramuscular ▼]    ← dropdown from catalog route
─────────────────────────────────
Dispense:     [___2____] [ml ▼]    ← quantityPrescribed + prescribedUnit (auto-calc)
                                     (editable if clinician wants to override)
Dosage instruction: [100 mg IM q8h × 5 days] ← auto-generated, editable
```

**Mode toggle:** A small pill switch "Simple / Dose" at the top of the form. Simple mode hides dose fields and shows only quantity + unit (as today).

### Phase 4: Dosage Calculator Utility

**New file:** `resources/js/lib/dosageCalculator.ts`

```typescript
export type Strength = {
    numeratorValue: number;
    numeratorUnit: string;
    denominatorValue: number;
    denominatorUnit: string | null;
};

export type Dose = {
    value: number;
    unit: string;
};

export function calculateDispenseQuantity(
    desiredDose: Dose,
    strength: Strength,
): { quantity: number; unit: string } {
    // dispenseQuantity = (desiredDose.value / strength.numeratorValue) * strength.denominatorValue
    const quantity = (desiredDose.value / strength.numeratorValue) * strength.denominatorValue;
    const unit = strength.denominatorUnit ?? strength.numeratorUnit;
    return { quantity, unit };
}

export function generateDosageInstruction(
    dose: Dose,
    route: string,
    frequency: string,
    duration: { value: number; unit: string } | null,
): string {
    let text = `${dose.value} ${dose.unit}`;
    if (route) text += ` ${route}`;
    if (frequency) text += ` ${frequency}`;
    if (duration?.value) text += ` \u00d7 ${duration.value} ${duration.unit}`;
    return text;
}
```

### Phase 5: Prescribed Unit Dropdown (Catalog-Aware)

**Files to change:**

| File | Change |
|---|---|
| `resources/js/components/pharmacyOrders/PharmacyOrderCreateSheet.vue` | Replace free-text `prescribedUnit` with a dropdown populated from the catalog item's `unit` field (plus common alternatives: ml, tablet, capsule, vial, ampoule, patch) |
| `resources/js/components/domain/clinical/encounter-orders/EncounterInlineOrderPanel.vue` | Same dropdown |

When a medication is selected from the catalog:
- `prescribedUnit` defaults to the catalog's `unit` (e.g. `ampoule` for Tramadol injection, `tablet` for Paracetamol)
- The dropdown includes the catalog unit + common pharmacy units for the same `dosageForm`
- If user switches to Dose mode and calculates, `prescribedUnit` auto-sets to `denominatorUnit` (e.g. `ml`)

### Phase 6: Backend Validation & Storage

**Files to change:**

| File | Change |
|---|---|
| `app/Modules/Pharmacy/Presentation/Http/Requests/StorePharmacyOrderRequest.php` | Make `doseQuantity`/`doseUnit` required when catalog item has a strength defined |
| `app/Modules/Pharmacy/Application/UseCases/CreatePharmacyOrderUseCase.php` | Add dosage-to-quantity validation: if `doseQuantity` + `doseUnit` provided, validate against catalog strength; store `dose_quantity`, `dose_unit` |
| `app/Modules/Pharmacy/Presentation/Http/Transformers/PharmacyOrderResponseTransformer.php` | Ensure `doseQuantity`, `doseUnit` are in the API response |

**Validation rules (new):**

```
If catalog item has strength:
  - doseQuantity + doseUnit are required
  - doseUnit must be compatible with strength numerator unit
  - calculated dispense quantity must match (or be reasonably close to) quantityPrescribed
```

### Phase 7: Inventory Integration (Future)

The dispense quantity calculated from `doseQuantity` feeds into inventory deduction. For Tramadol 100 mg/2 ml injection:
- `quantityPrescribed = 2`, `prescribedUnit = "ml"` → inventory deducts `1 ampoule` (since 1 ampoule = 2 ml)
- Requires an inventory conversion table: `unit "ml" → package "ampoule" → package quantity "2"`

**Not in scope for this plan** — requires separate inventory architecture work.

## Data Model Changes

### No catalog table migration needed

The `strength` field already exists on `platform_clinical_catalog_items`. Parsed structure is computed at query time.

### Pharmacy order table

Already has `dose_quantity`, `dose_unit` columns (migration `2026_06_20_000001`). No schema change needed for these fields.

### API Payload Changes

**Request** (`POST /pharmacy-orders`):

```json
{
    "patientId": "uuid",
    "catalogItemId": "uuid",
    "doseQuantity": 100,
    "doseUnit": "mg",
    "quantityPrescribed": 2,
    "prescribedUnit": "ml",
    "dosageInstruction": "100 mg IM q8h × 5 days",
    "route": "intramuscular",
    "frequency": "q8h",
    "durationValue": 5,
    "durationUnit": "days"
}
```

**Response** (`GET /pharmacy-orders`):

```json
{
    "data": {
        "id": "uuid",
        "doseQuantity": 100,
        "doseUnit": "mg",
        "quantityPrescribed": 2,
        "prescribedUnit": "ml",
        "dosageInstruction": "100 mg IM q8h × 5 days",
        "route": "intramuscular"
    }
}
```

## Testing Strategy

### Unit tests
- `dosageCalculator.ts`: test all strength formats (`"100 mg/2 ml"`, `"500 mg"`, `"250 mg/5 ml"`, `null`)
- `ClinicalCatalogItemModel::parsedStrength()`: test regex parsing edge cases
- `CreatePharmacyOrderUseCase::normalizeStructuredDoseFields()`: test with/without dose fields

### Integration tests
- Create pharmacy order with `doseQuantity`/`doseUnit`, verify `quantityPrescribed` matches calculation
- Create pharmacy order without dose fields (legacy mode), verify backward compatibility

### UI tests
- Medication search shows strength info (Playwright component test)
- Dose mode vs Simple mode toggle switches fields correctly
- Auto-calculation updates `quantityPrescribed` when `doseQuantity` changes

## Rollout Plan

| Step | What | Depends On |
|---|---|---|
| 1 | Phase 1: Catalog strength in API + TS types | — |
| 2 | Phase 2: Strength display in medication picker | Phase 1 |
| 3 | Phase 3: Dose UI fields (behind feature flag) | Phase 1 |
| 4 | Phase 4: Dosage calculator utility | Phase 1 |
| 5 | Enable dose fields by default | Phase 2-4 |
| 6 | Phase 5: Prescribed unit dropdown | Phase 1 |
| 7 | Phase 6: Backend validation | Phase 4 |
| 8 | Phase 7: Inventory integration | Separate track |

**Feature flag:** `pharmacy.dose-mode` — gated behind a config toggle during rollout.

## Open Questions

1. **How should the strength parser handle complex cases?** (e.g. `"250 mg/5 ml"` → 50 mg/ml, `"10 mg/1.5 ml"` → 6.67 mg/ml). Regex approach may not cover all edge cases — consider a configurable parser with fallback to manual correction in the admin UI.

2. **Should `doseQuantity` be a discrete set of values or continuous?** For tablets (available in fixed strengths), discrete makes sense. For injections (clinician can order any dose), continuous is needed. Solution: when `dosage_form = 'injection'` or `'solution'`, use continuous; otherwise use discrete from catalog.

3. **How to handle multi-ingredient products?** (e.g. `Co-amoxiclav 500 mg/125 mg`). The current `strength` field already captures this as a single string. The parser should detect dual numerators and possibly return an array.
