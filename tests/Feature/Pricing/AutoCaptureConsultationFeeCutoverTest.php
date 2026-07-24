<?php

use App\Http\Middleware\EnforceTenantIsolationWhenEnabled;
use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use App\Models\User;
use App\Modules\Appointment\Application\UseCases\UpdateAppointmentStatusUseCase;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Billing\Infrastructure\Models\BillingInvoiceModel;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use App\Modules\Staff\Infrastructure\Models\ClinicalSpecialtyModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileSpecialtyModel;
use App\Modules\Staff\Infrastructure\Models\StaffRegulatoryProfileModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(EnforceTenantIsolationWhenEnabled::class);
    $this->withoutMiddleware(EnsureFacilitySubscriptionEntitlement::class);
    $this->withoutMiddleware(EnsureMappedFacilitySubscriptionEntitlement::class);
});

function setAutoCaptureCutoverFlags(bool $master, bool $consultation): void
{
    $flags = config('feature_flags.flags');
    $flags['pricing.engine.v2']['enabled'] = $master;
    $flags['pricing.engine.v2.consultation']['enabled'] = $consultation;
    config(['feature_flags.flags' => $flags]);
}

function makeAutoCaptureCutoverPatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PT-'.strtoupper(Str::random(8)),
        'first_name' => 'Cutover', 'last_name' => 'Test', 'gender' => 'male',
        'date_of_birth' => '1990-01-15', 'country_code' => 'TZ', 'status' => 'active',
    ]);
}

function makeAutoCaptureCutoverClinician(): User
{
    $user = User::factory()->create();

    $profile = StaffProfileModel::query()->create([
        'user_id' => $user->id, 'employee_number' => 'DOC-'.strtoupper(Str::random(6)),
        'department' => 'Outpatient', 'job_title' => 'Clinical Officer', 'license_type' => 'CO',
        'employment_type' => 'full_time', 'status' => 'active',
    ]);

    StaffRegulatoryProfileModel::query()->create([
        'staff_profile_id' => $profile->id, 'primary_regulator_code' => 'TZ-CO-BOARD',
        'cadre_code' => 'CO', 'professional_title' => 'Clinical Officer', 'registration_type' => 'full',
        'practice_authority_level' => 'full', 'supervision_level' => 'none', 'good_standing_status' => 'active',
    ]);

    $specialty = ClinicalSpecialtyModel::query()->create(['code' => 'GENERAL-CUTOVER', 'name' => 'General', 'status' => 'active']);
    StaffProfileSpecialtyModel::query()->create(['staff_profile_id' => $profile->id, 'specialty_id' => $specialty->id, 'is_primary' => true]);

    return $user;
}

function makeAutoCaptureCutoverAppointment(string $patientId, int $clinicianUserId): AppointmentModel
{
    return AppointmentModel::query()->create([
        'appointment_number' => 'APT-'.strtoupper(Str::random(8)),
        'patient_id' => $patientId, 'clinician_user_id' => $clinicianUserId, 'consultation_owner_user_id' => $clinicianUserId,
        'department' => 'General OPD', 'status' => 'waiting_provider',
        'scheduled_at' => now()->subHours(2), 'checked_in_at' => now()->subHours(1)->toDateTimeString(),
        'triaged_at' => now()->subMinutes(45)->toDateTimeString(), 'duration_minutes' => 30, 'reason' => 'Checkup',
        'encounter_started_at' => now()->subMinutes(45)->toDateTimeString(),
        'consultation_started_at' => now()->subMinutes(30)->toDateTimeString(),
    ]);
}

function setUpAutoCaptureCutoverMapping(float $legacyPrice, float $newResolverPrice): void
{
    $tariff = BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'CONSULT-CO-GENERAL-OPD-CUTOVER', 'service_name' => 'CO General OPD Consultation',
        'service_type' => 'consultation', 'department' => 'General OPD', 'unit' => 'visit',
        'base_price' => $legacyPrice, 'currency_code' => 'TZS', 'effective_from' => now()->subDay(), 'status' => 'active',
    ]);

    $chargeableItem = new ChargeableItemModel();
    $chargeableItem->fill(['catalog_type' => 'consultation', 'charge_model' => 'flat', 'code' => $tariff->service_code, 'name' => $tariff->service_name, 'status' => 'active']);
    $chargeableItem->save();

    PriceBookEntryModel::query()->create([
        'chargeable_item_id' => $chargeableItem->id, 'currency_code' => 'TZS', 'unit_price' => $newResolverPrice, 'status' => 'active',
    ]);

    ConsultationMappingModel::query()->create([
        'billing_service_catalog_item_id' => $tariff->id,
        'chargeable_item_id' => $chargeableItem->id,
        'clinician_tier' => 'CO',
        'department' => 'General OPD',
    ]);
}

function executeAutoCaptureCutoverTransition(string $appointmentId): void
{
    app(UpdateAppointmentStatusUseCase::class)->execute(id: $appointmentId, status: 'in_consultation', reason: null, actorId: null);
}

it('auto-capture uses the mapping base_price unchanged when cutover flags are off (parity proof)', function (): void {
    setAutoCaptureCutoverFlags(master: false, consultation: false);

    setUpAutoCaptureCutoverMapping(legacyPrice: 15000, newResolverPrice: 20000);
    $patient = makeAutoCaptureCutoverPatient();
    $clinician = makeAutoCaptureCutoverClinician();
    $appointment = makeAutoCaptureCutoverAppointment($patient->id, $clinician->id);

    executeAutoCaptureCutoverTransition($appointment->id);

    $invoice = BillingInvoiceModel::query()->where('patient_id', $patient->id)->first();
    expect($invoice)->not->toBeNull()
        ->and((float) $invoice->subtotal_amount)->toBe(15000.0);
});

it('auto-capture uses the chargeable_item price once both cutover flags are on', function (): void {
    setAutoCaptureCutoverFlags(master: true, consultation: true);
    setUpAutoCaptureCutoverMapping(legacyPrice: 15000, newResolverPrice: 20000);
    $patient = makeAutoCaptureCutoverPatient();
    $clinician = makeAutoCaptureCutoverClinician();
    $appointment = makeAutoCaptureCutoverAppointment($patient->id, $clinician->id);

    executeAutoCaptureCutoverTransition($appointment->id);

    $invoice = BillingInvoiceModel::query()->where('patient_id', $patient->id)->first();
    expect($invoice)->not->toBeNull()
        ->and((float) $invoice->subtotal_amount)->toBe(20000.0);
});

it('auto-capture still uses base_price when flags are on but the mapping has no chargeable_item_id yet', function (): void {
    setAutoCaptureCutoverFlags(master: true, consultation: true);

    $tariff = BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'CONSULT-CO-GENERAL-OPD-NOMIG', 'service_name' => 'CO Unmigrated Consultation',
        'service_type' => 'consultation', 'department' => 'General OPD', 'unit' => 'visit',
        'base_price' => 15000, 'currency_code' => 'TZS', 'effective_from' => now()->subDay(), 'status' => 'active',
    ]);
    ConsultationMappingModel::query()->create([
        'billing_service_catalog_item_id' => $tariff->id,
        'clinician_tier' => 'CO',
        'department' => 'General OPD',
    ]);

    $patient = makeAutoCaptureCutoverPatient();
    $clinician = makeAutoCaptureCutoverClinician();
    $appointment = makeAutoCaptureCutoverAppointment($patient->id, $clinician->id);

    executeAutoCaptureCutoverTransition($appointment->id);

    $invoice = BillingInvoiceModel::query()->where('patient_id', $patient->id)->first();
    expect((float) $invoice->subtotal_amount)->toBe(15000.0);
});
