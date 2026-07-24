<?php

use App\Models\User;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function setConsultationCandidatesCutoverFlags(bool $master, bool $consultation): void
{
    $flags = config('feature_flags.flags');
    $flags['pricing.engine.v2']['enabled'] = $master;
    $flags['pricing.engine.v2.consultation']['enabled'] = $consultation;
    config(['feature_flags.flags' => $flags]);
}

function makeConsultationCandidateUser(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo('billing.invoices.create');
    $user->givePermissionTo('billing.invoices.read');

    return $user;
}

function makeConsultationCandidatePatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PT'.now()->format('Ymd').strtoupper(Str::random(6)),
        'first_name' => 'Consultation', 'last_name' => 'Candidate', 'gender' => 'female',
        'date_of_birth' => '1990-01-01', 'phone' => '+255700000044', 'country_code' => 'TZ', 'status' => 'active',
    ]);
}

function makeConsultationCandidateClinician(): User
{
    $user = User::factory()->create();
    StaffProfileModel::query()->create([
        'user_id' => $user->id, 'employee_number' => 'EMP'.strtoupper(Str::random(6)),
        'department' => 'General OPD', 'job_title' => 'Clinical Officer', 'license_type' => 'CO',
        'employment_type' => 'full_time', 'status' => 'active',
    ]);

    return $user;
}

function makeConsultationCandidateAppointment(string $patientId, ?int $clinicianUserId = null): AppointmentModel
{
    return AppointmentModel::query()->create([
        'appointment_number' => 'APT'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'clinician_user_id' => $clinicianUserId,
        'consultation_owner_user_id' => $clinicianUserId,
        'department' => 'General OPD',
        'scheduled_at' => now()->subHour()->toDateTimeString(),
        'consultation_started_at' => now()->subMinutes(30)->toDateTimeString(),
        'status' => 'completed',
    ]);
}

function setUpConsultationCandidateMapping(float $legacyPrice, float $newResolverPrice): BillingServiceCatalogItemModel
{
    $tariff = BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'CONSULT-CO-GENERAL-OPD', 'service_name' => 'CO General OPD Consultation',
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

    return $tariff;
}

it('consultationCandidates never checks the mapping when cutover flags are off (parity proof)', function (): void {
    setConsultationCandidatesCutoverFlags(master: false, consultation: false);

    setUpConsultationCandidateMapping(legacyPrice: 15000, newResolverPrice: 22000);
    $patient = makeConsultationCandidatePatient();
    $clinician = makeConsultationCandidateClinician();
    makeConsultationCandidateAppointment($patient->id, $clinician->id);

    $candidate = $this->actingAs(makeConsultationCandidateUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(15000.0)
        ->and($candidate['pricingSource'])->toBe('service_catalog');
});

it('consultationCandidates gains the mapping check and cuts over to the chargeable_item price once both flags are on', function (): void {
    setConsultationCandidatesCutoverFlags(master: true, consultation: true);
    setUpConsultationCandidateMapping(legacyPrice: 15000, newResolverPrice: 22000);
    $patient = makeConsultationCandidatePatient();
    $clinician = makeConsultationCandidateClinician();
    makeConsultationCandidateAppointment($patient->id, $clinician->id);

    $candidate = $this->actingAs(makeConsultationCandidateUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(22000.0)
        ->and($candidate['pricingSource'])->toBe('chargeable_item');
});

it('consultationCandidates falls back to the string-matched price when flags are on but no mapping exists for the tier/department', function (): void {
    setConsultationCandidatesCutoverFlags(master: true, consultation: true);
    BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'CONSULT-CO-GENERAL-OPD', 'service_name' => 'CO General OPD Consultation',
        'service_type' => 'consultation', 'department' => 'General OPD', 'unit' => 'visit',
        'base_price' => 15000, 'currency_code' => 'TZS', 'effective_from' => now()->subDay(), 'status' => 'active',
    ]);
    // Deliberately no ConsultationMappingModel row.

    $patient = makeConsultationCandidatePatient();
    $clinician = makeConsultationCandidateClinician();
    makeConsultationCandidateAppointment($patient->id, $clinician->id);

    $candidate = $this->actingAs(makeConsultationCandidateUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(15000.0)
        ->and($candidate['pricingSource'])->toBe('service_catalog');
});
