# Technical Design: Unified Pricing Engine

Companion to `PricingEngine_RFC.md` (read that first for the "why"). This document is the "how" — schema, resolver algorithm, and per-domain integration contract.

---

## 1. New Tables

### 1.1 `chargeable_items`

Canonical identity for anything a patient can be billed for. Supersedes `platform_clinical_catalog_items` in scope (covers everything that table covers, plus what it doesn't).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, nullable | matches existing scoping pattern |
| `facility_id` | uuid, nullable | |
| `facility_tier` | string, nullable | reuses `FacilityTierSupport` (`app/Support/CatalogGovernance/FacilityTierSupport.php`) availability-filter pattern already proven in `billing_service_catalog_items` |
| `catalog_type` | string | **extends** today's `ClinicalCatalogType` enum values (`lab_test`, `radiology_procedure`, `theatre_procedure`, `clinical_procedure`, `formulary_item`, `diagnosis_code`) **plus new**: `consultation`, `bed_day`, `service_point_session`, `equipment_rental`, `package` |
| `charge_model` | string | `flat` \| `per_unit` \| `per_day` \| `per_hour` \| `tiered` — drives resolver behavior, see §3 |
| `code` | string | human-readable label only — **not** a join key anywhere |
| `name` | string | |
| `department_id` | uuid, nullable, FK `departments.id` | |
| `category` | string, nullable | |
| `default_unit` | string | `visit`, `day`, `hour`, `test`, `study`, `unit`, `session` |
| `status` | string, default `active` | |
| `status_reason` | string, nullable | |
| `metadata` | json, nullable | replaces ad-hoc `metadata.billingServiceCode` lookups scattered in today's resolver |
| timestamps | | |

Indexes: `(tenant_id, catalog_type)`, `(facility_id, catalog_type)`, `(status, updated_at)`. No uniqueness on `code` — it's a label, duplicates are fine (unlike today where `service_code` uniqueness matters because it's the join key).

### 1.2 `price_book_entries`

Supersedes `billing_service_catalog_items` as the live pricing table. Old table is not dropped until full cutover (§ Migration Plan) — kept read-only for historical invoice reference during transition.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `chargeable_item_id` | uuid, **NOT NULL**, FK `chargeable_items.id` | the join key |
| `tenant_id` / `facility_id` / `facility_tier` | nullable | same availability-filter pattern |
| `payer_contract_id` | uuid, nullable, FK `billing_payer_contracts.id` | **native** payer override — null = self-pay/default rate. Supersedes `billing_payer_contract_price_overrides` as a separate table |
| `currency_code` | char(3) | |
| `unit_price` | decimal(14,2) | |
| `tax_rate_percent` | decimal(5,2), default 0 | |
| `is_taxable` | boolean, default false | |
| `effective_from` / `effective_to` | timestamp, nullable | unchanged versioning idiom from today |
| `tariff_version` | integer | |
| `supersedes_price_book_entry_id` | uuid, nullable, self-FK | unchanged versioning idiom from today |
| `status` / `status_reason` | | |
| timestamps | | |

Indexes: `(chargeable_item_id, status, effective_from)`, `(currency_code, status)`. A partial-uniqueness constraint (`chargeable_item_id, tenant_id, facility_id, payer_contract_id, effective_from`) prevents two active rows claiming the same date range — enforced at the application layer (`CreatePriceBookEntryUseCase`) rather than a DB constraint, since open-ended `effective_to` ranges can't be validated by a plain SQL unique index.

Audit trail: `price_book_entry_audit_logs`, same shape as today's `billing_service_catalog_item_audit_logs` — Finance's existing audit requirement (RFC §8 open question) carries over unchanged.

### 1.3 Domain FK additions

Every domain record that's billable gets a `chargeable_item_id`, added as **nullable** during migration (so existing rows don't break) and flipped to **NOT NULL** once backfilled and the domain's create-flow requires selecting one:

| Table | New column | Backfilled from |
|---|---|---|
| `laboratory_orders` | `chargeable_item_id` | existing `lab_test_catalog_item_id` (1:1, same row migrates) |
| `radiology_orders` | `chargeable_item_id` | existing `radiology_procedure_catalog_item_id` |
| `pharmacy_orders` | `chargeable_item_id` | existing `approved_medicine_catalog_item_id` |
| `clinical_procedure_orders` | `chargeable_item_id` | existing `clinical_procedure_catalog_item_id` |
| `theatre_procedures` | `chargeable_item_id` | existing `theatre_procedure_catalog_item_id` |
| `facility_resources` | `chargeable_item_id` (nullable) | **new** — no prior data; facility admin assigns via ward/bed and service-point admin screens (one new field, reuses existing screens) |
| `appointments` | `consultation_chargeable_item_id` (nullable) | **new** — resolved at booking/check-in time via the reworked Consultation Mapping (see §4) instead of derived at charge-capture time |

## 2. Charge Resolver

Single service, one entry point, replaces six near-duplicate candidate builders in `ListBillingChargeCaptureCandidatesUseCase`:

```
resolvePrice(
    chargeableItemId: uuid,
    quantityOrDuration: float,     // units, or hours/days depending on charge_model
    asOfDate: DateTime,
    facilityId: uuid,
    payerContractId: ?uuid,
    currencyCode: string,
): PricedLine
```

Algorithm:
1. Load `chargeable_items` row (guaranteed to exist — FK is NOT NULL on the calling domain record).
2. Query `price_book_entries` where `chargeable_item_id = X`, apply tenant/facility scope + `FacilityTierSupport` availability filter (reused as-is), `currency_code` match, `effective_from <= asOfDate <= effective_to` (or null-open).
3. Prefer a row with `payer_contract_id = payerContractId` if given and one exists; else the `payer_contract_id IS NULL` (self-pay) row.
4. Apply `charge_model` from the chargeable item:
   - `flat` → quantity forced to 1
   - `per_unit` → quantity passed through as-is (medications, tests)
   - `per_day` → `quantity = max(1, ceil(durationHours / 24))` — this is today's bed-day logic (`ListBillingChargeCaptureCandidatesUseCase::bedDayCandidatesForAdmission()`), extracted into a shared `DurationChargeStrategy` class so any future per-day item (ICU stay, equipment rental) reuses it instead of copy-pasting
   - `per_hour` → `quantity = ceil(durationHours)` — new capability, doesn't exist today (needed for e.g. ventilator-hours if that's ever priced)
5. Return `{chargeableItemId, unitPrice, quantity, lineTotal, currencyCode, pricingStatus}`. `pricingStatus` keeps today's `priced` / `missing_catalog_price` values (rename `missing_catalog_price` → `missing_price_book_entry` for accuracy, but the concept and UI badge stay identical).

## 3. Domain Integration Contract

Every domain module emits a "chargeable event" instead of the use case reaching into five different Eloquent models directly:

```
ChargeableEvent {
    chargeableItemId: uuid,
    sourceKind: string,        // unchanged concept from today's ClinicalSourceKind
    sourceId: string,
    patientId: uuid,
    quantityOrDuration: float,
    performedAt: DateTime,
}
```

`ListBillingChargeCaptureCandidatesUseCase` becomes: gather `ChargeableEvent[]` from each domain adapter (lab, radiology, pharmacy, procedure, theatre, consultation, bed-day, service-point), dedupe against invoiced sources (**unchanged** — `invoicedSourceIndex()` keeps working exactly as today, it doesn't care how the price was resolved), then call `resolvePrice()` once per event. This collapses `consultationCandidates()`, `orderCandidates()`/`candidatesForKind()`, and `bedDayCandidatesForAdmission()` into one loop over domain adapters + one shared pricer, instead of three parallel implementations of "build a candidate."

`ClinicalSourceKind` simplifies: `catalogFk()`, `modelClass()` no longer need special-case `throw` branches for `APPOINTMENT_CONSULTATION` / `ADMISSION_BED_DAY` — once those domains have real FKs, every case in the enum behaves uniformly.

## 4. Consultation Pricing — the one domain that isn't just "add an FK"

Today, consultation price is derived at charge-capture time from a clinician's job title/license string, matched through `ConsultationMappingModel` rows to produce a `CONSULT-{tier}-{department}` code, which is then string-matched against `billing_service_catalog_items`. This is a real business rule (which cadre + department combination bills at which rate), not just missing plumbing — so it doesn't disappear, it gets re-pointed:

- `ConsultationMappingModel` keeps its `clinician_tier` + `department` matching columns, but its output column changes from `catalog_item_id`/derived service code to `chargeable_item_id` (direct FK, NOT NULL).
- Resolution moves from "assemble a string at charge-capture read time" to "look up the mapping once, at consultation-start time, and stamp `appointments.consultation_chargeable_item_id`" — same timing as today's flow effectively, just storing an ID instead of deriving a string later.
- The mapping admin UI (`ConsultationMappings.vue` + edit/create sheets) is kept, reworked to pick a `chargeable_item_id` from a dropdown instead of relying on catalog/service-code text matching underneath.

## 5. Facility Resources (Beds, Service-Points) — genuinely new capability

`facility_resources` gains `chargeable_item_id` (nullable FK), following the same "nullable per-subtype column on a shared table" convention already established there for `ward_name`/`bed_number`/`service_point_type`. Set once via the existing ward/bed admin screen (`resources/js/pages/platform/admin/ward-beds/IndexV2.vue`) and service-point admin screen (`resources/js/pages/platform/admin/service-points/Index.vue`) — each gains one new "Pricing item" field, no new page needed.

Bed-day candidate generation reads `admission.bedResource.chargeable_item_id` directly. If null, the charge shows `pricingStatus: missing_price_book_entry` (today's `BED-{WARD}` fallback-to-`BED-DAY` string convention is deleted, not kept as a secondary fallback — see Removal Inventory).

## 6. Inventory Boundary

`InventoryClinicalLinkGuard` (`app/Support/CatalogGovernance/InventoryClinicalLinkGuard.php`) currently validates that pharmaceutical inventory items link to a clinical catalog item, erroring otherwise. It's extended to validate against `chargeable_items` instead of `platform_clinical_catalog_items` (same validation, same guard, new target table) — write-time enforcement, so `CatalogPlacementAuditor`'s after-the-fact repair job should see its detected-drift rate drop to near zero over time. The auditor is **not deleted** (kept as a defense-in-depth periodic check + retains its historical audit trail) but is downgraded from "actively needed" to "belt and suspenders."

## 7. API/Contract Changes (frontend-visible)

- `GET /api/v1/billing/charge-capture-candidates` response gains `chargeableItemId` on every candidate; `serviceCode` stays present (now purely a display label, sourced from `chargeable_items.code`) so nothing in the frontend that merely *displays* a code breaks in the same release.
- `POST /api/v1/billing` (create invoice) line items: `sourceWorkflowKind`/`sourceWorkflowId` stay exactly as-is (dedup mechanism unchanged, per RFC non-goals) — but a new optional `chargeableItemId` field is accepted per line, for future direct invoicing without going through charge-capture.
- Service Catalog admin API (`BillingServiceCatalogController`) gains a `chargeableItemId` filter/create field; `service_code` free-text create field becomes optional/derived rather than required (see Removal Inventory for the exact frontend field change).
