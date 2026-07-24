# RFC: Unified Pricing Engine for Afyanova AHS

**Status:** Draft — awaiting sign-off before any schema work begins
**Author:** Senior Engineering (this session), 2026-07-24
**Reviewers needed:** Billing module owner, Clinical modules owner (Lab/Radiology/Pharmacy/Theatre/ClinicalProcedure), Inventory owner, Finance/Product stakeholder (this changes what "the price of anything" means for the business)

---

## 1. Problem Statement

Afyanova prices every billable thing — lab tests, radiology, pharmacy, procedures, theatre, consultations, and (as of this week) bed-days — through one shared table, `billing_service_catalog_items`. On the surface this looks unified. It is not.

**The actual join key for every single charge in the system is a hand-built string (`service_code`), not a foreign key.** Confirmed by reading `ListBillingChargeCaptureCandidatesUseCase` end-to-end:

- Lab, radiology, pharmacy, clinical-procedure, and theatre orders all *do* carry a proper catalog FK (`lab_test_catalog_item_id`, `radiology_procedure_catalog_item_id`, etc., all pointing at the same `platform_clinical_catalog_items` table — this part of the design is genuinely good). But pricing is **not** resolved through that FK. It's resolved by assembling a `service_code` string per order (`order->test_code`, catalog `metadata.billingServiceCode`, a fallback code, etc.) and string-matching it against `billing_service_catalog_items.service_code`.
- A repository method exists specifically to price directly off the catalog FK (`listLatestByClinicalCatalogItemIds`) — and is never called from the charge-capture path. It just sits there.
- Consultations have no catalog FK at all. Price is derived by assembling a code like `CONSULT-{clinician_tier}-{department}` at read time from a clinician's job title/license-type string (`consultationClinicianTier()`), with a whole admin subsystem (`ConsultationMappingModel`/`ConsultationMappingController` + five frontend composables) that exists purely to manage this string-derivation.
- Beds and service-points (facility resources) have **no catalog representation of any kind** — `ClinicalCatalogType` (the enum backing the shared catalog) has no case for them. Bed-day pricing (added this week) had to fall back to the same string-matching mechanism with zero FK backing at all: `BED-{WARD_TOKEN}`, falling back to `BED-DAY`.
- Inventory (`InventoryProcurement` module) has a *third*, separate pricing concept (`inventory_item_unit_prices`, stock cost) loosely linked to the clinical catalog only for pharmaceuticals, validated by a purpose-built governance tool (`CatalogPlacementAuditor`) that exists because this boundary drifts in practice — evidence the team already knows this area is fragile.

**Net effect:** six near-duplicate string-matching pricing paths, one catalog that only covers some of what's billable, an admin UI (Consultation Mappings) that exists solely to patch around a missing FK, and a resolver method for the "right" way to do this that nothing calls.

## 2. Goals

1. One canonical identity for "anything a patient can be billed for" — `chargeable_items` — covering every domain that currently has one (lab, radiology, theatre, procedure, pharmacy) **and** the domains that currently have none (bed-days, service-point sessions, equipment, consultations).
2. Price resolution joins on that identity's UUID, never on a free-text code. `service_code` becomes a human-readable label only.
3. Duration/quantity charge logic (today: one bespoke `ceil(hours/24)` block inside a single use case, only for bed-days) becomes a reusable strategy any chargeable item can declare (`flat`, `per_unit`, `per_day`, `per_hour`).
4. Payer-specific pricing (NHIF, insurance contracts) is a native part of price resolution, not a separately-queried override table bolted on after.
5. Removal, not just addition — the string-matching resolution code, the Consultation Mapping string-generation logic, and (once fully migrated) the legacy override table are deleted. This is explicitly not "add a new system next to the old one forever." See `PricingEngine_Removal_Inventory.md`.

## 3. Non-Goals

- **Not** rewriting invoices, payments, the cashier queue UI, or refunds. They consume a priced line item; they don't care how it was resolved.
- **Not** touching Inventory's stock-cost tracking (`inventory_item_unit_prices`). Cost-to-hospital and price-to-patient are legitimately different concerns and stay separate. Only the *write-time validation* of the inventory↔clinical-catalog link changes (see §6).
- **Not** introducing a persisted, event-sourced charge ledger in this phase. Candidates stay derived-on-read from source records (appointments/orders/admissions), exactly as today — see §5 "Option considered and rejected."
- **Not** a big-bang cutover. Every domain migrates independently, behind a flag, with shadow verification against real historical invoices before anything old is deleted.

## 4. Proposed Architecture (summary — full detail in `PricingEngine_Technical_Design.md`)

```
chargeable_items          -- canonical identity, one per billable "thing," any domain
     |
     | 1:N (versioned)
     v
price_book_entries        -- what it costs: facility/tier/payer/currency/effective-dated
     |
     | referenced by
     v
[domain records]           -- lab_orders.chargeable_item_id, admissions (via facility_resources.chargeable_item_id),
                              appointments (via consultation assignment), etc. -- all NOT NULL, all FK
     |
     v
Charge Resolver            -- single service: (chargeable_item_id, qty/duration, payer, as-of date) -> priced line
```

## 5. Option Considered and Rejected: Persisted Charge-Event Ledger

A more "correct" long-term design would have each domain emit a durable `charge_events` row the moment a billable action happens (order completed, bed-day elapsed, consultation finished), rather than recomputing candidates live and deduping by scanning existing invoices' `line_items` JSON for a matching `sourceWorkflowKind:sourceWorkflowId` — which is what happens today (`invoicedSourceIndex()`).

**Rejected for this phase** because it's a materially larger change (new write paths in five+ domain modules, backfill of historical charge history, a new source of truth to keep consistent with invoices) for a problem (recompute-and-scan dedup) that isn't currently causing incidents. Flagging it here so it isn't forgotten — worth revisiting once the FK-based resolver has been live for a while and if invoice-scan dedup shows performance problems at scale.

## 6. Decision

Proceed with the FK-based `chargeable_items` + `price_book_entries` design, migrated one domain at a time behind feature flags, with mandatory shadow-diff verification against production billing data before any domain's legacy path is removed. Full phase breakdown in `PricingEngine_Migration_Plan.md`. Full backend/frontend deletion list in `PricingEngine_Removal_Inventory.md` — nothing is removed until its replacing phase has shipped and been verified.

## 7. Risks

- **Financial correctness risk is the dominant risk.** Any bug in price resolution shows up as a wrong invoice. Every phase gate requires shadow-diffing new resolution against old resolution on real historical data with zero tolerance for silent mismatch (see Migration Plan §"Verification Gate").
- **Consultation pricing is the trickiest migration**, not the bed-day one — it's the only domain where the "mapping" (clinician tier + department → price) is itself a business rule someone configures, not just a missing FK. Scope this migration to *keep* the mapping concept but back it with a real FK (see Removal Inventory, "Rework, not delete").
- **Live data, not a greenfield table.** `billing_service_catalog_items` and `billing_payer_contract_price_overrides` have real historical rows referenced by real (already-issued) invoices' JSON snapshots. Nothing existing gets mutated or dropped until backfill + shadow verification is complete for every consumer.

## 8. Open Questions for Reviewers

1. Does Finance require price-change audit history at the same granularity as today (`billing_service_catalog_item_audit_logs`) for the new `price_book_entries` table? (Assume yes unless told otherwise — carried into design.)
2. Should `chargeable_items` be a genuinely new table, or should `platform_clinical_catalog_items` be extended in place with the missing catalog types (bed_day, service_point_session, consultation, equipment)? RFC assumes a new table for a clean cutover with an FK backfill from the old one, but extending in place is a smaller diff if reviewers prefer it — flagging for discussion, not deciding unilaterally.
3. Confirm nobody outside Billing/Platform reads `billing_service_catalog_items.service_code` as a stable identifier today (e.g. reporting, exports, NHIF claims format) before it's demoted to display-only.
