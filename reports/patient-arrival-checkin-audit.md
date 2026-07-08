# Patient Arrival & Check-in — Reverse-Engineering Audit

**Scope**: this report documents exactly how patient identification, registration, appointment check-in, walk-in intake, encounter creation, and post-arrival queueing currently work, as implemented in code, with no recommendations and no best-practice comparisons mixed in (those live in `reports/patient-arrival-checkin-modernization-plan.md`). Every non-trivial claim is cited as file:line. Where something could not be verified, it is marked "Not found in code."

**Method**: read-only exploration of `app/Modules/{Patient,Appointment,Encounter,EmergencyTriage,ServiceRequest}`, `resources/js/pages/{patients,appointments,emergency-triage}`, `resources/js/workflows/front_desk`, `routes/api.php`, `routes/web.php`, and `database/seeders/RoleHierarchySeeder.php`, with the most load-bearing claims (the RBAC bypass, `EncounterResolverService` call sites, the appointment status enum) re-read directly against source rather than trusted from a single pass.

---

## 1. Patient identification (existing patients)

One free-text endpoint, not per-field lookups. `GET /patients?q=...` (`routes/api.php:568`) → `PatientController::index` (`app/Modules/Patient/Presentation/Http/Controllers/PatientController.php:38`) → `ListPatientsUseCase` → `EloquentPatientRepository::search()` (`app/Modules/Patient/Infrastructure/Repositories/EloquentPatientRepository.php:60-119`), which `LIKE`-matches `patient_number`, `first_name`/`last_name`/`middle_name`, concatenated full name, `phone`, `email`, and `national_id` simultaneously, case-insensitively, against one `q` parameter. No phonetic/fuzzy matching. The front-desk dashboard's search placeholder (`resources/js/workflows/front_desk/surface.ts:146`, `'Patient name, MRN, phone, or appointment #'`) confirms this is the intended reception UX.

## 2. New patient registration

`POST /patients` (`routes/api.php:574`) → `PatientController::store` (`PatientController.php:115-168`) → `CreatePatientUseCase`. Required fields per `StorePatientRequest.php:18-39`: first/last name, gender, DOB, phone, country code, region, district, address line. `nationalId` is nullable — registration does not require it.

**Duplicate detection is implemented and live** (`PatientDuplicateDetectionService.php`, `EloquentPatientRepository.php:196-317`):
- Hard block (HTTP 409, `DuplicatePatientException`) if an *active* patient already shares a normalized `national_id` or `patient_number`.
- Soft, non-blocking warnings for demographic-similarity candidates, scored (first name +20, last name +20, DOB +30, phone +15, gender +10, address +10; ≥80 = `strong_warning`, ≥50 = `possible_warning`), top 5 returned in the response for staff review.

Registration is idempotent via an `X-Idempotency-Key` header backed by a `patient_registration_syncs` table (`PatientController.php:118-167, 369-458`), so retried/offline submissions replay the original response rather than double-registering.

## 3. Appointment status model

`AppointmentStatus` enum (`app/Modules/Appointment/Domain/ValueObjects/AppointmentStatus.php`, read in full):
```php
enum AppointmentStatus: string {
    case SCHEDULED = 'scheduled';
    case WAITING_TRIAGE = 'waiting_triage';
    case WAITING_PROVIDER = 'waiting_provider';
    case IN_CONSULTATION = 'in_consultation';
    case COMPLETED = 'completed';
    case CANCELLED = 'cancelled';
    case NO_SHOW = 'no_show';
}
```
No `arrived`/`checked_in` value exists. "Checked in" = status `waiting_triage` + a `checked_in_at` timestamp column (`AppointmentModel.php:44,63`), confirmed as the intended reading by an inline frontend comment: *`// 'checked_in' is the dashboard alias for waiting_triage`* (`resources/js/pages/appointments/Index.vue:1431-1433`).

`PATCH /appointments/{id}/status` (`can:appointments.update-status`) → `UpdateAppointmentStatusUseCase::execute()` (`app/Modules/Appointment/Application/UseCases/UpdateAppointmentStatusUseCase.php:28-111`) stamps `checked_in_at = now()` only when the target status is `waiting_triage`, and **does not validate the current→target transition** — any enum value can be set from any other, except `reason` is `required_if:status,cancelled,no_show`. This is a materially weaker guard than `ServiceRequestStatus::canTransitionTo()` (`app/Modules/ServiceRequest/Domain/ValueObjects/ServiceRequestStatus.php`), which enforces an explicit whitelist (`pending → {in_progress, cancelled}`, `in_progress → {completed, cancelled}`) elsewhere in the same codebase.

## 4. Reception / check-in — no dedicated controller

No `Reception`/`FrontDesk`/`CheckIn` module, controller, or use case exists anywhere under `app/Modules`. Check-in is the generic status PATCH from §3. Walk-in intake is two sequential client calls, confirmed in `resources/js/pages/patients/Index.vue`:
```js
// startOutpatientWalkInFromHandoff(), Index.vue:2598-2651
await apiRequest('POST', '/appointments', {
    body: { patientId, appointmentType: 'walk_in', scheduledAt: <now+1min>, reason: 'OPD walk-in - created from patient handoff' },
});
await apiRequest('PATCH', `/appointments/${created.data.id}/status`, {
    body: { status: 'waiting_triage', reason: 'OPD walk-in checked in from patient handoff' },
});
```
`sendToEmergencyQueue()` (`Index.vue:2653-2691`) is structurally identical — it does **not** create an `EmergencyTriageCase`.

**Frontend entry points, precisely** (re-verified directly against source, this session): the button labeled **"Start Visit Handoff"** (`Index.vue:6497`, patient-list row) or **"Start visit handoff"** (`Index.vue:7862`, post-registration dialog) calls `openPatientVisitHandoff(patient, source)` (`Index.vue:2511-2523`), which opens a sheet. Inside that sheet, the primary CTA's label is computed dynamically by `visitHandoffPrimaryLabel` (`Index.vue:1360-1393`) — it only reads **"Check in patient"** when the patient has an active `scheduled` appointment today; otherwise it reads "Choose OPD arrival type" or similar. There is no standalone "Check in patient" button reachable directly from the patient list — it only appears inside the handoff sheet.

## 5. Encounter creation — decoupled from check-in

`EncounterResolverService::findOrCreateForVisit()` (`app/Modules/Encounter/Application/Services/EncounterResolverService.php:47-132`, read in full) is idempotent and race-safe: it looks up an existing encounter for the patient+appointment/admission, and on `UniqueConstraintViolationException` during create, recovers by returning whichever row a concurrent writer committed (lines 86-115, with an inline comment citing this as finding **C-4** from `reports/clinical-note-audit/15-critical-system-integrity-review.md`, already fixed per that report and git history).

Its only two callers that can *create* (not just read) an encounter:
1. `ResolveEncounterForAppointmentUseCase` ← `AppointmentController::encounter()` ← `GET appointments/{id}/encounter`, gated by `can:medical.records.read` + `can:medical.records.create` (`routes/api.php:662-664`) — a clinical permission, not `appointments.update-status`.
2. `CreateMedicalRecordUseCase::execute()` (`app/Modules/MedicalRecord/Application/UseCases/CreateMedicalRecordUseCase.php:98-105`) — when a clinician saves the first clinical note for a visit.

**`UpdateAppointmentStatusUseCase` never calls `EncounterResolverService`.** Confirmed by direct reading of the use case: it only updates the `appointments` row, writes an audit log, and (only for `in_consultation`) triggers `AutoCaptureConsultationFeeUseCase`. Check-in creates no encounter, and triage recording (`recordTriage`) writes directly to `appointments.triage_vitals_summary`/`triage_notes`/`triaged_at`, also without touching `Encounter`.

## 6. No automatic queueing

No model observers, listeners, or `event()` dispatches exist on `AppointmentModel` or in `UpdateAppointmentStatusUseCase`. "Waiting triage queue" / "provider queue" are `GET /appointments?status=...` filtered list views, not a distinct queue entity — no priority/acuity ordering, no SLA/wait-time tracking beyond the single `checked_in_at` timestamp.

`EmergencyTriageCase` (`CreateEmergencyTriageCaseUseCase.php:31-73`, status starts `WAITING`) and `ServiceRequest` (`CreateServiceRequestUseCase.php:25-79`, status starts `PENDING`, the one module here with a real transition whitelist — see §3) both require an explicit, separate `POST` by a human. Nothing in the check-in path calls either.

## 7. Reception scope — one confirmed access-control gap

Reception-driven flows (check-in, walk-in creation, direct service-request tickets) send only administrative fields (`patientId`, `appointmentType`, `scheduledAt`, `reason`, `status`, `serviceType`, `priority`) — confirmed across every call site in `patients/Index.vue`'s handoff panel.

**Exception, re-verified directly against source this session:**
- `UpdateAppointmentRequest::ALLOWED_FIELDS` (`app/Modules/Appointment/Presentation/Http/Requests/UpdateAppointmentRequest.php:15-29`) includes `triageVitalsSummary` and `triageNotes`, validated at lines 54-55, gated only by `authorize(): $this->user()?->can('appointments.update')` (line 33).
- `AppointmentController::update()` (`AppointmentController.php:186-193`):
```php
if (
    (array_key_exists('triage_vitals_summary', $payload) && trim(...) !== '')
    || (array_key_exists('triage_notes', $payload) && trim(...) !== '')
) {
    $payload['triaged_at'] = now();
    $payload['triaged_by_user_id'] = $request->user()?->id;
}
```
- `RoleHierarchySeeder.php:760-774` grants `ADMIN.REGISTRATION` (Registration Clerk) `appointments.update` but **not** `appointments.record-triage`, `medical.records.*`, or `emergency.triage.*`.

Net effect: a Registration Clerk cannot call the dedicated, correctly-gated `PATCH appointments/{id}/triage` (blocked by `appointments.record-triage`, itself derived from `emergency.triage.*` per `app/Providers/AppServiceProvider.php:80-91`), but **can** achieve the same write — including the `triaged_at`/`triaged_by_user_id` stamps — through the generic `PATCH appointments/{id}` endpoint, which their `appointments.update` permission does cover. This is a live permission-boundary bypass, not theoretical.

**Update — fixed (Phase 0 of `patient-arrival-checkin-modernization-plan.md`)**: `triageVitalsSummary`/`triageNotes` are now `['prohibited']` in `UpdateAppointmentRequest::rules()` and removed from `ALLOWED_FIELDS`, with a comment pointing back to this section; the `triaged_at`/`triaged_by_user_id` auto-stamp block in `AppointmentController::update()` is removed entirely. Regression coverage added directly (`tests/Feature/Appointment/AppointmentApiTest.php`: a Registration Clerk's `PATCH appointments/{id}` with triage fields now gets a 422 on both fields, and the appointment's triage columns stay null). Full suite run clean (62 passed). Gap closed.

`StorePatientVitalSetRequest::authorize()` (`app/Modules/PatientVitals/Presentation/Http/Requests/StorePatientVitalSetRequest.php:10-13`) unconditionally returns `true` — the real gate is route-level `can:inpatient.ward.create` middleware (`routes/api.php:1791-1793`), which Registration Clerk lacks. Noted as a code-quality smell (a no-op `authorize()`), not independently exploitable, since the route middleware still enforces correctly.

## 8. Frontend inventory

- `resources/js/workflows/front_desk/surface.ts` builds the Registration Clerk dashboard's KPIs and quick actions. The "Register OPD walk-in" quick-action link (`open=schedule&type=walkin`) is a **dead deep link** — `appointments/Index.vue`'s create form hardcodes `appointmentType: 'scheduled'` and never reads those query params; the functional walk-in path is the handoff panel in `patients/Index.vue` (§4).
- `resources/js/pages/appointments/Index.vue` (8,590 lines) is the main queue/status view, filter bar `all | scheduled | waiting_triage | waiting_provider | in_consultation | completed | exceptions`, all mutations via `apiRequest` calls, hand-rolled loading/error state (not TanStack Query — see cross-reference to §9 below, this file predates the V2 rebuild convention).
- `resources/js/pages/patients/Index.vue` hosts the "visit handoff" panel (outpatient / emergency / direct-services / billing / chart modes), also hand-rolled state, not TanStack Query.
- `resources/js/pages/emergency-triage/Index.vue` is a separate clinical intake form (`arrivalAt`, `triageLevel`, `chiefComplaint`, `vitalsSummary`), gated by `emergency.triage.create`, not reachable from reception's own components.

## 9. Cross-reference to established codebase conventions (this session's addition)

Both `appointments/Index.vue` and `patients/Index.vue` predate this codebase's now-established "V2" rebuild convention (TanStack Query + composables, documented in `reports/clinical-notes-frontend-rebuild-plan.md`, `reports/patient-chart-rebuild-plan.md`, `reports/medical-records-index-rebuild-plan.md`, and already shipped in `ShowV2.vue`, `IndexV2.vue`, `WorkspaceV2.vue`, `encounters/List.vue`). Neither page has had that treatment yet. This is relevant to, but out of scope for, this audit — addressed in `reports/patient-arrival-checkin-modernization-plan.md`.

## 10. Not found in code / could not verify

- Any domain event or observer on `Appointment` status changes — not found.
- Any queue/worklist table or model — not found; confirmed to be filtered list views only.
- Any linkage from `sendToEmergencyQueue()` to `EmergencyTriageCase` creation — not found; the two entities are populated independently.
- A dedicated exact-match "lookup by national ID" or "lookup by MRN" endpoint distinct from the general search — not found.
