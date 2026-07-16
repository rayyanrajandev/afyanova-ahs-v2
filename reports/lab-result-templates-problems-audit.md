# Lab Result Entry / Stool Analysis — Problems Audit

**Document type**: Audit (read-only findings, no changes made). Read [lab-result-templates-current-state-audit.md](lab-result-templates-current-state-audit.md) first for the architecture this refers to. Fixes are proposed in [lab-result-templates-2027-modernization-plan.md](lab-result-templates-2027-modernization-plan.md).

## Summary

The structured template system is real and Stool Analysis's fields are complete, but the "messed up" part is concrete and fixable: one live crash bug, one real UX gap (no Remarks/Impression on templated results), duplicated/desyncing data definitions, one name-matching bug that misapplies a template to the wrong test, and zero test coverage. None of these require rebuilding the system — see the modernization plan for scoped fixes.

## 1. Live crash bug — unfixed `SelectItem value=""`

`resources/js/components/laboratoryOrders/LaboratoryStatusUpdateDialog.vue:365-367`:

```html
<SelectContent>
    <SelectItem value=""
        >—</SelectItem
    >
    <SelectItem
        v-for="option in resultFlagOptions"
        ...
```

Reka UI's `SelectItem` reserves an empty string `value=""` to mean "clear selection" and throws when a `SelectItem` is given that value explicitly. This exact bug class was fixed in three recent commits (`d5b4ea5`, `449d5bd`, `ca29973`) everywhere else in the Lab module — but this one instance in the **panel parameter-row Flag dropdown** was missed. It's reachable from the `isPanel` branch (`LaboratoryStatusUpdateDialog.vue:298-407`), i.e. any panel-style test including **Stool Microscopy** (`LAB-STOOL-MICRO-001`), the sibling catalog item to Stool Analysis. Confirmed live in the current file — not yet patched.

## 2. No Remarks / Impression field on templated results

The original brief calls for "Remarks" (large textarea) and "Impression / Conclusion" (short text) as the only two free-text fields, with everything else structured. Today:

- The `isPanel` branch (`:387-406`) and the plain-test branch (`:462-481`) both render `Interpretation` and `Recommendation` `<Textarea>` fields.
- The `hasResultTemplate` branch (`:291-297`) — the one Stool Analysis actually uses — renders **only** `<StructuredLabResultForm>`, with no textarea at all:

```html
<template v-if="hasResultTemplate && order?.catalogResultTemplate">
    <StructuredLabResultForm
        :template="order.catalogResultTemplate"
        @update:values="(values) => (templateValues = values)"
    />
</template>
```

So for Stool Analysis (and all 6 other templated tests), there is currently **no way to record Remarks or an Impression/Conclusion at all**. This is the one genuinely missing piece of the requested field list.

Compounding this: `ResultTemplateField.type` (`resources/js/lib/resultTemplate.ts:4`) is a closed union — `'select' | 'multiselect' | 'text' | 'number' | 'positive-negative' | 'not-done'` — with **no multi-line/`textarea` variant**, so even adding "Remarks" as a template field today would render as a single-line `Input`, not a `Textarea`.

## 3. Two independent sources of truth for the same template JSON

`database/seeders/LaboratoryClinicalCatalogSeeder.php:256-313` and `database/migrations/2026_07_16_160000_add_result_templates_to_lab_test_catalog.php:15-62` both hard-code the **identical** Stool Analysis `resultTemplate` JSON verbatim (and the same is true for Malaria, HIV, Blood Group, Urinalysis, Sputum, and Widal — all seven templates are duplicated across both files). They apply differently:

- Seeder: `array_merge`-based upsert, **always overwrites** on re-seed.
- Migration: raw SQL `JSON_MERGE_PATCH`/`jsonb ||`, **only writes if `resultTemplate` is currently null** (`add_result_templates_to_lab_test_catalog.php:190-205`).

Today they match. The first time someone edits one file and not the other, catalog data silently desyncs depending on which mechanism ran most recently in a given environment — a classic two-sources-of-truth bug, not yet triggered but structurally present.

## 4. Duplicate catalog blueprint entries in the seeder

`grep "'code' =>" LaboratoryClinicalCatalogSeeder.php` shows three test codes defined **twice** in the same `LAB_TEST_BLUEPRINTS` array:

| Code | First definition (no template) | Second definition (with template) |
|---|---|---|
| `LAB-BGRH-001` "Blood Group and Rh" | lines 61-67 | lines 355-373 |
| `LAB-MPS-001` "Malaria Parasite Smear" | lines 77-84 | lines 315-333 |
| `LAB-HIV-001` "HIV 1/2 Rapid Test" | lines 233-240 | lines 335-353 |

`seedScope()` (`:474-531`) matches existing rows by code-or-name and upserts, so the second entry silently wins on every run — no crash, but dead/confusing duplicate blocks consistent with a half-finished edit that added new template-bearing entries without deleting the old plain ones. **`LAB-STOOL-001` itself is not duplicated** — it's a single, clean entry.

## 5. Name-substring collision misapplies a template

`add_result_templates_to_lab_test_catalog.php:200` matches catalog rows with `LOWER(name) LIKE '%malaria%'`. Two catalog items contain "malaria": `LAB-MPS-001` "Malaria Parasite Smear" (correct — this is the microscopy test the template was written for) and `LAB-MRDT-001` "Malaria Rapid Diagnostic Test" (**wrong** — a qualitative rapid test, but it will receive the same species/stage/parasite-density microscopy template, fields that don't apply to a rapid antigen test). The `'stool analysis'` substring is safe by comparison — only `LAB-STOOL-001` matches; `LAB-STOOL-MICRO-001` "Stool Microscopy" does not contain that exact substring, so it is unaffected by this specific bug (but see §1 — it has its own bug).

## 6. Section grouping is discarded at persistence and display

`buildResultParametersFromTemplate()` (`resultTemplate.ts:42-63`) flattens every section into one array of `{code, name, value, unit}` — the section label (`Macroscopic Examination`, `Microscopic Examination`, `Ova and Parasites`, …) is not carried through. `LaboratoryOrderDetailSheet.vue:122-187` then renders that flat array as a single undifferentiated table with no section headers. Result: a signed Stool Analysis report shows Colour, RBC, Ova Seen, and Occult Blood all as one flat list, with no visual grouping — clinically meaningful structure that the entry form itself preserves (via `<StructuredLabResultForm>`'s section cards) is lost by the time anyone reads the result back.

The auto-generated `resultSummary` text block *does* preserve section headers (built by `buildResultSummaryFromTemplate`, `resultTemplate.ts:20-40`), but `LaboratoryOrderDetailSheet.vue:194` only shows it `v-if="!order.resultParameters?.length"` — since Stool Analysis will almost always populate `resultParameters`, the nicely-sectioned summary text is computed, stored, and then never actually shown in the UI.

## 7. Stool Analysis vs. Stool Microscopy — unclear overlap

Two separate orderable catalog items exist for essentially the same clinical test:
- `LAB-STOOL-001` "Stool Analysis" — the new structured template (§4 of the current-state audit).
- `LAB-STOOL-MICRO-001` "Stool Microscopy" (`LaboratoryClinicalCatalogSeeder.php:212-231`) — the older flat `CatalogParameter` panel (Consistency, Color, Mucus, Blood, WBC, RBC, Ova, Parasites, Cysts, Fat, Yeast — all typed as free-text panel rows, no select/multiselect, no macroscopic/occult-blood/pH sections), and it's the one carrying the unfixed crash bug from §1.

A clinician ordering "stool" tests today has two near-duplicate options with materially different result-entry UX and one of them broken. Not resolved by any code — a product decision is needed (see modernization plan).

## 8. Zero test coverage

No `*.spec.ts` file or PHP test references `StructuredLabResultForm`, `resultTemplate.ts`, or "Stool" anywhere in the repository. The entire structured-template feature — seven test types, six field types, two persistence-shape builder functions — currently ships with no automated regression protection.

## Severity ranking

| # | Issue | Severity | Blocks the original brief? |
|---|---|---|---|
| 1 | `SelectItem value=""` crash | High — live crash risk | No (different catalog item), but same module |
| 2 | No Remarks/Impression on templated results | High — direct gap vs. brief | **Yes** |
| 6 | Section grouping lost on display | Medium — clinical readability | Partially (brief's sample report shows grouped sections) |
| 3 | Duplicate template source of truth | Medium — latent drift risk | No |
| 5 | `'malaria'` substring collision | Medium — wrong data on wrong test | No |
| 4 | Duplicate blueprint entries | Low — dead code, no functional bug | No |
| 7 | Stool Analysis vs. Stool Microscopy overlap | Low/product — confusing, not broken | No |
| 8 | No test coverage | Medium — regression risk going forward | No |
