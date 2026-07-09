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
| **1 — Visit-journey read-model** | `GetActiveVisitJourneyUseCase`, live query deriving current step per active visit | 0 | Medium — new cross-module aggregation, needs a real performance measurement before trusting it (§2.2) | 1-1.5 weeks |
| **2 — Triage claim/lock** | Reuse consultation-owner-locking pattern for `WAITING_TRIAGE`, making "In Triage" a real, visible state | — | Low-Medium | 3-5 days |
| **3 — Mode A shadow logging** | Listener logs derived step + would-be notification, zero visible effect | 0, 1 | Low | 2-3 days |
| **4 — Mode B: board view + polled notification badge** | `PatientFlowController`, `Board.vue`, `useOrderCompletionBadge.ts`, behind a default-off config flag | 1, 3 | Medium | 1-1.5 weeks |
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

1. Ship Phase 0 (domain events) — no open questions, no dependencies, ready now.
2. Ship Phase 1 (read-model) with a real performance measurement against realistic active-visit counts before trusting it, per §2.2/§6.
3. Ship Phase 2 (triage claim/lock) independently — no dependency on Phases 0-1.
4. Before Phase 4: decide which events notify (§5), and confirm polling is an acceptable starting point versus committing to WebSocket infra now.
5. Phase 5 (Mode C default-on) needs the same category of clinical-workflow sign-off Reception's own Mode C is still waiting on — not to be scheduled as a given.
