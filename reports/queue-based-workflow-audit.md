# Queue-Based Workflow Audit

**Document type**: Read-only audit, no code changes. Method: direct inspection of every status value-object enum and transition-guard method in the patient-journey path (`Appointment`, `Encounter`, `EmergencyTriage`, `Laboratory`, `Pharmacy`, `Radiology`, `ServiceRequest`), plus a repo-wide search for `Domain/Events`/`Application/Listeners` directories to determine whether any module reacts automatically to another module's status changes. Builds directly on `reports/patient-arrival-checkin-audit.md` and the `Reception` module it led to (`reports/patient-arrival-checkin-modernization-plan.md`, Phases 0–6, all shipped) — this audit picks up exactly where that one stopped: at "patient is with the clinician."

**Target model** (given, restated for reference):

```
Arrival → Check-in → Waiting for Triage → In Triage → Waiting for Clinician →
With Clinician → Waiting for Lab → In Lab → Waiting for Clinician Review →
With Clinician → Waiting for Pharmacy → Completed
```

---

## 1. Answer

**No** — this is not a single, continuously queue-driven workflow. What exists is a real, working queue for the front-desk-to-first-consultation segment (Arrival through "With Clinician"), and then a hard seam: everything from the point a clinician orders labs/pharmacy onward runs on **separate, mutually unaware status machines**, connected only by a manual "am I allowed to close this visit" checklist, not by anything that pushes the visit forward or notifies anyone. Four different modules each have their own idea of "the patient's current step," and none of them update each other.

## 2. Mapping table

| Target model step | What actually exists | Where | Automated (push) or manual (pull)? |
|---|---|---|---|
| **Arrival** | `ArrivalEventModel` row, `ArrivalMode` (`scheduled_checkin`/`walk_in`/`emergency`) | `app/Modules/Reception/Domain/ValueObjects/ArrivalMode.php` | Automated — written atomically with check-in (Reception Phase 1) |
| **Check-in** | `AppointmentStatus::SCHEDULED → WAITING_TRIAGE` | `app/Modules/Appointment/Domain/ValueObjects/AppointmentStatus.php:56-61`, guarded by `canTransitionTo()` (Phase 2) | Automated — one API call (`CheckInUseCase`), opens the `Encounter` too (Phase 3) |
| **Waiting for Triage** | `AppointmentStatus::WAITING_TRIAGE` | Same enum | Automated — appears in `GetReceptionQueueUseCase`'s live queue (Phase 4), tiered emergency-first |
| **In Triage** | **Does not exist as a distinct state.** `RecordAppointmentTriageUseCase` writes `WAITING_TRIAGE → WAITING_PROVIDER` in one call — vitals, notes, and routing are submitted all at once, synchronously | `app/Modules/Appointment/Application/UseCases/RecordAppointmentTriageUseCase.php:68-78` | Neither — there is no way to query "who is currently being triaged" as distinct from "who is waiting to be triaged." A nurse who opens a triage form but hasn't submitted it yet is invisible to the system. |
| **Waiting for Clinician** | `AppointmentStatus::WAITING_PROVIDER` | Same enum | Automated — reachable in `GetReceptionQueueUseCase`'s `waiting_provider` stage |
| **With Clinician** | `AppointmentStatus::IN_CONSULTATION`, plus `Encounter` opens in parallel (`EncounterStatus::OPENED`/`IN_PROGRESS`) | `AppointmentController::startConsultation()` (line 411), `EncounterStatus.php` | Automated for entry; consultation-owner locking prevents two clinicians claiming the same visit (fixed by C-4 in the clinical-note audit) |
| **Waiting for Lab** | `LaboratoryOrderStatus::ORDERED` — but this is a status on the **lab order**, not on the appointment or encounter. The appointment stays `IN_CONSULTATION` the whole time an order is outstanding. | `app/Modules/Laboratory/Domain/ValueObjects/LaboratoryOrderStatus.php:7` | Manual — appears only on the lab department's own worklist (`openWorklistValues()`), not on any patient-journey queue |
| **In Lab** | `LaboratoryOrderStatus::COLLECTED`/`IN_PROGRESS` | Same enum, lines 8-9 | Manual — same as above |
| **Waiting for Clinician Review** | **Does not exist anywhere.** A completed lab order (`LaboratoryOrderStatus::COMPLETED`) does not notify, re-queue, or flag the ordering clinician. The only place a clinician sees outstanding/completed orders is by opening the Encounter Workspace or attempting to close the encounter, where `GetEncounterCloseReadinessUseCase` lists pending items as a close-blocker | `app/Modules/Encounter/Application/UseCases/GetEncounterCloseReadinessUseCase.php:24-38` (`LAB_TERMINAL_STATUSES`/`PHARMACY_TERMINAL_STATUSES`/`RADIOLOGY_TERMINAL_STATUSES`/`THEATRE_TERMINAL_STATUSES`), `:244-346` (`pendingOrderDetails()`) | Manual/pull only — nothing pushes this back to the clinician; they have to go looking |
| **With Clinician** (second pass) | Same `IN_CONSULTATION`/`Encounter` state as before — there is no distinct "review" re-entry state. `updateProviderWorkflow()` allows `in_consultation → waiting_provider` if a clinician wants to release the visit and reclaim it later, but that's a manual choice, not something lab-result-completion triggers | `AppointmentController::updateProviderWorkflow()` line 549, `allowedTransitions` array lines 562-565 | Manual |
| **Waiting for Pharmacy** | `PharmacyOrderStatus::PENDING`/`IN_PREPARATION`/`PARTIALLY_DISPENSED` | `app/Modules/Pharmacy/Domain/ValueObjects/PharmacyOrderStatus.php:7-9` | Manual — pharmacy's own worklist only, same disconnection as lab |
| **Completed** | `AppointmentStatus::COMPLETED` (visit-level) and separately `EncounterStatus::CLOSED` (documentation-level) — two different "done" signals that don't imply each other | `AppointmentStatus.php:11`, `EncounterStatus.php:11` | Manual — front desk/clinician each close their own side independently |

## 3. What's actually driving each segment

**Four separate, uncoordinated status machines**, not one queue:

1. **`AppointmentStatus`** (visit/front-desk lifecycle): `scheduled → waiting_triage → waiting_provider → in_consultation → completed`, with `cancelled`/`no_show` off-ramps. Transition-guarded (`canTransitionTo()`, Phase 2 of the Reception plan). This is the closest thing to "the queue" and it's real — `GetReceptionQueueUseCase` reads it live and orders it by arrival priority.
2. **`EncounterStatus`** (clinical documentation lifecycle): `opened → in_progress → ready_for_sign → signed → closed`, plus `amended`/`cancelled`. Tracks whether the *note* is done, not where the *patient* physically is.
3. **`EmergencyTriageCaseStatus`** (ED-specific, entirely parallel to `AppointmentStatus`): `waiting → triaged → in_treatment → admitted/discharged/cancelled`. An emergency patient effectively has two independent status fields tracking overlapping-but-not-identical things, connected only by Reception's opt-in, disabled-by-default Mode C (`app/Modules/Reception/Application/Listeners/CreateSkeletonEmergencyTriageCase.php`).
4. **Per-department order status enums** (`LaboratoryOrderStatus`, `PharmacyOrderStatus`, `RadiologyOrderStatus`, `ServiceRequestStatus`, `TheatreProcedureStatus`): each is a self-contained little state machine with its own `openWorklistValues()`/`allowedForwardTransitions()`, scoped to that department's own worklist screen. None references `AppointmentStatus`, `EncounterStatus`, or each other.

**Zero cross-module events exist outside Reception.** A repo-wide search for `Domain/Events` and `Application/Listeners` directories found exactly two listener classes in the entire codebase, both in `app/Modules/Reception/Application/Listeners/`, both reacting to `AppointmentCheckedIn` (Reception Phase 5, Mode B/C). `Laboratory`, `Pharmacy`, `Radiology`, `Encounter`, `ServiceRequest`, and `EmergencyTriage` have no `Domain/Events` directories at all. Nothing a clinician, nurse, lab tech, or pharmacist does fires an event another module listens for.

## 4. Consequence, concretely

A patient who is `in_consultation`, has a lab order sitting at `ORDERED` and a pharmacy order at `PENDING`, looks *identical* in the appointment queue to a patient who's been sitting in the room for five minutes with no orders placed at all — both are just `in_consultation`. The only way to learn "this visit has open loops" is:
- The clinician remembers and checks the Encounter Workspace manually, or
- The clinician tries to close the encounter and `GetEncounterCloseReadinessUseCase` blocks them with a checklist (a stop-gate at the end, not a queue position in the middle).

There is no "board view" anywhere (this codebase's dashboards — `resources/js/workflows/*/surface.ts` — are KPI/quick-action summaries, not visit-position boards) that would show, say, "Room 3 — waiting on lab" the way the target model implies.

## 5. Where this leaves the codebase relative to the target model

- **Arrival → With Clinician (first pass)**: essentially matches the target model, minus the missing "In Triage" intermediate state. This segment is genuinely queue-driven (Reception Phases 1–5), not manual handoffs, and it's the part of the system that just went through the most scrutiny (`patient-arrival-checkin-audit.md`).
- **With Clinician → Completed (lab/pharmacy loop)**: does not match the target model. It's not that the states don't exist at all — `LaboratoryOrderStatus`/`PharmacyOrderStatus`/`RadiologyOrderStatus` cover "waiting for X" and "in X" reasonably well — it's that they're invisible to the patient-journey queue and there is no "waiting for clinician review" state or push notification anywhere in the codebase.

## 6. Not recommending an implementation here

Per this engagement's established pattern (`clinical-note-audit/16`'s C-9/C-12, and the Phase-by-phase decision points in the Reception plan), closing this gap is a product/clinical-workflow decision, not an engineering default — it would mean either (a) introducing a real cross-module event bus so lab/pharmacy/radiology completions can push the visit into a "waiting for clinician review" state and notify someone, or (b) accepting the current pull-based model (clinician checks manually) as intentional, the same way C-12 decided narrative documentation and structured orders should stay separate workflows. Both are legitimate; this audit is scoped to establishing the facts, not choosing between them.
