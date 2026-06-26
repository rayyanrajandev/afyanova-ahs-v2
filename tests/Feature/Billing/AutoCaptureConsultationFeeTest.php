<?php

use App\Models\User;
use App\Http\Middleware\EnforceTenantIsolationWhenEnabled;
use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Billing\Infrastructure\Models\BillingInvoiceModel;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileSpecialtyModel;
use App\Modules\Staff\Infrastructure\Models\StaffRegulatoryProfileModel;
use App\Modules\Staff\Infrastructure\Models\ClinicalSpecialtyModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(EnforceTenantIsolationWhenEnabled::class);
    $this->withoutMiddleware(EnsureFacilitySubscriptionEntitlement::class);
    $this->withoutMiddleware(EnsureMappedFacilitySubscriptionEntitlement::class);
});

function makeAutoCapturePatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PT-'.strtoupper(Str::random(8)),
        'first_name' => 'Auto',
        'last_name' => 'Capture',
        'gender' => 'female',
        'date_of_birth' => '1990-01-15',
        'country_code' => 'TZ',
        'status' => 'active',
    ]);
}

function makeAutoCaptureClinician(): User
{
    $user = User::factory()->create();

    $profile = StaffProfileModel::query()->create([
        'user_id' => $user->id,
        'employee_number' => 'DOC-'.strtoupper(Str::random(6)),
        'department' => 'Outpatient',
        'job_title' => 'Medical Doctor',
        'license_type' => 'MD',
        'employment_type' => 'full_time',
        'status' => 'active',
    ]);

    StaffRegulatoryProfileModel::query()->create([
        'staff_profile_id' => $profile->id,
        'primary_regulator_code' => 'TZ-MEDICAL-BOARD',
        'cadre_code' => 'MD',
        'professional_title' => 'Medical Doctor',
        'registration_type' => 'full',
        'practice_authority_level' => 'full',
        'supervision_level' => 'none',
        'good_standing_status' => 'active',
    ]);

    $specialty = ClinicalSpecialtyModel::query()->create([
        'code' => 'GENERAL',
        'name' => 'General Medicine',
        'status' => 'active',
    ]);

    StaffProfileSpecialtyModel::query()->create([
        'staff_profile_id' => $profile->id,
        'specialty_id' => $specialty->id,
        'is_primary' => true,
    ]);

    return $user;
}

function makeAutoCaptureConsultationTariff(): BillingServiceCatalogItemModel
{
    return BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'CONSULT-MD-OUTPATIENT',
        'service_name' => 'Medical Doctor Consultation - Outpatient',
        'service_type' => 'consultation',
        'department' => 'Outpatient',
        'unit' => 'visit',
        'base_price' => 35000,
        'currency_code' => 'TZS',
        'tax_rate_percent' => 0,
        'is_taxable' => false,
        'effective_from' => now()->subDay()->toDateTimeString(),
        'effective_to' => null,
        'description' => 'Consultation fee auto-capture tariff',
        'metadata' => null,
        'status' => 'active',
        'status_reason' => null,
    ]);
}

function makeAutoCaptureAppointment(string $patientId, int $clinicianUserId, array $overrides = []): AppointmentModel
{
    return AppointmentModel::query()->create(array_merge([
        'appointment_number' => 'APT-'.strtoupper(Str::random(8)),
        'patient_id' => $patientId,
        'clinician_user_id' => $clinicianUserId,
        'consultation_owner_user_id' => $clinicianUserId,
        'department' => 'Outpatient',
        'status' => 'checked_in',
        'scheduled_at' => now()->subHours(2),
        'checked_in_at' => now()->subHours(1)->toDateTimeString(),
        'duration_minutes' => 30,
        'reason' => 'General checkup',
        'encounter_started_at' => now()->subMinutes(45)->toDateTimeString(),
        'consultation_started_at' => now()->subMinutes(30)->toDateTimeString(),
    ], $overrides));
}

function withAutoCaptureScope(int $userId): array
{
    $tenantId = (string) Str::uuid();
    $facilityId = (string) Str::uuid();

    DB::table('tenants')->insert([
        'id' => $tenantId,
        'code' => 'TZ-AUTO',
        'name' => 'Auto Capture Test',
        'country_code' => 'TZ',
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('facilities')->insert([
        'id' => $facilityId,
        'tenant_id' => $tenantId,
        'code' => 'DAR-AUTO',
        'name' => 'Dar Auto Capture',
        'facility_type' => 'hospital',
        'timezone' => 'Africa/Dar_es_Salaam',
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('facility_user')->insert([
        'facility_id' => $facilityId,
        'user_id' => $userId,
        'role' => 'clinician',
        'is_primary' => true,
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return [
        'tenantId' => $tenantId,
        'facilityId' => $facilityId,
        'headers' => [
            'X-Tenant-Code' => 'TZ-AUTO',
            'X-Facility-Code' => 'DAR-AUTO',
        ],
    ];
}

it('auto-captures consultation fee when appointment status becomes completed', function (): void {
    $user = makeAutoCaptureClinician();
    $scope = withAutoCaptureScope($user->id);
    $patient = makeAutoCapturePatient();
    $tariff = makeAutoCaptureConsultationTariff();
    $appointment = makeAutoCaptureAppointment($patient->id, $user->id);

    $user->givePermissionTo('appointments.update-status');

    $this->actingAs($user)
        ->patchJson(
            '/api/v1/appointments/'.$appointment->id.'/status',
            ['status' => 'completed'],
            $scope['headers'],
        )
        ->assertOk();

    $invoices = BillingInvoiceModel::query()
        ->where('patient_id', $patient->id)
        ->where('appointment_id', $appointment->id)
        ->get();

    expect($invoices)->toHaveCount(1);

    $invoice = $invoices->first();
    expect($invoice->status)->toBe('draft');

    $lineItems = $invoice->line_items ?? [];
    expect($lineItems)->toHaveCount(1);
    expect($lineItems[0]['sourceWorkflowKind'])->toBe('appointment_consultation');
    expect($lineItems[0]['sourceWorkflowId'])->toBe((string) $appointment->id);
    expect((float) $invoice->total_amount)->toBe(35000.0);
    expect((float) $invoice->balance_amount)->toBe(35000.0);
});

it('does not duplicate consultation invoice on second completed transition', function (): void {
    $user = makeAutoCaptureClinician();
    $scope = withAutoCaptureScope($user->id);
    $patient = makeAutoCapturePatient();
    $tariff = makeAutoCaptureConsultationTariff();
    $appointment = makeAutoCaptureAppointment($patient->id, $user->id);

    $user->givePermissionTo('appointments.update-status');

    $this->actingAs($user)
        ->patchJson(
            '/api/v1/appointments/'.$appointment->id.'/status',
            ['status' => 'completed'],
            $scope['headers'],
        )
        ->assertOk();

    $this->actingAs($user)
        ->patchJson(
            '/api/v1/appointments/'.$appointment->id.'/status',
            ['status' => 'completed'],
            $scope['headers'],
        )
        ->assertOk();

    $invoices = BillingInvoiceModel::query()
        ->where('patient_id', $patient->id)
        ->where('appointment_id', $appointment->id)
        ->get();

    expect($invoices)->toHaveCount(1);
});

it('creates draft invoice with correct consultation service name for MD clinician', function (): void {
    $user = makeAutoCaptureClinician();
    $scope = withAutoCaptureScope($user->id);
    $patient = makeAutoCapturePatient();
    $tariff = makeAutoCaptureConsultationTariff();
    $appointment = makeAutoCaptureAppointment($patient->id, $user->id);

    $user->givePermissionTo('appointments.update-status');

    $this->actingAs($user)
        ->patchJson(
            '/api/v1/appointments/'.$appointment->id.'/status',
            ['status' => 'completed'],
            $scope['headers'],
        )
        ->assertOk();

    $invoice = BillingInvoiceModel::query()
        ->where('patient_id', $patient->id)
        ->where('appointment_id', $appointment->id)
        ->first();

    expect($invoice)->not->toBeNull();

    $lineItem = $invoice->line_items[0] ?? [];
    expect($lineItem['description'] ?? '')->toContain('Consultation');
});

it('does not auto-capture when appointment transitions to non-completed status', function (): void {
    $user = makeAutoCaptureClinician();
    $scope = withAutoCaptureScope($user->id);
    $patient = makeAutoCapturePatient();
    $tariff = makeAutoCaptureConsultationTariff();
    $appointment = makeAutoCaptureAppointment($patient->id, $user->id);

    $user->givePermissionTo('appointments.update-status');

    $this->actingAs($user)
        ->patchJson(
            '/api/v1/appointments/'.$appointment->id.'/status',
            ['status' => 'cancelled', 'reason' => 'Patient no-show'],
            $scope['headers'],
        )
        ->assertOk();

    $invoices = BillingInvoiceModel::query()
        ->where('patient_id', $patient->id)
        ->where('appointment_id', $appointment->id)
        ->get();

    expect($invoices)->toHaveCount(0);
});

it('auto-captures even when no catalog pricing exists using fallback service code', function (): void {
    $user = makeAutoCaptureClinician();
    $scope = withAutoCaptureScope($user->id);
    $patient = makeAutoCapturePatient();
    $appointment = makeAutoCaptureAppointment($patient->id, $user->id);

    $user->givePermissionTo('appointments.update-status');

    $this->actingAs($user)
        ->patchJson(
            '/api/v1/appointments/'.$appointment->id.'/status',
            ['status' => 'completed'],
            $scope['headers'],
        )
        ->assertOk();

    $invoices = BillingInvoiceModel::query()
        ->where('patient_id', $patient->id)
        ->where('appointment_id', $appointment->id)
        ->get();

    expect($invoices)->toHaveCount(1);

    $invoice = $invoices->first();
    expect($invoice->status)->toBe('draft');
    expect((float) $invoice->total_amount)->toBe(0.0);
    expect((float) $invoice->balance_amount)->toBe(0.0);
});

it('auto-capture does not break when clinician has no staff profile', function (): void {
    $patient = makeAutoCapturePatient();
    $tariff = makeAutoCaptureConsultationTariff();

    $noProfileUser = User::factory()->create();
    $scope = withAutoCaptureScope($noProfileUser->id);
    $noProfileUser->givePermissionTo('appointments.update-status');

    $appointment = AppointmentModel::query()->create([
        'appointment_number' => 'APT-'.strtoupper(Str::random(8)),
        'patient_id' => $patient->id,
        'clinician_user_id' => $noProfileUser->id,
        'department' => 'Outpatient',
        'status' => 'checked_in',
        'scheduled_at' => now()->subHours(2),
        'duration_minutes' => 30,
        'reason' => 'General checkup',
    ]);

    $this->actingAs($noProfileUser)
        ->patchJson(
            '/api/v1/appointments/'.$appointment->id.'/status',
            ['status' => 'completed'],
            $scope['headers'],
        )
        ->assertOk();

    $invoices = BillingInvoiceModel::query()
        ->where('patient_id', $patient->id)
        ->where('appointment_id', $appointment->id)
        ->get();

    expect($invoices)->toHaveCount(1);
});
