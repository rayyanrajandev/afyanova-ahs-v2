<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Phase 4 (Mode B) of reports/queue-based-workflow-modernization-plan.md.
 * Reuses makePatientFlowPatient()/makePatientFlowAppointment()/
 * makePatientFlowLabOrder() from GetActiveVisitJourneyUseCaseTest.php and
 * makeSignedLabOrder()/makeSignedPharmacyOrder()/makeSignedRadiologyOrder()
 * from PatientFlowShadowAutomationTest.php (Pest shares global function
 * scope across sibling test files run in the same directory).
 */
function makePatientFlowUser(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo('appointments.read');

    return $user;
}

it('returns the board with derived steps for active visits', function (): void {
    $user = makePatientFlowUser();
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, ['status' => 'waiting_triage']);

    $this->actingAs($user)
        ->getJson('/api/v1/patient-flow/board')
        ->assertOk()
        ->assertJsonPath('data.0.appointmentId', $appointment->id)
        ->assertJsonPath('data.0.step', 'waiting_triage')
        ->assertJsonPath('data.0.patientName', 'Furaha Ngowi');
});

it('includes a direct-service walk-in on the board with no appointment', function (): void {
    $user = makePatientFlowUser();
    $patient = makePatientFlowPatient();
    makePatientFlowServiceRequest($patient->id, 'pending');

    $this->actingAs($user)
        ->getJson('/api/v1/patient-flow/board')
        ->assertOk()
        ->assertJsonPath('data.0.appointmentId', null)
        ->assertJsonPath('data.0.step', 'waiting_direct_service')
        ->assertJsonPath('data.0.department', 'Laboratory');
});

it('forbids the board without appointments.read', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/patient-flow/board')
        ->assertForbidden();
});

it('returns an empty notifications list when Mode B is disabled by default', function (): void {
    $user = makePatientFlowUser();
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, ['status' => 'in_consultation']);
    makeSignedLabOrder($patient->id, $appointment->id, 'completed');

    $this->actingAs($user)
        ->getJson('/api/v1/patient-flow/notifications')
        ->assertOk()
        ->assertJsonPath('data', []);
});

it('returns completed orders for the requesting clinician when Mode B is enabled', function (): void {
    config(['patient_flow_automation.mode_b_notifications.enabled' => true]);

    $clinician = makePatientFlowUser();
    $otherClinician = makePatientFlowUser();
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, ['status' => 'in_consultation']);

    $ownOrder = makeSignedLabOrder($patient->id, $appointment->id, 'completed');
    $ownOrder->forceFill(['ordered_by_user_id' => $clinician->id, 'resulted_at' => now()])->save();

    $otherOrder = makeSignedLabOrder($patient->id, $appointment->id, 'completed');
    $otherOrder->forceFill(['ordered_by_user_id' => $otherClinician->id, 'resulted_at' => now()])->save();

    $this->actingAs($clinician)
        ->getJson('/api/v1/patient-flow/notifications')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.orderId', $ownOrder->id)
        ->assertJsonPath('data.0.orderType', 'laboratory')
        ->assertJsonPath('data.0.patientName', 'Furaha Ngowi');
});

it('excludes a completed order once its visit is no longer active', function (): void {
    config(['patient_flow_automation.mode_b_notifications.enabled' => true]);

    $clinician = makePatientFlowUser();
    $patient = makePatientFlowPatient();
    $appointment = makePatientFlowAppointment($patient->id, ['status' => 'completed']);

    $order = makeSignedLabOrder($patient->id, $appointment->id, 'completed');
    $order->forceFill(['ordered_by_user_id' => $clinician->id, 'resulted_at' => now()])->save();

    $this->actingAs($clinician)
        ->getJson('/api/v1/patient-flow/notifications')
        ->assertOk()
        ->assertJsonPath('data', []);
});
