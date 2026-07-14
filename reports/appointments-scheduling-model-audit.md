# Audit: Does the Appointments Module Follow a Modern 2027 Hospital Scheduling Model?

**Document type**: Read-only audit, no code changes, no patches. Scope: the Appointments module (`app/Modules/Appointment/`) and everything directly touching appointment scheduling/management — `resources/js/pages/appointments/Index.vue` (8,602 lines), `AppointmentController.php` (1,157 lines), every UseCase under `Application/UseCases/`, `AppointmentStatus`/`AppointmentModel`, `routes/api.php`'s `appointments*` routes, and the boundary with the Reception module where the two interact. Cross-references `reports/appointments-index-audit.md` (frontend structural survey, already done) and `reports/queue-worklist-navigation-audit.md` (the hidden Triage/Clinician queue modes, already fixed) rather than re-deriving them. Every conclusion below is backed by a file/line citation; anything not directly verified is stated as such, not assumed.

---

## 1. Executive Summary

The Appointments module is **not a scheduling calendar system** in the 2027 sense (no day/week/calendar grid, no provider-schedule board, no recurring appointments, no waitlist, no distinct "confirmed" status) — it is closer to **a visit-lifecycle management workspace** that happens to also create appointments. Of its 13 Sheet/Dialog surfaces (`reports/appointments-index-audit.md` §1), only one (Create/Schedule) is genuinely a scheduling action; the rest — triage recording, consultation takeover, provider workflow, referrals, status/reschedule/no-show/cancel — are operational visit-management actions that legitimately belong to *a* module, but several sit inside this one rather than the modules that own the equivalent downstream work elsewhere in this codebase (Reception, Encounter).

**The single most significant finding**: the Appointments module has its own, independently-built "Check in" action (queue-row button, `scheduled → waiting_triage`) that goes through the generic status-update endpoint and **skips three of the four side effects** the codebase's own dedicated, purpose-built check-in path (`CheckInUseCase`, owned by the Reception module) performs for the exact same transition — most importantly, it never writes an `ArrivalEvent` audit row, and that gap is **permanent, not self-healing** (§5.1). This is direct, code-level evidence of unclear module boundaries between Appointments and Reception around the single most important patient-arrival moment in the whole system.

Billing and clinical-documentation logic are also directly embedded in `AppointmentController`/`UpdateAppointmentStatusUseCase` (auto-capture of the consultation fee, a hard gate on closing a visit that queries `MedicalRecordRepositoryInterface` directly) — real, working, tested code, but a genuine cross-module coupling worth naming explicitly (§5.2, §5.3).

---

## 2. Current responsibilities of the Appointments module

| Responsibility | File(s) | Controller action | UseCase(s) | Vue page/component | Route |
|---|---|---|---|---|---|
| List/search/filter appointments | `EloquentAppointmentRepository.php` | `index` | `ListAppointmentsUseCase` | `appointments/Index.vue` (queue table, 5226–5904) | `GET /appointments` |
| Status counts (KPIs) | same | `statusCounts` | `ListAppointmentStatusCountsUseCase` | header KPI cards | `GET /appointments/status-counts` |
| Department option list | same | `departmentOptions` | `ListAppointmentDepartmentOptionsUseCase` | filter dropdowns | `GET /appointments/department-options` |
| Create/schedule an appointment | `CreateAppointmentUseCase.php` | `store` | `CreateAppointmentUseCase` | Create/Schedule sheet (6037–6418) | `POST /appointments` |
| Read one appointment | — | `show` | `GetAppointmentUseCase` | Details sheet open | `GET /appointments/{id}` |
| Edit / reschedule an appointment | `UpdateAppointmentUseCase.php` | `update` | `UpdateAppointmentUseCase` | Reschedule dialog (8384–8450), same endpoint for both | `PATCH /appointments/{id}` |
| Generic status transition (check-in, no-show, cancel, complete, return-to-triage) | `UpdateAppointmentStatusUseCase.php`, `AppointmentStatus.php` | `updateStatus` | `UpdateAppointmentStatusUseCase` | Status dialog (8303–8383), queue-row buttons | `PATCH /appointments/{id}/status` |
| Record nurse triage (vitals, category, routing) | `RecordAppointmentTriageUseCase.php` | `recordTriage` | `RecordAppointmentTriageUseCase` | Triage sheet (7985–8199) | `PATCH /appointments/{id}/triage` |
| Claim/release triage ownership | `ClaimAppointmentTriageUseCase.php`, `ReleaseAppointmentTriageClaimUseCase.php` | `claimTriage`, `releaseTriageClaim` | same | **none — dead code**, see §5.4 | `PATCH /appointments/{id}/claim-triage`, `/release-triage-claim` |
| Start/take over a consultation (provider ownership) | inline in `AppointmentController::startConsultation()` | `startConsultation` | `GetAppointmentUseCase` + `UpdateAppointmentStatusUseCase` | Consultation takeover dialog (7948–7984) | `PATCH /appointments/{id}/start-consultation` |
| Provider workflow transitions (return to triage/provider queue, complete visit) | inline in `AppointmentController::updateProviderWorkflow()` | `updateProviderWorkflow` | `GetAppointmentUseCase` + `UpdateAppointmentStatusUseCase` + `MedicalRecordRepositoryInterface` (direct dependency) | Status dialog, provider mode | `PATCH /appointments/{id}/provider-workflow` |
| Override NEW/REVIEW consultation classification | `OverrideConsultationTypeUseCase.php`, `ConsultationClassificationServiceInterface` | `overrideConsultationType` | `OverrideConsultationTypeUseCase` | Consult type override dialog (8264–8302) | `PATCH /appointments/{id}/consultation-type` |
| Consultation-type volume analytics (billing/reporting) | inline in controller | `consultationTypeSummary` | none (raw query in controller) | **dead endpoint** — zero consumers anywhere in `resources/js` besides the auto-generated Wayfinder route/action stubs every backend route gets (confirmed by grep across `pages/components/composables`) | `GET /appointments/analytics/consultation-type-summary` |
| Referrals (create/list/update/status) | `*AppointmentReferralUseCase.php` (5 files) | `referrals`, `storeReferral`, `updateReferral`, `updateReferralStatus`, `referralStatusCounts`, `referralNetwork`, `referralNetworkStatusCounts` | corresponding UseCases | Details sheet's Workflow tab (referral dialogs, 8451–8601) | `GET/POST/PATCH appointments/{id}/referrals*` |
| Audit trail (own + referral) | `ListAppointmentAuditLogsUseCase.php`, `ListAppointmentReferralAuditLogsUseCase.php` | `auditLogs`, `exportAuditLogsCsv`, `referralAuditLogs`, `exportReferralAuditLogsCsv` | same | Details sheet's Audit trail section | `GET .../audit-logs`, `.../audit-logs/export` |
| Resolve/open the clinical Encounter for a visit | — | `encounter` | `ResolveEncounterForAppointmentUseCase` (**Encounter module**, not Appointment) | consultation-launch links via `@/lib/encounterWorkspace.ts` | `GET /appointments/{id}/encounter` |
| **Check-in a pre-existing scheduled appointment** | `ReceptionController.php` (**Reception module**), `CheckInUseCase.php` (**Reception module**) | `ReceptionController::checkIn` — not `AppointmentController` | `CheckInUseCase` (wraps `UpdateAppointmentStatusUseCase`) | **no page calls it** — `useCheckIn.ts` exists, zero call sites (§5.1) | `PATCH /appointments/{id}/check-in` |

---

## 3. Features currently implemented (per the requested checklist)

### Scheduling
- **Create**: ✅ `CreateAppointmentUseCase`, `POST /appointments`, Create/Schedule sheet.
- **Edit**: ✅ `UpdateAppointmentUseCase`, `PATCH /appointments/{id}`.
- **Reschedule**: ✅ as a UX affordance (Reschedule dialog, `submitRescheduleUpdate()`, `appointments/Index.vue:3687-3716`) — but **not a distinct domain concept**: it calls the same generic `PATCH /appointments/{id}` update endpoint as any other edit, with no dedicated "reschedule" use case, no previous-slot history beyond the generic audit log `UpdateAppointmentUseCase` writes. Confirmed via reading the submit function directly.
- **Cancel**: ✅ `AppointmentStatus::CANCELLED`, reachable from every non-terminal status (`AppointmentStatus.php:56-77`), triggered via the generic status endpoint, labeled "Cancel appointment" (`statusActionLabel()`, `appointments/Index.vue:4788-4801`).
- **Confirm appointment**: ❌ **could not be confirmed to exist**. Exhaustive grep for "confirm" across the Appointment module found no distinct confirmation status, field, or workflow (only unrelated matches: consultation-takeover confirmation, triage-claim confirmation). `AppointmentStatus` has no `CONFIRMED` case (`AppointmentStatus.php:7-13`: `SCHEDULED, WAITING_TRIAGE, WAITING_PROVIDER, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW`).
- **No-show management**: ✅ `AppointmentStatus::NO_SHOW`, `SCHEDULED`-only by design (`AppointmentStatus.php:43-44`: "it means the patient never arrived, which is meaningless once any check-in/triage/consultation step has occurred"), UI button "Record no-show" (`appointments/Index.vue:5852`).
- **Waitlist**: ❌ **does not exist**. Zero matches for "waitlist"/"wait_list" anywhere in `app/Modules/Appointment` or the Vue page.
- **Recurring appointments**: ❌ **does not exist**. Zero matches for "recur" anywhere in the module.

### Schedule views
- **Daily schedule**: ⚠️ **could not be confirmed as a first-class view**. `from`/`to` date filters exist and default to empty (no implicit "today" scoping — `appointments/Index.vue:402-403`, `queryDateFilterParam()` returns `''` when unset), so a single-day view is only reachable by the user manually setting `from = to = today`, not a dedicated mode.
- **Weekly schedule**: ❌ does not exist as a distinct view (only the same `from`/`to` range filter, which can be widened but has no week-grid presentation).
- **Calendar view**: ❌ **does not exist**. Confirmed by exhaustive search of the template — no calendar/grid component, no day/week rendering; the queue is a flat, card-based list (no `<table>` element at all in the whole file).
- **List view**: ✅ this **is** the module's only view — the entire queue is rendered as a vertically-stacked list of appointment cards, sortable and filterable, not a calendar.
- **Provider schedule**: ⚠️ partial — filterable by `clinicianUserId` (a specific provider's appointments can be listed), but there is no calendar/timeline view of a provider's day, only the same flat filtered list.
- **Department schedule**: ⚠️ partial — same shape as provider schedule: filterable by `department`, no dedicated department-calendar view.

### Search & Filtering
Backed by `ListAppointmentsUseCase::execute()` (`app/Modules/Appointment/Application/UseCases/ListAppointmentsUseCase.php:13-88`) and `EloquentAppointmentRepository`'s free-text search (`EloquentAppointmentRepository.php:260-283`):
- **Patient**: ✅ by `patientId` (exact) or free-text `q` matching first/middle/last name (multiple concatenation forms), phone, national ID.
- **Provider**: ✅ `clinicianUserId`, plus `unassignedClinicianOnly`.
- **Department**: ✅ `department`.
- **Date**: ✅ `fromDateTime`/`toDateTime` range against `scheduled_at`.
- **Status**: ✅ `status` (validated against `AppointmentStatus::values()`, plus a `checked_in` legacy alias for `waiting_triage` and an `exceptions` pseudo-status).
- **Appointment type**: ❌ **not filterable anywhere** — `appointmentType` is stored and displayed (a badge distinguishing `scheduled` vs `walk_in`, `appointments/Index.vue:5723`) but `ListAppointmentsUseCase` has zero references to it as a filter, and the frontend never sends it as one (confirmed by grep across both files).

---

## 4. Missing scheduling capabilities

Per §3: **no appointment confirmation workflow, no waitlist, no recurring appointments, no calendar/day/week/provider/department schedule views, and appointment type is not a searchable/filterable dimension.** All six are absent by omission (confirmed by exhaustive search), not disabled-but-present.

---

## 5. Features that do not belong in the Appointments module (or overlap with modules that should own them)

### 5.1 Patient arrival / check-in — the most significant finding

**Does the Appointments module process patient arrival directly?** Partially, and inconsistently.

There are **two independent code paths** that both transition an appointment from `scheduled` to `waiting_triage` (the codebase's own documented definition of "check-in" — `AppointmentStatus.php:33`: "SCHEDULED -> WAITING_TRIAGE: check-in"):

1. **The dedicated, correct path — owned by the Reception module, not Appointments**: `ReceptionController::checkIn()` (`app/Modules/Reception/Presentation/Http/Controllers/ReceptionController.php`) → `CheckInUseCase` (`app/Modules/Reception/Application/UseCases/CheckInUseCase.php:45-104`), routed at `PATCH /appointments/{id}/check-in` (`routes/api.php:694` — note the URL is namespaced under `/appointments/` even though the controller and use case both live in the Reception module). In one transaction, it:
   - Calls `UpdateAppointmentStatusUseCase` to make the status transition (line 64-69).
   - Writes an `ArrivalEventModel` row via `ArrivalEventRepositoryInterface` — the dedicated arrival audit trail (line 75-83). **Confirmed to be the only writer of this table anywhere in the backend** (`grep -rln "arrivalEventRepository->create" app/Modules` → one match, this file).
   - Calls `EncounterResolverService::findOrCreateForVisit()` to open the visit's clinical Encounter (line 85-90).
   - Dispatches the `AppointmentCheckedIn` domain event via `DB::afterCommit()` (line 92-99). **Confirmed to be the only dispatcher of this event anywhere** (`grep -rln "new AppointmentCheckedIn" app/Modules` → one match, this file).
   - This is exactly the pattern the frontend composable `resources/js/composables/reception/useCheckIn.ts` was built to call.

2. **A second, incomplete path — inside the Appointments module itself**: the "Check in" button in `appointments/Index.vue`'s queue row (line 5781-5789, `v-else-if="... appointment.status === 'scheduled'"`, label literally "Check in" from `statusActionLabel()` at line 4788-4801) and Details sheet (line 6854) both call `openStatusDialog(appointment, 'waiting_triage')`, which submits through the **generic** `PATCH /appointments/{id}/status` endpoint → `UpdateAppointmentStatusUseCase::execute()` (`UpdateAppointmentStatusUseCase.php:29-119`). This use case:
   - Does perform the status transition and sets `checked_in_at` (line 55-58) — so the appointment record itself looks checked-in.
   - Writes a generic `appointment.status.updated` audit-log entry (line 90-116) — a real, but different and less specific, audit trail than an `ArrivalEvent` row.
   - **Does not** write an `ArrivalEvent` row. **Does not** dispatch `AppointmentCheckedIn`. **Does not** call `EncounterResolverService` directly.

**Consequence, verified**: an appointment checked in through the Appointments module's own "Check in" button permanently has no `ArrivalEvent` record (nothing else in the codebase ever backfills this table) and never fires `AppointmentCheckedIn` — any automation subscribed to that event (per `queue-based-workflow-modernization-plan.md`'s Mode B, this session's own patient-flow work) silently never runs for that visit. The Encounter gap is **not** permanent — `ResolveEncounterForAppointmentUseCase` and `CreateMedicalRecordUseCase` both independently call the same idempotent `findOrCreateForVisit()` (confirmed: `grep -rln "findOrCreateForVisit" app/Modules` → 4 matches including these two), so the Encounter still gets created the moment a clinician opens the consultation workspace — just later than the architecture's stated intent (documented in `CheckInUseCase.php:27-37` as "opens the visit's Encounter at check-in").

**Does it redirect to the Reception Queue? Does it initiate check-in? Does it only display arrival status?** All three, depending on which part of the module: the "Check in" button *initiates* check-in itself (imperfectly, above); `reports/appointments-index-audit.md` §1/§7 already documented a separate in-page banner (`showTriageQueueSuggestion`, shipped in commit `11731fd`) that *redirects* users to `/reception/queue`; and elsewhere the page purely *displays* status (badges, timestamps) with no action at all. There is no single consistent answer — the module does all three inconsistently depending on which surface of it a user is looking at.

**Which module owns the check-in workflow?** By construction (controller/use-case location, `ArrivalEvent` ownership, event dispatch), **Reception owns it** — but the Appointments module has its own parallel, less-complete implementation of the same domain action, reachable from its own UI, that a user has no way to distinguish from the "correct" one (both buttons just say some variant of "check in").

### 5.2 Billing — consultation-fee auto-capture

`UpdateAppointmentStatusUseCase` directly depends on and calls `AutoCaptureConsultationFeeUseCase` (`UpdateAppointmentStatusUseCase.php:9,21,65-83`) whenever a status transition lands on `IN_CONSULTATION` — a real financial side effect (creating/updating a billing capture) triggered as a byproduct of an appointment status change, surfaced back to the frontend as `billing_capture` in the response (`AppointmentController.php:355,710`). The frontend does act on it: `submitStatusUpdate()` checks `response.billing_capture?.captured` when completing a visit and shows a distinct toast — "Visit completed. Consultation fee draft invoice created." (`appointments/Index.vue:3351-3352`) — confirming the page itself surfaces a billing outcome as user-facing feedback, not just a silently-ignored response field. `AutoCaptureConsultationFeeUseCase` itself lives in the Billing module (not read in this pass — its internal implementation is out of scope for this audit, only its call site and frontend consumption were verified), so this is a cross-module call, not misplaced billing *logic*, but both the *decision of when to trigger it* and the *user-facing confirmation of it* live entirely inside the Appointment status-transition path.

### 5.3 Clinical documentation gate

`AppointmentController::updateProviderWorkflow()` directly injects `MedicalRecordRepositoryInterface` (`AppointmentController.php:620`) and, when closing a visit (`in_consultation → completed`), calls `hasDraftConsultationNoteForAppointment()`/`hasSignedConsultationNoteForAppointment()` to block the transition unless a signed consultation note exists (line 661-680). This is a genuine clinical-documentation business rule enforced from inside the Appointments module's controller, not the Medical Records/Encounter module. It is defensible as "the visit can't close until its note is done" (a visit-lifecycle rule), but the enforcement code itself lives in `AppointmentController`, directly coupled to `MedicalRecordRepositoryInterface`.

### 5.4 A dormant, unused capability — not a "belongs elsewhere" finding, but a real gap

`ClaimAppointmentTriageUseCase`/`ReleaseAppointmentTriageClaimUseCase` (`PATCH .../claim-triage`, `/release-triage-claim`) are fully implemented, backend-tested (`tests/Feature/Appointment/AppointmentTriageClaimApiTest.php`, 188 lines), and mirror the consultation-ownership pattern that *is* wired up for clinicians (`startConsultation()`'s takeover-confirmation flow). The frontend never calls either endpoint (confirmed by exhaustive grep of `appointments/Index.vue`) — `submitTriage()` (line 3470) records triage directly with no claim/lock step. This is not a case of the wrong module owning something; it's a completed backend capability with no frontend consumer at all, structurally identical to the pattern this session's `queue-worklist-navigation-audit.md` found for the queue-mode discoverability gaps.

---

## 6. Relationship between Appointments and the Reception Queue

**Do appointments naturally feed the Reception Queue?** Yes, confirmed at the data layer: `GetReceptionQueueUseCase` reads live from `AppointmentModel`/`ArrivalEventModel` (per this session's prior work, not re-verified line-by-line this pass — cited from `reception-checkin-architecture-audit.md`, already an established fact in this codebase). Every appointment, regardless of which module created it, is visible in the Reception Queue once its status and arrival data qualify.

**Should reception staff work primarily from Appointments or Reception Queue?** Based on actual capability, not naming: **Reception Queue** is the more complete, correctly-wired surface for the *walk-in/arrival* half of front-desk work (atomic `POST /reception/walk-ins`, the newly-added inline registration, Direct Service access — all V2, all this session's work). But **Appointments is the only place to create a scheduled-in-advance appointment at all** (`POST /appointments` only exists on this page) and, per §5.1, is *also* where a scheduled patient's arrival gets checked in today, via the less-complete path. So reception staff currently cannot avoid using both: Appointments to book ahead and (as currently built) check in the specific "Check in" button case, Reception Queue for walk-ins/emergencies and to see the live triage/provider queue.

**Do both modules have clearly separated responsibilities, or do they overlap?** They overlap on exactly one action — checking in a scheduled appointment — and that overlap is not a deliberate, documented split (unlike, say, "Appointments creates future visits, Reception handles arrivals," which *would* be a clean split). The `/appointments/{id}/check-in` URL and `ReceptionController` ownership signal Reception was meant to own this, but nothing prevents (or even flags) the Appointments page's own competing "Check in" button, which was seemingly built independently and is silently missing the arrival-audit and event-dispatch side effects the Reception-owned path provides. This is the one place the two modules' responsibilities are not clearly separated.

---

## 7. UX Assessment: scheduling workspace, operational workflow workspace, or a mixture?

**A mixture, weighted heavily toward operational workflow.** Evidence:
- Of the 13 Sheet/Dialog surfaces (`reports/appointments-index-audit.md` §1), exactly **one** (Create/Schedule, ~380 lines) is a scheduling action in the traditional sense. The other twelve — Advanced Filters, Mobile Filters, the ~1,530-line Details sheet (referrals, audit, cross-module cards), Consultation Takeover, Triage, Leave-Confirm, Lifecycle, Consult-Type Override, Status, Reschedule, Referral, Referral Status — are all visit-lifecycle/operational actions once an appointment already exists.
- The queue itself has no calendar affordance at all (§3, Schedule Views) — it presents and sorts appointments as an operational worklist (P1→P2→P3 priority sorting, wait-time labels, status-driven action buttons), the same shape as a triage/consultation queue, not a scheduling grid.
- The page directly performs consultation-ownership management, triage recording, referral management, and (per §5.1-§5.3) has direct hooks into billing capture and clinical-note completeness — none of which are scheduling.
- The one purely-scheduling feature (Create/Schedule) is proportionally small (~380 of 8,602 lines, ~4.4%) against the rest of the page's operational surface.

---

## 8. Overall assessment against a modern 2027 hospital scheduling model

**Does not align** with what "hospital scheduling system" typically means in 2027 (calendar/day/week/provider-grid views, waitlists, recurring series, patient-confirmation workflows, appointment-type-aware search) — none of those exist, confirmed by exhaustive search, not assumed. What exists instead is a well-built **visit-lifecycle operations console**: creation is one small feature among many status/triage/consultation/referral/billing-adjacent actions, most of which are legitimately valuable but are not "scheduling," and one of which (check-in, §5.1) actively duplicates — incompletely — a capability the Reception module already owns correctly. A 2027-aligned module would either (a) genuinely be a scheduling calendar with these operational actions delegated elsewhere, or (b) be explicitly renamed/scoped as a Visit Operations workspace rather than "Appointments," with check-in fully and exclusively delegated to Reception's already-correct path. Neither framing is assumed here as a recommendation — this audit only establishes that the current implementation is neither.

---

## Update: §5.1's check-in duplication fixed

Following `reports/appointments-module-scope-appropriateness-audit.md`'s finding that this was a named, deliberately-deferred task in `patient-arrival-checkin-modernization-plan.md` (not a fresh discovery), `appointments/Index.vue`'s "Check in" button (queue row line ~5785, Details sheet line ~6854) now routes through `PATCH /appointments/{id}/check-in` (`ReceptionController::checkIn` → `CheckInUseCase`) instead of the generic `PATCH /appointments/{id}/status`, for exactly the one case this represents a real arrival — `!isProviderStatusDialog.value && nextStatus === 'waiting_triage'` (`submitStatusUpdate()`, `appointments/Index.vue:3321-3369`). The provider-side "return to triage" transition (mid-visit, not an arrival) is deliberately left on `provider-workflow`/`status` — it must not create a second `ArrivalEvent` or re-fire `AppointmentCheckedIn` for a patient who already arrived earlier in the same visit.

Verified: request/response contracts confirmed compatible before the change (`CheckInAppointmentRequest` accepts `verificationNotes`, same `appointments.update-status` permission gate, same `AppointmentResponseTransformer` response shape, same `InvalidAppointmentStatusTransitionException` 422 error shape as the endpoint it replaces). No backend code touched. TS error count unchanged at the 778-error pre-existing baseline. 179/179 Vitest passing. `tests/Feature/Reception/ReceptionCheckInApiTest.php` (10 tests, including "opens the encounter for the appointment at check-in" and "checks in a scheduled appointment and records an arrival event") passing against the now-actually-used endpoint.

Not fixed, and not attempted: the EmergencyTriage/Appointment reconciliation (§5.2) and the dormant claim-triage endpoints (§5.4) — both remain real, but out of engineering scope without product/clinical direction, per `patient-arrival-checkin-modernization-plan.md`'s own explicit deferral.
