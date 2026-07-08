<?php

use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Reception\Application\Listeners\LogShadowEmergencyTriageCaseCreation;
use App\Modules\Reception\Domain\Events\AppointmentCheckedIn;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/**
 * Coverage for Phase 5 Mode B of
 * reports/patient-arrival-checkin-modernization-plan.md §3.3 (decided to
 * start as soon as Phase 4 shipped): CheckInUseCase dispatches
 * AppointmentCheckedIn after its transaction commits, and a listener logs —
 * never writes — what a Mode C skeleton EmergencyTriageCase creation would
 * look like, for emergency arrivals only.
 */
function shadowAutomationPatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PTSHD'.now()->format('Ymd').strtoupper(Str::random(6)),
        'first_name' => 'Shadow', 'last_name' => 'Automation', 'gender' => 'female',
        'date_of_birth' => '1993-03-03', 'phone' => '+255700000019', 'country_code' => 'TZ',
        'status' => 'active',
    ]);
}

function shadowAutomationUser(): User
{
    $user = User::factory()->create();
    foreach (['appointments.read', 'appointments.create', 'appointments.update-status'] as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

it('dispatches AppointmentCheckedIn with the correct payload after check-in commits', function (): void {
    Event::fake([AppointmentCheckedIn::class]);

    $user = shadowAutomationUser();
    $patient = shadowAutomationPatient();

    $appointment = AppointmentModel::query()->create([
        'appointment_number' => 'APTSHD'.strtoupper(Str::random(8)),
        'patient_id' => $patient->id,
        'department' => 'Outpatient',
        'scheduled_at' => now()->addHour(),
        'duration_minutes' => 30,
        'reason' => 'Consultation',
        'status' => 'scheduled',
    ]);

    $this->actingAs($user)
        ->patchJson('/api/v1/appointments/'.$appointment->id.'/check-in', [])
        ->assertOk();

    Event::assertDispatched(AppointmentCheckedIn::class, function (AppointmentCheckedIn $event) use ($appointment, $patient, $user): bool {
        return $event->appointmentId === (string) $appointment->id
            && $event->patientId === (string) $patient->id
            && $event->arrivalMode === 'scheduled_checkin'
            && $event->actorId === $user->id;
    });
});

it('does not dispatch AppointmentCheckedIn when check-in is rejected', function (): void {
    Event::fake([AppointmentCheckedIn::class]);

    $user = shadowAutomationUser();
    $patient = shadowAutomationPatient();

    $appointment = AppointmentModel::query()->create([
        'appointment_number' => 'APTSHD'.strtoupper(Str::random(8)),
        'patient_id' => $patient->id,
        'department' => 'Outpatient',
        'scheduled_at' => now()->addHour(),
        'duration_minutes' => 30,
        'reason' => 'Consultation',
        'status' => 'completed',
    ]);

    $this->actingAs($user)
        ->patchJson('/api/v1/appointments/'.$appointment->id.'/check-in', [])
        ->assertStatus(422);

    Event::assertNotDispatched(AppointmentCheckedIn::class);
});

it('logs the shadow skeleton-triage-case proposal for an emergency walk-in end-to-end', function (): void {
    Log::shouldReceive('channel')
        ->once()
        ->with('reception_shadow_automation')
        ->andReturnSelf();
    Log::shouldReceive('info')
        ->once()
        ->with(
            'Mode B shadow: would create a skeleton EmergencyTriageCase for this arrival',
            \Mockery::on(fn (array $context): bool => $context['mode'] === 'B'
                && $context['proposed_action'] === 'create_skeleton_emergency_triage_case'
                && $context['arrival_mode'] === 'emergency'),
        );

    $user = shadowAutomationUser();
    $patient = shadowAutomationPatient();

    $this->actingAs($user)
        ->postJson('/api/v1/reception/walk-ins', [
            'patientId' => $patient->id,
            'arrivalMode' => 'emergency',
        ])
        ->assertCreated();
});

it('does not log anything for a non-emergency check-in end-to-end', function (): void {
    Log::shouldReceive('channel')->never();

    $user = shadowAutomationUser();
    $patient = shadowAutomationPatient();

    $this->actingAs($user)
        ->postJson('/api/v1/reception/walk-ins', [
            'patientId' => $patient->id,
            'arrivalMode' => 'walk_in',
        ])
        ->assertCreated();
});

it('swallows a logging failure rather than letting it propagate', function (): void {
    Log::shouldReceive('channel')
        ->once()
        ->with('reception_shadow_automation')
        ->andThrow(new RuntimeException('log channel unavailable'));

    $event = new AppointmentCheckedIn(
        appointmentId: (string) Str::uuid(),
        patientId: (string) Str::uuid(),
        arrivalMode: 'emergency',
        actorId: null,
    );

    expect(fn () => (new LogShadowEmergencyTriageCaseCreation())->handle($event))
        ->not->toThrow(RuntimeException::class);
});
