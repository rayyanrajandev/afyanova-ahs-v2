<?php

use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

function makeConsultationTariffForBackfill(array $overrides = []): BillingServiceCatalogItemModel
{
    return BillingServiceCatalogItemModel::query()->create(array_merge([
        'service_code' => 'CONSULT-CO-GENERAL-OPD',
        'service_name' => 'Clinical Officer General OPD Consultation',
        'service_type' => 'consultation',
        'unit' => 'visit',
        'base_price' => 15000,
        'currency_code' => 'TZS',
        'tax_rate_percent' => 0,
        'is_taxable' => false,
        'effective_from' => now()->subDay(),
        'tariff_version' => 1,
        'status' => 'active',
    ], $overrides));
}

function makeConsultationMappingForBackfill(string $tariffId, array $overrides = []): ConsultationMappingModel
{
    return ConsultationMappingModel::query()->create(array_merge([
        'billing_service_catalog_item_id' => $tariffId,
        'clinician_tier' => 'CO',
        'department' => 'General OPD',
    ], $overrides));
}

it('creates a chargeable item and price book entry, and links the mapping to it', function (): void {
    $tariff = makeConsultationTariffForBackfill();
    $mapping = makeConsultationMappingForBackfill($tariff->id);

    Artisan::call('pricing:backfill-consultation-chargeable-items');

    $mapping->refresh();
    expect($mapping->chargeable_item_id)->not->toBeNull();

    $chargeableItem = ChargeableItemModel::query()->find($mapping->chargeable_item_id);
    expect($chargeableItem)->not->toBeNull()
        ->and($chargeableItem->catalog_type)->toBe('consultation')
        ->and($chargeableItem->charge_model)->toBe('flat')
        ->and($chargeableItem->code)->toBe('CONSULT-CO-GENERAL-OPD');

    $priceBookEntry = PriceBookEntryModel::query()->where('chargeable_item_id', $chargeableItem->id)->first();
    expect($priceBookEntry)->not->toBeNull()
        ->and((float) $priceBookEntry->unit_price)->toBe(15000.0)
        ->and($priceBookEntry->currency_code)->toBe('TZS');
});

it('is idempotent across repeated runs', function (): void {
    $tariff = makeConsultationTariffForBackfill();
    makeConsultationMappingForBackfill($tariff->id);

    Artisan::call('pricing:backfill-consultation-chargeable-items');
    Artisan::call('pricing:backfill-consultation-chargeable-items');

    expect(ChargeableItemModel::query()->where('catalog_type', 'consultation')->count())->toBe(1)
        ->and(PriceBookEntryModel::query()->count())->toBe(1);
});

it('reuses an existing chargeable item for the same code/tenant/facility instead of duplicating it', function (): void {
    $tariffA = makeConsultationTariffForBackfill(['service_code' => 'CONSULT-CO-GENERAL-OPD']);
    $tariffB = makeConsultationTariffForBackfill(['service_code' => 'CONSULT-CO-GENERAL-OPD', 'base_price' => 16000]);
    $mappingA = makeConsultationMappingForBackfill($tariffA->id, ['clinician_tier' => 'CO', 'department' => 'General OPD']);
    $mappingB = makeConsultationMappingForBackfill($tariffB->id, ['clinician_tier' => 'CO', 'department' => 'Outpatient']);

    Artisan::call('pricing:backfill-consultation-chargeable-items');

    $mappingA->refresh();
    $mappingB->refresh();

    expect($mappingA->chargeable_item_id)->toBe($mappingB->chargeable_item_id)
        ->and(ChargeableItemModel::query()->where('catalog_type', 'consultation')->count())->toBe(1);
});

it('deleting a tariff cascades to its mapping, leaving nothing orphaned for the backfill to skip', function (): void {
    // consultation_mappings.billing_service_catalog_item_id is
    // onDelete('cascade') -- a mapping can never actually outlive its
    // tariff, so the command's "no tariff" guard is defensive against a
    // relation lazy-loading to null, not a state reachable via normal
    // deletes. Confirming the cascade itself, not an unreachable scenario.
    $tariff = makeConsultationTariffForBackfill();
    $mapping = makeConsultationMappingForBackfill($tariff->id);
    $tariff->delete();

    expect(ConsultationMappingModel::query()->find($mapping->id))->toBeNull();

    Artisan::call('pricing:backfill-consultation-chargeable-items');

    expect(ChargeableItemModel::query()->where('catalog_type', 'consultation')->count())->toBe(0);
});

it('writes nothing in dry-run mode', function (): void {
    $tariff = makeConsultationTariffForBackfill();
    $mapping = makeConsultationMappingForBackfill($tariff->id);

    Artisan::call('pricing:backfill-consultation-chargeable-items', ['--dry-run' => true]);

    expect($mapping->fresh()->chargeable_item_id)->toBeNull()
        ->and(ChargeableItemModel::query()->where('catalog_type', 'consultation')->count())->toBe(0)
        ->and(PriceBookEntryModel::query()->count())->toBe(0);
});
