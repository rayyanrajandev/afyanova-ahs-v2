<?php

use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Reception\Infrastructure\Models\ArrivalEventModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/**
 * Coverage for Phase 1 of reports/patient-arrival-checkin-modernization-plan.md:
 * PATCH appointments/{id}/check-in (arrival event + status change for a
 * pre-existing scheduled appointment) and POST reception/walk-ins (atomic
 * appointment-create + check-in, replacing the two-sequential-call pattern
 * named in reports/patient-arrival-checkin-audit.md §4). Neither
 * CreateAppointmentUseCase nor UpdateAppointmentStatusUseCase is modified —
 * this only proves the new coordination layer calls them correctly and adds
 * the ArrivalEvent audit trail atomically.
 */
function receptionPatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PTRCP'.now()->format('Ymd').strtoupper(Str::random(6)),
        'first_name' => 'Reception', 'last_name' => 'Fixture', 'gender' => 'female',
        'date_of_birth' => '1991-11-11', 'phone' => '+255700000017', 'country_code' => 'TZ',
        'status' => 'active',
    ]);
}

function receptionUser(): User
{
    $user = User::factory()->create();
    foreach (['appointments.read', 'appointments.create', 'appointments.update-status'] as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

function receptionScheduledAppointment(string $patientId): AppointmentModel
{
    return AppointmentModel::query()->create([
        'appointment_number' => 'APTRCP'.strtoupper(Str::random(8)),
        'patient_id' => $patientId,
        'department' => 'Outpatient',
        'scheduled_at' => now()->addHour(),
        'duration_minutes' => 30,
        'reason' => 'Consultation',
        'status' => 'scheduled',
    ]);
}

it('checks in a scheduled appointment and records an arrival event', function (): void {
    $user = receptionUser();
    $patient = receptionPatient();
    $appointment = receptionScheduledAppointment($patient->id);

    $response = $this->actingAs($user)
        ->patchJson('/api/v1/appointments/'.$appointment->id.'/check-in', [
            'verificationNotes' => 'ID verified at desk',
        ])
        ->assertOk();

    $response->assertJsonPath('data.status', 'waiting_triage');

    expect(AppointmentModel::query()->find($appointment->id))
        ->status->toBe('waiting_triage')
        ->checked_in_at->not->toBeNull();

    $arrivalEvent = ArrivalEventModel::query()->where('appointment_id', $appointment->id)->first();
    expect($arrivalEvent)->not->toBeNull();
    expect($arrivalEvent->arrival_mode)->toBe('scheduled_checkin');
    expect($arrivalEvent->recorded_by_user_id)->toBe($user->id);
    expect($arrivalEvent->verification_notes)->toBe('ID verified at desk');
});

it('rejects check-in for an appointment that is already past the waiting_triage stage', function (): void {
    $user = receptionUser();
    $patient = receptionPatient();
    $appointment = receptionScheduledAppointment($patient->id);
    $appointment->forceFill(['status' => 'completed'])->save();

    $this->actingAs($user)
        ->patchJson('/api/v1/appointments/'.$appointment->id.'/check-in', [])
        ->assertStatus(422)
        ->assertJsonPath('code', 'APPOINTMENT_STATUS_TRANSITION_INVALID');

    expect(ArrivalEventModel::query()->where('appointment_id', $appointment->id)->count())->toBe(0);
});

it('registers a walk-in and checks it in atomically with one call', function (): void {
    $user = receptionUser();
    $patient = receptionPatient();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/reception/walk-ins', [
            'patientId' => $patient->id,
            'arrivalMode' => 'walk_in',
            'reason' => 'OPD walk-in from front desk',
        ])
        ->assertCreated();

    $response->assertJsonPath('data.status', 'waiting_triage');
    $appointmentId = $response->json('data.id');

    expect(AppointmentModel::query()->find($appointmentId))
        ->status->toBe('waiting_triage')
        ->appointment_type->toBe('walk_in');

    $arrivalEvent = ArrivalEventModel::query()->where('appointment_id', $appointmentId)->first();
    expect($arrivalEvent)->not->toBeNull();
    expect($arrivalEvent->arrival_mode)->toBe('walk_in');
});

it('registers an emergency walk-in with the emergency arrival mode', function (): void {
    $user = receptionUser();
    $patient = receptionPatient();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/reception/walk-ins', [
            'patientId' => $patient->id,
            'arrivalMode' => 'emergency',
        ])
        ->assertCreated();

    $appointmentId = $response->json('data.id');
    $arrivalEvent = ArrivalEventModel::query()->where('appointment_id', $appointmentId)->first();

    expect($arrivalEvent->arrival_mode)->toBe('emergency');
});

it('rejects walk-in registration without both create and update-status permission', function (): void {
    $user = User::factory()->create();
    $user->givePermissionTo('appointments.create');
    $patient = receptionPatient();

    $this->actingAs($user)
        ->postJson('/api/v1/reception/walk-ins', [
            'patientId' => $patient->id,
            'arrivalMode' => 'walk_in',
        ])
        ->assertForbidden();
});

it('rejects an invalid arrival mode for walk-in registration', function (): void {
    $user = receptionUser();
    $patient = receptionPatient();

    $this->actingAs($user)
        ->postJson('/api/v1/reception/walk-ins', [
            'patientId' => $patient->id,
            'arrivalMode' => 'scheduled_checkin',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['arrivalMode']);
});
