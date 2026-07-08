<?php

use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/**
 * Coverage for Phase 4 of reports/patient-arrival-checkin-modernization-plan.md
 * (decided scope, plan §5): GET /reception/queue backed by a live query over
 * AppointmentModel + ArrivalEventModel, ordered emergency > scheduled > walk-in,
 * oldest-wait-first within each tier. Deliberately not a separately-persisted
 * table (see GetReceptionQueueUseCase's docblock) — no synchronization to
 * verify, just the read itself.
 */
function queuePatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PTQ'.now()->format('Ymd').strtoupper(Str::random(6)),
        'first_name' => 'Queue', 'last_name' => 'Fixture', 'gender' => 'male',
        'date_of_birth' => '1985-05-05', 'phone' => '+255700000018', 'country_code' => 'TZ',
        'status' => 'active',
    ]);
}

function queueUser(): User
{
    $user = User::factory()->create();
    foreach (['appointments.read', 'appointments.create', 'appointments.update-status'] as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

function checkInViaApi(User $user, string $patientId, string $arrivalMode, ?string $checkedInMinutesAgo = null): string
{
    if ($arrivalMode === 'scheduled_checkin') {
        $appointment = AppointmentModel::query()->create([
            'appointment_number' => 'APTQ'.strtoupper(Str::random(8)),
            'patient_id' => $patientId,
            'department' => 'Outpatient',
            'scheduled_at' => now()->addHour(),
            'duration_minutes' => 30,
            'reason' => 'Consultation',
            'status' => 'scheduled',
        ]);

        test()->actingAs($user)
            ->patchJson('/api/v1/appointments/'.$appointment->id.'/check-in', [])
            ->assertOk();

        $appointmentId = (string) $appointment->id;
    } else {
        $response = test()->actingAs($user)
            ->postJson('/api/v1/reception/walk-ins', [
                'patientId' => $patientId,
                'arrivalMode' => $arrivalMode,
            ])
            ->assertCreated();

        $appointmentId = (string) $response->json('data.id');
    }

    if ($checkedInMinutesAgo !== null) {
        AppointmentModel::query()->where('id', $appointmentId)->update([
            'checked_in_at' => now()->subMinutes((int) $checkedInMinutesAgo),
        ]);
    }

    return $appointmentId;
}

it('orders the triage queue by arrival-mode tier then oldest wait first', function (): void {
    $user = queueUser();

    // Registered in an order that would be wrong under pure FIFO, to prove
    // tiering actually reorders them: walk-in first (5 min wait), then
    // scheduled (3 min wait), then emergency (1 min wait, i.e. most recent).
    $walkInId = checkInViaApi($user, queuePatient()->id, 'walk_in', '5');
    $scheduledId = checkInViaApi($user, queuePatient()->id, 'scheduled_checkin', '3');
    $emergencyId = checkInViaApi($user, queuePatient()->id, 'emergency', '1');

    $response = $this->actingAs($user)
        ->getJson('/api/v1/reception/queue?stage=waiting_triage')
        ->assertOk();

    $orderedIds = collect($response->json('data'))->pluck('appointmentId')->all();

    expect($orderedIds)->toBe([$emergencyId, $scheduledId, $walkInId]);
});

it('includes the patient name and number, not just the id, in each queue entry', function (): void {
    $user = queueUser();
    $patient = queuePatient();
    $appointmentId = checkInViaApi($user, $patient->id, 'walk_in');

    $response = $this->actingAs($user)
        ->getJson('/api/v1/reception/queue?stage=waiting_triage')
        ->assertOk();

    $entry = collect($response->json('data'))->firstWhere('appointmentId', $appointmentId);

    expect($entry['patientName'])->toBe('Queue Fixture');
    expect($entry['patientNumber'])->toBe($patient->patient_number);
});

it('orders same-tier entries oldest-wait-first', function (): void {
    $user = queueUser();

    $newer = checkInViaApi($user, queuePatient()->id, 'walk_in', '2');
    $older = checkInViaApi($user, queuePatient()->id, 'walk_in', '10');

    $response = $this->actingAs($user)
        ->getJson('/api/v1/reception/queue?stage=waiting_triage')
        ->assertOk();

    $orderedIds = collect($response->json('data'))->pluck('appointmentId')->all();

    expect($orderedIds)->toBe([$older, $newer]);
});

it('rejects a queue request for an unsupported stage', function (): void {
    $user = queueUser();

    $this->actingAs($user)
        ->getJson('/api/v1/reception/queue?stage=completed')
        ->assertStatus(422)
        ->assertJsonValidationErrors(['stage']);
});

it('returns an empty queue when nothing is waiting', function (): void {
    $user = queueUser();

    $this->actingAs($user)
        ->getJson('/api/v1/reception/queue?stage=waiting_provider')
        ->assertOk()
        ->assertJsonPath('data', []);
});

it('forbids queue access without appointments.read permission', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/reception/queue?stage=waiting_triage')
        ->assertForbidden();
});
