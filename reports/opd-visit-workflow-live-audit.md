# Outpatient Visit Workflow — Live End-to-End Audit

**Scope**: this report documents what actually happens — in the UI, the database, and the source — when a real hospital user runs a full OPD visit from patient arrival to encounter close: Registration → Check-in → Waiting Queue → Triage → Provider Queue → Consultation (Encounter) → Orders (Lab / Imaging / Pharmacy) with per-order Billing Capture → Payment / Settlement → Encounter Close. Unlike a static code read, every claim below was exercised live against a running instance (raw `php -S` on `127.0.0.1:8002`, Postgres dev DB, facility `AFYANOVA` / tenant `TZH`) and cross-checked against the database and, where the UI behavior was ambiguous, the source.

**Method**: registered a real walk-in patient through the actual registration form, drove her through every stage via the real UI (reception queue, triage queue, clinician queue, encounter workspace, laboratory/pharmacy/radiology worklists, billing), and verified each transition with direct Postgres queries and captured network requests rather than trusting UI toasts alone. Source was read only to explain defects found live, not as the primary evidence.

**Test subject**: patient *Amina ZzzVerify*, MRN `PT20260718MSOWIH`, encounter `ENC20260718VHEEPW`. Left in the database for inspection. Throwaway admin logins used to drive the browser were deleted after each run.

**Severity key**: Critical = blocks or silently corrupts a core workflow step for a normal user. High = a step has no working path to completion. Medium = wrong/misleading behavior with a workaround. Low = cosmetic or narrow-impact.

**Revision note**: two items from the original pass (a stuck-open Region/District popover, and off-screen/blank order dialogs) were root-caused on follow-up and turned out to be an artifact of the automated Browser-pane test tool freezing CSS animation timelines while its tab reports `document.visibilityState: "hidden"` — not app defects. See "Investigated and ruled out" below each. Two other items — Gender defaulting to "Female", and the consultation fee auto-capturing at TZS 0.00 — were confirmed real and have been fixed. Findings are renumbered accordingly.

---

## Scorecard

| # | Stage | Verdict |
|---|---|---|
| 1 | Registration | Works |
| 2 | Check-in | Works |
| 3 | Waiting queue | Works |
| 4 | Triage | Works |
| 5 | Provider queue | Works |
| 6 | Consultation (encounter) | Works |
| 7 | Orders (lab / imaging / pharmacy) | Works |
| 8 | Billing capture | Fixed — capture-to-invoice and invoice-to-payment now both work |
| 9 | Payment / settlement | Fixed — reachable once an invoice is issued |
| 10 | Encounter close | Well designed |

Findings: **1 low** outstanding, **1 low newly found**, plus 5 fixed (Gender default, consultation $0 billing, lab catalog cross-tenant duplication, pharmacy status-count tile lag, billing capture/payment) and 2 ruled out as testing-tool artifacts.

Architecture notes: all 4 addressed — 3 fixed (shared status vocabulary, encounter FK, cash-billing traceability), 1 documented with a full rename scoped out as a separate follow-up (triage naming collision). One further pre-existing bug was discovered while verifying the cash-billing fix and flagged separately (see Architecture notes below).

---

## 1. Registration

Registered a new walk-in patient (34F, Dar es Salaam) through `/patients` → **Register Patient**. Duplicate-check, age-from-DOB calculation, and MRN generation (`PT20260718MSOWIH`) all worked correctly against the live duplicate-detection service.

### Investigated and ruled out — Region/District picker "never closes"

An earlier pass of this audit flagged the Region/District combobox (`resources/js/components/forms/SearchableSelectField.vue`, backed by `resources/js/components/ui/popover/PopoverContent.vue`) as never visually closing after a selection — `data-state="closed"` but still `opacity:1; pointer-events:auto; display:block`, at one point covering the Address field and the Register Patient submit button. On review, this did not match how the app behaves for a real user, so it was root-caused rather than taken at face value.

Root cause, confirmed with the Web Animations API on the stuck element:
```js
p.getAnimations() →
{ playState: "running", currentTime: 0, animationName: "exit", effect: { duration: 150, fill: "none" } }
document.visibilityState → "hidden"
```
The popover's exit animation is correctly applied (`animationName: "exit"`, 150ms) and reports `playState: "running"` — but its `currentTime` never advances past `0`. Browsers freeze the CSS/Web Animations timeline whenever `document.visibilityState !== "visible"`, which this automated Browser-pane test session reports as `"hidden"` even while notionally focused. Reka UI's `Presence` (`node_modules/reka-ui/dist/Presence/usePresence.js`) correctly detects the exit animation starting and waits for its `animationend` event before unmounting — an event that can never fire while the timeline is frozen, so the popover stays mounted and interactive indefinitely.

**This is a testing-tool artifact, not an app defect.** A real user's foregrounded browser tab reports `visibilityState: "visible"`, the 150ms exit animation runs and completes normally, and the popover unmounts on schedule. No code changes made. (The same mechanism explains the Orders-stage item ruled out in §7 — an *enter* animation stalling at its starting transform instead of an *exit* animation stalling at its end state.)

### Finding 1 (Low) — Gender defaults to "Female" — **Fixed**

The Gender combobox opened pre-selected to `Female` rather than an empty/placeholder state. A clerk who didn't notice the pre-fill could register a male patient with the wrong sex on file.

**Fix**: `usePatientRegistrationForm()` (`resources/js/composables/patientsIndex/usePatientRegistration.ts`) and `resetForm()` in `PatientRegistrationSheet.vue` now initialize `gender` to `''` instead of `'female'`; the trigger shows a `Select gender` placeholder (`<SelectValue placeholder="Select gender" />`); and `canSubmit` now requires `form.gender !== ''`, so Register Patient stays disabled until a gender is actually chosen. Verified live: fresh registration form shows the placeholder, submit stays disabled with every other field filled until Gender is picked, and the submitted patient's `gender` column matches the selection made. (Note: the legacy `patients/Index.vue` registration form has its own separate `registrationForm.gender = 'female'` default and was intentionally left untouched — it is slated for removal, not extension, per this codebase's V2 migration convention.)

---

## 2. Check-in & 3. Waiting queue

From `/reception/queue`, searched the new patient, chose **Walk-in OPD**, recorded a reason, and checked in.

- `POST /api/v1/reception/walk-ins` → `201 Created`
- Appointment status: `scheduled` → `waiting_triage`
- Encounter auto-opened: `ENC20260718VHEEPW`, status `opened` (via `EncounterResolverService::findOrCreateForVisit`, triggered on check-in)
- Patient appeared correctly in the "Waiting for triage" tab with the right wait badge

No defects found in this stage.

---

## 4. Triage

Recorded a full vitals set (BP 124/80, pulse 88, temp 38.2°C, RR 20, SpO2 97%, weight 62 kg, height 165 cm), intake notes, triage notes, and routed to the **General OPD** department pool.

Verified directly in `appointments`:
```
department: "General OPD"
triage_vitals_summary: "BP 124/80, Pulse 88 bpm, Temp 38.2 C, RR 20/min, SpO2 97%, Weight 62 kg, Height 165 cm, ..."
triage_notes: "Suspected gastroenteritis, refer to general OPD provider"
triaged_at / triaged_by_user_id: populated
status: waiting_triage → waiting_provider
```
No billing invoice exists at this point — confirmed correct: consultation-fee capture is deferred to consult start, not triage.

No defects found in this stage.

---

## 5. Provider queue

Patient appeared in `/clinician/queue` under **Waiting** with a live wait-time counter and a working **Start consultation** action that opens the encounter workspace. No defects found.

*(Aside, not a defect in the tested visit: another pre-existing patient, "Blandina Haonga," was shown "16h 31m since consultation started" under In Progress — a stuck/orphaned consultation with no visible timeout or escalation. Worth a look if this recurs for real patients.)*

---

## 6. Consultation (encounter)

Wrote a full SOAP note (Subjective / Objective / Assessment / Plan) in the TipTap rich-text editor, attached ICD-10 `K52.9`, and finalized. Auto-save, diagnosis-on-finalize, and note lock-after-finalize all behaved correctly:

- Note lifecycle: `draft` → `finalized`, becomes read-only, `signed_at` recorded
- `K52.9` auto-promoted to the encounter's primary diagnosis on finalize (`encounter_diagnoses` row created in the same transaction as the finalize PATCH)
- Encounter status: `opened` → `signed`; close-readiness score 40% → 80%

This part of the app is well built.

### Finding 2 (Critical) — Consultation fee auto-captures at TZS 0.00 with no warning — **Fixed**

Finalizing the note auto-generated invoice `INV20260718STNFIE` — but its only line item priced at **TZS 0**, and nothing in the UI flagged it.

Root cause, `app/Modules/Billing/Application/UseCases/AutoCaptureConsultationFeeUseCase.php`:
- Line 47-54: resolves clinician tier from the logged-in user's staff profile. My session had no `StaffProfileModel`, so tier resolution returned `null`.
- Lines 56-73: tries an exact `(clinician_tier, department)` mapping in `consultation_mappings` (empty table in this DB), then falls back to guessing service codes from the department name — the method is literally named `consultationServiceCodes()` and the comment above the fallback call reads **"Fallback to Brittle Generation Logic"**. Department `"General OPD"` token-normalizes to `GENERAL-OPD`, which does not match the one seeded catalog price, `CONSULT-MD-OUTPATIENT` (TZS 35,000).
- Lines 77-79 (as they were):
  ```php
  $unitPrice = $catalogItem !== null
      ? round(max((float) ($catalogItem['base_price'] ?? 0), 0), 2)
      : 0;   // ← silent zero, invoice still created
  ```
  When every lookup misses, the invoice was created anyway at `unitPrice = 0`, not blocked, queued for manual pricing, or flagged to billing staff.

Confirmed in the database at the time:
```json
"line_items": [{ "description": "Consultation - General OPD", "unitPrice": 0, "lineTotal": 0, "serviceCode": "CONSULTATION" }]
```
and the charge-capture-candidates API independently tagged the same row `"pricingStatus": "missing_catalog_price"` — the system already knew the price was missing; it billed zero regardless.

**Impact**: any consultation by a clinician whose staff profile doesn't resolve to a tier, or whose department name doesn't token-match a seeded catalog code, was rendered for free with no trace in the UI. This is a revenue-integrity gap, not a cosmetic one.

**Fix**: when neither the explicit `(clinician_tier, department)` mapping nor the fallback service-code guess resolves a catalog item, the use case now returns early — `['captured' => false, 'reason' => 'no_catalog_price', 'invoice' => null]` — instead of creating an invoice at `unitPrice = 0`. It deliberately does **not** invent a new "needs pricing" status or UI: `ListBillingChargeCaptureCandidatesUseCase` (`consultationCandidates()`) already independently recomputes pricing for any appointment with no invoiced line and correctly tags it `pricingStatus: missing_catalog_price` — by never creating the phantom $0 invoice, the visit now surfaces there instead, exactly like an unpriced lab or radiology order does. As a direct side effect, `GetEncounterCloseReadinessUseCase`'s "Billable services captured" check (which counts only *pending* candidates) now correctly warns about an unresolved consultation fee at close time too, instead of treating a $0 invoice as "already captured" and staying silent.

Verified two ways:
1. Live, via `tinker`, calling the use case directly on a fresh appointment with no clinician/tier and a non-matching department: `{"captured":false,"reason":"no_catalog_price","invoice":null}`, zero `billing_invoices` rows created (previously: 1 row at TZS 0).
2. Regression check on the happy path — a clinician with a matching `MD` + `Outpatient` staff/regulatory profile against the real seeded `CONSULT-MD-OUTPATIENT` (TZS 35,000) tariff — still auto-captures correctly: `{"captured":true,"reason":"created", ...}`, invoice at TZS 35,000.

`tests/Feature/Billing/AutoCaptureConsultationFeeTest.php` had two tests that directly encoded the old bug as expected behavior (`'auto-captures even when no catalog pricing exists using fallback service code'`, asserting 1 invoice at TZS 0; and a no-staff-profile test asserting the same) — both rewritten to assert the new behavior (0 invoices, `captured: false, reason: 'no_catalog_price'`). The full suite could not be re-run end-to-end in this environment (a pre-existing, unrelated seeder failure — `SQLSTATE[HY000]: ... no such function: JSON_MERGE_PATCH` against SQLite — blocks `RefreshDatabase` for every test in this file, confirmed present before this change too by re-running against a stash of the original code).

---

## 7. Orders — lab, imaging, pharmacy

Placed one order of each type from the encounter's Order Command Center, then advanced each through its full worklist lifecycle on the dedicated Laboratory / Radiology / Pharmacy pages.

| Order | Path traced | Result | Priced at close |
|---|---|---|---|
| Lab — Complete Blood Count | ordered → collected → in progress → completed, results entered (8 parameters) | Full cycle works | TZS 15,000 |
| Radiology — Chest X-Ray PA | ordered → scheduled → in progress → completed, report entered | Full cycle works | TZS 30,000 |
| Pharmacy — Paracetamol 500 mg | ordered → in preparation → dispense blocked | Blocked by 0 stock in dev DB (correct server behavior, not a defect) | — |

The pharmacy dispense dialog explicitly warned *"This exceeds the currently available stock (0 tablet). The server will reject the dispense if stock hasn't changed by submission"* before I even submitted, and the server did reject it (`PATCH .../pharmacy-orders/{id}/status` correctly enforced the stock check). The medication-safety panel (allergy/interaction check) also fired correctly when selecting the drug. Both are good signs — the validation logic itself is sound; this environment simply has no seeded stock for `MED-PARA-500TAB`.

### Investigated and ruled out — Order/status dialogs "rendering off-screen or blank"

An earlier pass flagged the "New Laboratory order" `Sheet` (`resources/js/components/domain/clinical/EncounterOrderSheet.vue`, `resources/js/components/domain/clinical/encounter-orders/EncounterInlineOrderPanel.vue`) as opening fully off-canvas — `transform: translateX(588px)`, stuck at its slide-in start position with the whole panel beyond the right edge of the viewport — and separately flagged status-update dialogs (Collect specimen, Complete result, Record dispense, Complete report, Add diagnosis) as sometimes reusing a stale, blank instance after the first one per page load.

Both are the same frozen-animation-timeline mechanism identified in §1: with `document.visibilityState: "hidden"` in this Browser-pane session, an *enter* animation (`data-[state=open]:animate-in ... slide-in-from-right`) stalls at its starting transform instead of completing to its resting position, and a *closing* instance that never got its `animationend` stays mounted for the next interaction to collide with. A full page reload reliably "fixed" both symptoms in testing because it re-created a fresh timeline — consistent with a frozen-timeline cause, not a Vue state or component-reuse bug.

**Not an app defect.** No code changes made. Order placement itself, once reachable, worked correctly end to end for all three order types (table above) — duplicate checks, medication-safety checks, and status transitions all fired as designed.

### Finding 3 (Medium) — Lab test catalog search returns every result five times over — **Fixed**

Searching the lab-order catalog picker returned 106 buttons where a normal catalog would return far fewer — each test (`LAB-BG-001 — Blood Glucose`, `LAB-CBC-001 — Complete Blood Count`, etc.) appeared exactly 5 times consecutively. The Pharmacy catalog picker (186 distinct items, no dupes) and Imaging catalog picker (1 item) were unaffected under the same combobox component, which initially looked like a join/scope bug specific to the laboratory catalog query.

**Actual root cause, on investigation, was bigger than a query bug**: `EloquentClinicalCatalogItemRepository`'s tenant/facility scoping was gated behind two platform-wide, centrally-managed rollout flags (`platform.multi_facility_scoping`, `platform.multi_tenant_isolation` — a real DB-backed feature-flag system with per-country/tenant/facility overrides, not a forgotten dev toggle) — and both are currently **off**. With scoping off, every catalog query returns rows from every tenant, unfiltered. `platform_clinical_catalog_items` genuinely contains 5 near-identical rows per lab test code — one per seeded tenant (`LAB-BG-001` × 5, distinct `tenant_id`/`facility_id` per row, same `created_at`) — while pharmacy (186 rows, 186 distinct codes) and radiology (1 row) were each only ever seeded for a single tenant, so the same missing-scope gap is invisible there: there's nothing else to leak.

This means the bug wasn't cosmetic duplication — it was a live gap where a lab tech could pick a catalog item ID belonging to a *different* tenant's facility, with that tenant's own pricing/consumption-recipe configuration, not the current facility's.

**Fix, after discussing the tradeoff** (touching the shared scoping flag's effective behavior for one repository vs. leaving a real cross-tenant data gap): `EloquentClinicalCatalogItemRepository` now scopes every catalog query (`search`, `findById`, `update`, `statusCounts`, `searchActiveForSync`) to the current facility/tenant unconditionally, via `PlatformScopeQueryApplier::apply()` directly — no longer gated behind the two flags. Catalog rows carry facility-specific pricing and consumption recipes, so a cross-tenant row is never a valid choice regardless of where those flags are in their rollout elsewhere; `PlatformScopeQueryApplier::apply()` is already a safe no-op when no facility/tenant scope resolves at all (e.g. an unscoped platform-admin request), so this doesn't newly require scope to exist. The now-dead feature-flag gate (`isPlatformScopingEnabled()`) and its unused constructor dependency were removed rather than left in place.

Verified live: `GET .../lab-tests?q=Blood+Glucose` now returns exactly 1 row (was 5), correctly scoped to the current facility; the full lab list returns 22 rows for 22 distinct codes (was 106 for 22 codes); pharmacy (186) and radiology (1) unaffected. Confirmed in the actual order-placement UI too — the lab catalog picker inside "New Laboratory order" now shows each test once.

### Finding 4 (Low) — Worklist status-count tiles lag one refresh behind the row they summarize — **Fixed**

After moving the pharmacy order to "In preparation," the order row correctly updated while the summary tile row above it still read `Pending 1 · In preparation 0` until the next poll cycle.

**Root cause**: a query-key typo in `resources/js/pages/pharmacy-orders/IndexV2.vue`. `usePharmacyOrderStatusCounts()` registers its query under `['sidebar-pharmacy-order-status-counts']`, but the shared `invalidatePharmacyQueries()` helper — called after every status-changing action (Start preparation, Record dispense, Verify, Cancel, etc.) — invalidated `['pharmacy-orders-status-counts']`, a key nothing is registered under. That call was a silent no-op; the tile only ever refreshed on its own 30-second `refetchInterval` poll. Checked Laboratory and Radiology's equivalent composables/pages for the same class of bug — both already use matching keys, so this was isolated to Pharmacy.

**Fix**: corrected the key in `invalidatePharmacyQueries()` to match the composable exactly.

**Verified live**: cancelled a pharmacy order and read the tiles immediately after, with no reload and no wait — `In preparation 0`, `Cancelled 1`, in sync with the row. Confirmed via the network log that a fresh `GET /pharmacy-orders/status-counts` fired right after the action (the invalidation actually working), not a coincidental poll.

---

## 8. Billing capture & 9. Payment / settlement

Once the lab and radiology orders were marked completed, both correctly appeared in the charge-capture-candidates feed (`GET /api/v1/billing-invoices/charge-capture-candidates`) at their real catalog prices:
```json
{"source": "laboratory_order", "service": "Complete Blood Count", "price": 15000, "pricingStatus": "priced"}
{"source": "radiology_order", "service": "Chest X-Ray PA View", "price": 30000, "pricingStatus": "priced"}
```
The eligibility gating in `ListBillingChargeCaptureCandidatesUseCase` is correctly implemented — lab/radiology candidates only surface once `status = completed` (or `resulted_at`/`completed_at` is set), i.e. you bill for work actually performed, not merely ordered. This part of the logic is sound.

### Finding 5 (High) — Nothing in the Billing screen can add a captured charge to an invoice, or take a payment — **Fixed**

The Billing → Cashier Queue view (`/billing-invoices`) lists "Ready to bill (2)" — the CBC and Chest X-Ray, correctly priced — directly alongside the patient's existing draft invoice. But every element on that screen was inert:

- The invoice card had no click handler, dropdown, or expand affordance — confirmed by walking up its DOM ancestors to the tab panel root and finding no clickable element, then dispatching a synthetic click at every ancestor depth with no effect.
- The "Ready to bill" rows were static `<div>`s with no button, checkbox, or "add to invoice" control.
- `/billing-cash` is a structurally separate walk-in cash-account flow (`Pos` module) that does not touch this encounter-linked invoice at all.

**Corroboration**: the encounter's own close-readiness checklist (§10) independently flags exactly this gap — *"Billable services captured — Warning — 2 completed services still need billing capture."* The system detects the problem correctly; there was simply no control anywhere in the reachable UI to resolve it.

**Root cause and fix, part 1 — no capture-to-invoice action.** [billing/Index.vue](resources/js/pages/billing/Index.vue) had a fully-built "Unbilled Services" tab (`pricedCandidates` computed from the already-correct `GET /billing-invoices/charge-capture-candidates` endpoint) with no button on any row. Added an "Add to invoice" action per candidate (`addCandidateToInvoice()`) that appends the candidate's own `suggestedLineItem` to the patient's existing draft invoice via `PATCH /billing-invoices/{id}` (draft line items are still editable server-side), or creates a new draft invoice via `POST /billing-invoices` if none exists yet.

**Root cause and fix, part 2 — payment recording was silently broken too.** Live-testing the fix surfaced that "Record Payment" — which appeared fully implemented (optimistic UI, undo stack, receipt printing) and had been assumed working in the original pass because the test invoice happened to be TZS 0 — actually 422s on every real invoice. Two separate bugs:
  - `recordPayment()`/`recordBulkPayment()` hardcoded `payerType: 'patient'`, but `RecordBillingInvoicePaymentRequest` only accepts `self_pay | insurance | employer | government | donor | other` — every payment attempt failed validation before ever reaching an invoice-state check. Fixed by sending `'self_pay'` (the correct semantic match for a walk-in patient paying out of pocket).
  - Once that was fixed, payment still 422'd with *"Billing invoice payment can only be recorded after the invoice is issued"* — `RecordBillingInvoicePaymentUseCase` requires `status = issued`, but every invoice on this page is created (and stays) in `draft` status, and there was no button anywhere in `billing/Index.vue` to transition one to `issued`, even though the backend endpoint (`PATCH /billing-invoices/{id}/status`, backed by the already-existing `UpdateBillingInvoiceStatusUseCase`) fully supports it. Added an "Issue Invoice" action (`issueInvoice()`) that appears on draft invoices in place of "Record Payment"/the bulk-payment checkbox (both of which would otherwise 422) and calls that endpoint.

**Root cause and fix, part 3 — appending a second charge silently corrupted the invoice total.** A user report caught this after the first pass: adding a *second* candidate to an invoice that already had one (i.e. clicking "Add to invoice" a second time for the same patient, which hits the append/PATCH path rather than create) triggered `Call to undefined method BillingInvoicePayerSummaryResolver::resolve()` — a pre-existing typo in `UpdateBillingInvoiceUseCase.php` and `PreviewBillingInvoiceUseCase.php` (both called `->resolve(...)`, a method that has never existed; `CreateBillingInvoiceUseCase` calls the correctly-named `resolveFromLegacyInvoice()` with identical arguments, confirming the intended method). Fixed both call sites. That fix alone then exposed a second, independent gap: once the crash was gone, the append succeeded but the invoice's `subtotal_amount`/`total_amount`/`balance_amount` silently stayed at the *first* item's price only — `CreateBillingInvoiceUseCase` recomputes manual-mode subtotal from `line_items` via `calculateManualLineItemSubtotal()`, but `UpdateBillingInvoiceUseCase` had no equivalent step, so updating `line_items` alone never touched the totals unless the caller also happened to pass `subtotalAmount` explicitly. Added the same recalculation to `UpdateBillingInvoiceUseCase` for manual-mode line item changes.

**Verified live**: created a temporary patient with two completed, correctly-priced lab orders (`Complete Blood Count`, TZS 15,000 each) → clicked **Add to invoice** on the first (`POST /billing-invoices` → `201`, new draft) → clicked **Add to invoice** on the second (`PATCH /billing-invoices/{id}` → `200`, no crash; invoice correctly shows both line items totaling **TZS 30,000**, not stuck at 15,000) → clicked **Issue Invoice** (`PATCH .../status` → `200`, Draft → Issued) → clicked **Record Payment** for the full TZS 30,000 balance (`POST .../payments` → `201`) → invoice showed `Paid`, `Unpaid: 0`. All test data and throwaway users were deleted afterward.

**Impact of the fix**: every OPD visit with completed lab, imaging, pharmacy, or theatre work can now be taken end-to-end from "priced but uncaptured" to "invoiced, issued, and paid" entirely from the reachable Billing screen — previously impossible at every one of those three steps.

---

## 10. Encounter close

The strongest screen in the workflow. `GetEncounterCloseReadinessUseCase` independently re-verifies every upstream stage and reads like a real chart-closure gate rather than a rubber stamp:

| Check | Result |
|---|---|
| Consultation note signed | Ready |
| Diagnosis documented | Ready |
| Pending clinical orders | Warning — 1 (Paracetamol, stock-blocked) |
| Billable services captured | Warning — 2 (TZS 30,000 + TZS 15,000 uncaptured) |
| Disposition recorded | Required — free-text override reason required to close with any warning present, and rejects generic text like "n/a" |

Closed with disposition **Discharged** and a documented override reason (required specifically because of the two warnings above). Encounter status moved `signed` → `closed` cleanly (`PATCH /api/v1/encounters/{id}/status`, `200`).

### Finding 6 (Low) — Stale "Ready to close" header label after close

The encounter header badge continued to read "Ready to close" for one render after the encounter had already transitioned to `closed`. Cosmetic only; a subsequent read confirmed the correct closed state and readiness copy.

### Finding 7 (Low) — Cashier Queue's "unbilled service" count never decreases once a charge is invoiced

Found incidentally while verifying Finding 5's fix. After successfully invoicing the temporary patient's one completed lab order (moving it out of "Ready to bill" entirely), the Cashier Queue row on the left still read "1 unbilled service" — permanently, since the count can never go down for that source again.

**Root cause**: `ListCashierQueueUseCase::countUnbilledServices()` counts every `laboratory_orders`/`pharmacy_orders`/`radiology_orders`/`theatre_procedures` row in a terminal status (`completed`, `dispensed`, etc.) for the patient, full stop — unlike `ListBillingChargeCaptureCandidatesUseCase` (used by the "Unbilled Services" tab itself), it never excludes sources that already have a `sourceWorkflowId` match on an existing invoice line item. The two use cases answer the same conceptual question ("does this patient have unbilled work?") with different logic, and only one of them is correct.

**Impact**: the queue's per-patient "N unbilled" badge and amber status dot are unreliable indicators once a facility has been billing patients for any length of time — a patient who is actually fully invoiced can still show as having outstanding unbilled services, which could cause a cashier to look for charges that no longer need capturing, or to distrust the badge entirely. Not fixed as part of this pass — flagged for a follow-up querying `countUnbilledServices()` against the same already-invoiced-source index `ListBillingChargeCaptureCandidatesUseCase` builds.

---

## Architecture notes

Surfaced while explaining the findings above against source — not defects on their own, but the reason several of the findings were possible. All four have since been addressed (see below); none required behavior changes to existing consumers.

- **No shared visit-status vocabulary — Fixed.** `AppointmentStatus`, `EncounterStatus`, and each order type's own status enum (`LaboratoryOrderStatus`, `RadiologyOrderStatus`, `PharmacyOrderStatus`, `TheatreProcedureStatus`) evolved independently — five-plus different spellings of "done" (`completed`, `dispensed`, `signed`, `closed`). `GetEncounterCloseReadinessUseCase` hardcoded its own local copy of every order type's terminal statuses to compensate (`LAB_TERMINAL_STATUSES`, `PHARMACY_TERMINAL_STATUSES`, etc.) — its own doc comments flagged this duplication as a drift risk, citing a past incident (C-11).
  **Fix**: added a `terminalValues()` static method to each of the four order-status enums (the real source of truth), then converted `GetEncounterCloseReadinessUseCase`'s four constants into methods that derive from those enums instead of duplicating the values — e.g. `labTerminalStatuses(): array { return LaboratoryOrderStatus::terminalValues(); }`. Pharmacy's method special-cases `'reconciliation_completed'` on top of the enum's real terminal values, with a comment explaining that string is never written to the real `status` column in production (only a test fixture uses it) and is kept solely for that regression test's sake. Updated the 8 call sites in `GetEncounterWorkspaceUseCase` (the only other consumer) to match.
  **Verified**: confirmed all four methods return byte-identical values to the original hardcoded arrays; the pre-existing SQLite/`JSON_MERGE_PATCH` seeder issue (unrelated, hit earlier in this audit) blocks running `EncounterCloseReadinessPharmacyReconciliationTest`/`EncounterCloseAcknowledgementTest`/`EncounterWorkspaceOrderPanelTest` directly — confirmed via `git stash`/re-run that this failure is identical with or without the fix.

- **`EmergencyTriage` is a naming trap — Documentation added; rename scoped out separately.** It is an ED-only module (`EmergencyTriageCaseModel`, its own status enum, own DB table, ~60 backend files) structurally disconnected from the OPD triage step this audit walked through (`PatientVitals` + `RecordAppointmentTriageUseCase` + `triage/Queue.vue`). A prior code comment in `Queue.vue` shows this collision already caused a real bug once (OPD triage's permission check was "reverted to the wrong thing once already" against EmergencyTriage's permission strings).
  **Fix**: added class-level doc comments to `EmergencyTriageCaseModel.php`, `RecordAppointmentTriageUseCase.php`, and the top of `triage/Queue.vue`, each explicitly stating the two systems are unrelated and pointing to the other. A full rename (EmergencyTriage alone touches 60 files/366 occurrences/71 routes/a live DB table) is a separate, larger project — flagged as its own follow-up task rather than attempted here.

- **Billing invoices link to encounters through a nullable, non-cascading FK — Fixed.** The consultation invoice created in the original test run carried `encounter_id: null` despite the encounter already existing at invoice-creation time. Close-readiness happened to still find the invoice via `appointment_id` as a fallback, but the encounter↔invoice linkage wasn't guaranteed by the schema.
  **Root cause**: `AutoCaptureConsultationFeeUseCase` never resolved or passed `encounter_id` when building the invoice payload, even though `CreateBillingInvoiceUseCase` already fully supported it end-to-end.
  **Fix**: injected the existing `EncounterResolverService` (already used elsewhere in the codebase) into `AutoCaptureConsultationFeeUseCase`, calling its existing `findByAppointmentId()` method and adding `encounter_id` to the invoice payload when an encounter is found.
  **Verified live**: created a fresh appointment, resolved its encounter, transitioned to `in_consultation` — the resulting invoice's `encounter_id` correctly matched the real encounter row (previously would have been `null`). Only affects new consultation invoices going forward; no backfill of historical rows was in scope.

- **Two parallel payment systems — Traceability gap closed; full unification remains out of scope.** Encounter-linked `BillingInvoice` records (the path traced in this report) and register-based cash accounts (`/billing-cash`) were bridged only by a one-way `ConvertCashBillingToInvoiceUseCase`, with nothing on the resulting invoice pointing back to its source account. Investigation confirmed `/billing-cash` is explicit legacy — its own controller docblock says future charges should go through "Frontdesk Quick POS" instead — and the conversion endpoint has no UI trigger anywhere in the app (reachable only via direct API call or its one test), so building out further unification would mean investing in a system already being retired.
  **Fix**: added a nullable `source_cash_billing_account_id` FK column to `billing_invoices` (mirroring the existing `encounter_id` column's pattern), populated by `ConvertCashBillingToInvoiceUseCase` whenever it runs. No UI changes — deliberately minimal, just the missing structural link.
  **Verified**: confirmed the field persists correctly end-to-end through `CreateBillingInvoiceUseCase` → repository → model. While verifying the full conversion flow, discovered a separate, pre-existing bug blocking it entirely in this dev environment — a migration that was supposed to allow `cash_billing_accounts.status = 'converted'` is marked as run, but the underlying Postgres CHECK constraint was never actually updated (a Doctrine DBAL limitation with enum→varchar changes on Postgres), so every real conversion attempt 23514-errors regardless of this fix. Flagged as its own follow-up task rather than fixed here, since it's unrelated to the traceability gap this pass targeted.

---

## Appendix — test data left in place

| Entity | Identifier |
|---|---|
| Patient | Amina ZzzVerify, `PT20260718MSOWIH` |
| Appointment | `APT20260718YRTKML` |
| Encounter | `ENC20260718VHEEPW` (status: `closed`) |
| Consultation note | `MR20260718GLDUVQ` (finalized) |
| Invoice | `INV20260718STNFIE` (draft, TZS 0 — Finding 2) |
| Lab order | `LAB202607184PXTKP` — Complete Blood Count (completed, results entered) |
| Radiology order | `RAD20260718GMEFEN` — Chest X-Ray PA View (completed, reported) |
| Pharmacy order | `RX20260718VMJHNK` — Paracetamol 500mg (cancelled during Finding 4 fix verification — was in preparation, dispense blocked by stock) |
