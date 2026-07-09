# Reception Check-in Architecture Audit

**Document type**: Read-only audit, no code changes. Question: which of two architectural models — Queue-Centric or Form-Centric — does the current check-in implementation actually follow, and is it applied consistently? This was raised before continuing Phase 5 of `patients-index-modernization-plan.md` (a "Visit Handoff sheet"), specifically to avoid building a form-centric competing pattern for an action the codebase has already settled as queue-centric.

---

## 1. The two models, restated

1. **Queue-Centric**: the queue is the primary workspace; check-in is initiated directly from it; any extra form is a lightweight, optional dialog; the patient advances to the next stage immediately on success.
2. **Form-Centric**: a dedicated check-in page/sheet is opened; administrative work happens inside it; check-in only completes on form submission; the patient then advances.

---

## 2. What the backend actually does

**`CheckInUseCase::execute()`** (`app/Modules/Reception/Application/UseCases/CheckInUseCase.php:57-103`) — one `DB::transaction()`:
1. `UpdateAppointmentStatusUseCase::execute(status: WAITING_TRIAGE)` — the appointment moves to the *next queue stage* as part of this same call, not a separate step afterward.
2. Writes an `ArrivalEvent` row (mode, timestamp, recording user).
3. `EncounterResolverService::findOrCreateForVisit()` — opens the visit's Encounter.
4. `DB::afterCommit()` dispatches `AppointmentCheckedIn`.

There is no intermediate "pending check-in, awaiting form completion" state anywhere in this flow. Check-in and stage-advancement are the same atomic write — this is the Queue-Centric model's defining property ("patient is advanced immediately after successful check-in"), implemented at the domain layer, not just the UI.

**`RegisterWalkInAndCheckInUseCase`** (`app/Modules/Reception/Application/UseCases/RegisterWalkInAndCheckInUseCase.php`) wraps `CreateAppointmentUseCase` + `CheckInUseCase` in one transaction for a walk-in with no prior appointment — explicitly built (per its own docblock) to close a race window that existed when the old code called `POST /appointments` then `PATCH /appointments/{id}/status` as two sequential, non-atomic calls. That prior two-call shape is the closest thing to a "form-centric" pattern this codebase ever had for check-in, and it was deliberately replaced.

**`GetReceptionQueueUseCase`** (`app/Modules/Reception/Application/UseCases/GetReceptionQueueUseCase.php:12-26`) is explicitly documented as "a live query, not a separately-persisted/synced `visit_queue_entries` table" — reading `AppointmentModel` directly by status, live, on every request. There is no queue *projection* fed by a separate check-in-completion step; the queue **is** the appointment table's current state. This is architecturally load-bearing for Queue-Centric: a synced/staged queue table would imply a two-step "complete form → queue updates later" model, and the codebase explicitly rejected that shape (citing the same C-7 lesson — "two writes for one fact" — from a prior incident review).

## 3. What the frontend actually does

**`reception/Queue.vue`** is the queue itself as the whole page (not a sheet layered on top of something else). Its "Check in a walk-in visit" panel (`Queue.vue:207-230`) is:
- Inline in the queue page's own scrolling body — not a separate route, not a modal overlay requiring navigation away from the queue.
- A patient search (2+ chars, debounced) + an arrival-mode toggle + one optional `reason` text field. No other administrative fields.
- On submit, `useWalkInCheckIn` (`POST /reception/walk-ins`) fires the atomic backend call above, then `queryClient.invalidateQueries({ queryKey: ['reception-queue'] })` — the patient appears in the *same page's* queue list immediately, no redirect.

This matches "check-in initiated directly from the queue" and "optional lightweight dialog only when needed" almost exactly — it isn't even a dialog, just an inline card on the queue page.

**`appointments/Index.vue`** has no check-in mutation call at all (confirmed by grep — zero matches for `check-in`/`checkedIn`/`check_in` as an API call). It only *displays* guidance text pointing at the gate ("Front desk still needs to check this patient in before consultation can start," "This visit advances automatically after check-in"). It does not implement a competing, heavier check-in flow of its own — it defers entirely to the reception queue as the one place this action happens. That deference is itself evidence of a single, consistently-owned primary workspace, which is a Queue-Centric hallmark, not something a Form-Centric design would need.

## 4. What the legacy sheet did (patients/Index.vue's "Patient Visit Handoff")

The pre-existing `PatientVisitHandoffMode` sheet (audit'd separately in `reports/patients-index-audit.md §1`) has 5 modes. Two of them — `outpatient` and `emergency` — are check-in actions:

- `startOutpatientWalkInFromHandoff()` (`patients/Index.vue:2598-2642`) and `sendToEmergencyQueue()` (`:2644-2683`) both call **the exact same** `POST /reception/walk-ins` endpoint `reception/Queue.vue` uses today.
- Neither collects any real form input for the check-in action itself — the `reason` sent is a **hardcoded string** (`'OPD walk-in - created from patient handoff'` / `'Emergency — directed to triage by registration'`), not a user-filled field.
- Both complete in one atomic call and immediately reflect the new status.

So even the legacy sheet's check-in-shaped modes were already behaviorally Queue-Centric (one atomic action, immediate advance, no real administrative form) — they were just triggered from a different UI location (a big multi-purpose sheet on the patient list) instead of the queue page itself. The *sheet* container looked form-centric (a dedicated panel you open before acting), but the *action* inside it was not.

The other 3 modes — `direct-services`, `billing`, `chart` — are not check-in actions at all: `direct-services` creates a `ServiceRequest` (a parallel, non-queue workflow), and `billing`/`chart` are pure navigation with no state transition. Bundling all 5 under one "Visit Handoff" label conflated "check the patient into the clinical queue" with "route the patient somewhere else entirely" — a real scope-mixing issue in the legacy sheet, but it's a naming/grouping problem, not evidence of a form-centric check-in model.

---

## 5. Findings

**Which model does the current architecture follow?** Queue-Centric, unambiguously — at the domain layer (`CheckInUseCase`'s single atomic transaction, `GetReceptionQueueUseCase`'s explicit live-not-synced design), not just the UI layer.

**Is it applied consistently?** Yes, everywhere check-in actually happens:
- `reception/Queue.vue` (current, actively-developed page): fully queue-centric — inline, lightweight, immediate.
- `appointments/Index.vue`: consistent by deference — implements no competing check-in flow, defers to reception.
- The legacy sheet's outpatient/emergency modes: behaviorally queue-centric under the hood (same atomic endpoint, no real form, immediate advance), even though the container they lived in was a bigger multi-mode sheet.

**Does anything conflict with the model?** Nothing at the check-in-action level. The one real tension is organizational, not architectural: the legacy sheet's bundling of check-in modes alongside non-check-in actions (direct-services, billing, chart routing) under a single "Visit Handoff" umbrella blurs the boundary between "this is the queue-centric check-in action" and "this is an unrelated routing shortcut." That's a labeling/scope issue in a sheet whose relevant parts already behave correctly, not a sign that a form-centric check-in model exists anywhere in the codebase.

**Which model better fits the project as it stands?** Queue-Centric — not as a recommendation to change anything, but as a description of what's already been deliberately built and would be the correct model to keep matching. The backend's atomicity (`CheckInUseCase`), the live-query queue (`GetReceptionQueueUseCase`'s explicit anti-synced-table design), and the one actively-maintained frontend surface (`reception/Queue.vue`) are all load-bearing on this model already. A form-centric "complete this page, then check in" flow would require reintroducing the two-step shape the codebase's own history shows was deliberately removed (the pre-Phase-1 race condition between `POST /appointments` and `PATCH /appointments/{id}/status`).

## 6. Implication for Phase 5 (not a recommendation — a constraint this audit surfaces)

If a "Visit Handoff" surface is built for `patients/IndexV2.vue`, its outpatient/emergency modes should call the same `useWalkInCheckIn`/`POST /reception/walk-ins` path `reception/Queue.vue` already uses — one atomic action, no intermediate form step — rather than introducing a second, heavier UI for an action this codebase has already settled as a one-click, immediate-advance operation. `direct-services` (a real `ServiceRequest` creation, genuinely needs a few fields) and `billing`/`chart` (pure navigation) are different in kind and don't carry this constraint.
