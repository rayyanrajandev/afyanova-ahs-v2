<?php

use App\Modules\Billing\Application\Support\ConsultationPricingResolver;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function setConsultationCutoverFlags(bool $master, bool $consultation): void
{
    $flags = config('feature_flags.flags');
    $flags['pricing.engine.v2']['enabled'] = $master;
    $flags['pricing.engine.v2.consultation']['enabled'] = $consultation;
    config(['feature_flags.flags' => $flags]);
}

function makeLinkedConsultationMapping(float $chargeableItemPrice): ConsultationMappingModel
{
    $tariff = BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'CONSULT-CO-GENERAL-OPD', 'service_name' => 'CO Consultation', 'service_type' => 'consultation',
        'unit' => 'visit', 'base_price' => 15000, 'currency_code' => 'TZS', 'effective_from' => now()->subDay(), 'status' => 'active',
    ]);

    $chargeableItem = new ChargeableItemModel();
    $chargeableItem->fill(['catalog_type' => 'consultation', 'charge_model' => 'flat', 'code' => 'CONSULT-CO-GENERAL-OPD', 'name' => 'CO Consultation', 'status' => 'active']);
    $chargeableItem->save();

    PriceBookEntryModel::query()->create([
        'chargeable_item_id' => $chargeableItem->id, 'currency_code' => 'TZS', 'unit_price' => $chargeableItemPrice, 'status' => 'active',
    ]);

    return ConsultationMappingModel::query()->create([
        'billing_service_catalog_item_id' => $tariff->id,
        'chargeable_item_id' => $chargeableItem->id,
        'clinician_tier' => 'CO',
        'department' => 'General OPD',
    ]);
}

it('returns null when the cutover flags are off, regardless of a linked mapping existing', function (): void {
    setConsultationCutoverFlags(master: false, consultation: false);

    makeLinkedConsultationMapping(18000);

    $result = app(ConsultationPricingResolver::class)->resolveViaExplicitMapping(
        mapping: null, tier: 'CO', department: 'General OPD', quantity: 1.0,
        performedAt: null, tenantId: null, facilityId: null, currencyCode: 'TZS',
    );

    expect($result)->toBeNull();
});

it('returns a priced result when both flags are on and the mapping has a chargeable_item_id', function (): void {
    setConsultationCutoverFlags(master: true, consultation: true);
    makeLinkedConsultationMapping(18000);

    $result = app(ConsultationPricingResolver::class)->resolveViaExplicitMapping(
        mapping: null, tier: 'CO', department: 'General OPD', quantity: 1.0,
        performedAt: null, tenantId: null, facilityId: null, currencyCode: 'TZS',
    );

    expect($result)->not->toBeNull()
        ->and($result['unitPrice'])->toBe(18000.0)
        ->and($result['pricingStatus'])->toBe('priced');
});

it('returns null when flags are on but no mapping exists for that tier/department', function (): void {
    setConsultationCutoverFlags(master: true, consultation: true);

    $result = app(ConsultationPricingResolver::class)->resolveViaExplicitMapping(
        mapping: null, tier: 'MD', department: 'Cardiology', quantity: 1.0,
        performedAt: null, tenantId: null, facilityId: null, currencyCode: 'TZS',
    );

    expect($result)->toBeNull();
});

it('returns null when a mapping exists but has not been backfilled with a chargeable_item_id yet', function (): void {
    setConsultationCutoverFlags(master: true, consultation: true);

    $tariff = BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'CONSULT-AMO-GENERAL-OPD', 'service_name' => 'AMO Consultation', 'service_type' => 'consultation',
        'unit' => 'visit', 'base_price' => 12000, 'currency_code' => 'TZS', 'effective_from' => now()->subDay(), 'status' => 'active',
    ]);
    ConsultationMappingModel::query()->create([
        'billing_service_catalog_item_id' => $tariff->id,
        'clinician_tier' => 'AMO',
        'department' => 'General OPD',
    ]);

    $result = app(ConsultationPricingResolver::class)->resolveViaExplicitMapping(
        mapping: null, tier: 'AMO', department: 'General OPD', quantity: 1.0,
        performedAt: null, tenantId: null, facilityId: null, currencyCode: 'TZS',
    );

    expect($result)->toBeNull();
});

it('accepts a pre-fetched mapping instead of re-querying, for callers that already have one', function (): void {
    setConsultationCutoverFlags(master: true, consultation: true);
    $mapping = makeLinkedConsultationMapping(18000);

    $result = app(ConsultationPricingResolver::class)->resolveViaExplicitMapping(
        mapping: $mapping, tier: 'CO', department: 'General OPD', quantity: 1.0,
        performedAt: null, tenantId: null, facilityId: null, currencyCode: 'TZS',
    );

    expect($result['unitPrice'])->toBe(18000.0);
});
