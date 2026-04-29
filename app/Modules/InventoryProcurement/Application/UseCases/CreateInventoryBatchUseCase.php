<?php

namespace App\Modules\InventoryProcurement\Application\UseCases;

use App\Modules\InventoryProcurement\Application\Exceptions\InventoryItemNotFoundException;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryBatchRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;

class CreateInventoryBatchUseCase
{
    public function __construct(
        private readonly InventoryBatchRepositoryInterface $batchRepository,
        private readonly InventoryItemRepositoryInterface $itemRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $item = $this->itemRepository->findById((string) $payload['item_id']);
        if (! $item) {
            throw new InventoryItemNotFoundException('Inventory item not found.');
        }

        return $this->batchRepository->create([
            'tenant_id' => $this->platformScopeContext->tenantId(),
            'facility_id' => $this->platformScopeContext->facilityId(),
            'item_id' => $payload['item_id'],
            'batch_number' => strtoupper(trim((string) $payload['batch_number'])),
            'lot_number' => isset($payload['lot_number']) ? trim((string) $payload['lot_number']) : null,
            'manufacture_date' => $payload['manufacture_date'] ?? null,
            'expiry_date' => $payload['expiry_date'] ?? null,
            'quantity' => (float) ($payload['quantity'] ?? 0),
            'warehouse_id' => $payload['warehouse_id'] ?? null,
            'bin_location' => $payload['bin_location'] ?? null,
            'supplier_id' => $payload['supplier_id'] ?? null,
            'unit_cost' => isset($payload['unit_cost']) ? (float) $payload['unit_cost'] : null,
            'status' => 'available',
            'notes' => $payload['notes'] ?? null,
        ]);
    }
}
