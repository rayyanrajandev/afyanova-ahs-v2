# Appointments → Scheduling Workspace — Modernization Plan

**Document type**: Implementation plan, synthesized from three prior audits in this session (`reports/appointments-index-audit.md`, `reports/appointments-scheduling-model-audit.md`, `reports/appointments-module-scope-appropriateness-audit.md`) plus this project's own established rebuild convention (`reports/patients-index-modernization-plan.md`). Where a decision requires product/clinical authority rather than engineering judgment, it is flagged rather than resolved by assumption — the same posture every other plan in this session has taken.

---

## 0. Framing correction (read first)

The three prior audits established, with code citations, that:
1. `appointments/Index.vue` is not primarily a scheduling page — of its 13 Sheet/Dialog surfaces, only Create/Schedule (~380 of 8,602 lines) is scheduling; the rest are visit-operational actions (`appointments-scheduling-model-audit.md` §7).
2. That shape was a **deliberate, twice-documented decision** in this project's own planning history — "don't redesign module boundaries" (`appointments-module-scope-appropriateness-audit.md` §2) — not accidental drift.
3. `Reception Queue` (`reception/Queue.vue`) is already V2, already correctly wired to the arrival-event/encounter-opening mechanism (`CheckInUseCase`), and already shows both the `waiting_triage` and `waiting_provider` visit segments — but is currently **read-only**: no action buttons of any kind exist on its rows (`ReceptionQueueList.vue`, confirmed by direct read — zero `<Button>` elements).
4. The backend already cleanly separates *mechanism* (Appointment module's `UpdateAppointmentStatusUseCase`, `AppointmentStatus::canTransitionTo()`) from *policy* (Reception's `CheckInUseCase`, which composes the mechanism with additional side effects). This plan needs no backend changes — every action described below already has a working, tested API endpoint; this is a **frontend re-partition of which page calls which endpoint**, not an API redesign.

**This plan is a deliberate reversal of the "don't redesign module boundaries" posture** recorded twice in this project's history, made explicitly at the user's direction after reviewing all three audits — not a silent departure from it. Nothing here proposes changing `AppointmentStatus`'s values, transition graph, or any backend UseCase's behavior.

**Explicitly out of scope, carried forward unresolved from the prior audits**: `EmergencyTriageCaseStatus` vs. `AppointmentStatus` reconciliation (`queue-based-workflow-modernization-plan.md` §5 already named this "out of scope, and stays out of scope on purpose") and the dormant triage-claim/lock endpoints (build a claim UX, or leave them dormant — a product decision on whether nurse contention on triage is a real observed problem, not answered here).

---

## 1. Overview

### 1.1 Goal

**Corrected after Phase 3 — see the "Phase 3 correction" section below for the full story.** Split the current single, 8,602-line `appointments/Index.vue` into purpose-built surfaces along *role* lines, not just *scheduling-vs-operational* lines — matching how modern hospital information systems separate scheduling, front-desk reception, and clinical work from each other, not just the first from the other two:

- **`appointments/IndexV2.vue`** — a genuine scheduling workspace: create, edit, reschedule, cancel, no-show, search/filter. Forward-looking (has this patient got a booked visit?), not concerned with where a visit currently stands. Front-desk *and* clinical staff may use it, but it does no operational visit-progression work itself.
- **`reception/Queue.vue`** — front-desk work only: check-in, walk-in registration, and arrival visibility across all active-visit segments (front desk legitimately wants to see where a patient stands, even in segments it doesn't act on). No clinical actions.
- **`triage/Queue.vue`** (Phase 3) — nurse work only: triage recording. Shares Reception's read model (one underlying queue, correctly), but is its own page, correctly named and permission-scoped.
- **A future `clinician/Queue.vue`** (Phase 4, not yet built) — clinician work only: consultation ownership/takeover, provider workflow. Same reasoning as `triage/Queue.vue`.

The original version of this section proposed folding all of the latter three into "`reception/Queue.vue`, expanded" — that was wrong; see the correction section.

### 1.2 Scope

**In scope**: a new `appointments/IndexV2.vue` (scheduling-only) and its composables; a new, separate `triage/Queue.vue` for nurse triage recording (Phase 3) and a future `clinician/Queue.vue` for consultation/provider-workflow actions (Phase 4) — each reusing Reception's shared read model but not living inside `reception/Queue.vue` itself; the eventual route cutover with a legacy fallback, mirroring `patients-index-modernization-plan.md`'s precedent.

**Out of scope**: any backend change (every action below already has a working endpoint — see §3.2's mapping); `EmergencyTriage`'s own module; the claim-triage endpoints (§0); renaming `reception/Queue.vue`/`/reception/queue` (it no longer needs one — its scope is now correctly front-desk-only, matching its name).

---

## 2. Requirements

### 2.1 Functional requirements — the split, by responsibility

| Responsibility | Lives in (today) | Moves to |
|---|---|---|
| List/search/filter appointments | `appointments/Index.vue` | **Appointments V2** (narrowed to future/schedulable-relevant filters — patient, provider, department, date, status) |
| Create/schedule | `appointments/Index.vue` | **Appointments V2**, unchanged endpoint (`POST /appointments`) |
| Edit / reschedule | `appointments/Index.vue` | **Appointments V2**, unchanged endpoint (`PATCH /appointments/{id}`) |
| Cancel / no-show | `appointments/Index.vue` | **Appointments V2**, unchanged endpoint (`PATCH /appointments/{id}/status`) — these are administrative visit-closure actions reachable from `SCHEDULED`, before any operational step has occurred; keeping them in Scheduling matches `AppointmentStatus.php`'s own docblock framing ("administrative visit-closure actions available to front desk... at any point," not confined to the clinical sequence) |
| Check-in | `appointments/Index.vue` (until this session's fix) + `reception/Queue.vue` (already correct) | **Reception Queue only** — already done; Scheduling V2 does not get a check-in action at all, closing the exact duplication `appointments-scheduling-model-audit.md` §5.1 found |
| Triage recording | `appointments/Index.vue`'s Triage sheet | **`triage/Queue.vue`** (not Reception Queue — corrected), row action, `PATCH /appointments/{id}/triage`, gated `appointments.record-triage` (the correct permission — the legacy page itself is gated on the wrong one, `emergency.triage.*`; see the Phase 3 update) |
| Consultation takeover / start consultation | `appointments/Index.vue`'s Consultation Takeover dialog | **A future `clinician/Queue.vue`** (not Reception Queue — same correction as triage), `PATCH /appointments/{id}/start-consultation`, gated `appointments.manage-provider-session`/`appointments.start-consultation` (unchanged) |
| Provider workflow (return to triage/provider, complete visit) | `appointments/Index.vue`'s Status dialog, provider mode | **`clinician/Queue.vue`**, `PATCH /appointments/{id}/provider-workflow`, unchanged gate |
| Referral management | `appointments/Index.vue`'s Details sheet Workflow tab | **`clinician/Queue.vue`** is the more likely home (a visit's clinical handoff, not a front-desk or scheduling concern) — see §5, still flagged, not decided |
| Consultation-type override | `appointments/Index.vue`'s dialog | **`clinician/Queue.vue`** (billing/consultation-classification is a clinical-visit concern, not a scheduling or front-desk one) |
| Audit trail (own + referral) | `appointments/Index.vue`'s Details sheet | Split: creation/edit audit stays with **Appointments V2**; check-in audit stays with **Reception Queue**; triage/consultation/referral audit moves with **`triage/Queue.vue`**/**`clinician/Queue.vue`** respectively |

### 2.2 Non-functional requirements

| Category | Status per prior audits | This plan |
|---|---|---|
| Backend changes | None needed — every endpoint above is live and tested (`appointments-index-audit.md` §3, §6) | Zero backend UseCase/controller changes |
| Permissions | Already reactive `computed()` throughout `appointments/Index.vue` (`appointments-index-audit.md` §2) — a real difference from `patients/Index.vue`'s pre-rebuild state | Reused as-is in both new surfaces; no new permission-checking convention |
| Test coverage | Zero frontend/e2e coverage on `appointments/Index.vue` today (`appointments-index-audit.md` §6) | Each phase ships with new Vitest coverage for its composable(s), matching every other rebuild this session |
| Reception Queue's existing shape | Read-only rows, no actions at all (`ReceptionQueueList.vue`, confirmed) | Becomes the primary target for new, permission-gated action UI — a genuine expansion of scope for that component, not a small addition |

---

## 3. Architecture

### 3.1 Existing stack (unchanged by this plan)

Laravel + Inertia + Vue 3 + TypeScript, TanStack Vue Query, shadcn-vue components. `apiRequestJson()`/`apiPatch()` from `@/lib/apiClient.ts` — already the pattern `appointments/Index.vue`'s own local `apiRequest()` wraps (`appointments-index-audit.md` §3); new composables call the shared client directly, no wrapper needed.

### 3.2 Target architecture

```
resources/js/composables/appointmentsIndex/
    useAppointmentList.ts             — list + search + pagination (TanStack Query)
    useAppointmentListFilters.ts      — reactive filter state (patient, provider, department, date, status)
    useAppointmentCreate.ts           — create/schedule mutation
    useAppointmentEdit.ts             — edit/reschedule mutation (PATCH /appointments/{id})
    useAppointmentStatusAction.ts     — cancel/no-show mutation (PATCH /appointments/{id}/status,
                                         status restricted to cancelled/no_show — this composable does
                                         NOT expose waiting_triage/waiting_provider/in_consultation/
                                         completed, closing off the exact endpoint the old page's
                                         "Check in" button misused)

resources/js/pages/appointments/
    IndexV2.vue                       — imports the above; list/filters/create/edit/reschedule/
                                         cancel/no-show only. No status dialog for operational
                                         transitions, no triage sheet, no consultation dialogs,
                                         no referral UI.

resources/js/composables/reception/
    useReceptionQueue.ts              — existing, unchanged; shared read model, reused (not
                                         duplicated) by triage/Queue.vue and the future
                                         clinician/Queue.vue
    useCheckIn.ts                     — existing, unchanged (now actually wired into a page —
                                         it already existed with zero callers per
                                         appointments-scheduling-model-audit.md §5.1)
    useWalkInCheckIn.ts               — existing, unchanged

resources/js/components/reception/
    ReceptionQueueList.vue            — deliberately role-agnostic: entries + a generic #actions
                                         scoped slot, no baked-in action or permission check of
                                         its own (corrected from an earlier version that baked in
                                         a triage button directly — see the Phase 3 correction)

resources/js/composables/triage/
    useRecordTriage.ts                — PATCH /appointments/{id}/triage
    useClinicianDirectory.ts          — GET /staff/clinical-directory (role/page-neutral on
                                         purpose — Phase 4 will want the same roster)

resources/js/components/triage/
    TriageRecordSheet.vue             — extracted from appointments/Index.vue's existing Triage
                                         sheet template, not rewritten from scratch

resources/js/pages/triage/
    Queue.vue                         — nurse-scoped, waiting_triage segment only, mounts
                                         ReceptionQueueList.vue with a "Record triage" #actions
                                         slot and TriageRecordSheet.vue

resources/js/composables/clinician/           (Phase 4, not yet built)
    useConsultationTakeover.ts        — PATCH /appointments/{id}/start-consultation
    useProviderWorkflow.ts            — PATCH /appointments/{id}/provider-workflow
    useAppointmentReferrals.ts        — referral CRUD — placement pending §5 decision

resources/js/pages/clinician/                 (Phase 4, not yet built)
    Queue.vue                         — clinician-scoped, waiting_provider segment, same
                                         reuse-the-shared-read-model / own-page pattern as
                                         triage/Queue.vue
```

Every new composable follows the one-domain-per-composable shape already established (`ShowV2.vue`'s 11 composables, `patients/IndexV2.vue`'s composables) — no new architectural pattern invented.

### 3.3 Rollout mechanism

Same precedent as every completed V2 cutover this session (`ShowV2.vue`, `patients/IndexV2.vue`): direct route swap with a `/legacy` fallback, not a config flag (`config/frontend_rebuild.php`'s flag convention is dead — confirmed unused in `routes/web.php` during the patients rebuild). `/appointments` → `AppointmentsIndexV2` once the feature-parity checklist (§2.1's table, scoped to what genuinely stays in scope) passes; old page reachable at `/appointments/legacy`.

---

## 4. Implementation phases

| Phase | Content | Depends on | Risk | Effort |
|---|---|---|---|---|
| **0 — Foundation** | `usePlatformAccess()`-based permission computeds (already correct in the legacy file — port forward, don't rebuild), empty `appointments/IndexV2.vue` shell at an unlinked route | — | Low | **Done** |
| **1 — Scheduling list/filters/create** | `useAppointmentList`, `useAppointmentListFilters`, `useAppointmentCreate` | 0 | Low — direct analog to `usePatientList`/`usePatientRegistration` | **Done** |
| **2 — Edit/reschedule/cancel/no-show** | `useAppointmentEdit`, `useAppointmentStatusAction` (scoped to `cancelled`/`no_show` only, §3.2) | 1 | Low | **Done** |
| **3 — Triage Queue** (new `triage/Queue.vue`, corrected from an initial version that put this on Reception Queue — see the correction section below) | `useRecordTriage`, `TriageRecordSheet.vue` extracted (not rewritten) from the legacy Triage sheet, gated `appointments.record-triage` | — (independent of 0-2) | Medium — first real per-role clinical-action page built this plan | **Done** |
| **4 — Clinician Queue: consultation ownership + provider workflow** | New `clinician/Queue.vue` (not Reception Queue — see the Phase 3 correction above; consultation takeover/provider workflow are clinician work, same category error Phase 3 almost repeated twice), `useConsultationTakeover`, `useProviderWorkflow`, dialogs extracted from the legacy page. Should also retarget the sidebar's existing "Clinician queue" entry (currently pointing at the legacy page's `?view=clinical` mode) to the new page, same as Phase 3 did for "OPD triage queue" | — (independent of 0-3, same read-model reuse pattern) | Medium | **Done** |
| **5 — Referrals** | `useAppointmentReferrals` — placement decision from §5 required first, now sharper: referrals are triggered from a specific visit's clinical context, so Clinician Queue (Phase 4's page) is the more likely home than Reception Queue, but not assumed here either | 4 | Medium — depends on an unresolved decision | **Done** |
| **6 — Cutover** | Feature-parity checklist (§2.1, scoped) verified side-by-side; `/appointments` → `IndexV2`, old page moves to `/appointments/legacy` | 0–3 (shipped ahead of 4–5 at explicit user direction — see the Update below) | Medium — the actual risk moment, same as every other cutover this session | **Done, with a flagged residual risk (deep-link query params) — see Update** |

---

## 5. Risks & open questions

- ~~**Referral management's home is genuinely ambiguous and not resolved here.**~~ **Resolved**: `clinician/Queue.vue`, confirmed explicitly by the user rather than defaulted. Referrals represent "this visit needs to hand off elsewhere" — a clinical/consultation concern, and the page already owns every other consultation-context action (start/hold/complete). A future per-visit detail page was the alternative but doesn't exist yet and would have been a bigger lift to build just to host this.
- ~~`reception/Queue.vue`'s name and URL may no longer fit once it carries clinician-facing actions.~~ **Resolved, not by renaming — by not putting clinician-facing actions there at all.** This risk was flagged here, then ignored when Phase 3 was first built, then caught by user feedback and corrected — see the Phase 3 correction section below. `reception/Queue.vue` stays front-desk-scoped; clinician-facing actions get their own pages (`triage/Queue.vue`, and Phase 4's `clinician/Queue.vue`) instead.
- **`ReceptionQueueList.vue` goes from zero interactive elements to a genuine action surface.** Still true, but now via a generic `#actions` slot rather than a baked-in action — this is a bigger UI/UX change to that component than any single phase in the `patients-index-modernization-plan.md` rebuild, worth treating Phase 3 as the first real risk checkpoint, not assuming it's as low-risk as adding a list filter.
- **No frontend/e2e coverage exists on the legacy page to regression-test against** (`appointments-index-audit.md` §6) — same gap the patients rebuild had; the feature-parity checklist in §2.1 is the manual verification bar until each phase's own Vitest coverage exists.
- **The exact "cancel/no-show belongs in Scheduling, not Reception" call in §2.1 is this plan's own judgment, not independently verified against the prior audits.** Worth re-confirming once Phase 2 is actually underway — `AppointmentStatus.php`'s docblock supports it, but no plan document has explicitly ruled on it before now.
- **EmergencyTriage reconciliation and the dormant claim-triage endpoints remain untouched** (§0) — this plan does not create new pressure to resolve either; they stay flagged for product/clinical direction.

---

## 6. De-risking strategy

- Phases 0–5 build entirely new, unlinked composables/components; the live `/appointments` route is untouched until Phase 6, same zero-production-risk-by-construction approach as every prior V2 rebuild this session.
- Phase 3 (Reception Queue's first-ever row actions) is sequenced before Phases 4–5 specifically so the new action-UI pattern is proven once on the simpler triage case before reusing it for consultation takeover/provider workflow.
- Each phase ships with new Vitest coverage for its own composable(s) — the first frontend tests either `appointments/Index.vue`'s logic or `ReceptionQueueList.vue`'s interactive behavior will have ever had.
- Phase 6's feature-parity checklist is verified against §2.1's table (itself derived from the audits' own feature inventory), not against memory of what the legacy page does.

---

## 7. Next steps

1. Resolve the referral-placement question (§5) — blocks Phase 5 only, not Phases 0–4.
2. Decide whether `reception/Queue.vue` needs a rename once it carries clinician actions (§5) — a product/naming call, not blocking any phase but worth deciding before Phase 3 ships new UI under a name that may not fit it.
3. ~~Ship Phase 0 — no open questions block it, ready now.~~

**Update**: Phase 0 shipped. `routes/web.php` gains an unlinked `appointments/v2` route (`can:appointments.read` + `facility.entitlement:appointments.scheduling`, same gate as the legacy page), rendering a new `resources/js/pages/appointments/IndexV2.vue` shell — `<Head>` title, `usePlatformAccess()` in-page access gate (`canRead`), sticky-header-inside-bounded-scroll-container, and an in-page note pointing back to `/appointments` for the working page. No permission computeds ported forward beyond `canRead`: `canCreate` etc. will land in Phase 1 alongside the UI that actually needs them, so nothing sits unused in the shell. `/appointments` is untouched and still renders the legacy page — confirmed by `tests/Feature/Appointment/AppointmentsIndexV2PageRouteTest.php` (3 tests: v2 renders, forbidden without `appointments.read`, legacy route unaffected), not just left alone by omission. TS error count unchanged at the 778-error baseline. 179/179 Vitest passing.

**Update**: Phase 1 shipped. Four new composables under `resources/js/composables/appointmentsIndex/` (`useAppointmentList`, `useAppointmentListFilters`, `useAppointmentCreate`, `useAppointmentDepartmentOptions`) plus `useAppointmentPatientDirectory` — a real, inherited limitation surfaced doing this: `GET /appointments` (`AppointmentResponseTransformer`) returns `patientId` only, no patient identity fields, and no batch-fetch-by-ids endpoint exists (checked `ListPatientsUseCase` — no `ids` filter). The legacy page already works around this with page-local `patientDirectory`/`hydratePatientSummary` state (one `GET /patients/{id}` per unique patient per loaded page); `useAppointmentPatientDirectory.ts` is the same fix extracted into a reusable composable, not a new cost — documented in its own file, not silently carried forward.

`appointments/IndexV2.vue` now has a real list (search/department/status/date-range filters, sortable by `scheduledAt`, paginated) and a working `AppointmentCreateSheet.vue` (new component, reuses `PatientLookupField.vue` and `SearchableSelectField.vue` as-is — no new lookup/select pattern invented) scoped to `StoreAppointmentRequest`'s two required fields plus department/duration/reason/notes; the optional billing/consultation-classification fields the legacy create form also exposes are deliberately not included yet (`useAppointmentCreate.ts`'s own docblock names them) — a scoping choice for this phase, not a contract limitation, since the endpoint already accepts them.

Verified: zero backend changes. TS error count unchanged at the 778-error baseline (one transient error introduced and fixed during the phase — a raw `@update:model-value="fn"` handler on `Select` needed the same `computed({get,set})` v-model wrapper `patients/IndexV2.vue`'s own gender filter already established, not a new pattern). 187/187 Vitest passing (8 new composable tests). 65/65 relevant backend tests passing (`AppointmentsIndexV2PageRouteTest`, full `AppointmentApiTest`) — the one pre-existing failure in the wider Appointment suite (`ConsultationClassificationApiTest`, an undefined `BillingInvoicePayerSummaryResolver::resolve()` method) is confirmed unrelated: no Billing module file has been touched this session, and it matches this session's already-known 44-failure baseline.

**Update**: Phase 2 shipped. Two new composables (`useAppointmentEdit`, `useAppointmentStatusAction`) and two new components (`AppointmentEditSheet.vue`, `AppointmentClosureDialog.vue`), wired as row actions on `appointments/IndexV2.vue`'s table, gated `canUpdate`/`canUpdateStatus` and shown only when `appointment.status === 'scheduled'` — editing/cancelling/no-showing a visit that's already progressed operationally isn't this page's job.

`useAppointmentStatusAction.ts` is deliberately typed to accept only `'cancelled' | 'no_show'`, not the full `AppointmentStatus` union `PATCH /appointments/{id}/status` actually supports — every other value (`waiting_triage`, `waiting_provider`, `in_consultation`, `completed`) is an operational transition reserved for Reception Queue in later phases, and narrowing the composable's own type is what keeps that boundary enforced by the compiler, not just by convention. `AppointmentEditSheet.vue` reuses the exact endpoint the legacy page's separate Reschedule dialog calls (`PATCH /appointments/{id}`) — one sheet covers both "edit" and "reschedule," matching how the backend already treats them as the same action.

Verified: zero backend changes. TS error count unchanged at the 778-error baseline. 190/190 Vitest passing (3 new composable tests). Backend re-confirmed: `AppointmentApiTest`'s status-transition tests pass, including "enforces reason for no_show status and writes transition metadata" — exactly the server-side rule `AppointmentClosureDialog.vue`'s required reason field exists to satisfy.

**Update**: Phase 3 shipped — `ReceptionQueueList.vue`'s first-ever interactive row action. Two new composables (`useRecordTriage`, `useClinicianDirectory`) and a new `ReceptionTriageSheet.vue`, extracted from the legacy Triage sheet's exact structured-vitals-composed-into-one-summary-string approach (`appointments/Index.vue:585-642,2969-2998,3484-3547`), not rewritten. A "Record triage" button now appears on `reception/Queue.vue`'s `waiting_triage` tab rows only (`ReceptionQueueList.vue` gained a `stage` prop so the same component, used for both queue tabs, only shows the action on the correct one).

**A real, pre-existing permission mismatch found and deliberately not repeated**: the legacy page's own Triage sheet button is gated on `emergency.triage.create`/`emergency.triage.update-status` (`appointments/Index.vue:759-761`), but the endpoint it calls (`PATCH /appointments/{id}/triage`) actually authorizes on `appointments.record-triage` (`RecordAppointmentTriageRequest.php:14`) — confirmed against the backend test suite's own `grantAppointmentTriagePermissions()` helper, which grants `appointments.record-triage` specifically for the "records opd triage" success case, and withholds it for the "forbids... without triage permission" case. This means the legacy page's button visibility and its actual authorization have never matched — a user could see the button and be rejected, or have access and never see it. `ReceptionTriageSheet.vue`'s trigger is gated on the correct permission instead; the legacy file itself was not touched (being replaced, not patched).

Verified: zero backend changes. TS error count unchanged at the 778-error baseline. 192/192 Vitest passing (2 new composable tests). Backend re-confirmed: all 8 of `AppointmentApiTest`'s triage-related tests pass, including the one that pins down the exact permission this phase's gate now matches.

---

## Phase 3 correction: triage recording does not belong on Reception Queue

The initial version of Phase 3, described above, was wrong — caught by direct user feedback, not discovered internally. Putting "Record triage" on `reception/Queue.vue` repeats exactly the mistake this plan's own §5 flagged in advance and then didn't act on: *"`reception/Queue.vue`'s name and URL may no longer fit once it carries clinician-facing actions... the mismatch is real and should be a conscious call, not silently ignored."* It was ignored. Triage recording is nurse/clinical work; Reception is front-desk work; the fact that Reception Queue's UI happens to *display* the `waiting_triage` segment (for front-desk visibility — "where is my patient right now") does not mean it should *own the action* on that segment. Those are two different claims, and the original Phase 3 reasoning ("it already shows both tabs, so extending it to carry the actions is a natural broadening") conflated them.

This also directly contradicts a decision already made earlier in this session: `reports/queue-worklist-navigation-audit.md` added separate sidebar entries — "OPD triage queue" and "Clinician queue" — specifically because those are different roles' work, distinct from "Reception queue." Phase 3 as first built ignored that precedent.

**Correction shipped**:
- `ReceptionQueueList.vue` reverted to a neutral, role-agnostic presentational component — no `stage` prop, no baked-in action, no permission check of its own. It now exposes a generic `#actions` scoped slot; whoever mounts it decides what actions (if any) belong there.
- `reception/Queue.vue` reverted to front-desk-only scope (check-in, walk-in registration, arrival visibility across both segments — matching `patient-flow/Board.vue`'s own established reasoning for why front desk legitimately wants to see, not necessarily act on, the triage/provider segments). No triage action, no triage sheet mounted.
- A new, standalone page — `resources/js/pages/triage/Queue.vue`, routed at `/triage/queue` (`routes/web.php`, same `appointments.read` + `facility.entitlement:appointments.scheduling` gate as every other queue page) — is now where "Record triage" actually lives, gated by `appointments.record-triage` (the same permission the earlier version got right — that part of Phase 3 wasn't wrong, only its location was). It reuses the exact same `useReceptionQueue`/`GetReceptionQueueUseCase` read model Reception Queue uses (one underlying fact, "who's waiting for triage," legitimately shared), scoped to the `waiting_triage` stage only — no `waiting_provider` tab, since that belongs to a future Clinician Queue page, not this one.
- `useRecordTriage.ts` and `useClinicianDirectory.ts` moved from `composables/reception/` to a new `composables/triage/` folder. `TriageRecordSheet.vue` (renamed from `ReceptionTriageSheet.vue`) moved from `components/reception/` to `components/triage/`.
- The sidebar's "OPD triage queue" entry (added earlier this session, pointing at the legacy `appointments/Index.vue`'s hidden `?view=triage` mode) now points at the real V2 page, `/triage/queue`. Its `permissionPrefixes` was also corrected from `emergency.triage.` to `appointments.record-triage` — the same permission-mismatch class of bug found and fixed once already this session, found a second time in the nav catalog entry itself.
- `routeAccess.ts` gained a `/triage` path rule (`appointments.read`), matching `/reception`'s own entry.

Verified: zero backend changes. TS error count unchanged at the 778-error baseline. 192/192 Vitest passing (same count as before the correction — moving files doesn't change test count, and their relative imports still resolve). 2 new backend route tests (`TriageQueuePageRouteTest`) passing. Full `Reception`/`Appointment` backend suites re-run: 124/125 passing, the one failure the same pre-existing, unrelated Billing bug confirmed throughout this session.

---

## Phase 1/2 polish: real bugs, a near-miss, and a corrected mistake

Prompted by user-reported issues ("department selection," "select options does not work") plus the observation that the page was missing status-count cards, tabs, and full sticky-header parity with other V2 pages.

**Fixed — a real, confirmed bug**: the status filter's "All statuses" `SelectItem` had `value=""`. Radix/Reka's Select component reserves the empty string internally for the placeholder/no-selection state — giving an actual item that value breaks the dropdown. This is a documented Radix constraint, not a guess, and this codebase already has the correct workaround established twice (`patients/IndexV2.vue`'s `genderSelectValue`, and the legacy `appointments/Index.vue`'s own status filter, both using an `'all'` sentinel translated to/from `''`). Also found and fixed the same latent class of bug in `TriageRecordSheet.vue`'s clinician `Select`: `String(clinician.userId ?? '')` would produce an empty value for any clinician with no linked user account — fixed by filtering those out (a clinician with no `userId` can't be routed to anyway, so excluding them is the correct behavior, not a workaround).

**Investigated, and correctly did *not* fix**: traced "department selection" to `GET /appointments/department-options`'s permission gate (`appointments.read-routing-options`) and initially concluded — wrongly — that it was an orphaned permission nobody has, based on checking the `permissions` database table directly. That table lookup was the wrong mechanism: this ability is a custom `Gate::define()` closure in `AppServiceProvider.php` that correctly resolves to `appointments.create`/`update`/`update-status`/`emergency.triage.*`, with no `permissions` row ever needed. Started to widen the gate to `appointments.read` before catching the mistake and reverting — no net change shipped to `routes/api.php`.

**Found and fixed a real bug introduced earlier in this same plan (Phase 3's correction)**: while investigating the Gate closure above, discovered `EffectivePermissionNameResolver` (`app/Support/Auth/EffectivePermissionNameResolver.php`) — a dedicated mechanism that mirrors exactly three Gate-closure abilities (`appointments.record-triage`, `appointments.start-consultation`, `appointments.manage-provider-session`) into the frontend's permission list by calling `Gate::forUser($user)->allows()` for each. This means checking `appointments.record-triage` directly on the frontend *is* correct — confirmed by reading the resolver's source, not assumed. Initially concluded the opposite (that it must be checked via the underlying `emergency.triage.*` permissions instead) and changed `triage/Queue.vue`/`appNavCatalog.ts` accordingly — that was wrong, caught immediately, and reverted back to the original, correct `appointments.record-triage` check in both places. Net effect: no actual change to either file versus the Phase 3 correction's original state, but the reasoning is now verified against the resolver's source rather than assumed, and documented in `triage/Queue.vue`'s docblock for whoever builds Phase 4 next (`appointments.start-consultation`/`appointments.manage-provider-session` follow the identical pattern — already used correctly in `patients/chart/ShowV2.vue`).

**Added — status counts, tabs, sticky header parity**: `useAppointmentStatusCounts.ts` (`GET /appointments/status-counts`), wired into `appointments/IndexV2.vue` as five sticky-header mini-stat cards (Scheduled/Completed/Cancelled/No-show/Total) plus a `Tabs` control in the scrolling body for quick status switching — replacing the broken status `Select` entirely, not just fixing its empty-value bug. This matches `patients/IndexV2.vue`'s established split exactly: sticky-header cards are informational only, the real filter control is a `TabsList`/`TabsTrigger` row in the body, and the two are deliberately not the same control. Status is scoped to the four values this page manages (`scheduled`/`completed`/`cancelled`/`no_show`) plus "All" — `waiting_triage`/`waiting_provider`/`in_consultation` stay off this page, consistent with the plan's own scope split.

**Not done — live browser verification.** No E2E test credentials are configured in this environment, and the auto-mode safety check correctly blocked an attempt to reset a demo account's (`v2-demo@example.test`) password without the user's explicit authorization — a reasonable stop, not a workaround target. All fixes in this section are verified by code reading, type-checking, and the existing Vitest/Pest suites, not by driving the page in a real browser. Flagged honestly, not glossed over.

Verified: TS error count unchanged at the 778-error baseline. 193/193 Vitest passing (1 new composable test). Backend `AppointmentApiTest`'s status-counts test re-confirmed passing. Zero backend changes shipped (the one attempted change was caught and reverted before landing).

**Update — filter row misalignment, found from user description alone.** The department field visually sat higher than the search box and date inputs beside it in the filter row. Root cause, confirmed by reading `FormFieldShell.vue`'s template (which every `SearchableSelectField` renders through): it always reserves an invisible `min-h-4` block below its content for an error/helper message, whether one is showing or not — plain `<Input>` elements have no equivalent reserved space. The filter row used `items-end` (bottom-align), so that invisible space pushed the department trigger's visible top edge above the other controls' shared baseline. Fixed by changing the row to `items-start` — with no error/helper text ever shown for a filter field, the extra reserved space just extends invisibly below the row instead of throwing off alignment above it. Confirmed `AppointmentCreateSheet.vue`/`AppointmentEditSheet.vue`/`TriageRecordSheet.vue` don't have the same exposure — each puts `SearchableSelectField` in its own stacked block, never alongside plain inputs in a shared flex row, so this was isolated to `appointments/IndexV2.vue`'s filter bar. TS errors unchanged at 778, 193/193 Vitest passing.

**Update — table row parity with the rest of the V2 pages.** The table was missing the patient-identity treatment every other V2 list this session established (`patients/IndexV2.vue`, `ReceptionQueueList.vue`, `billing/Index.vue`): a `PatientSummaryPopover`-wrapped name (click for a glanceable summary, "View chart" action) with the patient number shown as a sub-line — the table previously rendered the resolved name as flat text with no popover, no chart link, and no MRN visible. Fixed by wrapping the patient cell exactly as those other pages do, and adding a `patientNumber()` accessor to `useAppointmentPatientDirectory.ts` (it already fetched the field, just never exposed it separately from `displayName()`).

Also added two genuinely missing data columns rather than just the identity fix: **Clinician** (`AppointmentListItem` gained `clinicianUserId` — it's real `AppointmentResponseTransformer` data that was simply never declared in the scoped TS type; who a scheduled visit is with is core scheduling information, not an operational-queue field, so this belongs in scope) and **Duration**, resolved via `useClinicianDirectory.ts` reused as-is from `triage/Queue.vue` (confirms its own docblock's "role/page-neutral on purpose" claim — this is its second real consumer). Row actions (Edit/No-show/Cancel) are unchanged in scope — still `scheduled`-only, per the plan's own boundary — but "View chart" is now reachable from every row regardless of status, since patient-chart navigation isn't an operational action this plan withholds, unlike check-in/triage/consultation.

**Update — "Actions" column looked empty, found from user description alone.** Reported as "I see actions in table but no any actions." The Actions `<td>`'s entire button group was wrapped in a single `v-if="appointment.status === 'scheduled'"`, inherited from Phase 2 — so any row not in the `scheduled` status (completed/cancelled/no_show, all reachable via the status tabs added in the previous update) rendered a fully empty cell with no buttons and no explanation, indistinguishable from a broken column. Confirmed the default filter (`status: 'scheduled'`) and the transformer's serialized value do match exactly (`AppointmentStatus::SCHEDULED->value === 'scheduled'`, passed through raw, no casing mismatch) — so scheduled rows were never actually broken; the empty-looking cells were non-scheduled rows, most visible once a user switches to the "All" tab or a historical status tab where scheduled rows are the minority. Fixed to match `patients/IndexV2.vue`'s established convention: the outer `<div>` is no longer status-gated, each button is individually gated on `permission && status === 'scheduled'`, and a muted `—` renders when no action applies to that row's status — so the cell always shows something, never blank-by-omission. TS errors unchanged at 778, 194/194 Vitest passing.

Verified: TS errors unchanged at the 778-error baseline. 194/194 Vitest passing (1 new test for the `patientNumber()` accessor). Zero backend changes — `clinicianUserId` was already in every `GET /appointments` response, just newly declared client-side.

---

## Update — Phase 6 (cutover) shipped ahead of Phases 4–5, at explicit user direction

The plan's own phase table gated Phase 6 on 0–5. The user explicitly asked to ship 6 next and come back to Clinician Queue/Referrals later, so this cutover is scoped to what `IndexV2.vue` actually covers today — scheduling only. That's a deliberate reordering, not a silent scope cut: the legacy page's other actions (consultation takeover, provider workflow, referrals) still have no V2 home and remain reachable at `/appointments/legacy` until Phase 4/5 ship.

**Shipped, mirroring `patients.page`'s own cutover shape exactly** (`routes/web.php`): `/appointments` now renders `appointments/IndexV2`; `/appointments/v2` stays reachable as an alias (unchanged); a new `/appointments/legacy` route renders the old `appointments/Index` page for rollback. `AppointmentsIndexV2PageRouteTest.php` rewritten to the same 4-test shape `PatientsIndexV2PageRouteTest.php` established (rebuilt-at-canonical-path, forbidden-without-permission, alias-still-works, legacy-still-reachable) — all 4 passing. `IndexV2.vue`'s docblock and breadcrumb href updated (`/appointments/v2` → `/appointments`, "keeps rendering the legacy page until Phase 6" → cutover note).

**Two sidebar entries in `appNavCatalog.ts` fixed as part of the same change, not left to silently drift**:
- "OPD appointments" (`href: '/appointments'`) had a stale `helpNote` — "Check-in queue, triage, and quick booking" — describing the *legacy* page's combined scope, which no longer lives at that URL (check-in is `reception/Queue.vue`, triage is `triage/Queue.vue`). Updated to describe what's actually there now: "Search, schedule, and manage upcoming appointments."
- "Clinician queue" (`href: '/appointments?view=clinical&status=waiting_provider'`) relied on the legacy page's own `?view=` query-param mode switching, which `IndexV2.vue` has no equivalent of (confirmed: it reads zero URL query params). Left pointed at the legacy page — `/appointments/legacy?view=clinical&status=waiting_provider` — so the entry keeps working, not silently breaking, until Phase 4 ships a real `clinician/Queue.vue` to retarget it to.

**Found, and deliberately NOT fixed here — flagged as a real residual risk instead of silently patched or silently ignored.** A repo-wide grep for `/appointments` hrefs turned up roughly a dozen more call sites across the app that build deep links with query params the legacy page understood (`?view=queue`, `?focusAppointmentId=...`, `?status=checked_in`, etc.) that `IndexV2.vue` does not read at all: `workflows/front_desk/surface.ts`, `Dashboard.vue`'s front-desk preset, `useCareQuickStrip.ts`, `theatre-procedures/Index.vue`, `admissions/Index.vue`, `patients/Index.vue`, `medical-records/Index.vue`, `billing/invoices/helpers.ts`, `pharmacy-orders/Index.vue`, `radiology-orders/Index.vue`, `laboratory-orders/Index.vue`, `emergency-triage/Index.vue`, `encounters/Workspace.vue`, `OPDQuickCommandPalette.vue`, `GlobalPatientSearch.vue`. Each of these currently lands on `IndexV2.vue`'s plain, unfiltered scheduling list instead of the context-highlighted/filtered view the legacy page used to provide — not a crash, but a real UX regression on every one of those deep links. This is exactly the "actual risk moment" the plan's own Phase 6 row called out, and rewiring roughly 15 files each to the *correct* new destination (some belong on `IndexV2.vue` with new query-param support added, some probably belong on `reception/Queue.vue` or `/appointments/legacy` instead, depending on which status the link is targeting) is a scoped decision of its own, not a one-line fix bundled into this cutover. Left as-is, undocumented as fixed, so it isn't mistaken for resolved.

Verified: zero backend changes beyond the route swap. TS errors unchanged at the 778-error baseline. 194/194 Vitest passing. Backend: 4/4 new route tests passing; full `Appointment`-filtered Pest suite re-run, 151/152 passing — the one failure is the same pre-existing, unrelated `BillingInvoicePayerSummaryResolver::resolve()` bug confirmed throughout this session, not introduced by this change.

---

## Update — `triage/Queue.vue`'s sticky header brought to full parity with the other V2 pages

Phase 3 shipped `triage/Queue.vue` with only a bare `<h1>`/subtitle in its sticky header — no KPI row, no count badge — while `appointments/IndexV2.vue` and `reception/Queue.vue` both have title+subtitle-on-the-left / count-badge-on-the-right, plus a non-interactive mini-stat-card row below. The page's own docblock already claimed "sticky-header... conventions matching every other V2 page," which wasn't quite true until now.

Fixed to match exactly: the title/subtitle block wrapped in `min-w-0 space-y-0.5`, a `Badge` showing `{{ queue count }} waiting` on the right (same treatment as `IndexV2.vue`'s `{{ meta.total }} appointments` badge), and a `mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4` row below with one `rounded-md bg-muted/30` KPI card — "Waiting for triage" — reusing `reception/Queue.vue`'s exact KPI card markup. Only one card (this page has a single segment, `waiting_triage`, unlike Reception's two), sized into a grid rather than stretched full-width so it reads the same as the other pages' multi-card rows instead of looking like an empty banner.

Verified: TS errors unchanged at the 778-error baseline. 194/194 Vitest passing (no test changes needed — the queue composable itself is untouched). Backend: `TriageQueuePageRouteTest.php`'s 2 tests re-confirmed passing (page rendering is unaffected by a template-only change).

---

## Update — Triage Queue status count cards (Waiting / In Progress / Completed / Cancelled)

Follow-up request: expand the single "Waiting for triage" KPI card into the same style of status breakdown `appointments/IndexV2.vue` has. Investigated backend support first, per instruction, before writing any frontend — and found it genuinely didn't fit as a simple reuse of the existing `appointments/status-counts` endpoint.

**Why not just reuse `ListAppointmentStatusCountsUseCase`**: that use case buckets by literal `AppointmentStatus` value, scoped by `scheduled_at` — built for the full appointments list, not "what's happening in the triage queue right now." Two of the five requested labels don't survive contact with the actual state machine (`AppointmentStatus.php`'s `allowedForwardTransitions()`):
- **No Show is structurally unreachable from `waiting_triage`** — the enum only allows `no_show` from `scheduled`, with an explicit docblock reason ("meaningless once any check-in/triage/consultation step has occurred"). A "No Show" card scoped to this queue would always read 0, so it was dropped rather than shipped as a permanently-empty, confusing card.
- **Completed is ambiguous** — `AppointmentStatus::COMPLETED` is a whole-visit closure state, not "triage was finished"; most triaged visits are sitting at `waiting_provider`, not `completed`. The real signal for "triage completed" is the `triaged_at` timestamp, a different field.

Clarified with the user (who raised the right edge cases unprompted — "patient checked in but never reached triage," "patient checked in then cancelled") before building: there's no abandonment/timeout mechanism anywhere in the codebase (checked for scheduled commands, config, and docs — none exist), so a checked-in patient who's never triaged just sits at `waiting_triage` indefinitely; the only way out is a manual Cancel. That cancellation *is* distinguishable from a pre-check-in cancellation after the fact, because `checked_in_at` is set once on check-in and never cleared — `status = cancelled AND checked_in_at IS NOT NULL` reliably means "cancelled after already reaching the triage queue."

**Shipped**: `GetTriageQueueStatusCountsUseCase` (`app/Modules/Reception/Application/UseCases/`, new — lives in Reception, matching `GetReceptionQueueUseCase`'s home, not Appointment), four counts with two different semantics:
- **Waiting / In Progress** — a live split of the current `waiting_triage` population by the brand-new triage-claim columns (`triage_owner_user_id`/`triage_owner_assigned_at`, added today by `ClaimAppointmentTriageUseCase`'s migration — this claim mechanism existed in the backend with zero frontend surface until now). Not date-scoped; "who's in the queue right now" has no notion of "today."
- **Completed / Cancelled** — today's totals, not "of the current queue" (an appointment leaves `waiting_triage` the instant either happens, so there's nothing to count "of the queue" for these two — a same-shift operational summary instead). Completed uses `triaged_at`, Cancelled uses the `checked_in_at IS NOT NULL` signal described above.

New route `GET reception/triage-queue/status-counts` (`ReceptionController::triageQueueStatusCounts`, same `can:appointments.read` gate as `reception/queue`), new frontend composable `useTriageQueueStatusCounts.ts`, wired into `triage/Queue.vue`'s KPI row (now 4 cards instead of 1) and invalidated alongside the queue itself on triage recording.

Verified: TS errors unchanged at the 778-error baseline. 195/195 Vitest passing (1 new composable test). Backend: 4 new tests in `TriageQueueStatusCountsApiTest.php` (unclaimed-vs-claimed split, triaged-today regardless of current status, checked-in-then-cancelled-today vs. never-checked-in and vs. yesterday), full `Reception`-filtered Pest suite re-run — 34/34 passing.

---

## Update — wait-time formatting bug, real filter tabs, and claim/release/cancel actions

Three follow-up requests in one message: the KPI cards had no way to actually filter the list ("we have count but no tabs"), a formatting bug ("16h 42.178472083333304m wait"), and a fair challenge to whether "Record triage" is really the only action a nurse needs.

**Wait-time bug, fixed at the source and defensively at display time**: `GetReceptionQueueUseCase.php`'s `waitMinutes` used Carbon's `diffInMinutes()` uncast, which returns a float (sub-minute precision) — `remainder = minutes % 60` on a float produced exactly the reported garbage. Fixed with an `(int)` cast at the source, plus a defensive `Math.floor()` in `ReceptionQueueList.vue`'s `waitLabel()` so this class of bug can't resurface from any other caller.

**Tabs required real backend work first, not just a frontend filter** — investigated before building, per instruction. The KPI cards' Waiting/In Progress split relies on `triage_owner_user_id`, a claim column that existed in the database (`ClaimAppointmentTriageUseCase`/`ReleaseAppointmentTriageClaimUseCase`, both already built and tested — `AppointmentTriageClaimApiTest.php`) but was **never exposed on a queue entry** (`ReceptionQueueEntryResponseTransformer` omitted it entirely) and **had zero frontend consumer anywhere in the app** — nothing could ever set it, so "In Progress" could only ever read 0/empty. Exposed `triageOwnerUserId`/`triageOwnerAssignedAt` (plus `appointmentNumber`, needed for the Cancel dialog below) on `GetReceptionQueueUseCase`'s entry map and the transformer; extended `ReceptionQueueEntry`'s frontend type to match. Tabs (All/Waiting/In progress) filter the already-loaded queue client-side by that field — no new backend filter param needed, the whole queue was already being fetched.

**Answered "is Record triage the only action" directly, then built what was confirmed**: presented the gap (Claim/Release exist in the backend with no UI; there's no auto-timeout for an abandoned checked-in visit, so Cancel has no home either) and asked which to build. Confirmed: Claim/Release + Cancel.
- **Claim / Release**: new composables `useClaimTriage.ts`/`useReleaseTriageClaim.ts` (`PATCH appointments/{id}/claim-triage`/`release-triage-claim`, both gated `appointments.record-triage` — same permission as recording, not a new capability). A claim conflict (`409 TRIAGE_CLAIM_CONFLICT`) surfaces as a toast and refetches the queue rather than failing silently. Each row now shows "Claimed by {name}" (via the existing role-neutral `useClinicianDirectory.ts`) when claimed by someone else, a Release button when claimed by the current user (`page.props.auth.user.id`, same pattern `medical-records/Index.vue` already uses), and a Claim button when unclaimed.
- **Cancel**: reused `AppointmentClosureDialog.vue` as-is — `WAITING_TRIAGE -> CANCELLED` is a real, allowed transition (`AppointmentStatus::allowedForwardTransitions()`), gated on `appointments.update-status` (the request's real server-side gate, `UpdateAppointmentStatusRequest.php`), reason required. This is the concrete answer to the earlier "what's the limit before cancelling a no-show-to-triage patient" question: there is no automatic timeout anywhere in this codebase, so this manual Cancel is the only way such a visit ever leaves the queue. Narrowed the dialog's `appointment` prop from `AppointmentListItem` to a minimal structural type (`{ id, appointmentNumber }`) so it's reusable from a `ReceptionQueueEntry` without breaking its existing `appointments/IndexV2.vue` usage (still structurally assignable).

Verified: TS errors unchanged at the 778-error baseline. 198/198 Vitest passing (3 new composable tests: `useClaimTriage`, `useReleaseTriageClaim`). Backend: full `Reception`-filtered suite re-run, 34/34 passing (including the pre-existing `AppointmentTriageClaimApiTest.php` coverage for claim/release, untouched); full `Appointment`-filtered suite re-run, 152/153 passing — the one failure is the same pre-existing, unrelated `BillingInvoicePayerSummaryResolver::resolve()` bug confirmed throughout this session.

---

## Update — Phase 4 shipped: Clinician Queue (`clinician/Queue.vue`)

Requested with a specific candidate KPI list — Waiting / Called / In Progress / On Hold / Completed — and an explicit ask to check for anything missing. Investigated backend support before writing any frontend code, per the pattern established for the triage KPI cards.

**Found a real, confirmed bug, not just a gap — "On Hold" was structurally unbuildable as asked.** The signal meant to distinguish "on hold" (sent back for labs/pharmacy, will return) from "never yet seen a provider" is `consultation_started_at`. Reading `AppointmentController::updateProviderWorkflow` directly showed it **unconditionally nulled that field on every exit from `in_consultation`**, including the exact `in_consultation -> waiting_provider` transition meant to produce "on hold." This also meant `GetActiveVisitJourneyUseCase`'s existing `waiting_clinician_review` derived step (used by `patient-flow/Board.vue`) could never actually fire in practice, despite having its own passing unit test (`GetActiveVisitJourneyUseCaseTest.php`) — that test exercises the read-side derivation logic directly against a manually-seeded DB row, so it never caught that the write side (`updateProviderWorkflow`) was destroying the very field it depends on.

Presented this to the user with three options (fix the backend field / drop On Hold / add a redundant new field) rather than silently picking one — confirmed: fix it. **Fixed**: `updateProviderWorkflow` now only nulls `consultation_started_at` when the target status is `waiting_triage` or `completed` (leaving the provider-review flow or closing) — preserved specifically when returning to `waiting_provider`. Minimal, targeted change; added a regression assertion to the existing `AppointmentApiTest.php` test that exercises this exact transition ("returns active consultation to provider queue").

**"Called" confirmed to have zero backend representation** — no column, no paging/notification mechanism anywhere in `app/Modules/Appointment` or `app/Modules/PatientFlow`. Dropped from scope entirely rather than building a placeholder for it.

**Also surfaced, and built per explicit confirmation**: a full consultation ownership/takeover mechanism (`consultation_owner_user_id`, `consultation_takeover_count`, `AppointmentConsultationTakenOverNotification`) already existed in the backend — fully implemented and tested — with zero frontend consumer anywhere in the app, the same pattern found for the triage claim mechanism earlier this session. Built Claim/Start/Resume/Take-over UI for it rather than shipping the page without any way to actually populate "In Progress."

**Shipped**:
- Backend: `GetReceptionQueueUseCase` extended to support the `in_consultation` stage (previously only `waiting_triage`/`waiting_provider`), now also exposing `status`, `consultationOwnerUserId`, `consultationStartedAt` on every entry (plus `appointmentNumber`, `triageOwnerUserId`/`triageOwnerAssignedAt` from the earlier triage work) — `waitStartedAt` for `in_consultation` now reads `consultation_started_at` (duration in-progress) rather than a wait-for-something timestamp. New `GetClinicianQueueStatusCountsUseCase` (Reception module, mirroring `GetTriageQueueStatusCountsUseCase`'s shape): `waiting`/`onHold` split `waiting_provider` by `consultation_started_at` presence (live, not date-scoped); `inProgress` is `in_consultation` (live); `completed` is today's totals scoped to `consultation_started_at IS NOT NULL` specifically — deliberately excluding administrative closures of a still-scheduled visit, which aren't this page's clinical workflow. New route `GET reception/clinician-queue/status-counts`.
- Frontend composables (`composables/clinician/`): `useClinicianQueueStatusCounts`, `useStartConsultation` (covers fresh start, resume, and claim-when-unowned — the backend treats all three as one action), `useProviderWorkflow` (hold / send-to-triage / complete, typed to only the three targets `UpdateAppointmentProviderWorkflowRequest` accepts from `in_consultation`).
- Two small dedicated dialogs (`components/clinician/`): `SendToTriageDialog.vue` (reason required server-side, enforced client-side too) and `TakeoverConsultationDialog.vue` (resolves the 409 `CONSULTATION_OWNER_CONFLICT`, `takeoverReason` required when `forceTakeover` is set).
- `clinician/Queue.vue`: two independently-cached `useReceptionQueue()` calls (`waiting_provider` + `in_consultation`, same two-query precedent `reception/Queue.vue` established), sticky header with 4 KPI cards (Waiting/On hold/In progress/Completed today) and a 4-tab filter (All/Waiting/On hold/In progress) over the combined, already-loaded queue — no new backend filter param needed. Row actions branch on `entry.status` and an `effectiveOwnerUserId()` helper that mirrors the backend's own `resolvedConsultationOwnerUserId()` fallback (falls back to `clinicianUserId` when `consultationOwnerUserId` is unset but status is already `in_consultation`) so the UI's Claim/Hold/Take-over branching matches exactly what the server will accept. Cancel reused as-is from `AppointmentClosureDialog.vue` (both `waiting_provider` and `in_consultation` can transition to `cancelled` per `AppointmentStatus::allowedForwardTransitions()`).
- Route `GET /clinician/queue` (`can:appointments.read` + `facility.entitlement:appointments.scheduling`, same gate as every other queue page), `routeAccess.ts` gained a `/clinician` prefix rule, and the sidebar's pre-existing "Clinician queue" entry — pointed at a temporary `/appointments/legacy?view=clinical` placeholder since the Phase 6 cutover — now retargets to the real page, exactly as this table row always said it should.

Verified: TS errors unchanged at the 778-error baseline. 203/203 Vitest passing (7 new composable tests). Backend: 2 new route tests (`ClinicianQueuePageRouteTest.php`), 3 new status-count tests (`ClinicianQueueStatusCountsApiTest.php`), 1 new `ReceptionQueueApiTest.php` test for the `in_consultation` stage, 1 new regression assertion on the hold-fix — full `Reception`-filtered suite 41/41 passing, full `Appointment`-filtered suite 95/96 passing (the one failure is the same pre-existing, unrelated Billing bug), full `PatientFlow`-filtered suite 34/34 passing (confirming the `updateProviderWorkflow` fix didn't disturb `GetActiveVisitJourneyUseCase`'s consumers).

**Update — two real display bugs, found from user description alone.** `ReceptionQueueList.vue`'s `waitLabel()` unconditionally appended "wait" regardless of stage — an `in_consultation` entry's `waitMinutes` is actually consultation duration (see `GetReceptionQueueUseCase`'s docblock), so a 46-hour-old open consultation rendered as "46h 29m wait," reading as if the patient were still waiting rather than already being seen. Fixed by branching the label on `entry.status`: `in_consultation` now reads "Xh Ym in consultation" / "Just started"; every other stage keeps "Xh Ym wait" / "Just arrived" unchanged. Also renamed the arrival-mode badge's fallback from bare "Unknown" to "Arrival unknown" — the badge only reflects whether an `ArrivalEventModel` row exists for the visit (missing for visits that reached this stage without going through check-in), and the un-scoped word read as ambiguous. TS errors unchanged at 778, 203/203 Vitest passing.

---

## Update — queue-vs-encounter sync audit: "In Progress" is honest, but the underlying status is coarse

User question, verbatim in spirit: does the Clinician Queue's status track real encounter progress, or could it show "In Progress" + "Take over" for a visit whose documentation is already done and whose patient has physically moved on to the lab? Investigated rather than assumed, per this session's established pattern.

**Findings**: "In Progress" is not lying — it's an honest reflection of `appointments.status`. But that status is coarse by design, and two real gaps follow from it:
1. **Finalizing a consultation note has zero effect on `appointments.status`.** `UpdateMedicalRecordStatusUseCase`/`EncounterLifecycleService::syncFromMedicalRecordStatus()` only ever mutate the `encounters` table, never `AppointmentModel`. A clinician can fully sign their note and just never click "Complete" — the same no-timeout gap already found twice this session (`waiting_triage`, `waiting_provider`), now confirmed a third time for `in_consultation`.
2. **Sending a patient to lab/pharmacy/radiology mid-consultation also never touches `appointments.status`.** By design, the appointment stays `in_consultation` the whole diagnostic loop — the finer truth already exists (`GetActiveVisitJourneyUseCase`'s derived `with_clinician`/`waiting_lab`/`in_lab`/`waiting_pharmacy` steps, currently feeding only `patient-flow/Board.vue`), but the Clinician Queue doesn't consume it.

Presented both gaps with concrete fix-cost estimates and asked which to address now. Confirmed: fix #1 (documentation-done signal) only; #2 (patient physical location) explicitly deferred, not silently dropped — the logic to build it already exists in `GetActiveVisitJourneyUseCase` and can be reused when it's prioritized.

**Shipped**:
- New migration `2026_07_09_000002_add_appointment_id_index_to_medical_records_table.php` — `medical_records.appointment_id` had a foreign key but no index (Postgres doesn't implicitly index FK columns, unlike MySQL/InnoDB), so the existing single-row `hasSignedConsultationNoteForAppointment()`/`hasDraftConsultationNoteForAppointment()` calls (already used by `updateProviderWorkflow`'s completion gate) were unindexed scans. Applied to the dev DB.
- New batched method `MedicalRecordRepositoryInterface::hasSignedConsultationNoteForAppointments(array $appointmentIds): array` — one query for N appointments, not N (only one implementation exists, `EloquentMedicalRecordRepository`, updated).
- `GetReceptionQueueUseCase` calls this batched method only when `$stage === 'in_consultation'` (skipped entirely for the other two stages, since it can never return anything true for them), exposing a new `hasSignedConsultationNote` boolean per entry.
- `clinician/Queue.vue` shows a "✓ Note signed" indicator on `in_consultation` rows where it's true — visible whether the row is owned by the current user or someone else, so a clinician considering "Take over" can see the previous owner already finished documenting, even though the appointment itself hasn't been formally closed.

Verified: TS errors unchanged at the 778-error baseline. 203/203 Vitest passing (no frontend test changes needed — display-only addition to an existing type). Backend: 2 new tests in `ReceptionQueueApiTest.php` (signed-vs-draft distinction, plus the existing `in_consultation` entry-shape test extended with a `hasSignedConsultationNote: false` assertion) — full `Reception`-filtered suite 42/42 passing. Full `MedicalRecord`-filtered suite re-run: 101/105 passing — the 4 failures are a pre-existing, unrelated `ArgumentCountError` in `EloquentClinicalCatalogItemRepository::search()` (a diagnosis-code catalog lookup missing a `$dosageForm` argument), confirmed via `git log` to predate this session entirely, not touched by this change. Full `Appointment`-filtered suite re-run: 95/96 passing, same known unrelated Billing failure.

---

## Update — the second sync-audit gap closed: patient's actual diagnostic location

Follow-up to the queue-vs-encounter sync audit. The user picked this over three other candidates (Phase 5, the deep-link audit, the "Clinician #65" fallback) as the next priority: close the gap where the Clinician Queue couldn't show whether an "In Progress" patient is actually with the clinician, in the lab, or in pharmacy — the derived signal already existed (`GetActiveVisitJourneyUseCase`, feeding `patient-flow/Board.vue`) but wasn't wired into this queue.

**Shipped as a shared-logic extraction, not a duplicate copy.** `GetActiveVisitJourneyUseCase::deriveAppointmentStep()`'s `IN_CONSULTATION` branch — the batched `LaboratoryOrderModel`/`RadiologyOrderModel`/`PharmacyOrderModel` lookups and the earliest-incomplete-step-wins precedence rule (`waiting_lab` > `in_lab` > `waiting_pharmacy` > `with_clinician`) — was extracted into a new `ResolveConsultationDiagnosticStepsUseCase` (`app/Modules/PatientFlow/Application/UseCases/`). `GetActiveVisitJourneyUseCase` now delegates to it (a pure refactor — same three queries, same precedence, verified against its own full test suite before touching any consumer); `GetReceptionQueueUseCase` calls the same service for `in_consultation`-stage entries only, exposing a new `consultationStep` field per entry (null for every other stage, same "only query what can return something true" discipline as the `hasSignedConsultationNote` addition).

`clinician/Queue.vue` shows the result via a new `consultationStepLabel()` helper — "Waiting on lab" / "In lab" / "In pharmacy" appear as a small line on `in_consultation` rows; `with_clinician` (the unremarkable, most-common case) deliberately shows nothing, avoiding a label on every single row for the default state.

This closes both halves of the sync audit: `clinician/Queue.vue` now shows whether documentation is done (`✓ Note signed`, previous update) and whether the patient is actually still with the clinician or has moved on to a diagnostic step (`consultationStep`) — a clinician deciding whether to "Take over" a claimed consultation now has both signals, not just the raw, honest-but-coarse `in_consultation` status.

Verified: TS errors unchanged at the 778-error baseline. 203/203 Vitest passing (display-only addition to an existing type, no new frontend test scaffolding needed beyond what the type already required). Backend: `GetActiveVisitJourneyUseCaseTest.php`'s existing 7 step-derivation tests re-run unchanged and passing (confirming the extraction preserved behavior exactly), plus its "runs a bounded, N-independent number of queries" test — confirming the refactor introduced no N+1. 2 new tests in `ReceptionQueueApiTest.php` (`in_lab` vs. `with_clinician` distinction; `consultationStep` null for non-`in_consultation` stages). Full `Reception`-filtered suite 44/44 passing, full `PatientFlow`-filtered suite 34/34 passing, full `Appointment`-filtered suite 95/96 passing (same known unrelated Billing failure).

---

## Update — Phase 5 shipped: Referrals

Placement decision (§5) resolved explicitly by the user, not defaulted: `clinician/Queue.vue`, since referrals are triggered from a specific visit's clinical context and the page already owns every other consultation-context action (start/hold/complete). A future per-visit detail page was the alternative but doesn't exist yet and would have been a bigger lift just to host this one feature.

**Investigated the legacy referral UI before building**, per this session's established pattern — `appointments/Index.vue`'s referrals tab + create/status dialogs span ~830 lines across the file (types, dialogs, tab content, note-linkage, admission-prefill). Confirmed the backend is fully built and untouched by this phase: `GET/POST /appointments/{id}/referrals`, `PATCH .../referrals/{id}/status`, gated `appointments.manage-referrals`, with existing passing test coverage (`AppointmentApiTest.php`) this phase didn't need to add to since no backend code changed.

**Extracted, not rewritten — with three deliberate scope cuts**, each independently justified rather than a blanket "keep it small":
- **Referral notes sub-feature** (~200 lines) — links referrals to `/medical-records` entries via its own `medical.records.read`/`.create` gate. A genuinely separate, cross-module concern bolted onto the same legacy tab, not core referral CRUD. Left out.
- **`sourceAdmissionId` discharge-prefill** — auto-fills the create form from a post-discharge-followup appointment's admission summary. Appointment-details-only context that doesn't apply to a queue-page sheet. Left out.
- **The "referral network" facility-browse endpoint** (`GET appointments/referrals/network`) — confirmed via grep that the legacy UI itself never wired this up either; its create form already just uses free-text `targetFacilityCode`/`targetFacilityName` fields. Not a scope reduction — matching the legacy version exactly.

**Shipped**: three composables (`composables/clinician/`) — `useAppointmentReferrals` (list, `Ref`-scoped to whichever appointment is open), `useCreateAppointmentReferral`, `useUpdateAppointmentReferralStatus` (typed to the five legacy-matching transition targets: accepted/in_progress/completed/cancelled/rejected — `requested` itself is never a target, only where a referral can move to). One new component, `ReferralManagementSheet.vue` — a single Sheet with two view modes (list, create) rather than a create Dialog stacked on a Sheet, avoiding the exact Dialog-behind-Sheet overlay class of bug this session already found and fixed once (`fix(ui): Select/DropdownMenu rendering behind Dialog's overlay`). Status transitions needing a reason (reject/cancel) open one small nested Dialog on top of the Sheet only — never Dialog-on-Dialog. Built fresh `referralStatusVariant()`/`referralPriorityVariant()` badge-color helpers rather than reusing the legacy page's own `statusVariant()`, which the investigation found only has real cases for appointment statuses — every referral-specific status (`requested`/`accepted`/`in_progress`/`rejected`) silently fell through to a generic "outline" badge in the legacy page, a real (if minor) legacy bug not worth carrying forward.

"Referrals" row action added to `clinician/Queue.vue` for `in_consultation` rows, gated `appointments.manage-referrals` — a pure permission check, not tied to consultation ownership, matching the legacy page's own `canManageReferrals` gate exactly (referrals aren't restricted to whoever currently owns the consultation).

Verified: TS errors unchanged at the 778-error baseline. 208/208 Vitest passing (5 new composable tests). Backend: zero changes — all `referral`-filtered backend tests (13, spanning `AppointmentApiTest.php` and `MedicalRecordApiTest.php`'s referral-note-linkage tests) re-confirmed passing untouched, `ClinicianQueuePageRouteTest.php` re-confirmed passing.

This completes Phases 0–6 of this plan (Phase 6 shipped ahead of 4–5 earlier at explicit user direction, now retroactively fully covered by the later phases). Remaining open items are all outside this plan's original phase table: the deep-link query-param audit flagged during the Phase 6 cutover, and the "Clinician #65" directory-fallback question — both still awaiting a decision, not forgotten.

---

## Update — deep-link audit resolved

Explicit direction on scope, before any code changed: don't try to replicate the legacy page's exhaustive query-param behavior (highlighting one row, prefilling forms, filtering by clinician) — "it's not necessary to use all that used in old appointments page, what we need is system to work as modern system does... old appointments page was a mess." Landing on the *correct page* is the fix; preserving every legacy convenience is explicitly not the goal, since the legacy page is being retired, not kept as a permanent target for these links.

That reframing shrank the actual fix list dramatically. Of the ~28 call sites the original audit found, most (billing, pharmacy/lab/radiology orders, theatre procedures, admissions, patient search, generic "back to appointments" links) already pointed at `/appointments` — the correct modern page — just with unused query params attached. Per the new scope, those needed no change at all. Only links landing on the **wrong page entirely** (built for a clinical/triage context that `/appointments` no longer serves) were real bugs.

**A real investigation mistake was caught and corrected before any fix shipped.** The first pass checked `encounters/Workspace.vue`, `patients/Index.vue`, and `medical-records/Index.vue` — but none of those are actually routed anymore: `/encounters/{id}` renders `WorkspaceV2.vue` (which has zero appointment-link code at all), `/patients` renders `IndexV2.vue` (same, no appointment links), and `/medical-records` renders `IndexV2.vue` (which does have one `/appointments` link, but it's a plain patient-context link with no clinical-status filtering — already correct, nothing to fix). All three "findings" were entirely about dead code unreachable by any real user. Re-verified every remaining file against `routes/web.php` directly before touching anything, per explicit instruction not to confuse legacy/V2 pairs again.

**Fixed — 4 confirmed-live files, ~13 call sites**, each landing on the correct page for the audience/status combination rather than a `?view=`/`?status=` mode `IndexV2.vue` can't read:
- `Dashboard.vue`: `clinicianQueueHref`/`departmentQueueHref` → `/clinician/queue`; `triageQueueHref` → `/triage/queue`; the front-desk preset's `queueViewAllHref` branch → `/reception/queue`; the per-row `dashboardAppointmentHref` fallback now branches on the row's actual status (`waiting_provider`/`in_consultation` → clinician queue, `waiting_triage`/`checked_in` → triage queue, else → `/appointments`) instead of building a dead query string. All three href-builder functions simplified to drop their now-meaningless `URLSearchParams` construction entirely — real cleanup, not just a redirect.
- `OPDQuickCommandPalette.vue`: "Consultation Queue" command → `/clinician/queue`; both "Checked In" queue-preset commands → `/triage/queue`.
- `workflows/front_desk/surface.ts`: **all** appointment-queue links → `/reception/queue`, not `/triage/queue` — a correction caught mid-fix. This surface is explicitly front-desk-audience (its own widgets are literally named "Front desk handoff"), and front-desk staff don't record triage; they need arrival visibility, which `reception/Queue.vue` already provides across both segments. Routing "checked-in" links to the nurse-only triage queue would have been the same category of role/audience error the plan's own Phase 3 correction already documented once this session — caught this time before shipping, not after.
- `emergency-triage/Index.vue`: the ED case details "Open" (appointment link) button → `/triage/queue`, matching Dashboard.vue's own "emergency" preset → triage queue mapping.

Verified: TS errors unchanged at the 778-error baseline (confirmed no new errors in any of the 4 edited files specifically, only pre-existing ones). 208/208 Vitest passing — no test changes needed, none of these files had existing spec coverage of their href-building logic.

---

## Update — "Clinician #65" directory-fallback: explicitly cancelled, not deferred

The last open item from this whole modernization effort. Explained the mechanism — `clinicianDisplayName()` (`triage/Queue.vue`, `clinician/Queue.vue`) falls back to `Clinician #{userId}` when `useClinicianDirectory()`'s `GET /staff/clinical-directory?status=active&clinicalOnly=true` doesn't return a match, which happens whenever a user has enough permission to claim/start a consultation but isn't listed as active clinical staff (incomplete profile, wrong job-title keyword match, or a demo/admin account). Proposed a fix (broaden the fallback to a second, wider `/staff` lookup). **User declined — cancel it completely, no further work.** Not a deferral; this is a closed decision, and it should not be re-raised as an open item in a future session.

This closes out every item raised during the appointments-scheduling-workspace modernization effort — Phases 0–6 all shipped, the deep-link audit resolved, and this last cosmetic gap explicitly declined rather than left ambiguous.
