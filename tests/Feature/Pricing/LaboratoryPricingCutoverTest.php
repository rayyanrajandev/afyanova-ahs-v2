<?php

use App\Models\User;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Billing\Infrastructure\Models\PricingEngineShadowDiffModel;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/**
 * Flag names contain dots ("pricing.engine.v2"), so config()->set() with a
 * dotted path silently creates a useless parallel nested structure instead
 * of touching the real flag (Arr::set() walks segment-by-segment and has no
 * "check the full literal key first" shortcut the way Arr::get() does) --
 * confirmed against this exact codebase's ConfigFeatureFlagRepository,
 * which reads the whole feature_flags.flags array as one literal-keyed
 * array, not a nested one. Overriding a flag correctly means mutating that
 * whole array in one config() call, not a dotted sub-path.
 */
function setPricingEngineFlags(bool $master, bool $laboratory): void
{
    $flags = config('feature_flags.flags');
    $flags['pricing.engine.v2']['enabled'] = $master;
    $flags['pricing.engine.v2.laboratory']['enabled'] = $laboratory;
    config(['feature_flags.flags' => $flags]);
}

function makeCutoverUser(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo('billing.invoices.create');
    $user->givePermissionTo('billing.invoices.read');

    return $user;
}

function makeCutoverPatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PT'.now()->format('Ymd').strtoupper(Str::random(6)),
        'first_name' => 'Cutover',
        'last_name' => 'Test',
        'gender' => 'male',
        'date_of_birth' => '1985-01-01',
        'phone' => '+255700000088',
        'country_code' => 'TZ',
        'status' => 'active',
    ]);
}

function makeCutoverLabOrder(string $patientId, string $chargeableItemId): LaboratoryOrderModel
{
    return LaboratoryOrderModel::query()->create([
        'order_number' => 'LAB'.now()->format('Ymd').strtoupper(Str::random(6)),
        'patient_id' => $patientId,
        'ordered_at' => now()->subHours(2)->toDateTimeString(),
        'lab_test_catalog_item_id' => $chargeableItemId,
        'test_code' => 'LOINC:57021-8',
        'test_name' => 'Complete Blood Count',
        'priority' => 'routine',
        'specimen_type' => 'Blood',
        'resulted_at' => now()->subHour()->toDateTimeString(),
        'status' => 'completed',
    ]);
}

function makeCutoverRadiologyOrder(string $patientId, string $chargeableItemId): RadiologyOrderModel
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

function makeCutoverLabTariff(array $overrides = []): BillingServiceCatalogItemModel
{
    return BillingServiceCatalogItemModel::query()->create(array_merge([
        'service_code' => 'LOINC:57021-8',
        'service_name' => 'Complete Blood Count',
        'service_type' => 'laboratory',
        'unit' => 'test',
        'base_price' => 12000,
        'currency_code' => 'TZS',
        'effective_from' => now()->subDay(),
        'status' => 'active',
    ], $overrides));
}

/**
 * 'id' is deliberately not in ChargeableItemModel::$fillable (matches the
 * production backfill's own reasoning), so ::create(['id' => ...]) silently
 * drops it under mass-assignment protection and HasUuids generates a random
 * one instead -- exactly the bug PricingBackfillChargeableItems.php avoids
 * by setting ->id directly before ->save(). Mirror that here.
 */
function makeChargeableItemWithId(string $id, array $attributes): ChargeableItemModel
{
    $item = new ChargeableItemModel();
    $item->id = $id;
    $item->fill($attributes);
    $item->save();

    return $item;
}

function setUpCutoverCatalogAndPrice(float $legacyPrice, float $newResolverPrice): ClinicalCatalogItemModel
{
    $catalogItem = ClinicalCatalogItemModel::query()->create([
        'catalog_type' => 'lab_test', 'code' => 'LAB-CBC', 'name' => 'CBC', 'unit' => 'test', 'status' => 'active',
    ]);

    makeChargeableItemWithId($catalogItem->id, [
        'catalog_type' => 'lab_test', 'charge_model' => 'flat', 'code' => 'LAB-CBC', 'name' => 'CBC', 'status' => 'active',
    ]);

    PriceBookEntryModel::query()->create([
        'chargeable_item_id' => $catalogItem->id, 'currency_code' => 'TZS', 'unit_price' => $newResolverPrice, 'status' => 'active',
    ]);

    return $catalogItem;
}

it('serves the legacy price when both cutover flags default off', function (): void {
    $catalogItem = setUpCutoverCatalogAndPrice(legacyPrice: 12000, newResolverPrice: 20000);
    $patient = makeCutoverPatient();
    makeCutoverLabOrder($patient->id, $catalogItem->id);
    makeCutoverLabTariff(['base_price' => 12000]);

    $candidate = $this->actingAs(makeCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(12000.0);
});

it('serves the new resolver price once both the master and laboratory flags are on', function (): void {
    setPricingEngineFlags(master: true, laboratory: true);

    $catalogItem = setUpCutoverCatalogAndPrice(legacyPrice: 12000, newResolverPrice: 20000);
    $patient = makeCutoverPatient();
    makeCutoverLabOrder($patient->id, $catalogItem->id);
    makeCutoverLabTariff(['base_price' => 12000]);

    $candidate = $this->actingAs(makeCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(20000.0)
        ->and($candidate['pricingSource'])->toBe('chargeable_item');
});

it('stays on the legacy price when only the domain flag is on but the master flag is off', function (): void {
    setPricingEngineFlags(master: false, laboratory: true);

    $catalogItem = setUpCutoverCatalogAndPrice(legacyPrice: 12000, newResolverPrice: 20000);
    $patient = makeCutoverPatient();
    makeCutoverLabOrder($patient->id, $catalogItem->id);
    makeCutoverLabTariff(['base_price' => 12000]);

    $candidate = $this->actingAs(makeCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(12000.0);
});

it('stays on the legacy price when only the master flag is on but the domain flag is off', function (): void {
    setPricingEngineFlags(master: true, laboratory: false);

    $catalogItem = setUpCutoverCatalogAndPrice(legacyPrice: 12000, newResolverPrice: 20000);
    $patient = makeCutoverPatient();
    makeCutoverLabOrder($patient->id, $catalogItem->id);
    makeCutoverLabTariff(['base_price' => 12000]);

    $candidate = $this->actingAs(makeCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(12000.0);
});

it('cutting over laboratory does not affect radiology pricing (per-domain isolation)', function (): void {
    setPricingEngineFlags(master: true, laboratory: true);
    // pricing.engine.v2.radiology deliberately not set/enabled.

    $patient = makeCutoverPatient();

    $labCatalogItem = setUpCutoverCatalogAndPrice(legacyPrice: 12000, newResolverPrice: 20000);
    makeCutoverLabOrder($patient->id, $labCatalogItem->id);
    makeCutoverLabTariff(['base_price' => 12000]);

    $radiologyCatalogItem = ClinicalCatalogItemModel::query()->create([
        'catalog_type' => 'radiology_procedure', 'code' => 'RAD-ABD-001', 'name' => 'Abdominal Ultrasound', 'unit' => 'study', 'status' => 'active',
    ]);
    makeChargeableItemWithId($radiologyCatalogItem->id, [
        'catalog_type' => 'radiology_procedure', 'charge_model' => 'flat', 'code' => 'RAD-ABD-001', 'name' => 'Abdominal Ultrasound', 'status' => 'active',
    ]);
    PriceBookEntryModel::query()->create([
        'chargeable_item_id' => $radiologyCatalogItem->id, 'currency_code' => 'TZS', 'unit_price' => 99000, 'status' => 'active',
    ]);
    makeCutoverRadiologyOrder($patient->id, $radiologyCatalogItem->id);
    BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'RAD-ABD-001', 'service_name' => 'Abdominal Ultrasound', 'service_type' => 'radiology',
        'unit' => 'study', 'base_price' => 60000, 'currency_code' => 'TZS', 'effective_from' => now()->subDay(), 'status' => 'active',
    ]);

    $candidates = $this->actingAs(makeCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data');

    $labCandidate = collect($candidates)->firstWhere('sourceWorkflowKind', 'laboratory_order');
    $radiologyCandidate = collect($candidates)->firstWhere('sourceWorkflowKind', 'radiology_order');

    expect((float) $labCandidate['unitPrice'])->toBe(20000.0)
        ->and((float) $radiologyCandidate['unitPrice'])->toBe(60000.0);
});

it('still dispatches shadow-diff comparisons after a domain has cut over', function (): void {
    setPricingEngineFlags(master: true, laboratory: true);

    $catalogItem = setUpCutoverCatalogAndPrice(legacyPrice: 12000, newResolverPrice: 20000);
    $patient = makeCutoverPatient();
    makeCutoverLabOrder($patient->id, $catalogItem->id);
    makeCutoverLabTariff(['base_price' => 12000]);

    $this->actingAs(makeCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk();

    $diff = PricingEngineShadowDiffModel::query()->first();
    expect($diff)->not->toBeNull()
        ->and((float) $diff->legacy_unit_price)->toBe(12000.0)
        ->and((float) $diff->new_unit_price)->toBe(20000.0)
        ->and($diff->matched)->toBeFalse()
        ->and($diff->mismatch_reason)->toBe('price_differs');
});

it('falls back to missing_catalog_price rather than crashing when cut over with no price book entry', function (): void {
    setPricingEngineFlags(master: true, laboratory: true);

    $catalogItem = ClinicalCatalogItemModel::query()->create([
        'catalog_type' => 'lab_test', 'code' => 'LAB-CBC', 'name' => 'CBC', 'unit' => 'test', 'status' => 'active',
    ]);
    makeChargeableItemWithId($catalogItem->id, [
        'catalog_type' => 'lab_test', 'charge_model' => 'flat', 'code' => 'LAB-CBC', 'name' => 'CBC', 'status' => 'active',
    ]);
    // Deliberately no PriceBookEntryModel row.

    $patient = makeCutoverPatient();
    makeCutoverLabOrder($patient->id, $catalogItem->id);
    makeCutoverLabTariff(['base_price' => 12000]);

    $candidate = $this->actingAs(makeCutoverUser())
        ->getJson('/api/v1/billing/charge-capture-candidates?patientId='.$patient->id.'&currencyCode=TZS')
        ->assertOk()
        ->json('data.0');

    expect((float) $candidate['unitPrice'])->toBe(0.0)
        ->and($candidate['pricingStatus'])->toBe('missing_catalog_price');
});
