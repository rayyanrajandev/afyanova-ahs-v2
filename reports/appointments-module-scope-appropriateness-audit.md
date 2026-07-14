# Follow-up Audit: Is the Current Scope of the Appointments Module Appropriate?

**Document type**: Read-only audit, no code changes, no implementation recommendations. This is a *design-intent* audit, not a second structural survey — it re-examines `reports/appointments-scheduling-model-audit.md`'s findings against this project's own planning history (`reports/patient-arrival-checkin-modernization-plan.md`, `reports/queue-based-workflow-modernization-plan.md`) to determine whether the current shape is a deliberate, internally-consistent decision or organic drift. Every conclusion is backed by a direct quote or code citation; anything not directly verified is stated as such.

---

## 1. What business problem is the Appointments module intended to solve?

**There is no separate "Visit" entity anywhere in this codebase.** `ls app/Modules` lists 21 modules (`Admission`, `Appointment`, `Authentication`, `Billing`, `ClaimsInsurance`, `Department`, `EmergencyTriage`, `Encounter`, `InpatientWard`, `InventoryProcurement`, `Laboratory`, `MedicalRecord`, `Patient`, `PatientFlow`, `PatientVitals`, `Pharmacy`, `Platform`, `Pos`, `Radiology`, `Reception`, `ServiceRequest`, `Staff`, `TheatreProcedure`) — none named `Visit`. The only near-hit, `PatientFlow`'s `GetActiveVisitJourneyUseCase`, is a read-only cross-module aggregator (confirmed in the prior audit and this session's own earlier work: "it only reads; nothing it computes is written back," same discipline as `GetReceptionQueueUseCase`) — it has no table of its own and cannot be the system of record for anything.

This means **`AppointmentModel` is structurally this system's Visit aggregate** — the only row that carries `status` (`scheduled → waiting_triage → waiting_provider → in_consultation → completed`), `checked_in_at`, `consultation_owner_user_id`, `triage_category`, and every other field a visit's operational journey needs. Given that data-model reality, a module that owns `AppointmentModel` almost mechanically ends up owning "whatever changes as a visit progresses" — there is nowhere else for that logic to live without inventing a new aggregate the project has not built.

**Further evidence this is deliberate, not incidental**: `CreateAppointmentUseCase::assertNoActiveSameDayConflict()` (`CreateAppointmentUseCase.php:91-118`) checks for conflicts by `patientId` + calendar day only — `findActiveForPatientOnDate()` — with no reference anywhere to `clinicianUserId`/provider capacity or time-slot overlap. A true scheduling-calendar system would need to prevent double-booking a provider at a given time; this system only prevents a *patient* from having two simultaneous active visits. That is the conflict model of a queue-based, one-visit-per-patient-per-day OPD operation, not a slot-booked specialty-calendar clinic. `CreateAppointmentUseCase` also validates eligibility against `source_admission_id` (`CreateAppointmentUseCase.php:43-46`) — appointments can originate from an inpatient admission, further reinforcing that "Appointment" in this codebase means *a visit, however it started*, not narrowly "a booked outpatient slot."

**Conclusion**: the business problem this module solves is **"track and progress a patient's visit from scheduling through its clinical conclusion,"** not "manage a scheduling calendar." The prior audit's finding that this is "closer to a visit-lifecycle management workspace" is correct — but per this section's evidence, that is not a mismatch against the module's *name* so much as a mismatch against what "Appointments" *connotes* in generic scheduling software. Given this codebase's actual data model, a narrowly-scoped "just create bookings" module was never structurally possible without a larger redesign (introducing a Visit aggregate) that no plan document proposes.

---

## 2. Are the current responsibilities intentional and internally consistent?

**Yes, at the architectural-decision level — confirmed by two independent planning documents, not inferred.**

`reports/patient-arrival-checkin-modernization-plan.md` §0 (Framing correction): *"The audit establishes that Appointment, Encounter, EmergencyTriage, and ServiceRequest are all live, working modules with real patients and real data — this is **brownfield evolution of four already-functioning modules**, not a greenfield 'build a check-in system.' Nothing here proposes replacing `Appointment`, `EncounterResolverService`, `EmergencyTriageCase`, or `ServiceRequest`; each keeps its current responsibility."*

`reports/queue-based-workflow-modernization-plan.md` §0 makes the **identical statement independently**, about a different feature, five modules later in the project's history: *"This is brownfield evolution of five already-functioning modules... Nothing here proposes replacing `LaboratoryOrderStatus`, `PharmacyOrderStatus`, `RadiologyOrderStatus`, `EncounterStatus`, or `EmergencyTriageCaseStatus` — each keeps its current values, transitions, and responsibility."*

Two separately-written planning documents, addressing two different features, both explicitly choose **not** to consolidate or redraw module boundaries, and both name Appointment/Encounter/EmergencyTriage by name as boundaries to preserve. This is a repeated, consistent architectural posture, not a one-off call — the project has twice had the opportunity to redesign these boundaries and twice chosen not to, on the record.

**The composition pattern is also coherent, not competing ownership.** `CheckInUseCase.php:20-21`'s own docblock: *"Wraps `UpdateAppointmentStatusUseCase` (unmodified, called — not altered, per the plan's framing correction §0)"*. This is the actual intended architecture: **Appointment owns the low-level state-machine mechanism** (`UpdateAppointmentStatusUseCase`, `AppointmentStatus::canTransitionTo()`); **Reception owns the orchestration/policy layer** that decides *when* and *with what additional side effects* (arrival event, Encounter resolution, domain event) to invoke that mechanism for the specific case of a patient physically arriving. That is a standard, defensible layering — not two modules fighting over the same responsibility.

**Where it is not fully consistent**: the *frontend* was not migrated to match this layering. `appointments/Index.vue`'s own "Check in" button still calls the low-level mechanism directly (`PATCH /appointments/{id}/status`) instead of Reception's orchestration layer (`PATCH /appointments/{id}/check-in`) — and this is not a gap I am the first to notice. `patient-arrival-checkin-modernization-plan.md`'s own §6 De-risking strategy, bullet 2, states plainly: *"the existing `PATCH appointments/{id}/status` and `POST appointments` endpoints remain callable exactly as today for any integration that doesn't go through the new `Reception` module"* — a **deliberate** decision to leave the old path open during rollout, explicitly framed as risk mitigation, not an oversight. And Phase 6's own status notes name the specific unfinished piece: *"Slice 3: ... replacing `appointments/Index.vue`'s triage/clinical queue row template with `ReceptionQueueList.vue`... turned out to be materially riskier than slices 1-2... the decision was to add a discoverability link only... Still deferred, now explicitly out of this plan's remaining scope unless revisited."*

**Verdict**: the module-boundary *decision* is intentional and consistent, confirmed twice, independently, in writing. The specific *consequence* the prior audit found (the old "Check in" button still bypassing Reception's fuller path) is a **named, accepted, temporarily-deferred trade-off from that same decision** — not evidence the boundaries themselves are wrong.

---

## 3. Should the Appointments module reasonably own each of these?

| Responsibility | Verdict | Evidence |
|---|---|---|
| **Appointment scheduling** | ✅ Yes, uncontested | Core purpose; no other module creates `AppointmentModel` rows for scheduled visits. |
| **Appointment management** (edit, reschedule, cancel, no-show) | ✅ Yes | Same aggregate, same status machine (`AppointmentStatus.php`); no plan document questions this. |
| **Patient arrival** | ⚠️ No, per the project's own stated direction — but still partially does | `patient-arrival-checkin-modernization-plan.md`'s entire purpose was moving arrival ownership to Reception (§1.1 Goal #2 explicitly names the old "generic appointment-status PATCH relabeled 'check-in'" as the problem being fixed). The plan's intended end-state is Reception owns arrival; Appointment's lingering direct-call path is the explicitly-deferred leftover (§2 above). |
| **Check-in** | ⚠️ No, per the same evidence | `CheckInUseCase` (Reception module) is the named, purpose-built owner — `ArrivalEventModel`, `AppointmentCheckedIn` event, and Encounter-resolution-at-arrival are all Reception's additions layered on top of Appointment's mechanism, not Appointment's own design. |
| **Consultation initiation** (`startConsultation`, provider workflow) | ✅ Yes, reasonably | No separate Visit or "clinical session" module exists to own consultation ownership/takeover; it is tightly coupled to the same `waiting_provider ↔ in_consultation` status values Appointment already owns. Not flagged as contested in either plan document. |
| **Referral management** | ✅ Yes, reasonably | Referrals are keyed to `appointment_id` and represent this visit's handoff need — consistent with the visit-aggregate framing in §1. Not named as a boundary question in any plan document reviewed. |
| **Status transitions** | ✅ Yes — this is the mechanism other modules are meant to compose, not bypass | Per §2's `CheckInUseCase` evidence: the intended pattern is other modules *call into* Appointment's status machine, not replicate it. |

---

## 4. Responsibilities clearly supported by the existing architecture

Scheduling, appointment management, the status-transition mechanism itself, consultation ownership/takeover, and referral management (per §3's ✅ rows) are all supported by explicit code (`AppointmentStatus::allowedForwardTransitions()`, `CreateAppointmentUseCase`, `UpdateAppointmentUseCase`, `AppointmentController::startConsultation()`/`updateProviderWorkflow()`, the five referral UseCases) **and** are never named as boundary questions in either planning document surveyed. Their presence in the Appointment module is both functionally necessary (§1's Visit-aggregate reasoning) and architecturally undisputed in this project's own history.

---

## 5. Responsibilities that genuinely overlap with another module, with evidence

### 5.1 Reception — check-in (confirmed overlap, project's own documents name it)

Already the focus of §2/§3. To restate the sharpest single piece of evidence: `patient-arrival-checkin-modernization-plan.md` §6 explicitly, knowingly kept `PATCH appointments/{id}/status` "callable exactly as today" as a *deliberate* rollout safety net — but the corresponding frontend cleanup (routing `appointments/Index.vue`'s own "Check in" button through Reception's path, or removing it) was separately, explicitly deferred in Phase 6 Slice 3 and never completed. This is a real overlap, acknowledged by the project's own planning artifacts, not a design flaw invented by this audit.

### 5.2 EmergencyTriage — a second, explicitly-unreconciled triage model

`queue-based-workflow-modernization-plan.md` §5: *"`EmergencyTriageCaseStatus` vs. `AppointmentStatus` reconciliation is out of scope, **and stays out of scope on purpose**. The audit found these are two parallel, only-loosely-connected models for the same ED patient. Merging them (or formally defining how they should stay separate) is a real architectural decision this plan does not make."* This is the clearest possible confirmation: the "two separate triage systems" the prior audit flagged is a **known, named, consciously-deferred** architectural question, not an oversight. `EmergencyTriage` is a substantial module in its own right (49 PHP files — comparable in scale to `Encounter`'s 53), so this is not a thin duplicate either; it is a real second system the project has explicitly chosen not to reconcile with Appointment's own triage-recording capability yet.

### 5.3 What is *not* an overlap, on closer inspection

`Reception` itself is deliberately thin — 16 PHP files versus Appointment's 66, Encounter's 53, MedicalRecord's 63 — consistent with it being an orchestration/coordination layer over Appointment + Encounter + a new `ArrivalEvent` table, not a peer module competing for the same responsibilities at the same layer. This file-count asymmetry supports §2's "composition, not competition" reading: Reception was sized and built as a thin wrapper, matching its documented role.

---

## 6. Which "missing" features (from the prior audit) reflect a genuinely different operational model, vs. simple absence?

| Missing feature | Assessment |
|---|---|
| **Calendar/day/week/provider-grid views** | Consistent with a different operational model, not simple absence. §1's evidence (`assertNoActiveSameDayConflict()`'s per-patient-per-day-only conflict check, no provider-slot-capacity concept anywhere in `CreateAppointmentUseCase`) shows the system was never built to prevent provider double-booking — the one thing a calendar view exists to make visible and preventable. Building calendar UI on top of a booking model that has no slot-capacity concept underneath it would not add real scheduling capability without first adding that concept to the backend, which no plan document proposes. |
| **Recurring appointments** | Could not be confirmed as a deliberate operational choice either way — no plan document discusses recurring visits at all. Given the same-day-per-patient conflict model (§1), a recurring series would need active design work (which occurrence is "the" active one for conflict purposes, etc.) — genuinely absent, not confirmed as intentionally out of scope. |
| **Waitlist** | Same as recurring appointments — no evidence found either way in any plan document. Genuinely absent, not confirmed as an intentional omission. |
| **Confirmation workflow** (pre-visit patient confirmation) | Not discussed in any plan document surveyed. Given the walk-in-heavy, same-day-queue operational model §1's evidence points to (Reception's whole existence is oriented around walk-ins and same-day arrival, not advance confirmation of a booked slot), a formal confirmation step is plausibly less central to this operational model than it would be in a slot-booked specialty clinic — but this is an inference from the surrounding architecture, not a confirmed decision; no document states this explicitly. |
| **Appointment-type-aware search/filtering** | No evidence of an intentional decision either way. Genuinely absent — a filter field that could be added without any operational-model implications, unlike the calendar-view case above. |

**Overall pattern**: only the calendar/provider-schedule gap has strong, direct code evidence tying it to a genuinely different (queue-based, same-day, non-slot) operational model rather than simple incompleteness. The other four missing features (recurring, waitlist, confirmation, type-filtering) are not discussed in any planning document this audit could find — their absence cannot be confirmed as either a deliberate operational choice or an acknowledged gap; they are simply unaddressed.

---

## 7. Summary answer

The current module boundaries are **more intentional and internally consistent than the prior audit's framing suggested**, once checked against this project's own planning history rather than judged against generic scheduling-software norms. Two independent planning documents, written for two different features, both explicitly reaffirm "don't redesign these module boundaries" — and the specific overlap the prior audit flagged as its headline finding (Appointments' own incomplete "Check in" path) is not an accident this audit discovered first; it is a named, deliberately-accepted rollout trade-off with an explicitly deferred, never-completed follow-up task already on record in `patient-arrival-checkin-modernization-plan.md`. The one other genuine overlap — Appointment's triage recording vs. the separate `EmergencyTriage` module — is likewise a project-acknowledged, consciously-deferred question, not an oversight. The module's broad scope (consultation ownership, triage, referrals, status transitions) is structurally coherent given this codebase has no separate Visit aggregate — Appointment *is* that aggregate in practice — and every one of those responsibilities is either functionally necessary to that role or explicitly undisputed across the plan documents reviewed. Where the design is genuinely incomplete is narrow and already named by the project itself: the frontend never finished migrating from the pre-Reception check-in path to the post-Reception one.
