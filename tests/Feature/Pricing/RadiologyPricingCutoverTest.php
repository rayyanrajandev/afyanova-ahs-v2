<?php

use App\Models\User;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/**
 * Radiology reuses the exact same generic cutover mechanism proven by
 * LaboratoryPricingCutoverTest.php (candidatesForKind()'s domain-flag check
 * is driven by ClinicalSourceKind::pricingEngineDomainFlag(), not
 * per-domain code) -- this file only needs to prove the wiring reaches
 * radiology specifically, not re-prove the whole mechanism.
 */
function setRadiologyPricingFlags(bool $master, bool $radiology): void
{
    $flags = config('feature_flags.flags');
    $flags['pricing.engine.v2']['enabled'] = $master;
    $flags['pricing.engine.v2.radiology']['enabled'] = $radiology;
    config(['feature_flags.flags' => $flags]);
}

function makeRadiologyCutoverUser(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo('billing.invoices.create');
    $user->givePermissionTo('billing.invoices.read');

    return $user;
}

function makeRadiologyCutoverPatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PT'.now()->format('Ymd').strtoupper(Str::random(6)),
        'first_name' => 'Radiology',
        'last_name' => 'Cutover',
        'gender' => 'female',
        'date_of_birth' => '1990-01-01',
        'phone' => '+255700000077',
        'country_code' => 'TZ',
        'status' => 'active',
    ]);
}

function makeRadiologyCutoverOrder(string $patientId, string $chargeableItemId): RadiologyOrderModel
{
    return RadiologyOrderModel::query()->create([
        'order_number' => 'RAD'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'ordered_at' => now()->subHours(2)->toDateTimeString(),
        'radiology_procedure_catalog_item_id' => $chargeableItemId,
        'procedure_code' => 'RAD-ABD-001',
        'study_description' => 'Abdominal Ultrasound',
        'modality' => 'ultrasound',
        'completed_at' => now()->subHour()->toDateTimeString(),
        'status' => 'completed',
    ]);
}

function setUpRadiologyCutover(float $legacyPrice, float $newResolverPrice): ClinicalCatalogItemModel
{
    $catalogItem = ClinicalCatalogItemModel::query()->create([
        'catalog_type' => 'radiology_procedure', 'code' => 'RAD-ABD-001', 'name' => 'Abdominal Ultrasound', 'unit' => 'study', 'status' => 'active',
    ]);

    $chargeableItem = new ChargeableItemModel();
    $chargeableItem->id = $catalogItem->id;
    $chargeableItem->fill([
        'catalog_type' => 'radiology_procedure', 'charge_model' => 'flat', 'code' => 'RAD-ABD-001', 'name' => 'Abdominal Ultrasound', 'status' => 'active',
    ]);
    $chargeableItem->save();

    PriceBookEntryModel::query()->create([
        'chargeable_item_id' => $catalogItem->id, 'currency_code' => 'TZS', 'unit_price' => $newResolverPrice, 'status' => 'active',
    ]);

    BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'RAD-ABD-001', 'service_name' => 'Abdominal Ultrasound', 'service_type' => 'radiology',
        'unit' => 'study', 'base_price' => $legacyPrice, 'currency_code' => 'TZS', 'effective_from' => now()->subDay(), 'status' => 'active',
    ]);

    return $catalogItem;
}

it('serves the legacy price for radiology when both cutover flags are off', function (): void {
    setRadiologyPricingFlags(master: false, radiology: false);

    $catalogItem = setUpRadiologyCutover(legacyPrice: 60000, newResolverPrice: 99000);
    $patient = makeRadiologyCutoverPatient();
    makeRadiologyCutoverOrder($patient->id, $catalogItem->id);

    $candidate = $this->actingAs(makeRadiologyCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(60000.0);
});

it('serves the new resolver price for radiology once cut over', function (): void {
    setRadiologyPricingFlags(master: true, radiology: true);

    $catalogItem = setUpRadiologyCutover(legacyPrice: 60000, newResolverPrice: 99000);
    $patient = makeRadiologyCutoverPatient();
    makeRadiologyCutoverOrder($patient->id, $catalogItem->id);

    $candidate = $this->actingAs(makeRadiologyCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(99000.0)
        ->and($candidate['pricingSource'])->toBe('chargeable_item');
});

it('cutting over radiology does not enable laboratory (flags are independent, not just the reverse case)', function (): void {
    $flags = config('feature_flags.flags');
    $flags['pricing.engine.v2.laboratory']['enabled'] = false;
    config(['feature_flags.flags' => $flags]);

    setRadiologyPricingFlags(master: true, radiology: true);
    // pricing.engine.v2.laboratory explicitly forced off above, regardless of its ambient default.

    expect(app(App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface::class)->isEnabled('pricing.engine.v2.laboratory'))
        ->toBeFalse();
});
