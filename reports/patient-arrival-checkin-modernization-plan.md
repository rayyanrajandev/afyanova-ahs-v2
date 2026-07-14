# Patient Arrival & Check-in — Modernization Plan

**Document type**: Implementation plan, synthesized from `reports/patient-arrival-checkin-audit.md` and this codebase's established rebuild conventions (`reports/clinical-notes-implementation-plan.md`, `reports/{clinical-notes-frontend,patient-chart,medical-records-index}-rebuild-plan.md`, `reports/encounter-state-machine-design/00-03`). This document does not introduce new research beyond that audit and a direct re-verification of the V2 frontend patterns (`ShowV2.vue`, `IndexV2.vue`, `WorkspaceV2.vue`, `encounters/List.vue`) and the existing `config/frontend_rebuild.php` / `routes/web.php` cutover mechanics. Where a decision requires product or clinical authority rather than engineering judgment, that is flagged explicitly rather than resolved by assumption — consistent with how `clinical-note-audit/16` and `clinical-notes-implementation-plan.md` §5 handle the same situation.

---

## 0. Framing correction (read first)

The audit establishes that Appointment, Encounter, EmergencyTriage, and ServiceRequest are all live, working modules with real patients and real data — this is **brownfield evolution of four already-functioning modules**, not a greenfield "build a check-in system." Nothing here proposes replacing `Appointment`, `EncounterResolverService`, `EmergencyTriageCase`, or `ServiceRequest`; each keeps its current responsibility. What's missing is (a) one confirmed access-control gap, (b) a thin coordination layer connecting the four modules at the moment of arrival, and (c) the frontend rebuild these two reception pages haven't yet received, which every other high-traffic page in the system already has (`reports/patient-arrival-checkin-audit.md` §9).

This also means the caution already established for encounter work applies here without exception: `EncounterResolverService::findOrCreateForVisit()` is deliberately race-hardened (audit §5, citing the fixed `C-4` finding) and is not to be modified — only called from a new place, carefully.

---

## 1. Overview

### 1.1 Goal

Move patient arrival/check-in from its current state — a generic appointment-status PATCH relabeled "check-in" in the UI, with no arrival record, no state-machine guard, one confirmed RBAC bypass, and no automatic queueing (`patient-arrival-checkin-audit.md` §3–§7) — toward a system where:

1. The confirmed access-control gap (§7 of the audit) is closed, independent of everything else.
2. Arrival is a first-class, auditable event rather than an overloaded status column.
3. Appointment status transitions are guarded, matching the pattern `ServiceRequestStatus::canTransitionTo()` already establishes elsewhere in this codebase.
4. Downstream queueing (triage list, emergency case, ancillary service request) is connected to arrival through an explicit, reversible integration layer — not hand-wired into the status-update use case, and not fully automated on day one.
5. The two reception pages (`appointments/Index.vue`, `patients/Index.vue`) receive the same TanStack-Query-plus-composables treatment already given to Patient Chart, Medical Records Index, and the Encounter Workspace, so reception's frontend is consistent with the rest of the codebase rather than the oldest hand-rolled code left in it.

### 1.2 Scope

**In scope**: `Appointment` module (status model, check-in transition), a new thin arrival-coordination layer, `Patient` registration/search (unchanged, already audited as sound), read-only integration into `Encounter`, `EmergencyTriage`, and `ServiceRequest` (calling their existing use cases, not modifying their internals), and the two reception-facing frontend pages.

**Out of scope**: any change to `EncounterResolverService`'s internal logic, `PatientDuplicateDetectionService`, the Encounter lifecycle state machine (`encounter-state-machine-design/*` already governs that separately and is not touched here), and the clinical intake form itself (`emergency-triage/Index.vue`'s field set is unchanged — this plan only affects *whether a skeleton record exists* before a clinician fills it in, never what clinical fields it collects).

---

## 2. Requirements

### 2.1 Functional requirements

**Baseline — must continue working exactly as documented** (do-not-break contract, per audit §2–§4, §6):
- Patient search (`q` free-text match), registration with hard/soft duplicate detection, and the idempotency-key mechanism — unchanged.
- Existing `waiting_triage` + `checked_in_at` semantics — any new arrival-event table is additive, not a replacement column.
- `EmergencyTriageCase` and `ServiceRequest` creation flows, and their existing permission gates — unchanged; this plan only adds an optional skeleton-record trigger (§3.3), never alters their clinical field set or who can fill them in.

**New functional requirements**:
- Close the `appointments.update` → triage-field write gap (audit §7) — pure removal, no new capability, ships alone.
- `arrival_events` record per physical arrival (mode, timestamp, recording user) — additive table, no existing column removed.
- `AppointmentStatus::canTransitionTo()` guard, mirroring `ServiceRequestStatus`.
- An atomic walk-in check-in path, replacing today's two-sequential-call pattern (audit §4) with one endpoint, to remove the race window between "create appointment" and "mark checked in."
- A queue read-model (priority/wait-time-ordered) backing the triage/provider worklists, replacing raw status-filtered lists.
- Optional, explicitly gated (not default-on) creation of a skeleton `EmergencyTriageCase` at arrival when `arrival_mode = emergency`, so a patient is never administratively "arrived" but clinically invisible (audit §6) — decision on default-on timing deferred, see §5.

### 2.2 Non-functional requirements

| Category | Status per audit | Assessment |
|---|---|---|
| **Access control** | One confirmed live bypass (§7) | Highest-priority item in this plan; ships independently of every other phase. |
| **Concurrency / data integrity** | `EncounterResolverService` already race-hardened (fixed C-4); `Appointment` status update has no such guard | New arrival-event write and any Phase 3 encounter-creation-at-arrival must reuse the same unique-constraint-and-recover pattern, not invent a new one. |
| **Auditability** | Appointment status changes write an audit log entry already (`appointment.created`, and presumably a status-change entry — not independently re-verified this pass); no arrival-specific audit trail exists | `arrival_events` doubles as the audit trail for "how/when did this patient physically arrive," closing a real gap. |
| **Automation risk** | Zero automated queueing exists today; introducing it changes real clinical workflow behavior, not just code | Treated with the same caution as the encounter canonical-state overlay — see the Mode A/B/C framing in §3.3, borrowed deliberately from `encounter-state-machine-design/01`. |
| **Frontend consistency** | Both reception pages are the last major hand-rolled (non-TanStack-Query) pages in the clinical workflow surface (audit §9) | Addressed in Phase 6, following the exact composable/TanStack Query/`usePlatformAccess()` pattern already used by `ShowV2.vue`/`IndexV2.vue`. |

---

## 3. Architecture

### 3.1 Existing stack (unchanged by this plan)

Laravel hexagonal/DDD modules, Inertia + Vue 3 + TypeScript, Eloquent. No new stack component introduced. TanStack Vue Query (`@tanstack/vue-query`) and Vitest are already installed and used by the V2 pages (`patient-arrival-checkin-audit.md` §9; confirmed present via `ShowV2.vue`/`List.vue` imports) — reused, not re-justified.

### 3.2 Backend — target architecture

```
app/Modules/Appointment/
    Presentation/Http/Requests/UpdateAppointmentRequest.php
        — Phase 0: remove 'triageVitalsSummary'/'triageNotes' from ALLOWED_FIELDS and rules()
    Presentation/Http/Controllers/AppointmentController.php
        — Phase 0: remove the triaged_at/triaged_by_user_id auto-stamp block (lines 186-193)
    Domain/ValueObjects/AppointmentStatus.php
        — Phase 2: add canTransitionTo(self $target): bool, mirroring ServiceRequestStatus
    Application/UseCases/UpdateAppointmentStatusUseCase.php
        — Phase 2: call canTransitionTo() before persisting; reject with the same
          validation-error shape ServiceRequest uses today
        — Phase 5 (event dispatch only, see 3.3): dispatch AppointmentCheckedIn after
          the existing status write succeeds; no new side effects inline in this class

app/Modules/Reception/                          [NEW — thin, coordination-only]
    Domain/Models/ArrivalEvent.php               — arrived_at, arrival_mode, appointment_id,
                                                     recorded_by_user_id, verification_notes
    Application/UseCases/CheckInUseCase.php       — wraps UpdateAppointmentStatusUseCase +
                                                     writes ArrivalEvent; single entry point
                                                     for both "check in scheduled appointment"
                                                     and "atomic walk-in check-in"
    Application/UseCases/RegisterWalkInAndCheckInUseCase.php
                                                   — replaces the 2-call frontend sequence
                                                     (audit §4) with 1 backend transaction:
                                                     CreateAppointmentUseCase + CheckInUseCase
    Application/Listeners/                         — Phase 5, see 3.3

database/migrations/
    ..._create_arrival_events_table.php            — Phase 1
    ..._create_visit_queue_entries_table.php        — Phase 4
```

`CheckInUseCase` and `RegisterWalkInAndCheckInUseCase` are the only new callers of `UpdateAppointmentStatusUseCase`/`CreateAppointmentUseCase` — both existing use cases are called, not modified, so today's `PATCH appointments/{id}/status` and `POST appointments` endpoints keep working exactly as they do now for any caller that doesn't go through the new coordination layer.

### 3.3 Automation — borrowing the encounter canonical-state Mode A/B/C framing

The audit (§6) found zero automated queueing today. Wiring `EmergencyTriageCase`/`ServiceRequest`/queue-entry creation directly into `UpdateAppointmentStatusUseCase` would be the naive approach — and is explicitly the kind of unreviewed behavior change `encounter-state-machine-design/01` §1 rejected for encounter status (it evaluated and rejected "inside Domain layer," "middleware," and similar direct-coupling options before landing on a staged, reversible approach). The same reasoning applies here: automatic clinical-record creation is a genuine workflow change for real reception staff, not a pure refactor, so it gets the same staged trust model rather than shipping automated on day one:

- **Mode A (today, unchanged)**: humans manually create `EmergencyTriageCase`/`ServiceRequest` rows exactly as now. Default until a phase below is explicitly turned on.
- **Mode B (shadow)**: `AppointmentCheckedIn`/`AppointmentStatusChanged` events fire and a listener *logs* what it would have created (skeleton triage case, queue entry) to a dedicated log channel, without writing anything — verifies the trigger logic against real arrival volume before it can affect real records.
- **Mode C (advisory)**: the listener actually creates the skeleton record (e.g., a `WAITING`-status `EmergencyTriageCase` with no clinical fields), but the UI treats it as a pre-filled suggestion a clinician still opens and confirms — never a silent, unreviewable background action.
- **Mode D (full automation)**: deferred, not designed here, same as `encounter-state-machine-design/01` defers its own Mode D.

This directly reuses a framework this codebase has already validated once (`encounter-state-machine-design/02`'s rollout sequence and 7-point "ready for trust" checklist) rather than inventing a new rollout methodology for this feature.

### 3.4 Frontend — target architecture

Following the `patient-chart-rebuild-plan.md` / `medical-records-index-rebuild-plan.md` template exactly (gap → target, then a composable file tree):

| Current gap (audit §8) | Target |
|---|---|
| `appointments/Index.vue` (8,590 lines) and `patients/Index.vue`'s handoff panel both hand-roll `apiRequest` calls with manual loading/error refs — the only major clinical-workflow pages left in this state | TanStack Query via `apiGet`/`apiPost`/`apiPatch` (`@/lib/apiClient.ts`), same as `ShowV2.vue`/`IndexV2.vue`/`WorkspaceV2.vue`/`encounters/List.vue` |
| Two sequential client calls for walk-in check-in, no atomicity | One call to the new `RegisterWalkInAndCheckInUseCase` endpoint |
| Dead deep link (`open=schedule&type=walkin`) in `front_desk/surface.ts` | Removed or wired to the actual handoff entry point |
| No queue ordering, just status filters | `useReceptionQueue.ts` backed by the new queue read-model (§3.2), sorted by priority/wait time |
| Permission checks would need a pattern decision | `usePlatformAccess()` — Patient Chart's reasoning applies directly here: reception pages get permissions for free from Inertia shared props on every load (`patient-chart-rebuild-plan.md` §9 item 3), so the async `usePermissions.ts` fetch (built for Workspace) would add an unnecessary round-trip |

```
resources/js/composables/reception/
    useCheckIn.ts                 — POST check-in mutation (existing appointment)
    useWalkInCheckIn.ts           — POST atomic walk-in mutation
    useReceptionQueue.ts          — GET queue read-model, priority/wait-time sorted
    useArrivalHandoff.ts          — the handoff-sheet state machine (mode, primary label/
                                     icon/href/disabled-reason computeds), ported from
                                     patients/Index.vue's inline visitHandoff* refs into a
                                     reusable composable, same "label/icon/href triple"
                                     idiom already used by patientChartAppointmentAction.ts

resources/js/components/reception/
    ArrivalHandoffSheet.vue        — extracted from patients/Index.vue's inline panel
    ReceptionQueueList.vue         — replaces the raw status-filtered list in appointments/Index.vue
```

**Naming/routing decision — flagged as open, not resolved here** (see §5): this codebase's convention is `{Page}V2.vue` + a `/legacy` fallback route only when an existing page is being replaced (`patient-chart-rebuild-plan.md` §8's own open question about "This visit" labeling shows this kind of naming/scope call is treated as a decision, not an engineering default); a page with no true predecessor gets a plain name and no fallback route, per `encounters/List.vue`'s precedent (audit §9; `patient-arrival-checkin-audit.md` cross-references this directly). Reception's situation is mixed: `appointments/Index.vue` and `patients/Index.vue` are existing pages being partially rebuilt (composables extracted, queue view replaced), not wholesale replaced — so neither the "V2 + legacy fallback" nor the "brand-new plain name" precedent applies cleanly. Needs a decision before Phase 6 starts.

---

## 4. Implementation phases

Effort figures are rough order-of-magnitude placeholders, consistent with every other plan in this repo's convention (no team velocity data exists to ground them precisely).

| Phase | Content | Depends on | Risk | Rough effort | Status |
|---|---|---|---|---|---|
| **0 — Security fix** | Remove `triageVitalsSummary`/`triageNotes` from `UpdateAppointmentRequest`; remove the auto-stamp block in `AppointmentController::update()` | — | Low | Hours | **Done** |
| **1 — Arrival event + atomic check-in** | `arrival_events` migration, `CheckInUseCase`, `RegisterWalkInAndCheckInUseCase` | — | Low | 2–3 days | **Done** |
| **2 — Status state machine** | `AppointmentStatus::canTransitionTo()`, wired into `UpdateAppointmentStatusUseCase` | — | Low | 1–2 days | **Done** |
| **3 — Earlier encounter resolution** | Call `EncounterResolverService::findOrCreateForVisit()` from `CheckInUseCase` instead of only from clinician-gated endpoints | 1 | **Medium** — touches a deliberately race-hardened, permission-boundaried service; requires a permission-model decision (§5) | 3–5 days once decided | **Done** — decided as a single Encounter spanning the visit, opened at check-in, granting reception no clinical capability (verified by a test that checks in a visit and asserts the same user is forbidden from creating a note on it) |
| **4 — Queue read-model** | Live read over `AppointmentModel`/`ArrivalEventModel`, tiered priority/wait-time ordering (not a separately-persisted table — see below) | 1 | Medium | 1–1.5 weeks | **Done** — decided scope: simple tier (emergency > scheduled > walk-in) + oldest-wait-first, no formal acuity model required |
| **5 — Mode A→B→C automation** | `AppointmentCheckedIn` event; Mode B shadow-log listener; Mode C skeleton-record creation (opt-in) | 1, 4 | Medium — same staged-trust discipline as the encounter canonical-state work | Mode B: 3–5 days. Mode C: 1 week, only after Mode B soak | **Done, disabled by default** — Mode C built as an opt-in capability (`config/reception_automation.php`) gated separately from *whether to turn it on*, which remains an undecided clinical-workflow call (§5). Reusing `CreateEmergencyTriageCaseUseCase` instead of inserting directly surfaced that `triage_level`/`chief_complaint` are NOT NULL at the schema level — the plan's "no clinical fields" framing needed clearly-marked placeholders instead, not a literal empty skeleton |
| **6 — Frontend rebuild** | Composables (§3.4), `ArrivalHandoffSheet.vue`, `ReceptionQueueList.vue`, dead-link cleanup | 1, 4 | Low–Medium | 2–3 weeks (two large existing pages, more surface than a single-page rebuild like Patient Chart) | **Done, scope reduced** — standalone `reception/Queue` page (slice 1); walk-in race fix + dead-link repoint (slice 2); `appointments/Index.vue` triage banner now links to the new queue view (slice 3). Component extraction/rewiring of the two legacy pages descoped to a separate future effort — see notes below. |

**Update**: Phases 0–4 and both halves of Phase 5 are implemented and merged. Phase 4 shipped as a live query rather than the `visit_queue_entries` table originally sketched in §3.2 — a separately-synced projection is exactly the two-writes-for-one-fact shape that caused C-7 in the clinical-note audit, and a live read has nothing to drift. Phase 5 Mode C ships code-complete but inert (`RECEPTION_MODE_C_SKELETON_TRIAGE_CASE_ENABLED=false` by default) — flipping it on is still gated on the same clinical-workflow sign-off named in §5, now backed by real capability rather than a future to-do.

**Phase 6 status**: shipped as a new, standalone page rather than a `V2.vue`/legacy-fallback pair — Phase 4's queue read-model and Phase 1's walk-in registration had zero prior frontend consumers, so there was no existing page to replace or fall back to (same reasoning as `encounters/List.vue`'s precedent).

**Slice 1** ships:
- `resources/js/composables/reception/{useReceptionQueue,useCheckIn,useWalkInCheckIn}.ts` — TanStack Query composables over the Phase 1/4 API surface.
- `resources/js/components/reception/ReceptionQueueList.vue` and `resources/js/pages/reception/Queue.vue` — a new page at `/reception/queue` (nav entry + `routeAccessRules` guard added), with a stage toggle and an inline walk-in registration mini-form.
- Deliberately does not touch `appointments/Index.vue` or `patients/Index.vue`.

**Slice 2** closes the exact race window `patient-arrival-checkin-audit.md` §4 named — `patients/Index.vue`'s existing handoff panel (`startOutpatientWalkInFromHandoff()`, `sendToEmergencyQueue()`) called `POST /appointments` then `PATCH /appointments/{id}/status` as two separate client requests. Both now call `POST /reception/walk-ins` once, matching `RegisterWalkInAndCheckInUseCase`'s own docblock, which names this exact call site as what it was built to replace. No new frontend composable/component introduced here — the fix stays inside the file's existing local `apiRequest` helper and manual submitting/error refs, since this is a single-endpoint swap, not the full `ArrivalHandoffSheet.vue` extraction. Also fixed the accompanying dead deep link the audit named directly: `front_desk/surface.ts`'s "Register OPD walk-in" quick action pointed to `/appointments?open=schedule&type=walkin...`, query params `appointments/Index.vue`'s create form never reads — now points to `/reception/queue`, which has a working patient-search-and-register form.

**Slice 3**: both remaining items — extracting `ArrivalHandoffSheet.vue`/`useArrivalHandoff.ts` from `patients/Index.vue` (~20+ interdependent `computed`s across four handoff modes) and replacing `appointments/Index.vue`'s triage/clinical queue row template with `ReceptionQueueList.vue` (one giant, deeply conditional template block) — turned out to be materially riskier than slices 1–2: real component-extraction/rewrite work in untested, multi-thousand-line pages, not single-endpoint swaps. Given a choice between attempting that now or a smaller safe step, the decision was to add a discoverability link only: the "Nurse triage view" banner in `appointments/Index.vue` (shown when `isTriageQueue`) now has an "Open reception queue" link to `/reception/queue`, which surfaces the same waiting-triage/waiting-provider visits ordered by arrival priority (emergency → scheduled → walk-in) instead of this page's default sort. No rendering or data-fetching logic in either legacy page was touched.

Still deferred, now explicitly out of this plan's remaining scope unless revisited: the `ArrivalHandoffSheet.vue` extraction and the `ReceptionQueueList.vue` rewiring. Both are real refactors of large, untested legacy pages and are more appropriately scoped as their own dedicated effort than as "the rest of Phase 6."

**Update**: one narrower piece of the deferred gap this section named — `appointments/Index.vue`'s own "Check in" button still calling `PATCH appointments/{id}/status` instead of this plan's `PATCH appointments/{id}/check-in` — was found independently by `reports/appointments-scheduling-model-audit.md` §5.1 and fixed as a single-endpoint swap (not the full row-template rewiring §6's "Slice 3" note describes, which remains deferred). `submitStatusUpdate()` now routes the front-desk check-in case (`!isProviderStatusDialog && nextStatus === 'waiting_triage'`) through `CheckInUseCase`, so it gets an `ArrivalEvent` row and fires `AppointmentCheckedIn` like every other check-in path in the app. See `reports/appointments-scheduling-model-audit.md`'s own Update note for verification detail.

---

## 5. Risks & open questions

- **Phase 3 needs an explicit permission-model decision, not an engineering default.** Calling `EncounterResolverService::findOrCreateForVisit()` from a reception-triggered use case means either (a) reception's `CheckInUseCase` runs with a system-level actor context that bypasses the `medical.records.*` gate `GET appointments/{id}/encounter` currently requires, or (b) Phase 3 is dropped and encounter creation stays exactly where it is today. This is a product/security-owner call, structurally identical to how `clinical-note-audit/16`'s C-8/C-9/C-10/C-12 were left as documented options rather than unilaterally implemented.
- **Phase 5's Mode C default-on timing is a clinical-workflow decision.** Auto-creating a skeleton `EmergencyTriageCase` changes what a triage nurse sees the moment they open their queue — needs sign-off from whoever owns that workflow, not just an engineering "seems safe" judgment. Mirrors the caution in `encounter-state-machine-design/02`'s 7-point "READY FOR MODE B TRUST" gate before anything advances beyond shadow logging.
- **Frontend naming/routing convention doesn't map cleanly onto this feature** (§3.4) — `appointments/Index.vue` and `patients/Index.vue` are partial rebuilds, not the clean "existing page → V2 + legacy fallback" or "brand-new page → plain name" cases this codebase has precedent for. Needs a decision before Phase 6.
- **Queue prioritization rules (Phase 4) are unspecified.** "Priority/wait-time ordering" needs an actual clinical-acuity ranking scheme (e.g., emergency arrival mode ranks above scheduled OPD) — this plan does not invent one; it needs input from whoever owns triage protocol today.
- **No performance baseline exists for the new queue read-model.** `encounter-state-machine-design/02`'s experience (an unanticipated ~91-query cost discovered only once real load was tested) is a direct precedent for re-measuring Phase 4's actual query cost against realistic data before trusting it, not assuming a read-model query is cheap by construction.

---

## 6. De-risking strategy

- Phase 0 ships alone, immediately, independent of every other phase — it is a pure removal with no new surface to regress.
- Phases 1–2 touch only new tables/new guard logic layered around existing use cases; the existing `PATCH appointments/{id}/status` and `POST appointments` endpoints remain callable exactly as today for any integration that doesn't go through the new `Reception` module.
- Phases 3 and 5 use the same staged-trust model (shadow logging before any write, write-without-enforcement before any UI reliance) already validated once in this codebase for the encounter canonical-state overlay — reusing a proven rollout methodology rather than inventing a new one for this feature.
- Phase 6's frontend work follows the exact flag-gated route/config pattern already used three times (`config/frontend_rebuild.php`'s `workspace_v2_enabled` / `patient_chart_v2_enabled` / `medical_records_index_v2_enabled`) — a new `reception_checkin_v2_enabled`-style flag (name pending the §5 naming decision), old pages completely untouched until there is confidence to cut over.
- Every phase gets live-tested against real data before the next starts, per this repo's own documented lesson (`patient-chart-rebuild-plan.md` §7, `clinical-notes-frontend-rebuild-plan.md` §8): this engagement has twice caught real bugs that unit tests alone missed, and reception is higher-traffic than either of those pages.

---

## 7. Next steps (immediate action items)

1. Ship Phase 0 (security fix) — no dependencies, no open questions, ready now.
2. Get a decision on the Phase 3 permission-model question (§5) before scheduling that phase — everything else can proceed without it.
3. Get a decision on Phase 5's Mode C default-on timing and Phase 4's queue-priority ranking scheme from whoever owns clinical/triage workflow — both are listed in §5 as decisions, not engineering defaults.
4. Decide the Phase 6 naming/routing convention (§3.4, §5) before frontend work starts, since it determines whether this ships as `AppointmentsV2.vue`/`PatientsV2.vue` with legacy fallbacks or as a smaller set of extracted, always-on components inside the existing pages.
5. Phases 1, 2, and the Mode B half of Phase 5 have no open decisions blocking them and can be scheduled immediately after Phase 0.
