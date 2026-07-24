# Migration & Rollout Plan: Unified Pricing Engine

Companion to `PricingEngine_RFC.md` and `PricingEngine_Technical_Design.md`. No phase starts until the previous phase's verification gate passes. No legacy code is deleted until its replacing phase has been live and shadow-verified — the explicit deletion list lives in `PricingEngine_Removal_Inventory.md`, cross-referenced by phase below.

---

## Phase 0 — RFC Sign-off

**Deliverable:** `PricingEngine_RFC.md` reviewed and approved by Billing owner, clinical modules owner, Inventory owner, and a Finance/Product stakeholder (RFC §8 open questions answered).
**Gate to proceed:** written sign-off. No code in this phase.

## Phase 1 — New Schema, No Behavior Change

**Deliverable:**
- Migrations creating `chargeable_items`, `price_book_entries`, `price_book_entry_audit_logs`, and the nullable `chargeable_item_id` columns on every domain table listed in Technical Design §1.3.
- A backfill command (`php artisan pricing:backfill-chargeable-items`) that:
  - Creates one `chargeable_items` row per existing `platform_clinical_catalog_items` row (1:1, preserving `id` mapping in a lookup table for traceability).
  - Creates one `price_book_entries` row per existing active `billing_service_catalog_items` row, linked via the `clinical_catalog_item_id` FK where present.
  - Leaves rows with no `clinical_catalog_item_id` (bed-day's `BED-*` rows, consultation's `CONSULT-*` rows) unlinked — logged to a report, not silently dropped, since these need the Phase 3 domain-specific migrations before they can link properly.
- **Nothing reads the new tables yet.** This phase is additive-only; existing charge-capture keeps working exactly as today.

**Verification gate:** backfill command run against a copy of production data (not live prod), row counts reconciled (every active `billing_service_catalog_items` row has exactly one `price_book_entries` counterpart), report of unlinked legacy rows reviewed by Billing owner.

## Phase 2 — Resolver Built, Shadow-Only

**Deliverable:**
- `ChargeResolver` service (Technical Design §2) implemented and unit-tested against the new tables.
- Feature flag `pricing.engine.v2` (default **off**).
- A shadow-comparison job: for every charge-capture-candidates request, when the flag is off, *also* run the new resolver in the background (not user-facing) for any candidate whose domain already has a `chargeable_item_id` backfilled, and log any price mismatch against the legacy string-matched result to a dedicated `pricing_engine_shadow_diffs` table.

**Verification gate:** shadow diff log run for a minimum of one full billing cycle (recommend 2 weeks) with **zero unexplained mismatches** on lab/radiology/pharmacy/procedure/theatre (the domains with pre-existing FKs, migrated first since they need no new business-rule work — just switching the join). Any mismatch is investigated and either fixes a resolver bug or reveals a legacy data quality issue (e.g., a `clinical_catalog_item_id` that was set but pointed at the wrong row) — both are logged, neither is waved through.

## Phase 3 — Domain-by-Domain Cutover

Each domain gets its own sub-flag (`pricing.engine.v2.laboratory`, `...radiology`, etc.) so a bad cutover in one domain doesn't block or roll back the others. Order, smallest-risk first:

1. **Laboratory** — smallest catalog, cleanest existing FK data.
2. **Radiology**
3. **Clinical Procedure**
4. **Theatre**
5. **Pharmacy** — last of the "already has an FK" group; touches Inventory boundary (Technical Design §6), so `InventoryClinicalLinkGuard` re-pointing happens alongside this one.
6. **Consultation** — the one with real business-rule migration (Technical Design §4: `ConsultationMappingModel` re-pointed to `chargeable_item_id`, `appointments.consultation_chargeable_item_id` populated at check-in). Budget the most review time here — it's the only domain where "the mapping" is a product decision, not just plumbing.
7. **Bed-day / Service-point session** — net-new capability. Facility admins must assign a `chargeable_item_id` to each ward/bed and service-point via the admin screens (Technical Design §5) *before* this flag flips, or every bed-day candidate shows `missing_price_book_entry` on day one. Sequence: ship the admin-screen field first, give facilities a lead time window to populate it, verify coverage (a report: "N of M active beds have no assigned price"), only then flip the flag.

**Per-domain verification gate:** flag on in production for that domain only, shadow-diff logging continues for **both directions** for one week (new resolver is live and user-facing; legacy path still computed in the background purely for comparison), zero unexplained mismatches, then legacy candidate-building code for that specific domain is deleted (see Removal Inventory, domain-by-domain checklist).

## Phase 4 — Frontend Cutover

Only begins once **all** backend domains have flipped (Phase 3 fully complete) — frontend changes are shared across domains (the Service Catalog admin screen, the Charges tab), so partial backend migration with full frontend cutover would show inconsistent UX per domain.

**Deliverable:**
- `ServiceCatalogCreateItemSheet.vue` reworked: "Chargeable item" picker (search/select) replaces free-text "Service Code" as the required field; code becomes a read-only derived display.
- `ChargesTab.vue` / `BillingCreateChargeCapturePanel.vue` and friends: internal data plumbing swaps from `serviceCode`-keyed to `chargeableItemId`-keyed (API response already carries both per Technical Design §7 — this is a currently-invisible internal change, not a visual redesign).
- Ward/bed and service-point admin screens gain the "Pricing item" field (Technical Design §5).
- Consultation Mapping admin screens reworked per Technical Design §4.

**Verification gate:** manual QA pass (per this project's convention of testing UI in a real browser, not just component tests) through: creating a price for a new chargeable item, assigning a bed's pricing item, editing a consultation mapping, and confirming an end-to-end charge-capture → invoice flow for one patient in each of the seven domains.

## Phase 5 — Legacy Removal

Only starts once Phase 4 has been live and stable for an agreed bake period (recommend 2–4 weeks, Billing owner's call). Full itemized list in `PricingEngine_Removal_Inventory.md` — summary:

- Delete string-matching resolver code (`findActivePricingByServiceCodes`, `resolveServiceCode`, `normalizeServiceCodeCandidates`, the `CONSULT-*`/`BED-*` string-assembly helpers).
- Delete the old `billing_payer_contract_price_overrides` table (its data is now redundant with `price_book_entries.payer_contract_id`) — **archive, don't hard-delete**, export to cold storage first given financial-audit retention norms; confirm retention requirement with Finance before dropping.
- Drop the now-legacy-only `billing_service_catalog_items` table itself, **after** confirming no existing invoice/report/export depends on querying it live (already-issued invoices store their line items as a JSON snapshot at issue time, not a live FK, per current code — so this should be safe, but confirm before dropping, this is RFC §8 open question 3).
- Remove feature flags entirely once every domain is confirmed on the new path with no rollback expected.

**Verification gate:** confirm zero read traffic to the tables/methods being dropped (query logs / a temporary deprecation-warning log line) for the full bake period before deletion.

## Phase 6 — Cleanup & Documentation

- Update this repo's architecture docs to describe the new pricing engine as the current state (retire this set of planning docs to an `archive/` note, or fold key decisions into a permanent `PricingEngine_Architecture.md`).
- Close out any `catalog_integrity_audit_findings` backlog created by `CatalogPlacementAuditor` that's now structurally prevented by write-time validation.

---

## Rollback Strategy (applies to every phase from 2 onward)

Every cutover is flag-gated per domain. Rolling back is flipping that domain's flag off — legacy code path is not deleted until Phase 5, specifically so this stays true through Phase 4. The only phase without a clean instant rollback is Phase 5 itself (deletion) — which is exactly why it's gated on a bake period and a "confirm zero read traffic first" check rather than a fixed calendar date.
