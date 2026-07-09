<?php

use App\Models\User;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\PatientFlow\Application\UseCases\GetActiveVisitJourneyUseCase;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\ServiceRequest\Infrastructure\Models\ServiceRequestModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function makePatientFlowPatient(array $overrides = []): PatientModel
{
    return PatientModel::query()->create(array_merge([
        'patient_number' => 'PT'.now()->format('Ymd').strtoupper(Str::random(6)),
        'first_name' => 'Furaha',
        'middle_name' => null,
        'last_name' => 'Ngowi',
        'gender' => 'female',
        'date_of_birth' => '1990-01-01',
        'phone' => '+255700000002',
        'email' => null,
        'national_id' => null,
        'country_code' => 'TZ',
        'region' => null,
        'district' => null,
        'address_line' => null,
        'next_of_kin_name' => null,
        'next_of_kin_phone' => null,
        'status' => 'active',
        'status_reason' => null,
    ], $overrides));
}

function makePatientFlowAppointment(string $patientId, array $overrides = []): AppointmentModel
{
    return AppointmentModel::query()->create(array_merge([
        'appointment_number' => 'APT'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'clinician_user_id' => null,
        'department' => 'Outpatient',
        'scheduled_at' => now()->subHour()->toDateTimeString(),
        'duration_minutes' => 30,
        'reason' => 'Visit',
        'notes' => null,
        'status' => 'waiting_triage',
        'status_reason' => null,
    ], $overrides));
}

function makePatientFlowLabOrder(string $patientId, string $appointmentId, string $status): LaboratoryOrderModel
{
    return LaboratoryOrderModel::query()->create([
        'order_number' => 'LAB'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'appointment_id' => $appointmentId,
        'ordered_at' => now(),
        'test_code' => 'LOINC:57021-8',
        'test_name' => 'Complete Blood Count',
        'priority' => 'routine',
        'status' => $status,
    ]);
}

function makePatientFlowRadiologyOrder(string $patientId, string $appointmentId, string $status): RadiologyOrderModel
{
    return RadiologyOrderModel::query()->create([
        'order_number' => 'RAD'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'appointment_id' => $appointmentId,
        'ordered_at' => now(),
        'modality' => 'xray',
        'study_description' => 'Chest X-Ray (PA)',
        'status' => $status,
    ]);
}

function makePatientFlowPharmacyOrder(string $patientId, string $appointmentId, string $status): PharmacyOrderModel
{
    return PharmacyOrderModel::query()->create([
        'order_number' => 'RX'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'appointment_id' => $appointmentId,
        'ordered_at' => now(),
        'medication_code' => 'ATC:N02BE01',
        'medication_name' => 'Paracetamol 500mg',
        'dosage_instruction' => 'Take 1 tablet every 8 hours',
        'quantity_prescribed' => 12,
        'quantity_dispensed' => 0,
        'status' => $status,
    ]);
}

function makePatientFlowServiceRequest(
    string $patientId,
    string $status,
    ?string $appointmentId = null,
    ?string $linkedOrderId = null,
    string $serviceType = 'laboratory',
): ServiceRequestModel {
    return ServiceRequestModel::query()->create([
        'request_number' => 'SR'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'appointment_id' => $appointmentId,
        'service_type' => $serviceType,
        'priority' => 'routine',
        'status' => $status,
        'requested_at' => now(),
        'linked_order_id' => $linkedOrderId,
    ]);
}

it('maps waiting_triage appointments to the waiting_triage step', function (): void {
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, ['status' => 'waiting_triage']);

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries)->toHaveCount(1);
    expect($entries[0]['appointmentId'])->toBe($appointment->id);
    expect($entries[0]['step'])->toBe('waiting_triage');
    expect($entries[0]['patientName'])->toBe('Furaha Ngowi');
    expect($entries[0]['patientNumber'])->toBe($patient->patient_number);
});

it('maps a claimed waiting_triage appointment to in_triage', function (): void {
    $patient = makePatientFlowPatient();
    $nurse = User::factory()->create();
    makePatientFlowAppointment($patient->id, [
        'status' => 'waiting_triage',
        'triage_owner_user_id' => $nurse->id,
        'triage_owner_assigned_at' => now(),
    ]);

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('in_triage');
});

it('maps a first-time waiting_provider appointment to waiting_clinician', function (): void {
    $patient = makePatientFlowPatient();
    makePatientFlowAppointment($patient->id, [
        'status' => 'waiting_provider',
        'consultation_started_at' => null,
    ]);

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('waiting_clinician');
});

it('maps a returning waiting_provider appointment to waiting_clinician_review', function (): void {
    $patient = makePatientFlowPatient();
    makePatientFlowAppointment($patient->id, [
        'status' => 'waiting_provider',
        'consultation_started_at' => now()->subMinutes(20),
    ]);

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('waiting_clinician_review');
});

it('maps in_consultation with no open orders to with_clinician', function (): void {
    $patient = makePatientFlowPatient();
    makePatientFlowAppointment($patient->id, [
        'status' => 'in_consultation',
        'consultation_started_at' => now(),
    ]);

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('with_clinician');
});

it('maps in_consultation with an unstarted lab order to waiting_lab', function (): void {
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, [
        'status' => 'in_consultation',
        'consultation_started_at' => now(),
    ]);
    makePatientFlowLabOrder($patient->id, $appointment->id, 'ordered');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('waiting_lab');
});

it('maps in_consultation with an in-progress lab order to in_lab', function (): void {
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, [
        'status' => 'in_consultation',
        'consultation_started_at' => now(),
    ]);
    makePatientFlowLabOrder($patient->id, $appointment->id, 'collected');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('in_lab');
});

it('prefers waiting_lab over in_lab when both an unstarted and an in-progress order exist', function (): void {
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, [
        'status' => 'in_consultation',
        'consultation_started_at' => now(),
    ]);
    makePatientFlowLabOrder($patient->id, $appointment->id, 'ordered');
    makePatientFlowLabOrder($patient->id, $appointment->id, 'in_progress');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('waiting_lab');
});

it('maps in_consultation with a scheduled radiology order to waiting_lab', function (): void {
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, [
        'status' => 'in_consultation',
        'consultation_started_at' => now(),
    ]);
    makePatientFlowRadiologyOrder($patient->id, $appointment->id, 'scheduled');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('waiting_lab');
});

it('maps in_consultation with only an open pharmacy order to waiting_pharmacy', function (): void {
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, [
        'status' => 'in_consultation',
        'consultation_started_at' => now(),
    ]);
    makePatientFlowPharmacyOrder($patient->id, $appointment->id, 'pending');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('waiting_pharmacy');
});

it('ignores completed lab orders when deriving the step', function (): void {
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, [
        'status' => 'in_consultation',
        'consultation_started_at' => now(),
    ]);
    makePatientFlowLabOrder($patient->id, $appointment->id, 'completed');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('with_clinician');
});

it('maps a pending, unlinked service request to waiting_direct_service with no appointment', function (): void {
    $patient = makePatientFlowPatient();
    $serviceRequest = makePatientFlowServiceRequest($patient->id, 'pending');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries)->toHaveCount(1);
    expect($entries[0]['appointmentId'])->toBeNull();
    expect($entries[0]['serviceRequestId'])->toBe($serviceRequest->id);
    expect($entries[0]['step'])->toBe('waiting_direct_service');
    expect($entries[0]['department'])->toBe('Laboratory');
    expect($entries[0]['patientName'])->toBe('Furaha Ngowi');
});

it('maps an in-progress service request to in_direct_service', function (): void {
    $patient = makePatientFlowPatient();
    makePatientFlowServiceRequest($patient->id, 'in_progress', serviceType: 'pharmacy');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries[0]['step'])->toBe('in_direct_service');
    expect($entries[0]['department'])->toBe('Pharmacy');
});

it('excludes a service request already linked to a real order', function (): void {
    $patient = makePatientFlowPatient();
    makePatientFlowServiceRequest($patient->id, 'pending', linkedOrderId: (string) Str::uuid());

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries)->toBe([]);
});

it('excludes completed and cancelled service requests', function (): void {
    $patient = makePatientFlowPatient();
    makePatientFlowServiceRequest($patient->id, 'completed');
    makePatientFlowServiceRequest($patient->id, 'cancelled');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries)->toBe([]);
});

it('shows a service request tied to an appointment alongside the appointment entry', function (): void {
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, ['status' => 'in_consultation']);
    makePatientFlowServiceRequest($patient->id, 'pending', appointmentId: $appointment->id);

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries)->toHaveCount(2);
    $steps = array_column($entries, 'step');
    expect($steps)->toContain('with_clinician');
    expect($steps)->toContain('waiting_direct_service');
});

it('runs a bounded, N-independent number of queries regardless of active-visit volume', function (): void {
    // Direct answer to the plan's own §2.2/§6 requirement: measure this
    // before trusting it, per the encounter-state-machine-design/02 lesson
    // where an unmeasured cross-module aggregation turned out to cost ~91
    // queries under real load. This asserts the batched-query design (one
    // query per data source, never per visit) actually holds, not just that
    // it looks right on paper.
    $patient = makePatientFlowPatient();

    for ($i = 0; $i < 150; $i++) {
        $appointment = makePatientFlowAppointment($patient->id, [
            'status' => 'in_consultation',
            'consultation_started_at' => now(),
        ]);
        makePatientFlowLabOrder($patient->id, $appointment->id, 'ordered');
        makePatientFlowPharmacyOrder($patient->id, $appointment->id, 'pending');
    }

    DB::enableQueryLog();
    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();
    $queryCount = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($entries)->toHaveCount(150);
    expect($queryCount)->toBeLessThanOrEqual(6);
});

it('excludes completed, cancelled, and no_show appointments entirely', function (): void {
    $patient = makePatientFlowPatient();
    makePatientFlowAppointment($patient->id, ['status' => 'completed']);
    makePatientFlowAppointment($patient->id, ['status' => 'cancelled']);
    makePatientFlowAppointment($patient->id, ['status' => 'no_show']);

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute();

    expect($entries)->toBe([]);
});

it('scopes the board to one patient when a patientId is given, pushed into the query rather than filtered after', function (): void {
    $target = makePatientFlowPatient();
    $other = makePatientFlowPatient(['phone' => '+255700000099']);
    makePatientFlowAppointment($target->id, ['status' => 'waiting_triage']);
    makePatientFlowAppointment($other->id, ['status' => 'waiting_provider']);

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute($target->id);

    expect($entries)->toHaveCount(1);
    expect($entries[0]['patientId'])->toBe($target->id);
});

it('scopes direct-service walk-ins to one patient when a patientId is given', function (): void {
    $target = makePatientFlowPatient();
    $other = makePatientFlowPatient(['phone' => '+255700000098']);
    makePatientFlowServiceRequest($target->id, 'pending');
    makePatientFlowServiceRequest($other->id, 'pending');

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute($target->id);

    expect($entries)->toHaveCount(1);
    expect($entries[0]['patientId'])->toBe($target->id);
    expect($entries[0]['step'])->toBe('waiting_direct_service');
});

it('returns an empty array when the scoped patientId has no active visit', function (): void {
    $patient = makePatientFlowPatient();

    $entries = app(GetActiveVisitJourneyUseCase::class)->execute($patient->id);

    expect($entries)->toBe([]);
});
