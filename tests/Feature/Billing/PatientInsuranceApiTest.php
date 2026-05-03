<?php

use App\Models\User;
use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use App\Modules\Billing\Infrastructure\Models\BillingPayerContractModel;
use App\Modules\Billing\Infrastructure\Models\PatientInsuranceAuditEventModel;
use App\Modules\Billing\Infrastructure\Models\PatientInsuranceModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(EnsureFacilitySubscriptionEntitlement::class);
    $this->withoutMiddleware(EnsureMappedFacilitySubscriptionEntitlement::class);
});

function makePatientInsuranceUser(array $permissions = []): User
{
    $user = User::factory()->create();
    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

function createPatientForInsurance(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PT-INS-'.strtoupper(Str::random(6)),
        'first_name' => 'Insurance',
        'last_name' => 'Patient',
        'gender' => 'female',
        'date_of_birth' => '1990-05-10',
        'country_code' => 'TZ',
        'status' => 'active',
    ]);
}

function createInsurancePayerContract(): BillingPayerContractModel
{
    return BillingPayerContractModel::query()->create([
        'contract_code' => 'NHIF-STD-'.strtoupper(Str::random(4)),
        'contract_name' => 'NHIF Standard',
        'payer_type' => 'insurance',
        'payer_name' => 'NHIF',
        'payer_plan_code' => 'STD',
        'payer_plan_name' => 'Standard',
        'currency_code' => 'TZS',
        'default_coverage_percent' => 80,
        'default_copay_type' => 'percentage',
        'default_copay_value' => 20,
        'requires_pre_authorization' => false,
        'effective_from' => now()->subDay(),
        'status' => 'active',
    ]);
}

it('stores patient insurance records with payer contract mapping and audit event', function (): void {
    $user = makePatientInsuranceUser(['patients.insurance.manage', 'patients.insurance.read']);
    $patient = createPatientForInsurance();
    $contract = createInsurancePayerContract();

    $this->actingAs($user)
        ->postJson('/api/v1/patients/'.$patient->id.'/insurance', [
            'billingPayerContractId' => $contract->id,
            'insuranceType' => 'insurance',
            'insuranceProvider' => 'NHIF',
            'providerCode' => 'nhif',
            'planName' => 'Standard',
            'memberId' => 'NHIF-12345',
            'policyNumber' => 'POL-2026-1',
            'cardNumber' => 'CARD-12345',
            'effectiveDate' => now()->subDay()->toDateString(),
            'verificationStatus' => 'unverified',
        ])
        ->assertCreated()
        ->assertJsonPath('data.patientId', $patient->id)
        ->assertJsonPath('data.billingPayerContractId', $contract->id)
        ->assertJsonPath('data.memberId', 'NHIF-12345')
        ->assertJsonPath('data.verificationStatus', 'unverified');

    expect(PatientInsuranceModel::query()->where('patient_id', $patient->id)->count())->toBe(1)
        ->and(PatientInsuranceAuditEventModel::query()->where('patient_id', $patient->id)->count())->toBe(1);
});

it('verifies a patient insurance record', function (): void {
    $user = makePatientInsuranceUser(['patients.insurance.verify', 'patients.insurance.read']);
    $patient = createPatientForInsurance();
    $record = PatientInsuranceModel::query()->create([
        'patient_id' => $patient->id,
        'insurance_type' => 'insurance',
        'insurance_provider' => 'NHIF',
        'member_id' => 'NHIF-555',
        'effective_date' => now()->subDay(),
        'status' => 'active',
        'verification_status' => 'unverified',
    ]);

    $this->actingAs($user)
        ->patchJson('/api/v1/patients/'.$patient->id.'/insurance/'.$record->id.'/verify', [
            'verificationStatus' => 'verified',
            'verificationSource' => 'manual',
            'verificationReference' => 'VRF-001',
        ])
        ->assertOk()
        ->assertJsonPath('data.verificationStatus', 'verified')
        ->assertJsonPath('data.verificationReference', 'VRF-001');

    expect($record->fresh()->verification_status)->toBe('verified');
});

