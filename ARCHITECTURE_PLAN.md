# AfyaNova Architecture Plan

> **Goal**: Remove the specific, verified duplication in charge capture, clinical catalog, and inventory-consumption code.
> **Strategy**: Three small, independent, reversible fixes targeting duplication that exists today — not a new platform primitive built for hypothetical future modules.
> **Scope**: 3 required fixes (each a standalone PR) + 1 conditional fix, gated on an actual roadmap need.

---

## Why this plan replaces the previous one

Two prior drafts of this document proposed a multi-phase `ModuleManifest` + `CapabilityRegistry` + auto-discovery platform (the second draft improved the first's design — class-string resolution instead of `new X` for proper DI, an explicit caching command, `bootstrap/providers.php` preserved as the provider-order source of truth, explicit deferral gates for the riskier phases). Both argued that adding a new clinical module required editing 14+ hardcoded files, and both are a sound *engineering execution* of that idea.

Before committing to build it, the actual code was audited line-by-line. The audit changed the scope, not the execution quality:

| Claim in prior plans | What the code actually shows |
|---|---|
| Charge capture is "5 hardcoded source kinds" needing a capability interface | 4 of 5 methods in `ListBillingChargeCaptureCandidatesUseCase` already share a `buildCandidate()` helper and differ only in model class/status/FK/field names — genuinely table-shaped. The 5th (consultation pricing by clinician tier, ~230 lines) is bespoke domain logic that a capability interface would relocate, not shrink. |
| Cross-module coupling is theoretical / future-proofing | It's already live: `FrontdeskQuickCashierSupport` (POS) has its own hardcoded source-kind list, independent from billing's, and **the names have already drifted** — `pharmacy_prescription` vs `pharmacy_order`, `procedure` vs `theatre_procedure`. Two registries for one concept, silently diverging today. |
| "8+ files" contain duplicate catalog-type match statements | Only **2** files (`BillingClinicalCatalogIdentitySynchronizer`, `CatalogDownstreamSyncService`) contain a byte-identical duplicate (`serviceTypeForCatalogType()`). The other files with `match ($catalogType)` (e.g. `ClinicalCatalogBulkCsvSchema`) differ per type *by design* — CSV schema is supposed to differ per catalog type. Moving that into capability classes relocates the same code, it doesn't eliminate duplication. |
| Inventory consumption needs a new registry concept | It already has one: `ClinicalCatalogConsumptionRecipeItemModel`, generic across lab/radiology/theatre, living in the cross-cutting `Platform` module. It just has two small hardcoded type-lists (`ELIGIBLE_INVENTORY_CATEGORIES`, `SUPPORTED_CATALOG_TYPES`) that have drifted from each other the same way the source-kind lists did. |
| Clinical catalog is scattered per department | It's already unified — one `ClinicalCatalogItemModel` for all types, one billing sync path, one inventory sync path. This part of the platform is sound as-is. |

Conclusion: there is no systemic "new module touches N hardcoded files" crisis. There are three concrete, narrow single-source-of-truth violations that exist in the codebase right now, and one large-but-not-mostly-duplicated file. Fix those directly, cheaply, and reversibly. Do not stand up a new platform primitive (manifest classes, a registry singleton, filesystem auto-discovery, a cache-invalidation command) to solve three problems you can name.

---

## Fix 1 — Unify the two source-kind registries (highest priority — live bug risk)

**Problem.** Two independent hardcoded lists describe the same real-world source kinds (lab/radiology/pharmacy/theatre orders eligible for charge capture or quick-cashier checkout), and their keys have already diverged:

- `App\Modules\Billing\Application\UseCases\ListBillingChargeCaptureCandidatesUseCase::INVOICE_SOURCE_KINDS` → `appointment_consultation`, `laboratory_order`, `pharmacy_order`, `radiology_order`, `theatre_procedure`
- `App\Modules\Pos\Application\Support\FrontdeskQuickCashierSupport::SOURCE_KINDS` → `laboratory_order`, `pharmacy_prescription`, `radiology_order`, `procedure`

`pharmacy_order` vs `pharmacy_prescription`, `theatre_procedure` vs `procedure`: a change to one list silently does not apply to the other. This is the one item in this plan fixing a real, present inconsistency rather than a hypothetical one.

**What to build.** One canonical definition — a `ClinicalSourceKind` enum (preferred, since it gives type safety and IDE discoverability) or `config/clinical_source_kinds.php` — carrying, per kind: model class, catalog FK column, eligible statuses, entry-state filter, exclude-entered-in-error flag. Both `ListBillingChargeCaptureCandidatesUseCase`'s 4 order-shaped methods (lab/radiology/pharmacy/theatre) and `FrontdeskQuickCashierSupport` read from it instead of declaring their own copy.

**Explicitly out of scope for this fix:** `consultationCandidates()` stays a hand-written method. It isn't shaped like the other four (no catalog item, tier/specialty-driven pricing) and forcing it into the same table-driven shape would hide real logic behind a misleadingly generic interface.

**Files touched:**
| File | Change |
|---|---|
| New: `app/Modules/Billing/Domain/ValueObjects/ClinicalSourceKind.php` (or `config/clinical_source_kinds.php`) | Canonical per-kind metadata |
| `ListBillingChargeCaptureCandidatesUseCase.php` | 4 order-shaped private methods replaced by one loop over `ClinicalSourceKind` cases; `consultationCandidates()` untouched |
| `FrontdeskQuickCashierSupport.php` | `SOURCE_KINDS` const removed, reads from the same enum/config |

**Verification:** existing charge-capture and quick-cashier tests must pass unchanged (no response-shape change); add one test asserting both consumers resolve the same set of kinds from the same source.

---

## Fix 2 — Collapse the duplicate `serviceTypeForCatalogType()`

**Problem.** `BillingClinicalCatalogIdentitySynchronizer::serviceTypeForCatalogType()` and `CatalogDownstreamSyncService::serviceTypeForCatalogType()` are byte-identical 4-arm match statements in two different files.

**What to build.** Move the mapping onto `ClinicalCatalogType` itself as an enum method — `ClinicalCatalogType::defaultBillingServiceType(): ?string`. An enum knowing its own default property is the most idiomatic home for this; it needs no service class, no registry, no interface.

**Files touched:**
| File | Change |
|---|---|
| `app/Modules/Platform/Domain/ValueObjects/ClinicalCatalogType.php` | Add `defaultBillingServiceType(): ?string` method |
| `BillingClinicalCatalogIdentitySynchronizer.php` | Delete local match, call `$catalogType->defaultBillingServiceType()` |
| `CatalogDownstreamSyncService.php` | Same |

**Verification:** both call sites produce identical output before/after (this is a pure refactor, not a behavior change).

---

## Fix 3 — Consolidate the two consumption-recipe type-lists

**Problem.** `ClinicalCatalogConsumptionRecipeService::ELIGIBLE_INVENTORY_CATEGORIES` (keyed on 3 catalog types: lab, radiology, theatre) and `ClinicalCatalogRecipeStockConsumptionService::SUPPORTED_CATALOG_TYPES` (the same 3 types, redeclared as bare strings, not referencing the enum) are two independent hardcoded lists of the same fact.

**What to build.** Same pattern as Fix 2 — put both facts on `ClinicalCatalogType` as enum methods: `supportsConsumptionRecipes(): bool` and `eligibleInventoryCategories(): array`. `SUPPORTED_CATALOG_TYPES` and `ELIGIBLE_INVENTORY_CATEGORIES` are deleted; both services call the enum.

**Files touched:**
| File | Change |
|---|---|
| `ClinicalCatalogType.php` | Add `supportsConsumptionRecipes(): bool`, `eligibleInventoryCategories(): array` |
| `ClinicalCatalogConsumptionRecipeService.php` | Delete `ELIGIBLE_INVENTORY_CATEGORIES`, call enum methods |
| `ClinicalCatalogRecipeStockConsumptionService.php` | Delete `SUPPORTED_CATALOG_TYPES`, call enum methods |

**Verification:** pure refactor — same inputs produce same eligibility decisions before/after.

---

## Fix 4 — Capability interface for charge capture (conditional — do not start without a named roadmap need)

Only build this if there is a concrete plan to add 2+ new clinical modules (e.g. dialysis, physiotherapy) within the next couple of quarters that need to participate in charge capture and/or quick-cashier checkout. Fixes 1–3 already deliver the "add a kind without touching consumer code" property for the kinds that exist today; Fix 4 only pays for itself if new kinds are actually coming.

**What to build if triggered.** A `ChargeCaptureCapability` interface, bound via Laravel's existing **tagged container bindings** — not a new manifest/auto-discovery system:

```php
// In each module's existing ServiceProvider — no new file type introduced
$this->app->tag([ConsultationChargeCapture::class, LaboratoryChargeCapture::class, ...], 'charge-capture-capabilities');
```

```php
// Consumer
foreach ($this->app->tagged('charge-capture-capabilities') as $capability) { ... }
```

This gets the same payoff as a manifest/registry system (new modules register a capability, consumer code doesn't change) using a mechanism Laravel already ships — no `ModuleManifest` class, no `glob()` filesystem scanning, no `CapabilityRegistry` singleton, no changes to `bootstrap/providers.php`, no new caching command to build and maintain.

---

## What this plan deliberately does not build, and why

- **No `ModuleManifest` / `CapabilityRegistry` / auto-discovery / manifest-cache command.** The problem it solves (a new module needs a few code changes) is real but narrow — three named fixes above, not a platform. Building generic infrastructure — plus the operational overhead of a cache to invalidate — for a problem you can enumerate three instances of is designing for a hypothetical fourth and fifth that may not arrive on any stated timeline.
- **No catalog-type "capability classes" for CSV schema / recipe eligibility.** `ClinicalCatalogBulkCsvSchema`'s per-type logic differs by design. Moving it into capability classes relocates the same code behind an extra interface; it does not shrink it. Fixes 2 and 3 already remove the actual duplicate parts (the identical match statement, the two divergent type-lists) — what's left is real per-type content that deserves to live in a `match` a reader can see in one place, not scattered across N capability class files.
- **No routes/policies/listeners-via-manifest.** A single `routes/api.php` you can grep is frequently *easier* to audit than N scattered per-module route files. Centralization is not the bug here.
- **No changes to `bootstrap/providers.php`.** It is an explicit, ordered, greppable list today. It stays exactly as-is under this plan — nothing here touches service-provider registration at all.

---

## Sequence and effort

```
Fix 1 — Unify source-kind registries ───────────────────────────
  Impact: closes a live naming-drift bug between billing and POS.
  Effort: ~1 day. Independently shippable.

Fix 2 — Collapse duplicate serviceTypeForCatalogType() ─────────
  Impact: removes the one byte-identical duplication found.
  Effort: ~1 hour. Independently shippable.

Fix 3 — Consolidate consumption-recipe type-lists ──────────────
  Impact: removes the second drift-prone duplicated list.
  Effort: ~1 hour. Independently shippable.

Fix 4 — Tagged charge-capture capability (CONDITIONAL) ─────────
  Impact: new clinical modules register a capability instead of
  editing consumer code, via Laravel's existing tagged-binding
  feature — no new platform primitives.
  Effort: ~1–2 days. Only start once a 2nd/3rd new module is
  actually scheduled — not before.
```

Total committed effort: ~2–3 days across three independent, low-risk PRs, each fixing a concrete, named problem. No new abstraction is introduced unless Fix 4's trigger condition is actually met.

---

## Risks

| Risk | Mitigation |
|---|---|
| Fix 1's shared enum/config doesn't capture some edge-case difference between the billing and POS consumers (e.g. a filter one side needs the other doesn't) | Read both existing implementations fully before defining the shared shape; if a genuine per-consumer difference exists, model it as an explicit field on the shared definition rather than dropping it silently. |
| Fix 2/3 enum methods grow into a dumping ground for unrelated per-type facts over time | Keep `ClinicalCatalogType` methods narrowly scoped to facts that are genuinely 1:1 with the type (billing service type, recipe eligibility). If a future fact is consumer-specific rather than intrinsic to the type, it does not belong on the enum. |
| Fix 4 gets started speculatively before a real second module is scheduled | This document states the trigger condition explicitly; do not start Fix 4 without a named module and rough timeline. |

---

*Supersedes the prior ModuleManifest/CapabilityRegistry drafts of this document, following a code audit that found the underlying problem to be three narrow, fixable duplications rather than a systemic cross-module coupling crisis.*
