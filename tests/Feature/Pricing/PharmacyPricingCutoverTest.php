<?php

use App\Models\User;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/**
 * Pharmacy is the first domain where charge_model=per_unit actually matters
 * end-to-end (Laboratory/Radiology are flat -- quantity is always 1
 * regardless of what's passed in). This file specifically proves quantity
 * dispensed drives the billed quantity through the new resolver, not just
 * that the same generic on/off mechanism reaches a third domain.
 */
function setPharmacyPricingFlags(bool $master, bool $pharmacy): void
{
    $flags = config('feature_flags.flags');
    $flags['pricing.engine.v2']['enabled'] = $master;
    $flags['pricing.engine.v2.pharmacy']['enabled'] = $pharmacy;
    config(['feature_flags.flags' => $flags]);
}

function makePharmacyCutoverUser(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo('billing.invoices.create');
    $user->givePermissionTo('billing.invoices.read');

    return $user;
}

function makePharmacyCutoverPatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PT'.now()->format('Ymd').strtoupper(Str::random(6)),
        'first_name' => 'Pharmacy',
        'last_name' => 'Cutover',
        'gender' => 'male',
        'date_of_birth' => '1988-01-01',
        'phone' => '+255700000066',
        'country_code' => 'TZ',
        'status' => 'active',
    ]);
}

function makePharmacyCutoverOrder(string $patientId, string $chargeableItemId, float $quantityDispensed): PharmacyOrderModel
{
    return PharmacyOrderModel::query()->create([
        'order_number' => 'RX'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'approved_medicine_catalog_item_id' => $chargeableItemId,
        'ordered_at' => now()->subHours(2)->toDateTimeString(),
        'medication_code' => 'ATC:N02BE01',
        'medication_name' => 'Paracetamol 500mg',
        'dosage_instruction' => 'Take 1 tablet twice daily',
        'quantity_prescribed' => $quantityDispensed,
        'quantity_dispensed' => $quantityDispensed,
        'dispensed_at' => now()->subHour()->toDateTimeString(),
        'status' => 'dispensed',
        'entry_state' => 'active',
    ]);
}

function setUpPharmacyCutover(float $legacyUnitPrice, float $newResolverUnitPrice): ClinicalCatalogItemModel
{
    $catalogItem = ClinicalCatalogItemModel::query()->create([
        'catalog_type' => 'formulary_item', 'code' => 'ATC:N02BE01', 'name' => 'Paracetamol 500mg', 'unit' => 'tablet', 'status' => 'active',
    ]);

    $chargeableItem = new ChargeableItemModel();
    $chargeableItem->id = $catalogItem->id;
    $chargeableItem->fill([
        'catalog_type' => 'formulary_item', 'charge_model' => 'per_unit', 'code' => 'ATC:N02BE01', 'name' => 'Paracetamol 500mg', 'status' => 'active',
    ]);
    $chargeableItem->save();

    PriceBookEntryModel::query()->create([
        'chargeable_item_id' => $catalogItem->id, 'currency_code' => 'TZS', 'unit_price' => $newResolverUnitPrice, 'status' => 'active',
    ]);

    BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'ATC:N02BE01', 'service_name' => 'Paracetamol 500mg', 'service_type' => 'pharmacy',
        'unit' => 'tablet', 'base_price' => $legacyUnitPrice, 'currency_code' => 'TZS', 'effective_from' => now()->subDay(), 'status' => 'active',
    ]);

    return $catalogItem;
}

it('serves the legacy price for pharmacy when both cutover flags are off', function (): void {
    setPharmacyPricingFlags(master: false, pharmacy: false);

    $catalogItem = setUpPharmacyCutover(legacyUnitPrice: 200, newResolverUnitPrice: 250);
    $patient = makePharmacyCutoverPatient();
    makePharmacyCutoverOrder($patient->id, $catalogItem->id, quantityDispensed: 20);

    $candidate = $this->actingAs(makePharmacyCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(200.0)
        ->and((float) $candidate['quantity'])->toBe(20.0)
        ->and((float) $candidate['lineTotal'])->toBe(4000.0);
});

it('serves the new resolver price for pharmacy once cut over, still billing the real quantity dispensed', function (): void {
    setPharmacyPricingFlags(master: true, pharmacy: true);

    $catalogItem = setUpPharmacyCutover(legacyUnitPrice: 200, newResolverUnitPrice: 250);
    $patient = makePharmacyCutoverPatient();
    makePharmacyCutoverOrder($patient->id, $catalogItem->id, quantityDispensed: 20);

    $candidate = $this->actingAs(makePharmacyCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(250.0)
        ->and((float) $candidate['quantity'])->toBe(20.0)
        ->and((float) $candidate['lineTotal'])->toBe(5000.0)
        ->and($candidate['pricingSource'])->toBe('chargeable_item');
});

it('bills a fractional quantity dispensed correctly once cut over (per_unit does not round like per_day)', function (): void {
    setPharmacyPricingFlags(master: true, pharmacy: true);

    $catalogItem = setUpPharmacyCutover(legacyUnitPrice: 200, newResolverUnitPrice: 250);
    $patient = makePharmacyCutoverPatient();
    makePharmacyCutoverOrder($patient->id, $catalogItem->id, quantityDispensed: 2.5);

    $candidate = $this->actingAs(makePharmacyCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['quantity'])->toBe(2.5)
        ->and((float) $candidate['lineTotal'])->toBe(625.0);
});
