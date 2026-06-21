<?php

namespace App\Modules\InventoryProcurement\Application\UseCases;

use App\Modules\InventoryProcurement\Application\Exceptions\DuplicateInventoryItemCodeException;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryItemRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\Platform\Domain\Repositories\ClinicalCatalogItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use App\Support\CatalogGovernance\StandardsCodeSupport;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemUnitModel;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryItemAuditLogRepositoryInterface;
use App\Support\CatalogGovernance\InventoryClinicalLinkGuard;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use Illuminate\Support\Facades\DB;

class BulkCreateInventoryItemsFromCatalogUseCase
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventoryItemRepository,
        private readonly InventoryItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly InventoryClinicalLinkGuard $clinicalLinkGuard,
        private readonly StandardsCodeSupport $standardsCodeSupport,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
    ) {}

    /**
     * Bulk-create inventory items from active formulary (clinical catalog) items.
     *
     * Only creates items for formulary entries that do NOT already have
     * a corresponding inventory item linked via clinical_catalog_item_id.
     *
     * @param list<string>|null $catalogItemIds  Optional subset of catalog item IDs to sync.
     *                                           If null, syncs all eligible active formulary items.
     * @param string|null $defaultWarehouseId   Default warehouse UUID for all created items.
     * @param string|null $defaultSupplierId    Default supplier UUID for all created items.
     * @param int|null $actorId
     * @return array{created: positive-int, skipped: positive-int, errors: list<array{catalogItemId: string, code: string, name: string, error: string}>}
     */
    public function execute(
        ?array $catalogItemIds = null,
        ?string $defaultWarehouseId = null,
        ?string $defaultSupplierId = null,
        ?int $actorId = null,
    ): array {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();

        // 1. Fetch eligible active formulary items from the clinical catalog
        $catalogQuery = ClinicalCatalogItemModel::query()
            ->select(['id', 'catalog_type', 'code', 'name', 'category', 'unit', 'description', 'metadata', 'codes', 'status'])
            ->where('catalog_type', ClinicalCatalogType::FORMULARY_ITEM->value)
            ->where('status', ClinicalCatalogItemStatus::ACTIVE->value)
            ->orderBy('name');

        if ($catalogItemIds !== null && $catalogItemIds !== []) {
            $catalogQuery->whereIn('id', $catalogItemIds);
        }

        if ($this->isPlatformScopingEnabled()) {
            app(PlatformScopeQueryApplier::class)->apply($catalogQuery);
        }

        $catalogItems = $catalogQuery->get();

        if ($catalogItems->isEmpty()) {
            return [
                'created' => 0,
                'skipped' => 0,
                'errors' => [],
            ];
        }

        // 2. Determine which catalog items already have an inventory item linked
        $existingLinkedIds = $this->inventoryItemRepository->findLinkedClinicalCatalogItemIds(
            $catalogItems->pluck('id')->map(fn ($id): string => (string) $id)->values()->all(),
        );

        $existingLinkedSet = array_flip($existingLinkedIds);

        // 3. Build inventory item payloads for unlinked catalog items
        $created = 0;
        $skipped = 0;
        $errors = [];

        foreach ($catalogItems as $catalogItem) {
            $catalogId = (string) $catalogItem->id;

            // Skip if already linked
            if (isset($existingLinkedSet[$catalogId])) {
                $skipped++;
                continue;
            }

            $metadata = is_array($catalogItem->metadata) ? $catalogItem->metadata : [];
            $codes = is_array($catalogItem->codes) ? $catalogItem->codes : [];

            $itemCode = $this->generateItemCode($catalogItem->code, $catalogItem->name);
            $dosageForm = $metadata['dosageForm'] ?? $metadata['dosage_form'] ?? null;
            $strength = $metadata['strength'] ?? null;
            $dispensingUnit = $metadata['dispensingUnit'] ?? $metadata['dispensing_unit'] ?? $catalogItem->unit;
            $genericName = $metadata['genericName'] ?? $metadata['generic_name'] ?? null;
            $conversionFactor = $metadata['conversionFactor'] ?? $metadata['conversion_factor'] ?? null;

            // Check for duplicate item code
            if ($this->inventoryItemRepository->existsByItemCode($itemCode)) {
                // Append a suffix to make it unique
                $suffix = 1;
                $baseCode = $itemCode;
                while ($this->inventoryItemRepository->existsByItemCode($itemCode)) {
                    $itemCode = $baseCode . '-' . $suffix;
                    $suffix++;
                }
            }

            $createPayload = [
                'tenant_id' => $tenantId,
                'facility_id' => $facilityId,
                'clinical_catalog_item_id' => $catalogId,
                'item_code' => $itemCode,
                'codes' => $this->standardsCodeSupport->normalize($codes),
                'item_name' => $catalogItem->name,
                'generic_name' => $genericName,
                'dosage_form' => $dosageForm ? (is_string($dosageForm) ? $dosageForm : null) : null,
                'strength' => $strength ? (is_string($strength) ? $strength : null) : null,
                'category' => InventoryItemCategory::PHARMACEUTICAL->value,
                'subcategory' => $catalogItem->category,
                'unit' => $catalogItem->unit ?? 'Each',
                'dispensing_unit' => $dispensingUnit ? (is_string($dispensingUnit) ? $dispensingUnit : null) : null,
                'conversion_factor' => $conversionFactor ? (is_numeric($conversionFactor) ? (float) $conversionFactor : null) : null,
                'current_stock' => 0,
                'reorder_level' => 0,
                'default_warehouse_id' => $defaultWarehouseId,
                'default_supplier_id' => $defaultSupplierId,
                'status' => 'active',
            ];

            try {
                $this->clinicalLinkGuard->assertPayloadCanPersist($createPayload);

                $createdItem = $this->inventoryItemRepository->create($createPayload);

                // Auto-seed base unit
                $unitName = trim((string) ($catalogItem->unit ?: 'Each'));
                if ($unitName !== '') {
                    InventoryItemUnitModel::query()->create([
                        'tenant_id' => $tenantId,
                        'facility_id' => $facilityId,
                        'item_id' => $createdItem['id'],
                        'unit_name' => $unitName,
                        'unit_code' => $unitName,
                        'base_quantity' => 1.0,
                        'is_base_unit' => true,
                        'is_default_sales_unit' => true,
                        'is_default_purchase_unit' => true,
                        'is_active' => true,
                    ]);
                }

                $this->auditLogRepository->write(
                    inventoryItemId: $createdItem['id'],
                    action: 'inventory-item.bulk-created-from-catalog',
                    actorId: $actorId,
                    changes: [
                        'after' => $this->extractTrackedFields($createdItem),
                        'source_catalog_item_id' => $catalogId,
                        'source_catalog_code' => $catalogItem->code,
                    ],
                );

                $created++;
            } catch (\Throwable $e) {
                $errors[] = [
                    'catalogItemId' => $catalogId,
                    'code' => $catalogItem->code,
                    'name' => $catalogItem->name,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return [
            'created' => $created,
            'skipped' => $skipped,
            'errors' => $errors,
        ];
    }

    private function generateItemCode(string $catalogCode, string $catalogName): string
    {
        // Use the catalog code as-is if it's not empty, otherwise derive from name
        $code = trim($catalogCode);
        if ($code === '') {
            // Derive from name: uppercase, take first letters of significant words
            $parts = preg_split('/[\s\-]+/', $catalogName);
            $abbr = '';
            foreach (array_slice($parts ?: [], 0, 3) as $part) {
                $abbr .= strtoupper(substr($part, 0, 3));
            }
            $code = $abbr ?: 'MED';
        }

        return $code;
    }

    private function isPlatformScopingEnabled(): bool
    {
        return $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            || $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation');
    }

    /**
     * @param array<string, mixed> $item
     * @return array<string, mixed>
     */
    private function extractTrackedFields(array $item): array
    {
        $tracked = [
            'clinical_catalog_item_id',
            'item_code',
            'item_name',
            'generic_name',
            'dosage_form',
            'strength',
            'category',
            'subcategory',
            'unit',
            'dispensing_unit',
            'conversion_factor',
            'current_stock',
            'reorder_level',
            'default_warehouse_id',
            'default_supplier_id',
            'status',
        ];

        $result = [];
        foreach ($tracked as $field) {
            if (array_key_exists($field, $item)) {
                $result[$field] = $item[$field];
            }
        }

        return $result;
    }
}