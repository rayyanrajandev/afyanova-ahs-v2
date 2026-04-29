<?php

namespace App\Modules\InventoryProcurement\Application\UseCases;

use App\Modules\InventoryProcurement\Application\Exceptions\DuplicateInventoryItemCodeException;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryItemAuditLogRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryItemRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemStatus;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\CatalogGovernance\InventoryClinicalLinkGuard;
use App\Support\CatalogGovernance\StandardsCodeSupport;

class CreateInventoryItemUseCase
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventoryItemRepository,
        private readonly InventoryItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly InventoryClinicalLinkGuard $clinicalLinkGuard,
        private readonly StandardsCodeSupport $standardsCodeSupport,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $itemCode = $this->normalizeItemCode((string) $payload['item_code']);
        if ($this->inventoryItemRepository->existsByItemCode($itemCode)) {
            throw new DuplicateInventoryItemCodeException('Item code already exists.');
        }

        $createPayload = [
            'tenant_id' => $this->platformScopeContext->tenantId(),
            'facility_id' => $this->platformScopeContext->facilityId(),
            'clinical_catalog_item_id' => $this->nullableTrimmedValue($payload['clinical_catalog_item_id'] ?? null),
            'item_code' => $itemCode,
            'msd_code' => $this->nullableTrimmedValue($payload['msd_code'] ?? null),
            'nhif_code' => $this->nullableTrimmedValue($payload['nhif_code'] ?? null),
            'barcode' => $this->nullableTrimmedValue($payload['barcode'] ?? null),
            'codes' => $this->standardsCodeSupport->normalize(is_array($payload['codes'] ?? null) ? $payload['codes'] : null),
            'item_name' => trim((string) $payload['item_name']),
            'generic_name' => $this->nullableTrimmedValue($payload['generic_name'] ?? null),
            'dosage_form' => $this->nullableTrimmedValue($payload['dosage_form'] ?? null),
            'strength' => $this->nullableTrimmedValue($payload['strength'] ?? null),
            'category' => $this->nullableTrimmedValue($payload['category'] ?? null),
            'subcategory' => $this->nullableTrimmedValue($payload['subcategory'] ?? null),
            'ven_classification' => $this->nullableTrimmedValue($payload['ven_classification'] ?? null),
            'abc_classification' => $this->nullableTrimmedValue($payload['abc_classification'] ?? null),
            'unit' => trim((string) $payload['unit']),
            'dispensing_unit' => $this->nullableTrimmedValue($payload['dispensing_unit'] ?? null),
            'conversion_factor' => $this->nullableNumericValue($payload['conversion_factor'] ?? null),
            'bin_location' => $this->nullableTrimmedValue($payload['bin_location'] ?? null),
            'manufacturer' => $this->nullableTrimmedValue($payload['manufacturer'] ?? null),
            'storage_conditions' => $this->nullableTrimmedValue($payload['storage_conditions'] ?? null),
            'requires_cold_chain' => (bool) ($payload['requires_cold_chain'] ?? false),
            'is_controlled_substance' => (bool) ($payload['is_controlled_substance'] ?? false),
            'controlled_substance_schedule' => $this->nullableTrimmedValue($payload['controlled_substance_schedule'] ?? null),
            'current_stock' => 0,
            'reorder_level' => (float) ($payload['reorder_level'] ?? 0),
            'max_stock_level' => $this->nullableNumericValue($payload['max_stock_level'] ?? null),
            'default_warehouse_id' => $payload['default_warehouse_id'] ?? null,
            'default_supplier_id' => $payload['default_supplier_id'] ?? null,
            'status' => InventoryItemStatus::ACTIVE->value,
        ];

        $this->clinicalLinkGuard->assertPayloadCanPersist($createPayload);

        $created = $this->inventoryItemRepository->create($createPayload);

        $this->auditLogRepository->write(
            inventoryItemId: $created['id'],
            action: 'inventory-item.created',
            actorId: $actorId,
            changes: [
                'after' => $this->extractTrackedFields($created),
            ],
        );

        return $created;
    }

    private function normalizeItemCode(string $value): string
    {
        return strtoupper(trim($value));
    }

    private function nullableTrimmedValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    private function nullableNumericValue(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) $value;
    }

    /**
     * @return array<string, mixed>
     */
    private function extractTrackedFields(array $item): array
    {
        $tracked = [
            'tenant_id',
            'facility_id',
            'clinical_catalog_item_id',
            'item_code',
            'msd_code',
            'nhif_code',
            'barcode',
            'codes',
            'item_name',
            'generic_name',
            'dosage_form',
            'strength',
            'category',
            'subcategory',
            'ven_classification',
            'abc_classification',
            'unit',
            'dispensing_unit',
            'conversion_factor',
            'bin_location',
            'manufacturer',
            'storage_conditions',
            'requires_cold_chain',
            'is_controlled_substance',
            'controlled_substance_schedule',
            'current_stock',
            'reorder_level',
            'max_stock_level',
            'default_warehouse_id',
            'default_supplier_id',
            'status',
        ];

        $result = [];
        foreach ($tracked as $field) {
            $result[$field] = $item[$field] ?? null;
        }

        return $result;
    }
}
