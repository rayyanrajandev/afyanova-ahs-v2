<?php

namespace App\Modules\InventoryProcurement\Application\UseCases;

use App\Modules\InventoryProcurement\Application\Exceptions\DuplicateInventoryItemCodeException;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryItemAuditLogRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\CatalogGovernance\InventoryClinicalLinkGuard;
use App\Support\CatalogGovernance\StandardsCodeSupport;

class UpdateInventoryItemUseCase
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventoryItemRepository,
        private readonly InventoryItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly InventoryClinicalLinkGuard $clinicalLinkGuard,
        private readonly StandardsCodeSupport $standardsCodeSupport,
    ) {}

    public function execute(string $id, array $payload, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->inventoryItemRepository->findById($id);
        if (! $existing) {
            return null;
        }

        $updatePayload = [];

        if (array_key_exists('item_code', $payload)) {
            $itemCode = $this->normalizeItemCode((string) $payload['item_code']);
            if ($this->inventoryItemRepository->existsByItemCode($itemCode, $id)) {
                throw new DuplicateInventoryItemCodeException('Item code already exists.');
            }

            $updatePayload['item_code'] = $itemCode;
        }

        if (array_key_exists('item_name', $payload)) {
            $updatePayload['item_name'] = trim((string) $payload['item_name']);
        }

        if (array_key_exists('category', $payload)) {
            $updatePayload['category'] = $this->nullableTrimmedValue($payload['category']);
        }

        $nullableStringFields = [
            'clinical_catalog_item_id',
            'msd_code', 'nhif_code', 'barcode', 'generic_name', 'dosage_form',
            'strength', 'subcategory', 'ven_classification', 'abc_classification',
            'dispensing_unit', 'bin_location', 'manufacturer', 'storage_conditions',
            'controlled_substance_schedule', 'default_warehouse_id', 'default_supplier_id',
        ];
        foreach ($nullableStringFields as $field) {
            if (array_key_exists($field, $payload)) {
                $updatePayload[$field] = $this->nullableTrimmedValue($payload[$field]);
            }
        }

        if (array_key_exists('codes', $payload)) {
            $updatePayload['codes'] = $this->standardsCodeSupport->normalize(is_array($payload['codes']) ? $payload['codes'] : null);
        }

        $booleanFields = ['requires_cold_chain', 'is_controlled_substance'];
        foreach ($booleanFields as $field) {
            if (array_key_exists($field, $payload)) {
                $updatePayload[$field] = (bool) $payload[$field];
            }
        }

        if (array_key_exists('conversion_factor', $payload)) {
            $updatePayload['conversion_factor'] = $this->nullableNumericValue($payload['conversion_factor']);
        }

        if (array_key_exists('unit', $payload)) {
            $updatePayload['unit'] = trim((string) $payload['unit']);
        }

        if (array_key_exists('reorder_level', $payload)) {
            $updatePayload['reorder_level'] = (float) $payload['reorder_level'];
        }

        if (array_key_exists('max_stock_level', $payload)) {
            $updatePayload['max_stock_level'] = $this->nullableNumericValue($payload['max_stock_level']);
        }

        $this->clinicalLinkGuard->assertPayloadCanPersist($updatePayload, $existing);

        $updated = $this->inventoryItemRepository->update($id, $updatePayload);
        if (! $updated) {
            return null;
        }

        $changes = $this->extractChanges($existing, $updated);
        if ($changes !== []) {
            $this->auditLogRepository->write(
                inventoryItemId: $id,
                action: 'inventory-item.updated',
                actorId: $actorId,
                changes: $changes,
            );
        }

        return $updated;
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
    private function extractChanges(array $before, array $after): array
    {
        $trackedFields = [
            'item_code',
            'clinical_catalog_item_id',
            'codes',
            'item_name',
            'category',
            'unit',
            'reorder_level',
            'max_stock_level',
            'status',
        ];

        $changes = [];
        foreach ($trackedFields as $field) {
            $beforeValue = $before[$field] ?? null;
            $afterValue = $after[$field] ?? null;
            if ($beforeValue === $afterValue) {
                continue;
            }

            $changes[$field] = [
                'before' => $beforeValue,
                'after' => $afterValue,
            ];
        }

        return $changes;
    }
}
