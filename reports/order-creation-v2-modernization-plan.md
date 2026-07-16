# Order Creation in V2 Pages — Modernization Plan

**Document type**: Implementation plan, following the same conventions established in `reports/appointments-scheduling-workspace-modernization-plan.md` and `reports/emergency-queue-modernization-plan.md` (extract-don't-rewrite from working code, reuse existing backend unchanged, `Sheet`-based creation UI matching `AppointmentCreateSheet.vue`/`PatientRegistrationSheet.vue`, phased delivery with an explicit scope table).

**Why this exists now**: the next step after this plan is to delete every legacy page that already has a V2 replacement (`patients/Index.vue`, `appointments/Index.vue`, `laboratory-orders/Index.vue`, `pharmacy-orders/Index.vue`, `radiology-orders/Index.vue`, `theatre-procedures/Index.vue`). Before that can happen safely, every capability the legacy pages provide has to exist in V2 first. Confirmed by investigation before writing this plan: **order creation is the one capability V2 is missing.**

## 1. The gap, confirmed

The 4 order-type legacy pages (`laboratory-orders/Index.vue`, `pharmacy-orders/Index.vue`, `radiology-orders/Index.vue`, `theatre-procedures/Index.vue`) each have a **workspace-view toggle** (`'queue' | 'new'`/`'create'`) that swaps the whole page body to an **inline `<Card>` creation form** — not a modal of any kind. This is the "inline ordering" being replaced.

Their V2 counterparts have no creation UI at all today — each "Create order" button is a bare `<Link href="/…/legacy">` that bounces the user back to the legacy page's inline form:
- `laboratory-orders/IndexV2.vue:423-428`
- `pharmacy-orders/IndexV2.vue:504-509`
- `radiology-orders/IndexV2.vue:372-377`
- `theatre-procedures/IndexV2.vue:359-364`

**Appointments and Patients are already done** and are explicitly out of scope here — both legacy pages were already `Sheet`-based (not inline) even before their V2 rebuilds, and V2 already ships real creation UI: `AppointmentCreateSheet.vue` (wired into `appointments/IndexV2.vue:14,206-210,408`) and `PatientRegistrationSheet.vue` (wired into `patients/IndexV2.vue:70,271-273,456`). Deleting those two legacy pages is not blocked by this plan.

## 2. Design decision: Sheet, not Dialog/Popover/Drawer

All four UI primitives exist in this codebase (`components/ui/sheet`, `dialog`, `drawer`, `popover`), so this was a real choice, not a default. Decided **Sheet, `variant="form"`**, matching the pattern already established for every other multi-field creation form in V2:

- `AppointmentCreateSheet.vue:169-178` — `<SheetContent variant="form" size="2xl">`
- `PatientRegistrationSheet.vue:287-293` — `<SheetContent side="right" variant="form" size="2xl">`

Ruled out:
- **Dialog** — this codebase reserves `Dialog`/`size="md"` for short, single-purpose actions (status changes, closure reasons, duplicate-order confirmations), never for a multi-field creation form with a patient/context picker plus order-specific fields.
- **Popover** — too lightweight for a form with 6-12 fields; every existing Popover usage in this codebase is a small filter or a summary card, not a form.
- **Drawer** — the primitive exists but has zero creation-form usages anywhere in the codebase today; introducing it here would be a third pattern for the same job with no benefit over Sheet.

## 3. Reuse strategy: extract, don't rewrite

Order creation for Lab/Pharmacy/Radiology already works end-to-end today, just from a different entry point: `encounters/WorkspaceV2.vue` → `EncounterOrdersCommandCenter.vue` → `EncounterInlineOrderPanel.vue`, which posts to the exact same endpoints (`POST /laboratory-orders`, `/pharmacy-orders`, `/radiology-orders`) via `resources/js/lib/encounterInlineOrders.ts`. Theatre has its own equivalent, `TheatreInlineOrderForm.vue`.

This plan **extracts the field logic from those components into shared composables**, then wraps them in a new `Sheet` per order type for the standalone list pages — it does not reimplement validation or submission logic that already works. The encounter-context versions stay as they are (they have a bound patient/encounter already and use `entryMode: 'active'` + `orderSessionId`, which the standalone page has no equivalent for — see §4).

## 4. What's actually new: the context picker

The encounter-workflow forms never need a patient/context picker — they already have a patient and (usually) an encounter bound. A standalone order-list page has neither, so each new Sheet needs a step the encounter panel doesn't:

1. **Patient search** — reuse `PatientLookupField.vue` (already used by `patients/PatientDirectServiceDialog.vue`, confirmed in earlier session's audit) or `GlobalPatientSearch.vue`, not a new component.
2. **Optional context link** — appointment / admission / service request, all nullable per the backend validation (`StoreLaboratoryOrderRequest.php:20-38` etc.) — matches the legacy page's own context fields (`patientId`, `appointmentId`, `admissionId`, `serviceRequestId`) exactly, so nothing here is invented.
3. Once a patient (and optionally a context) is selected, the rest of the Sheet is the extracted field set from the corresponding inline panel.

## 5. Per-order-type scope and open questions

| Order type | Fields (from `StoreXRequest.php`) | Submission | Open question |
|---|---|---|---|
| **Radiology** | catalog item or procedureCode, modality (required), studyDescription, clinicalIndication, scheduledFor | Single-step `POST /radiology-orders` | None — simplest case, build first to prove the Sheet+picker pattern. |
| **Pharmacy** | catalog item or medicationCode, dosageInstruction (required), quantityPrescribed (required), route/frequency/duration, clinicalIndication, safety override fields | Single-step `POST /pharmacy-orders` | Whether to embed `EncounterMedicationSafetyPanel` (the drug-interaction/dose checks) in the standalone Sheet too, or defer it. Recommend embedding it — skipping medication safety checks for orders placed outside an encounter would be a real regression, not a simplification. |
| **Theatre** | catalog item or procedureType, operatingClinicianUserId (required), anesthetistUserId, theatreRoomServicePointId, scheduledAt (required), notes | Single-step `POST /theatre-procedures` | None functionally new — same shape as `TheatreInlineOrderForm.vue`, just needs the patient/context picker in front of it. |
| **Laboratory** | catalog item or testCode, priority (required), specimenType, clinicalNotes | **Two-step**: draft (`POST /laboratory-orders`) then sign (`POST /laboratory-orders/{id}/sign`) | **Needs a decision**: preserve the legacy draft→sign two-step, or simplify to single-step like the other three? The encounter-panel version doesn't have this step at all (`entryMode: 'active'` skips it). Recommend preserving draft→sign for standalone-page creation specifically, since it's real existing behavior with its own purpose (a pending/unsigned order state) — collapsing it would be a silent behavior change, not just a UI port. |
| **Laboratory "basket mode"** | Queue several tests before one submit (`createOrderBasket`, legacy `Index.vue:1081` onward) | Batch of the same draft+sign flow | **Needs a decision**: this is real, currently-used legacy functionality. Recommend scoping it as a fast-follow (Phase 5 below) rather than a hard blocker — a working single-test Sheet is enough to retire the legacy page's *page-level* pattern; basket mode can be added to the same Sheet once the base version ships, without re-opening the Sheet-vs-other-primitive decision. |

## 6. Backend

**Zero backend changes required.** All four `CreateXOrderUseCase`s, their routes, and their `StoreXRequest` validation already exist, are already used by the legacy pages today, and need no modification — confirmed directly against `routes/api.php:895,1262,1326,1802` and the four `StoreXRequest.php` files.

## 7. Phasing

| Phase | Content | Depends on | Status |
|---|---|---|---|
| **1 — Radiology creation Sheet** | New `RadiologyOrderCreateSheet.vue`, patient/context picker, fields extracted from `EncounterInlineOrderPanel.vue`'s radiology branch. Wired into `radiology-orders/IndexV2.vue`, replacing the legacy-link button. | — | **Done** |
| **2 — Pharmacy creation Sheet** | Same pattern, plus embedded `EncounterMedicationSafetyPanel` and safety-override fields. | 1 | **Done** |
| **3 — Theatre creation Sheet** | Same pattern, extracted from `TheatreInlineOrderForm.vue` (clinician/anesthetist/room fields). **Scope decision made after starting**: quick-booking only, matching `TheatreInlineOrderForm.vue` exactly — no OR room-registry/conflict-checking. `theatre-procedures/Index.vue` stays reachable via a "Full scheduling" link alongside the new Sheet; unlike radiology/pharmacy, this phase does **not** unblock deleting theatre's legacy page. | 1 | **Done** |
| **4 — Laboratory creation Sheet** | Same pattern, plus the draft→sign two-step (single order at a time — no basket yet), preserved exactly as the legacy page's `createOrder()` does it (one user-facing action, two backend calls). Submits via direct `apiPost` calls rather than `createLaboratoryInlineOrder()` (which hardcodes `entryMode: 'active'`), so the encounter workflow's create path is untouched. | 1 | **Done** |
| **Note** | Phases 1-4 all reuse `checkXDuplicate`/`fetchXCatalog` from `encounterInlineOrders.ts`/`theatreInlineOrder.ts` but never modify those files — the encounter-workflow create functions (`createLaboratoryInlineOrder`, `createPharmacyInlineOrder`, `createRadiologyInlineOrder`, `createTheatreInlineOrder`) are called as-is where their behavior matches (radiology/pharmacy/theatre — all `entryMode: 'active'`), or bypassed in favor of a direct `apiPost` where it doesn't (laboratory's draft→sign). | — | — |
| **5 — Laboratory basket mode** | Multi-test queueing before one submit, ported from legacy `createOrderBasket`. | 4 | Not started — fast-follow, not a blocker for legacy deletion |
| **5b — Reorder / Add-on** | Found during a pre-deletion parity audit: the legacy pages' "Reorder"/"Add linked test" buttons (which set `replacesOrderId`/`addOnToOrderId`) had no V2 equivalent at all in any of the three domains. Deliberately **not** copied as a legacy-style detail-view button set — instead, `LaboratoryOrderDetailSheet.vue`/`PharmacyOrderDetailSheet.vue`/`RadiologyOrderDetailSheet.vue` each gained a footer with "Reorder"/"Add linked X" buttons that emit the source order, and `IndexV2.vue` opens the *same* creation Sheet from Phases 1/2/4, pre-filled with the source patient and passing a `linkage` prop (`{mode, sourceOrderId, sourceLabel}`) through to `replacesOrderId`/`addOnToOrderId` in the create payload. One creation form serves both "fresh order" and "linked order" — not a second UI surface. | 1, 2, 4 | **Done** |
| **5c — Pharmacy safety override** | Found during the same audit: when a medication-safety check reports blockers, `PharmacyOrderCreateSheet.vue` used to just error out and tell the user to "open the pharmacy orders module" — pointing at the legacy page this whole plan retires, with no way to actually proceed. Added a small override Dialog (category Select from `summary.overrideOptions` + reason Textarea, validated the same way the legacy page does), submitting `safetyOverrideCode`/`safetyOverrideReason` — fields the backend already accepted but no V2 UI ever sent. Widened the shared `PatientMedicationSafetySummary` type in `encounterInlineOrders.ts` to include `overrideOptions` (additive only — confirmed no other consumer constructs this type manually, so nothing else could break). | 2 | **Done** |
| **6 — Legacy deletion** | Deleted `laboratory-orders/Index.vue` (10,103 lines), `pharmacy-orders/Index.vue` (16,767 lines), `radiology-orders/Index.vue` (7,350 lines) — 34,220 lines removed. **Theatre's legacy page is excluded** — it stays for full resource booking regardless of this plan's other phases (see Phase 3). The ~24 hardcoded links elsewhere in the app (encounter workflow, patient chart, theatre cross-links) pointing at `/legacy` with `reorderOfId`/`addOnToOrderId`/`includeTabNew` params were explicitly **not** rewired this pass (user decision) — the three `/legacy` routes were kept as aliases to the V2 page instead of removed, so those links still resolve, just without the reorder/add-on context carrying through. Rewiring them to the canonical route + `linkage` prop is still open, whenever that's picked up. Audit export-job system (async CSV export/poll/retry) was scoped, then explicitly descoped by user decision — not built. | 1-4, 5b | **Done** |

## 8. Non-goals

- Rebuilding Appointments/Patients creation — already done in V2, not touched by this plan.
- Deleting any legacy page — that's the *next* plan, after this one ships; explicitly out of scope here.
- Changing the encounter-workflow creation path (`EncounterInlineOrderPanel.vue`, `TheatreInlineOrderForm.vue`) — those stay exactly as they are; this plan only adds a second entry point for the same backend endpoints.

## 9. Verification (per phase)

- Backend: none needed (no backend changes), but existing `StoreXRequest` feature tests stay green as a regression check.
- Frontend: `vue-tsc --noEmit` / `vitest run` held at current baselines; new composable specs for the extracted field logic, mirroring `AppointmentCreateSheet`'s own test coverage.
- Route test per phase confirming the V2 page's "Create order" button now opens the Sheet instead of linking to `/legacy`.
- Browser, throwaway-data pattern: create a real order end-to-end through the new Sheet, confirm it appears in the list, confirm the same order is visible/editable from the legacy `/legacy` page too (proving both write to the same data, not a parallel path).
