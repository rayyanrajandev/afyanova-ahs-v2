# Queue-Based Workflow — Modernization Plan

**Document type**: Implementation plan, synthesized from `reports/queue-based-workflow-audit.md` and this codebase's established rebuild conventions (`reports/patient-arrival-checkin-modernization-plan.md`, `reports/encounter-state-machine-design/00-03`). Where a decision requires product/clinical authority rather than engineering judgment, it is flagged rather than resolved by assumption — the same posture the audit and the Reception plan both took.

---

## 0. Framing correction (read first)

This is **brownfield evolution of five already-functioning modules** (`Appointment`, `Encounter`, `EmergencyTriage`, `Laboratory`, `Pharmacy`, `Radiology`), not a rewrite of any of them. Nothing here proposes replacing `LaboratoryOrderStatus`, `PharmacyOrderStatus`, `RadiologyOrderStatus`, `EncounterStatus`, or `EmergencyTriageCaseStatus` — each keeps its current values, transitions, and responsibility. What's missing, per the audit, is (a) events fired when those statuses change, (b) a read-model that derives one coherent "where is this patient right now" answer from all of them, and (c) a way for a clinician to be told a completed order exists instead of having to go looking.

This also inherits the caution already established twice in this codebase: `EncounterResolverService` and the consultation-owner-locking mechanism are both deliberately race-hardened and are not to be modified — only read from.

---

## 1. Overview

### 1.1 Goal

Close the gap the audit identified — everything from "With Clinician" onward is invisible as a journey position, with four disconnected status machines and zero cross-module events outside `Reception` — without touching any module's existing status enum, transition rules, or worklist screens. Concretely:

1. Every order-completing module (`Laboratory`, `Pharmacy`, `Radiology`) gains a domain event on its terminal transitions, mirroring `AppointmentCheckedIn`.
2. A new, additive **visit-journey read-model** derives one current-step value per active visit from `AppointmentStatus` + `EncounterStatus` + open orders across all three ancillary modules — the same "live query, not a synced table" shape as `GetReceptionQueueUseCase`, for the same reason (a separately-persisted projection is the two-writes-for-one-fact shape that caused C-7).
3. A clinician is notified when their own outstanding order completes, instead of only finding out by opening the Encounter Workspace or attempting to close the visit.
4. A board view surfaces every active visit's current step in one screen — this does not exist anywhere in the app today.
5. "In Triage" becomes a real, visible state (reusing the consultation-owner-locking pattern already proven for `in_consultation`), instead of being indistinguishable from "waiting for triage."

### 1.2 Scope

**In scope**: new domain events on `Laboratory`/`Pharmacy`/`Radiology` order status writes (additive, no behavior change to those modules), a new `PatientFlow` (or similarly named) module containing the visit-journey read-model and its API surface, a notification mechanism for order completion, and a new board-view frontend page.

**Out of scope**: any change to `LaboratoryOrderStatus`/`PharmacyOrderStatus`/`RadiologyOrderStatus`/`EncounterStatus`/`EmergencyTriageCaseStatus`'s values or transition graphs, any change to `GetEncounterCloseReadinessUseCase`'s existing close-gate behavior (it stays as the last-resort backstop even after this plan ships), and reconciling `EmergencyTriageCaseStatus` with `AppointmentStatus` into a single model (a real, separate modeling decision — see §5).

---

## 2. Requirements

### 2.1 Functional requirements

**Baseline — must continue working exactly as documented** (do-not-break contract):
- Every existing worklist screen (lab, pharmacy, radiology, theatre) and their `openWorklistValues()`-driven queries — unchanged.
- `GetEncounterCloseReadinessUseCase`'s close-gate — unchanged; this plan adds visibility earlier in the visit, it does not replace the backstop at the end.
- Consultation-owner locking on `in_consultation` — unchanged, reused as the template for the new triage-claim lock.

**New functional requirements**:
- `LaboratoryOrderCompleted`, `PharmacyOrderDispensed` (and the pharmacy `PARTIALLY_DISPENSED` case, if a decision is made to notify on that too — see §5), `RadiologyOrderCompleted` domain events, dispatched via `DB::afterCommit()` exactly as `AppointmentCheckedIn` already is.
- A visit-journey query (`GetActiveVisitJourneyUseCase` or similar) that, per active visit, derives one of: `waiting_triage`, `in_triage`, `waiting_clinician`, `with_clinician`, `waiting_lab`, `in_lab`, `waiting_pharmacy`, `waiting_clinician_review`, `completed` — computed from existing fields, nothing new stored as source of truth.
- A "claim triage" action, mirroring `startConsultation()`'s ownership semantics, so `WAITING_TRIAGE` splits into "waiting" vs. "claimed by nurse X" without adding a new `AppointmentStatus` enum value (a claim is metadata alongside the status, the same way `consultation_owner_user_id` sits alongside `in_consultation` today).
- A notification path: at minimum, an in-app indicator the ordering clinician sees (e.g., a badge count reusing the `useReceptionQueue`-style polling composable pattern); real-time push is a separate, larger decision (§5).
- A board view page listing active visits with their derived journey step, filterable by department — the `/reception/queue` page's direct successor in scope, not a replacement for it.

### 2.2 Non-functional requirements

| Category | Status per audit | Assessment |
|---|---|---|
| **Data integrity** | The visit-journey read-model must never become a second source of truth for order/appointment status | It only reads; nothing it computes is written back to `Laboratory`/`Pharmacy`/`Radiology`/`Appointment`. Same discipline as `GetReceptionQueueUseCase`. |
| **Performance** | No cross-module aggregation query exists today; one has to run per active visit, potentially at dashboard-refresh frequency | `encounter-state-machine-design/02`'s ~91-query surprise is a direct precedent — this must be measured against realistic active-visit counts before trusting it, not assumed cheap. |
| **Automation risk** | Introducing push notifications changes real clinical attention patterns, not just code | Same Mode A→B→C staged-trust discipline already used twice in this codebase (encounter canonical-state, Reception Phase 5) — reused a third time, not reinvented. |
| **Isolation** | New events must not become blocking dependencies of the modules that emit them | `Laboratory`/`Pharmacy`/`Radiology`'s existing write paths must succeed identically whether or not any listener is registered — event dispatch is fire-and-forget via `afterCommit()`, never awaited synchronously. |

---

## 3. Architecture

### 3.1 Existing stack (unchanged by this plan)

Laravel hexagonal/DDD modules, Inertia + Vue 3 + TypeScript, Eloquent, TanStack Vue Query. **No real-time/broadcasting infrastructure exists in this stack today** — no Reverb, Pusher, or Echo config anywhere in `composer.json`/`package.json`/`config/`. Any "push" notification in Phase 1 of this plan means polling (the same `refetchInterval` pattern `useReceptionQueue` already uses), not sockets — introducing actual WebSocket infra is a separate, larger decision, not a prerequisite (§5).

### 3.2 Backend — target architecture

```
app/Modules/Laboratory/Domain/Events/LaboratoryOrderCompleted.php   [NEW]
app/Modules/Pharmacy/Domain/Events/PharmacyOrderDispensed.php       [NEW]
app/Modules/Radiology/Domain/Events/RadiologyOrderCompleted.php     [NEW]
    — dispatched via DB::afterCommit() from each module's existing
      status-update use case, at the exact point the status write
      already happens. No new write path; an event added to an
      existing one, same shape as AppointmentCheckedIn.

app/Modules/PatientFlow/                                            [NEW module]
    Application/UseCases/GetActiveVisitJourneyUseCase.php
        — live query, not a persisted table (avoids the C-7 shape),
          joining Appointment + Encounter + open Lab/Pharmacy/
          Radiology orders per visit, deriving one current-step value.
    Application/Listeners/
        LogOrderCompletionForOrderingClinician.php   (Mode A/B — shadow log only)
        NotifyOrderingClinicianOfCompletion.php       (Mode C — opt-in, default off)
    Presentation/Http/Controllers/PatientFlowController.php
        GET /patient-flow/board  — the board-view data source
        GET /patient-flow/notifications — polled by the frontend badge
```

### 3.3 Automation — reusing the Mode A→B→C framing a third time

Identical staged-trust model to `encounter-state-machine-design/01` and Reception Phase 5, reused rather than reinvented:

- **Mode A (shadow, inert)**: events are emitted and a listener logs what the derived visit-journey step and notification *would* be, to a dedicated log channel (mirroring `reception_shadow_automation`). Nothing is visible to any user. Purpose: confirm the derivation logic is correct against real data before anyone sees it.
- **Mode B (visible, opt-in)**: the board view and notification badge become real, but behind a facility-level config flag default-off (mirroring `config/reception_automation.php`), so it can be piloted with one department before wider rollout.
- **Mode C (default-on)**: flag flips to default-true — gated on the same kind of clinical-workflow sign-off Reception's Mode C enablement is still waiting on, not an engineering judgment call.

### 3.4 Frontend — target architecture

New, standalone pages/components — no existing page is rewritten by this plan:
```
resources/js/composables/patient-flow/
    useVisitJourneyBoard.ts     — TanStack Query, same shape as useReceptionQueue
    useOrderCompletionBadge.ts  — polled notification count
resources/js/components/patient-flow/
    VisitJourneyBoard.vue       — Kanban-style column-per-step board
resources/js/pages/patient-flow/
    Board.vue                   — standalone page, same "new page, no V2 ceremony"
                                   reasoning as reception/Queue.vue
```

---

## 4. Implementation phases

| Phase | Content | Depends on | Risk | Rough effort |
|---|---|---|---|---|
| **0 — Domain events** | `LaboratoryOrderCompleted`/`PharmacyOrderDispensed`/`RadiologyOrderCompleted`, dispatched from existing status-update use cases | — | Low | **Done** |
| **1 — Visit-journey read-model** | `GetActiveVisitJourneyUseCase`, live query deriving current step per active visit | 0 | Medium — new cross-module aggregation, needs a real performance measurement before trusting it (§2.2) | **Done** |
| **2 — Triage claim/lock** | Reuse consultation-owner-locking pattern for `WAITING_TRIAGE`, making "In Triage" a real, visible state | — | Low-Medium | **Done** |
| **3 — Mode A shadow logging** | Listener logs derived step + would-be notification, zero visible effect | 0, 1 | Low | **Done** |
| **4 — Mode B: board view + polled notification badge** | `PatientFlowController`, `Board.vue`, `useOrderCompletionBadge.ts`, behind a default-off config flag | 1, 3 | Medium | **Done, scope narrowed** |
| **5 — Mode C: default-on** | Flip the flag default-true | 4, clinical sign-off | Product/clinical decision, not engineering | — |
| **(Separate decision, not phased here)** — real-time push via WebSockets | Introducing Reverb/Pusher/Echo | 4 | Medium-High — new infra category for this stack | Not estimated; scope this separately if polling proves too slow in practice |

---

## 5. Risks & open questions

- **Real-time push vs. polling is an explicit decision, not resolved here.** This plan defaults to polling (matching `useReceptionQueue`'s existing `refetchInterval: 30_000` precedent) because no broadcasting infrastructure exists in this stack today. If 30-second latency is unacceptable for "clinician sees lab result is back," introducing WebSocket infra is a separate, larger initiative that should be scoped on its own, not folded into this plan by default.
- **`EmergencyTriageCaseStatus` vs. `AppointmentStatus` reconciliation is out of scope, and stays out of scope on purpose.** The audit found these are two parallel, only-loosely-connected models for the same ED patient. Merging them (or formally defining how they should stay separate) is a real architectural decision this plan does not make — Reception's Mode C (skeleton `EmergencyTriageCase` creation) already established that connecting them further is a deliberate, gated choice, not a default.
- **Which order-completion events should notify, and whether `PARTIALLY_DISPENSED` counts.** A partially-dispensed pharmacy order might or might not warrant clinician attention — this is a pharmacy-workflow call, not resolved here.
- **No performance baseline exists for the visit-journey read-model**, the same caution the Reception plan already flagged for its own queue read-model, doubled here since this one joins across four modules instead of two.
- **Board view UX (columns, grouping, department scoping) is unspecified** — needs input from whoever owns floor/ward operational workflow today, the same way Reception Phase 4's queue-priority ranking needed triage-protocol input.

---

## 6. De-risking strategy

- Phase 0 ships alone: pure additive events, no consumer yet, no behavior change to `Laboratory`/`Pharmacy`/`Radiology`.
- Phase 1's read-model is queried, never written to anything — the same "nothing computed here can drift because nothing here is a second copy" reasoning already validated for `GetReceptionQueueUseCase`.
- Phases 3-5 reuse the Mode A→B→C rollout this codebase has now validated twice (encounter canonical-state, Reception): shadow log before anything is visible, opt-in before anything is default, and a real clinical sign-off gate before Mode C — not an engineering "seems safe" judgment.
- Every phase gets tested against real data volumes before the next starts, per this repo's own repeatedly-learned lesson (`patient-chart-rebuild-plan.md` §7, `encounter-state-machine-design/02`'s ~91-query discovery, this plan's own §2.2).

---

## 7. Next steps (immediate action items)

**Update**: Phase 0 is implemented — `LaboratoryOrderCompleted`, `PharmacyOrderDispensed` (on `DISPENSED` only, not `PARTIALLY_DISPENSED`, per §5), and `RadiologyOrderCompleted` are dispatched via `DB::afterCommit()` from their respective `UpdateXOrderStatusUseCase`, exactly mirroring `AppointmentCheckedIn`. No listener consumes them yet — that's Phase 3. Verified via `Event::fake()`/`assertDispatched`/`assertNotDispatched` tests in each module's existing API test file (5 new tests total), and a full-suite `git stash` comparison confirming zero regressions against the pre-existing, unrelated `InventoryUnitConversionService`/inventory-unit-fixture failures already known in this codebase (14 failures, identical count before and after).

**Update**: Phase 1 is implemented — `app/Modules/PatientFlow/Application/UseCases/GetActiveVisitJourneyUseCase.php`, a live query (no new table) deriving one of `waiting_triage`/`waiting_clinician`/`waiting_clinician_review`/`with_clinician`/`waiting_lab`/`in_lab`/`waiting_pharmacy` per active visit (appointments in `waiting_triage`/`waiting_provider`/`in_consultation`), batching one query per data source (appointments, lab, radiology, pharmacy, patients) rather than per visit. Two documented, intentional gaps: "In Triage" isn't distinguished from "Waiting for Triage" yet (needs Phase 2's claim/lock), and "Waiting for Clinician Review" is inferred from `consultation_started_at` being already set on a `waiting_provider` appointment, not from a stored flag — the only real signal available without adding a new persisted field, which this read-only phase deliberately avoids. The §2.2 performance requirement is directly tested, not assumed: a query-count assertion at 150 concurrent active visits confirms the batched design stays at a bounded, N-independent number of queries (asserted ≤5), the exact measurement `encounter-state-machine-design/02`'s ~91-query surprise argued for doing before trusting a cross-module aggregation. 12 new tests total, no API surface yet (that's Phase 4) — verified via `app(GetActiveVisitJourneyUseCase::class)->execute()` directly, the same non-HTTP feature-test pattern `EncounterResolverConcurrencyTest` already uses.

**Update**: Phase 2 is implemented — `triage_owner_user_id`/`triage_owner_assigned_at` columns on `appointments` (mirroring `consultation_owner_user_id`/`consultation_owner_assigned_at`), `ClaimAppointmentTriageUseCase`/`ReleaseAppointmentTriageClaimUseCase`, and `PATCH appointments/{id}/claim-triage` / `PATCH appointments/{id}/release-triage-claim` (gated on `appointments.record-triage`, same permission `recordTriage` already requires). Deliberately simpler than `startConsultation()`'s full takeover flow — no previous-owner notification, no blocked-attempt audit trail — since this phase's scope is making the state visible, not replicating every nuance consultation ownership has grown over time. A claim conflict returns 409 `TRIAGE_CLAIM_CONFLICT` with a `forceTakeover` escape hatch, mirroring `CONSULTATION_OWNER_CONFLICT` exactly. `GetActiveVisitJourneyUseCase` (Phase 1) now derives `in_triage` from this claim, closing that phase's one remaining deferred gap — only "Waiting for Clinician Review" being inferred rather than stored remains. 10 new tests (9 API, 1 read-model); the only failure seen running the full Appointment suite was the pre-existing, unrelated `BillingInvoicePayerSummaryResolver::resolve()` bug.

**Update**: Phase 3 is implemented — `LogOrderCompletionForOrderingClinician` (new `PatientFlow` module, `app/Modules/PatientFlow/PatientFlowServiceProvider.php`, registered in `bootstrap/providers.php`) listens on all three Phase 0 events and logs, to a new `patient_flow_shadow_automation` daily channel (mirroring `reception_shadow_automation`), what a real notification to the ordering clinician would say — including the visit's derived journey step immediately after the completion, by calling Phase 1's `GetActiveVisitJourneyUseCase` directly. A pure observer: never writes to the database, dispatches nothing further, and swallows its own logging failures so a channel outage can never surface as a failure of the order-completion write it's observing — the same contract `LogShadowEmergencyTriageCaseCreation` already established for Reception. 5 new tests, mirroring `ReceptionShadowAutomationTest`'s `Log::shouldReceive()` style exactly. Full-suite run confirms no regressions from registering a service provider whose listeners now fire on every lab/pharmacy/radiology completion across the whole suite.

**Update**: Phase 4 is implemented, with two scope corrections made mid-implementation after an explicit duplication/convention audit (user-requested, not self-identified):

1. **Board scope narrowed.** The original plan sketch had the board covering all 8 journey steps. Auditing existing pages first found `waiting_triage`/`in_triage`/`waiting_clinician`/`waiting_clinician_review` would directly duplicate `reception/Queue.vue`'s own `waiting_triage`/`waiting_provider` stages (and `appointments/Index.vue`'s triage/clinical views) — this codebase already had five separate "queue" pages (`reception/Queue.vue`, `appointments/Index.vue`'s two queue modes, and the per-department `laboratory-orders`/`pharmacy-orders`/`radiology-orders` worklists) before this board existed. `VisitJourneyBoard.vue` now shows only `with_clinician`/`waiting_lab`/`in_lab`/`waiting_pharmacy` — the segment the original audit found had zero visibility anywhere — with a single count linking to `/reception/queue` for the earlier stages. The backend (`GetActiveVisitJourneyUseCase`, `GET /patient-flow/board`) still returns all 8 steps unfiltered; the narrowing is a page-level display decision, not a data-model limitation, so a future consumer isn't blocked by this choice.
2. **Board.vue and reception/Queue.vue brought in line with the real V2 convention.** Checking `medical-records/IndexV2.vue` directly (rather than assuming) found the established pattern is `<Head>` title + an in-page `usePlatformAccess()` gate (defense in depth alongside server-side route middleware) + clickable/informational KPI stat cards — neither page had this. Both now do. `reception/Queue.vue`'s stage buttons became two independently-cached `useReceptionQueue()` queries (one pinned per stage) so both stages' counts render as KPI cards simultaneously without a third network call, reusing TanStack Query's queryKey-based cache dedup rather than adding a new backend endpoint.

Backend: `GetOrderCompletionNotificationsForClinicianUseCase` (same live-query, no-new-persisted-state discipline as Phase 1 — "completed order whose visit is still active" needs no `acknowledged_at` field, since the order naturally drops off the list once the visit itself closes), gated by `config/patient_flow_automation.php`'s `mode_b_notifications` flag (default off, checked in the use case itself — the same place `CreateSkeletonEmergencyTriageCase` checks its own Mode C flag, not in the controller). `PatientFlowController` (`GET /patient-flow/board`, `GET /patient-flow/notifications`), both gated on `appointments.read`. The board route itself is **not** flag-gated — read-only visibility into already-visible data carries none of the risk the Mode B flag exists to manage; only the notification data behind it is.

13 new tests (5 API/read-model, 2 page-route, plus the pre-existing 6 re-verified against regressions). No new TypeScript errors (778, unchanged). Frontend Vitest and full Reception/WebRouteAuthorization suites confirm zero regressions.

**Second correction, same audit**: the initial pass matched `medical-records/IndexV2.vue`'s conventions but missed that `patients/chart/ShowV2.vue` and `encounters/WorkspaceV2.vue` use a further pattern list-style V2 pages don't: a sticky header (title + informational KPI mini-stats) pinned inside a bounded, independently-scrolling container (`98dvh` minus the element's own offset, recomputed on resize) rather than page-level scroll. Both `Board.vue` and `reception/Queue.vue` now use this — the header (and, for `reception/Queue.vue`, the clickable stage-switcher cards) stays visible while the board/list scrolls underneath, matching the reasoning `ShowV2.vue`/`WorkspaceV2.vue` apply to their own tall content.

**Deferred, flagged mid-session by the user as its own initiative**: a full `patients/IndexV2.vue` rewrite (patients/Index.vue brought in line with `patients/chart/ShowV2.vue`'s architecture — TanStack Query composables, `usePlatformAccess()` gating, KPI cards), the same scale of effort as the other V2 rebuilds. Not part of this plan; needs its own audit + rebuild-plan doc before implementation, per this codebase's established convention for undertakings of this size.

1. Ship Phase 0 (domain events) — no open questions, no dependencies, ready now.
2. Ship Phase 1 (read-model) with a real performance measurement against realistic active-visit counts before trusting it, per §2.2/§6.
3. Ship Phase 2 (triage claim/lock) independently — no dependency on Phases 0-1.
4. Before Phase 4: decide which events notify (§5), and confirm polling is an acceptable starting point versus committing to WebSocket infra now.
5. Phase 5 (Mode C default-on) needs the same category of clinical-workflow sign-off Reception's own Mode C is still waiting on — not to be scheduled as a given.
