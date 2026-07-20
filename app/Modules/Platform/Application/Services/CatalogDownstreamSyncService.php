<?php

namespace App\Modules\Platform\Application\Services;

use App\Modules\Billing\Application\Support\BillingClinicalCatalogIdentitySynchronizer;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Billing\Domain\ValueObjects\BillingServiceCatalogItemStatus;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemModel;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemUnitModel;
use App\Support\CatalogGovernance\StandardsCodeSupport;
use Illuminate\Support\Facades\DB;

class CatalogDownstreamSyncService
{
    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $billingRepository,
        private readonly BillingClinicalCatalogIdentitySynchronizer $identitySynchronizer,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly StandardsCodeSupport $standardsCodeSupport,
    ) {}

    public function syncToBilling(string $clinicalCatalogItemId, ?int $actorId = null): void
    {
        $catalogItem = ClinicalCatalogItemModel::query()->find($clinicalCatalogItemId);
        if ($catalogItem === null) {
            return;
        }

        $existingVersions = $this->billingRepository->listVersionsByClinicalCatalogItemId(
            $clinicalCatalogItemId,
            $this->platformScopeContext->tenantId(),
            $this->platformScopeContext->facilityId(),
        );

        if ($existingVersions !== []) {
            return;
        }

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();
        $meta = is_array($catalogItem->metadata) ? $catalogItem->metadata : [];
        $currencyCode = $meta['currencyCode'] ?? $meta['currency_code'] ?? 'TZS';

        $payload = $this->identitySynchronizer->forCreate(
            payload: [
                'service_code' => $catalogItem->code,
                'service_name' => $catalogItem->name,
                'service_type' => ClinicalCatalogType::tryFrom((string) $catalogItem->catalog_type)?->defaultBillingServiceType(),
                'unit' => $catalogItem->unit,
                'base_price' => 0,
                'currency_code' => $currencyCode,
                'price_unit' => $meta['priceUnit'] ?? $meta['price_unit'] ?? $catalogItem->unit,
                'department_id' => $catalogItem->department_id,
                'description' => $catalogItem->description,
                'codes' => $this->standardsCodeSupport->normalize(
                    is_array($catalogItem->codes) ? $catalogItem->codes : null,
                ),
            ],
            tenantId: $tenantId,
            facilityId: $facilityId,
        );

        $this->billingRepository->create([
            'tenant_id' => $tenantId,
            'facility_id' => $facilityId,
            'clinical_catalog_item_id' => $clinicalCatalogItemId,
            'service_code' => strtoupper(trim((string) ($payload['service_code'] ?? $catalogItem->code))),
            'tariff_version' => 1,
            'service_name' => trim((string) ($payload['service_name'] ?? $catalogItem->name)),
            'service_type' => $payload['service_type'] ?? null,
            'unit' => $payload['unit'] ?? $catalogItem->unit ?? 'service',
            'price_unit' => $payload['price_unit'] ?? null,
            'base_price' => 0,
            'currency_code' => $currencyCode,
            'department_id' => $payload['department_id'] ?? $catalogItem->department_id,
            'facility_tier' => $payload['facility_tier'] ?? $catalogItem->facility_tier,
            'description' => $payload['description'] ?? $catalogItem->description,
            'codes' => $this->standardsCodeSupport->normalize(
                is_array($payload['codes'] ?? $catalogItem->codes) ? ($payload['codes'] ?? $catalogItem->codes) : null,
            ),
            'status' => BillingServiceCatalogItemStatus::ACTIVE->value,
        ]);
    }

    public function syncToInventory(string $clinicalCatalogItemId, ?int $actorId = null): void
    {
        $catalogItem = ClinicalCatalogItemModel::query()->find($clinicalCatalogItemId);
        if ($catalogItem === null) {
            return;
        }

        if ((string) $catalogItem->catalog_type !== ClinicalCatalogType::FORMULARY_ITEM->value) {
            return;
        }

        $existingInventory = InventoryItemModel::query()
            ->where('clinical_catalog_item_id', $clinicalCatalogItemId)
            ->first();

        if ($existingInventory !== null) {
            return;
        }

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();
        $meta = is_array($catalogItem->metadata) ? $catalogItem->metadata : [];

        $dosageForm = $meta['dosageForm'] ?? $meta['dosage_form'] ?? null;
        $strength = $meta['strength'] ?? null;
        $stockUnit = $meta['stockUnit'] ?? $meta['stock_unit'] ?? $catalogItem->unit;
        $dispensingUnit = $meta['dispensingUnit'] ?? $meta['dispensing_unit'] ?? $catalogItem->unit;
        $genericName = $meta['genericName'] ?? $meta['generic_name'] ?? null;
        $conversionFactor = $meta['conversionFactor'] ?? $meta['conversion_factor'] ?? null;
        $codes = is_array($catalogItem->codes) ? $catalogItem->codes : [];

        $itemCode = $catalogItem->code;
        if (InventoryItemModel::query()->where('item_code', $itemCode)->exists()) {
            $suffix = 1;
            $baseCode = $itemCode;
            while (InventoryItemModel::query()->where('item_code', $itemCode)->exists()) {
                $itemCode = $baseCode . '-' . $suffix;
                $suffix++;
            }
        }

        DB::transaction(function () use (
            $tenantId, $facilityId, $clinicalCatalogItemId, $catalogItem,
            $itemCode, $codes, $genericName, $dosageForm, $strength,
            $stockUnit, $dispensingUnit, $conversionFactor
        ): void {
            $inventoryItem = InventoryItemModel::query()->create([
                'tenant_id' => $tenantId,
                'facility_id' => $facilityId,
                'clinical_catalog_item_id' => $clinicalCatalogItemId,
                'item_code' => $itemCode,
                'codes' => $this->standardsCodeSupport->normalize($codes),
                'item_name' => $catalogItem->name,
                'generic_name' => $genericName,
                'dosage_form' => $dosageForm ? (is_string($dosageForm) ? $dosageForm : null) : null,
                'strength' => $strength ? (is_string($strength) ? $strength : null) : null,
                'category' => InventoryItemCategory::PHARMACEUTICAL->value,
                'subcategory' => $catalogItem->category,
                'unit' => $stockUnit ?? 'Each',
                'dispensing_unit' => $dispensingUnit ? (is_string($dispensingUnit) ? $dispensingUnit : null) : null,
                'conversion_factor' => $conversionFactor ? (is_numeric($conversionFactor) ? (float) $conversionFactor : null) : null,
                'current_stock' => 0,
                'reorder_level' => 0,
                'status' => 'active',
            ]);

            $unitName = trim((string) ($stockUnit ?: 'Each'));
            if ($unitName !== '') {
                InventoryItemUnitModel::query()->create([
                    'tenant_id' => $tenantId,
                    'facility_id' => $facilityId,
                    'item_id' => $inventoryItem->id,
                    'unit_name' => $unitName,
                    'unit_code' => $unitName,
                    'base_quantity' => 1.0,
                    'is_base_unit' => true,
                    'is_default_sales_unit' => true,
                    'is_default_purchase_unit' => true,
                    'is_active' => true,
                ]);
            }
        });
    }

    public function syncDownstream(string $clinicalCatalogItemId, ?int $actorId = null): void
    {
        $this->syncToBilling($clinicalCatalogItemId, $actorId);
        $this->syncToInventory($clinicalCatalogItemId, $actorId);
    }

}
