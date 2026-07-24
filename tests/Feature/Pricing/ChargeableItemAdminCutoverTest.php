<?php

use App\Models\User;
use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityResourceModel;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * PricingEngine_Migration_Plan.md Phase 4: the new chargeable_items /
 * price_book_entries admin CRUD, plus the three-layer-gap fixes on
 * ward-bed and consultation-mapping admin (chargeableItemId now flows
 * through validation -> controller -> transformer/response).
 */
uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->withoutMiddleware(EnsureFacilitySubscriptionEntitlement::class);
    $this->withoutMiddleware(EnsureMappedFacilitySubscriptionEntitlement::class);
});

function makeChargeableItemActor(array $permissions = []): User
{
    $user = User::factory()->create();

    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

function makeChargeableItemLabCatalogItem(string $code = 'LAB-CHG-001'): ClinicalCatalogItemModel
{
    return ClinicalCatalogItemModel::query()->create([
        'catalog_type' => 'lab_test',
        'code' => $code,
        'name' => 'Full Blood Count',
        'unit' => 'test',
        'status' => 'active',
    ]);
}

it('creates a standalone chargeable item with a fresh id and first price', function (): void {
    $actor = makeChargeableItemActor(['billing.chargeable-items.manage', 'billing.chargeable-items.read']);

    $response = $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'bed_day',
            'chargeModel' => 'per_day',
            'code' => 'BED-GEN-WARD',
            'name' => 'General Ward Bed-Day',
            'currencyCode' => 'TZS',
            'unitPrice' => 25000,
        ])
        ->assertCreated()
        ->assertJsonPath('data.catalogType', 'bed_day')
        ->assertJsonPath('data.code', 'BED-GEN-WARD')
        ->assertJsonPath('data.prices.0.unitPrice', 25000);

    $itemId = $response->json('data.id');

    expect(ChargeableItemModel::query()->find($itemId))->not->toBeNull();
    expect(PriceBookEntryModel::query()->where('chargeable_item_id', $itemId)->count())->toBe(1);
});

it('reuses the clinical catalog item id when creating a chargeable item linked to it', function (): void {
    $actor = makeChargeableItemActor(['billing.chargeable-items.manage']);
    $catalogItem = makeChargeableItemLabCatalogItem();

    $response = $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'lab_test',
            'chargeModel' => 'flat',
            'clinicalCatalogItemId' => $catalogItem->id,
            'currencyCode' => 'TZS',
            'unitPrice' => 8000,
        ])
        ->assertCreated()
        ->assertJsonPath('data.id', $catalogItem->id)
        ->assertJsonPath('data.code', $catalogItem->code)
        ->assertJsonPath('data.name', $catalogItem->name);

    expect(ChargeableItemModel::query()->count())->toBe(1);
    expect(ChargeableItemModel::query()->first()->id)->toBe($catalogItem->id);
});

it('reuses an already-backfilled chargeable item instead of failing on a duplicate id', function (): void {
    $actor = makeChargeableItemActor(['billing.chargeable-items.manage']);
    $catalogItem = makeChargeableItemLabCatalogItem();

    $existing = new ChargeableItemModel();
    $existing->id = $catalogItem->id;
    $existing->fill([
        'catalog_type' => 'lab_test',
        'charge_model' => 'flat',
        'code' => $catalogItem->code,
        'name' => $catalogItem->name,
        'status' => 'active',
    ]);
    $existing->save();

    $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'lab_test',
            'chargeModel' => 'flat',
            'clinicalCatalogItemId' => $catalogItem->id,
            'currencyCode' => 'TZS',
            'unitPrice' => 9000,
        ])
        ->assertCreated()
        ->assertJsonPath('data.id', $catalogItem->id);

    expect(ChargeableItemModel::query()->count())->toBe(1);
    expect(PriceBookEntryModel::query()->where('chargeable_item_id', $catalogItem->id)->count())->toBe(1);
});

it('adds a new price book entry to an existing chargeable item via storePrice', function (): void {
    $actor = makeChargeableItemActor(['billing.chargeable-items.manage']);

    $itemId = $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'bed_day',
            'chargeModel' => 'per_day',
            'code' => 'BED-ICU',
            'name' => 'ICU Bed-Day',
            'currencyCode' => 'TZS',
            'unitPrice' => 90000,
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($actor)
        ->postJson("/api/v1/chargeable-items/{$itemId}/prices", [
            'currencyCode' => 'TZS',
            'unitPrice' => 95000,
            'effectiveFrom' => now()->addDay()->toDateTimeString(),
        ])
        ->assertCreated()
        ->assertJsonPath('data.prices.0.unitPrice', 95000)
        ->assertJsonPath('data.prices.1.unitPrice', 90000);

    expect(PriceBookEntryModel::query()->where('chargeable_item_id', $itemId)->count())->toBe(2);
});

it('denies chargeable item reads and writes without permission', function (): void {
    $actor = makeChargeableItemActor();

    $this->actingAs($actor)->getJson('/api/v1/chargeable-items')->assertForbidden();

    $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'bed_day',
            'chargeModel' => 'per_day',
            'code' => 'BED-X',
            'name' => 'Bed X',
            'currencyCode' => 'TZS',
            'unitPrice' => 1000,
        ])
        ->assertForbidden();
});

it('round-trips chargeableItemId through ward-bed create and update', function (): void {
    $actor = makeChargeableItemActor([
        'platform.resources.read',
        'platform.resources.manage-ward-beds',
        'billing.chargeable-items.manage',
    ]);

    $chargeableItemId = $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'bed_day',
            'chargeModel' => 'per_day',
            'code' => 'BED-GEN-A',
            'name' => 'General Ward Bed-Day A',
            'currencyCode' => 'TZS',
            'unitPrice' => 25000,
        ])
        ->assertCreated()
        ->json('data.id');

    $response = $this->actingAs($actor)
        ->postJson('/api/v1/platform/admin/ward-beds', [
            'code' => 'BED-WB-001',
            'name' => 'Ward A Bed 1',
            'wardName' => 'WARD-A',
            'bedNumber' => 'A-01',
            'chargeableItemId' => $chargeableItemId,
        ])
        ->assertCreated()
        ->assertJsonPath('data.chargeableItemId', $chargeableItemId);

    $resourceId = $response->json('data.id');

    expect(FacilityResourceModel::query()->find($resourceId)->chargeable_item_id)->toBe($chargeableItemId);

    $secondChargeableItemId = $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'bed_day',
            'chargeModel' => 'per_day',
            'code' => 'BED-GEN-B',
            'name' => 'General Ward Bed-Day B',
            'currencyCode' => 'TZS',
            'unitPrice' => 30000,
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($actor)
        ->patchJson("/api/v1/platform/admin/ward-beds/{$resourceId}", [
            'chargeableItemId' => $secondChargeableItemId,
        ])
        ->assertOk()
        ->assertJsonPath('data.chargeableItemId', $secondChargeableItemId);
});

it('round-trips chargeable_item_id through consultation-mapping create and update', function (): void {
    $actor = makeChargeableItemActor([
        'billing.consultation-mappings.read',
        'billing.consultation-mappings.manage',
        'billing.chargeable-items.manage',
    ]);

    $catalogItem = BillingServiceCatalogItemModel::query()->create([
        'service_code' => 'CONSULT-CO-OPD-CHG',
        'service_name' => 'Clinical Officer Consultation - OPD',
        'service_type' => 'consultation',
        'department' => 'Outpatient Department (OPD)',
        'unit' => 'visit',
        'base_price' => 12000,
        'currency_code' => 'TZS',
        'tax_rate_percent' => 0,
        'is_taxable' => false,
        'effective_from' => now()->subDay()->toDateTimeString(),
        'effective_to' => null,
        'status' => 'active',
    ]);

    $chargeableItemId = $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'consultation',
            'chargeModel' => 'flat',
            'code' => 'CONSULT-CO-OPD-CHG',
            'name' => 'CO Consultation OPD',
            'currencyCode' => 'TZS',
            'unitPrice' => 12000,
        ])
        ->assertCreated()
        ->json('data.id');

    $mapping = $this->actingAs($actor)
        ->postJson('/api/v1/consultation-mappings', [
            'billing_service_catalog_item_id' => $catalogItem->id,
            'chargeable_item_id' => $chargeableItemId,
            'clinician_tier' => 'CO',
            'department' => 'Outpatient Department (OPD)',
        ])
        ->assertCreated()
        ->assertJsonPath('data.chargeable_item_id', $chargeableItemId)
        ->json('data');

    expect(ConsultationMappingModel::query()->find($mapping['id'])->chargeable_item_id)->toBe($chargeableItemId);

    $secondChargeableItemId = $this->actingAs($actor)
        ->postJson('/api/v1/chargeable-items', [
            'catalogType' => 'consultation',
            'chargeModel' => 'flat',
            'code' => 'CONSULT-CO-OPD-CHG-2',
            'name' => 'CO Consultation OPD v2',
            'currencyCode' => 'TZS',
            'unitPrice' => 13000,
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($actor)
        ->patchJson("/api/v1/consultation-mappings/{$mapping['id']}", [
            'chargeable_item_id' => $secondChargeableItemId,
        ])
        ->assertOk()
        ->assertJsonPath('data.chargeable_item_id', $secondChargeableItemId);
});
