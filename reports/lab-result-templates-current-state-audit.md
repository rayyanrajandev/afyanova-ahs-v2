# Lab Result Entry / Stool Analysis — Current State Audit

**Document type**: Audit (read-only findings, no changes made). Companion docs: [lab-result-templates-problems-audit.md](lab-result-templates-problems-audit.md) (what's wrong) and [lab-result-templates-2027-modernization-plan.md](lab-result-templates-2027-modernization-plan.md) (what to do about it).

**Why this exists**: a structured "Stool Analysis Result Form" was requested (macroscopic/microscopic exam, ova & parasites multi-select, occult blood, pH, reducing substance, remarks, impression) to replace a single free-text result box. Before writing a plan, this audits what's actually in the codebase today — because the starting assumption ("still a free-text box") turned out to be wrong.

## 1. Headline finding

The single free-text result box has **already been superseded** by a generic, structured, section-based template system (`ResultTemplate`), and **Stool Analysis is one of seven test types that already has a complete template** matching nearly the entire original field list. This is not a from-scratch build — it's an in-progress feature with specific defects and gaps, audited in [lab-result-templates-problems-audit.md](lab-result-templates-problems-audit.md).

## 2. Where the system lives

**Frontend**
| File | Role |
|---|---|
| `resources/js/pages/laboratory-orders/IndexV2.vue:661-669` | V2 Lab page; renders the result-entry dialog |
| `resources/js/components/laboratoryOrders/LaboratoryStatusUpdateDialog.vue` | Result-entry dialog; branches into templated / panel / plain-field UI |
| `resources/js/components/laboratoryOrders/StructuredLabResultForm.vue` | Generic renderer for any `ResultTemplate` — this is what draws the Stool Analysis form |
| `resources/js/lib/resultTemplate.ts` | `ResultTemplate`/`ResultTemplateField` types + summary/param builder functions |
| `resources/js/composables/laboratoryOrders/useLaboratoryOrders.ts:23-30,84-126` | `LaboratoryOrder` type — hybrid `resultSummary` (text) + `resultParameters` (flattened array) + `catalogResultTemplate` |
| `resources/js/components/laboratoryOrders/LaboratoryOrderDetailSheet.vue:115-253` | Result display (generic flat table, not Stool-specific) |

**Backend**
| File | Role |
|---|---|
| `app/Modules/Laboratory/Presentation/Http/Transformers/LaboratoryOrderResponseTransformer.php` | Exposes `catalogResultTemplate` from the catalog item's `metadata.resultTemplate` JSON |
| `database/seeders/LaboratoryClinicalCatalogSeeder.php` | Defines catalog items + their `resultTemplate` JSON (source #1) |
| `database/migrations/2026_07_16_160000_add_result_templates_to_lab_test_catalog.php` | A second, independent definition of the same templates (source #2 — see problems doc) |

Legacy `pages/laboratory-orders/Index.vue` (10,103 lines) was already deleted in commit `16c21e4` (Phase 6 of the order-creation plan) — V2 is the only live Lab page. `/legacy` routes remain only as redirect aliases.

## 3. How the form decides what to render

`LaboratoryStatusUpdateDialog.vue:63-74`:

```ts
const isPanel = computed(() =>
    props.order?.catalogUnit === 'panel' &&
    (props.order?.catalogParameters?.length ?? 0) > 0,
);

const hasResultTemplate = computed(() =>
    props.intent === 'complete' &&
    props.order?.catalogResultTemplate != null &&
    (props.order.catalogResultTemplate.sections?.length ?? 0) > 0,
);
```

Three render branches (`:291-482`):
1. **`hasResultTemplate`** → `<StructuredLabResultForm :template="order.catalogResultTemplate" />` — the sectioned, typed form. **This is the branch Stool Analysis uses.**
2. **`isPanel`** (no template, flat numeric parameters e.g. CBC, Stool Microscopy) → tabular parameter-row entry with per-row Value/Unit/Flag/Reference-range.
3. **Plain test** (neither) → single measured-result/unit/flag/reference-range fields, plus Interpretation/Recommendation textareas.

## 4. The Stool Analysis template, as it exists today

Defined at `database/seeders/LaboratoryClinicalCatalogSeeder.php:256-313` (catalog code `LAB-STOOL-001`), rendered generically by `StructuredLabResultForm.vue`. Field-by-field, it already matches the requested brief:

| Section | Fields | Type |
|---|---|---|
| **Macroscopic Examination** | Colour (Brown/Yellow/Green/Black/Red/Pale/Other), Consistency (Formed/Soft/Loose/Watery/Mucoid), Mucus, Blood (visible), Pus, Worms/Segments | `select` / `not-done` (Absent/Present/Not Done toggle) |
| | Adult Parasites Seen | `text` |
| **Microscopic Examination** | RBC, WBC, Epithelial Cells, Yeast Cells | `text` (free-form e.g. "0–2/HPF") |
| | Fat Globules, Starch Granules, Muscle Fibres | `select` (Absent/Few/Moderate/Many) |
| **Ova and Parasites** | Ova Seen, Cysts Seen, Trophozoites Seen, Larvae Seen | `multiselect` (species checklists, e.g. Ascaris lumbricoides, Giardia lamblia, Entamoeba histolytica…) |
| **Occult Blood** | Occult Blood | `positive-negative` (Positive/Negative/Not Done buttons) |
| **Additional Tests** | pH, Reducing Substance | `number`, `positive-negative` |

`StructuredLabResultForm.vue:1-226` renders each field type as: `select` dropdown (84-101), `positive-negative` 3-button toggle (104-138), `not-done` Absent/Present/Not-Done toggle (141-175), `text` input (178-185), `number` input (188-196), `multiselect` clickable badge chips (199-221).

## 5. Data model — how a submitted result is stored

`resultTemplate.ts:20-63` — on submit, the form's `Record<code, value>` map is converted two ways:
- `buildResultSummaryFromTemplate()` → a human-readable text block (section headers + `Field: value` lines) stored in `resultSummary`.
- `buildResultParametersFromTemplate()` → a **flat** array of `{code, name, value, unit}` (section label is discarded) stored in `resultParameters`.

`LaboratoryOrder` type (`useLaboratoryOrders.ts:84-126`) carries both `resultSummary: string | null` and `resultParameters: LabResultParameter[] | null` plus the original `catalogResultTemplate: ResultTemplate | null` for re-rendering the form shape.

## 6. Other test types with the same structured-template system

Six other catalog items already have a `resultTemplate` (seeder `LAB_TEST_BLUEPRINTS`, migration `templates()`): Urinalysis (`LAB-UA-001`), Malaria Parasite Smear (`LAB-MPS-001`), HIV 1/2 Rapid Test (`LAB-HIV-001`), Blood Group and Rh (`LAB-BGRH-001`), Sputum Analysis (`LAB-SPUTUM-001`), Widal Test (`LAB-WIDAL-001`). Everything else (CBC, Hemoglobin, ESR, Sickle Cell, MRDT, Blood Glucose, HbA1c, Creatinine, U&E, LFT, CRP, Urine Pregnancy, Stool Microscopy, HBsAg, VDRL/RPR) has no template and uses the flat panel-table or plain-field fallback.

## 7. Result display

`LaboratoryOrderDetailSheet.vue:115-253` — generic, not Stool-specific: a flat Parameter/Value/Flag/Reference-range table when `resultParameters.length > 0` (`:122-187`), falling back to `resultSummary` text only when there are no parameters (`:194`, `!order.resultParameters?.length`). Section headers (Macroscopic/Microscopic/Ova & Parasites) are not shown — see problems doc §5.
