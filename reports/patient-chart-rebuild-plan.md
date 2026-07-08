# Patient Chart — Rebuild Plan (V2)

## Scope assumptions (stated explicitly so they're easy to redirect)

- This plan covers `resources/js/pages/patients/chart/Show.vue` (6,903 lines, route `patients/{id}/chart`) only. It does not touch `medical-records/Index.vue` or the `encounters/*` pages built earlier in this engagement, beyond the one deliberate cross-link fix described in §2.
- Based on the analysis pass already done (see the "Patient Chart modernity assessment" findings): **no backend changes are required**. All 10 endpoints this page calls already support clean `?patientId=` server-side filtering. This plan is a frontend-only rebuild — the opposite situation from the encounters list, which needed a new backend contract from scratch.
- The one real bug found (the `focusedEncounterX` computeds actually filtering by `appointmentId`, not the real `EncounterModel`) is folded into Phase 2, not treated as a separate effort — the analysis confirmed the backend already sends `encounterId` on every order transformer, so this is a frontend-only fix too (add the field to 4 local types, swap 5 filter predicates).
- Like `WorkspaceV2.vue`, this ships as a new, flag-gated page (`patients/{id}/chart/v2`) — the existing `patients/{id}/chart` route and `Show.vue` are completely untouched until there's confidence to cut over. Nothing here is a "redesign the concept" exercise — Patient Chart's actual information architecture (7 tabs, read-only summary-card dashboard, "Open X" links out to full module pages) already matches modern practice and is being preserved, not reimagined.

---

## 1. Why this is a lower-risk rebuild than the note composer was

The note composer rebuild carried real risk because the backend had a genuinely subtle contract (draft-resolution quirks, optimistic locking, the finalize-after-sign→amended override) that a naive rewrite could silently violate. Patient Chart doesn't have that shape:

- It's a **read-only aggregation** page — no writes happen here at all (every action is a link-out to the module that owns that write).
- Every endpoint it calls already exists, is already used correctly by other pages, and already supports the exact filtering this page needs.
- The known bug is narrow and precisely diagnosed (5 computeds, 4 types), not a systemic issue.

The actual risk here is more mundane: 10 domains means 10 places to introduce a silent regression (a dropped filter, a miscounted status, a broken "This visit" toggle) if the port from hand-rolled refs to composables isn't done carefully and checked against real data per domain — same discipline as everywhere else in this engagement, just applied 10 times instead of once.

---

## 2. Target architecture

```
routes/web.php
    GET patients/{id}/chart/v2 → Inertia::render('patients/chart/ShowV2', ['patientId' => $id])
    Config-gated: frontend_rebuild.patient_chart_v2_enabled (mirrors workspace_v2_enabled / encounters_list_enabled)

config/frontend_rebuild.php
    'patient_chart_v2_enabled' => (bool) env('FRONTEND_PATIENT_CHART_V2_ENABLED', false)

resources/js/pages/patients/chart/ShowV2.vue
    Thin page shell: sticky tab bar (reused visual pattern, not rebuilt — it already matches
    modern practice), permission gates, patientId prop → composables below.

resources/js/composables/patientChart/
    usePatientChartOrderStream.ts     — generic factory: one list + one status-counts query,
                                         parameterized by endpoint. Backs lab/pharmacy/radiology/
                                         theatre — these four are structurally identical (list +
                                         counts, patientId-scoped, optional visit-scope filter),
                                         so one factory instead of four near-duplicate files.
    usePatientMedicalRecords.ts       — /medical-records?patientId=
    usePatientAppointments.ts         — /appointments?patientId=
    usePatientBillingInvoices.ts      — /billing-invoices?patientId= (+ status-counts)
    usePatientAllergies.ts            — /patients/{id}/allergies
    usePatientMedicationProfile.ts    — /patients/{id}/medication-profile
    usePatientMedicationReconciliation.ts — /patients/{id}/medication-reconciliation
    useVisitScope.ts                  — the "This visit / Current / All" toggle, fixed to key off
                                         the real encounterId (see Phase 2), shared across the
                                         Visits tab and all 4 Orders sub-tabs since they all use it
                                         identically today.

resources/js/components/patient-chart/
    PatientChartOverviewTab.vue
    PatientChartTimelineTab.vue
    PatientChartVisitsTab.vue
    PatientChartOrdersTab.vue          — hosts its own 4 sub-tabs
        PatientChartLaboratoryPanel.vue / PharmacyPanel.vue / RadiologyPanel.vue / TheatrePanel.vue
    PatientChartMedicationsTab.vue
    PatientChartBillingTab.vue
    PatientChartRecordsTab.vue
```

**Reused as-is, not rebuilt**: the sticky/blurred tab bar with count badges, the stat-tile card layout, the "Open X" link-out pattern, `@/lib/apiClient.ts`, `usePermissions.ts`. The analysis was explicit that the visual shell already matches what WorkspaceV2 established elsewhere — this is a state-management rebuild, not a visual one.

---

## 3. Component/composable decomposition (replacing 10 hand-rolled fetch/ref sets)

Every one of the 11 loading refs + 25 error refs in the old page gets replaced by a TanStack Query call. The 4 order-type sections in particular currently duplicate near-identical fetch/loading/error/status-count logic four times (per the analysis) — collapsing them into one parameterized `usePatientChartOrderStream(endpoint, options)` factory removes that duplication rather than porting it forward as four separate files that would drift from each other over time.

---

## 4. The encounter/appointment bug fix (folded into Phase 2, not separate)

Current (buggy) shape, confirmed in the analysis:
```js
const focusedEncounterLaboratoryOrders = computed(() => {
    const appointmentId = primaryVisit.value?.id;   // primaryVisit is an Appointment, not an Encounter
    if (!appointmentId) return [];
    return laboratoryOrders.value.filter((order) => order.appointmentId === appointmentId);
});
```
Fix: add `encounterId` to the 4 local order types (the backend transformers already send it — confirmed for `LaboratoryOrderResponseTransformer`, same pattern expected for pharmacy/radiology/theatre, to be individually re-verified during Phase 2, not assumed), and change the 5 `focusedEncounterX` computeds to filter by the real encounter (from the actual `EncounterModel`, not `primaryVisit`/Appointment). This also means "This visit" scoping starts working correctly for admission-based encounters (no appointment), which it silently excludes today.

**Open question this raises, not resolved here**: should the UI label stay "This visit" (user-facing continuity) even though the underlying scope changes from appointment to encounter? Leaning toward yes — the fix is about correctness of the data binding, not about renaming a concept users already understand — but flagging it since it's a genuine copy decision.

---

## 5. Feature-parity checklist (the actual "done" bar)

- [x] All 7 top-level tabs (Overview, Timeline, Visits, Medications, Orders, Billing, Records) built and **manually verified in a real browser session against real patient data** — every tab clicked through, not just type-checked/built.
- [x] All 4 Orders sub-tabs (Laboratory, Imaging, Procedures, Pharmacy) built via the shared `PatientChartOrdersDomainSection`/`PatientChartOrderCard` components, including their own status-counts, current-care sorting, and lifecycle actions (cancel/discontinue/entered-in-error via the reused `EncounterLifecycleDialog.vue`). **Manually verified**: scope toggle changes the lists, a lifecycle action (More → Cancel/Entered-in-error) was exercised successfully.
- [x] The "Focused visit / Current care / All visits" scoping toggle is rebuilt on top of `useVisitScope.ts`, now keying "Focused visit" off the real `encounterId`. **Manually verified**: switching the focused visit in the Visits tab correctly changed the Orders tab's "Focused visit" scope. Still **not verified against a real admission-based encounter with no appointment** — Patient Chart still has no "focus an admission" UI, so that path is correctness-safe but unreachable, same limitation as before.
- [x] "Open X" link-outs rebuilt via `patientChartModuleHref` (Timeline/Orders/Medications/Billing) and `patientChartAppointmentAction` (Visits). **Manually verified**: Timeline event action labels correctly prefer the backend's `currentCare.nextAction` label (e.g. "Start preparation", "Schedule imaging", "Collect specimen") over the generic fallback.
- [x] Allergies, medication profile, and medication reconciliation are full read+write via `usePatientAllergyDialog.ts`/`usePatientMedicationProfileDialog.ts`. **Manually verified**: created a new allergy and a new medication-profile entry through the dialogs; both saved and appeared in their lists.
- [x] Permission gates ported 1:1 per tab/section — confirmed during Phase 0/1/2, not assumed.

**One finding from manual verification (fixed, not a code bug)**: a leftover test appointment (`APTV2DEMOZ9QYCB`) had `status = 'in_progress'`, which is not a valid `AppointmentStatus` enum value (`scheduled | waiting_triage | waiting_provider | in_consultation | completed | cancelled | no_show`). This made the Visits tab's primary action button fall back to "Schedule appointment" instead of a workflow action — but this is identical behavior to the old `Show.vue` page with the same data (same status list, same `formatEnumLabel`), not a V2 regression. Fixed by correcting the test fixture's status to `in_consultation`.

**Remaining before cutover**: a decision on when to flip `patient_chart_v2_enabled` to default-true and retire `Show.vue`.

---

## 6. Effort estimate (rough — no team velocity data exists to ground this precisely)

| Phase | Content | Rough effort |
|---|---|---|
| 0. Contract re-verification | Confirm all 10 endpoints' `?patientId=` filtering and the encounterId field on all 4 order transformers, per-domain, against real data — not just trusting the analysis pass | 1–2 days |
| 1. Foundation + Overview/Timeline | Route/config flag, page shell reusing the existing tab visual pattern, `usePatientMedicalRecords`/appointments composables, Overview + Timeline tabs | 3–4 days |
| 2. Visits + Orders (4 sub-tabs) + encounter-bug fix | `usePatientChartOrderStream` factory, `useVisitScope` fixed to encounterId, all 4 order panels, Visits tab | 1–1.5 weeks — the meaningful complexity phase |
| 3. Medications + Billing + Records | Allergies/medication-profile/reconciliation composables, billing composable, records tab (likely thin, reuses medical-records patterns already built) | 3–5 days |

**Total: roughly 3–4 weeks**, meaningfully less than the note-composer rebuild took, consistent with "backend already clean, visual shell already reusable" being the dominant factor.

---

## 7. De-risking strategy

- Flag-gated (`FRONTEND_PATIENT_CHART_V2_ENABLED`), old page completely untouched, same as `WorkspaceV2`/`encounters/List`.
- Live-test each phase against real patient data before moving to the next — this engagement has twice now caught real bugs (the draft-recovery issue in Phase 2 of the note composer, the `MAX(uuid)` Postgres failure in the encounters list) that unit tests alone missed. Ten domains means ten more chances for exactly that kind of gap.
- Phase 2 specifically needs a real admission-based encounter (no appointment) in test data — the whole point of the bug fix is a case the old page can't handle, so verification needs to actually exercise that case, not just the appointment-based case that already "worked."

---

## 8. Open questions requiring a decision before Phase 1 starts

- **"This visit" label vs. underlying encounter-scoping** (§4) — cosmetic continuity vs. correctness-driven rename, needs a call, not an engineering default.
- **Should Patient Chart eventually get a real composed backend endpoint** (one "patient chart bundle" call instead of 10 parallel round-trips, mirroring the encounter workspace bundle pattern)? The analysis explicitly called this a separate, lower-priority question from the frontend rebuild — not blocking, but worth deciding if/when to schedule it.

---

## 9. Phase 0 findings (verified against actual code, not assumed)

1. **`?patientId=`/path-scoping filtering confirmed correct for all 10 endpoints.** Medical records, appointments, and billing invoices filter via a validated `patientId` query param in their use-cases (`ListAppointmentsUseCase.php:46-49`, `ListBillingInvoicesUseCase.php:64-65`, and the medical-records/order use-cases already verified in the earlier analysis). Allergies, medication profile, and medication reconciliation are **path-scoped** (`patients/{id}/allergies` etc., all on `PatientMedicationSafetyController`) — inherently safer than query-string filtering, no way to forget the param. No gaps found.

2. **Real gap found**: `TheatreProcedureResponseTransformer.php` does **not** expose `encounterId`, unlike the Laboratory/Pharmacy/Radiology transformers (all three confirmed to return `'encounterId' => $order['encounter_id'] ?? null`). The `theatre_procedures` table *does* have the column (added by `2026_05_21_000002_add_encounter_id_to_clinical_artifacts.php`, alongside medical_records/laboratory_orders/pharmacy_orders/radiology_orders/billing_invoices) — this is a one-line transformer fix, not a missing-data problem, but it means the encounter-bug fix in Phase 2 needs this small backend change first for the Procedures sub-tab specifically. `BillingInvoiceResponseTransformer.php:17` already exposes `encounterId` correctly, for whenever Billing's own encounter-scoping is worth the same treatment.

3. **Permission model mismatch, worth reusing correctly rather than porting WorkspaceV2's approach.** The old Patient Chart page gates each tab/action with real per-permission checks (`medical.records.read`, `appointments.read/create/update-status`, `laboratory.orders.read/create`, `pharmacy.orders.read/create`, `radiology.orders.read/create`, `theatre.procedures.read/create`, `billing.invoices.read/create`, `patients.update`, plus a few action-specific ones) — via `usePlatformAccess()`'s `hasPermission()`/`isFacilitySuperAdmin`, which reads permissions **synchronously from Inertia's shared page props** (`HandleInertiaRequests.php:54`, populated on every page load — confirmed, not assumed). This is a *different, more efficient* mechanism than `usePermissions.ts` (built for WorkspaceV2), which fetches `/auth/me/permissions` as a separate async TanStack Query call. Since Patient Chart already gets permissions for free on every load, **Patient Chart V2 should reuse `usePlatformAccess()`, not `usePermissions.ts`** — introducing the fetch-based composable here would add an unnecessary network round-trip for data already present. (Whether WorkspaceV2 itself should be switched to the shared-props approach retroactively is a separate, smaller cleanup question, not part of this plan.)
