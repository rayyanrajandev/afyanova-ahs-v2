<?php

namespace App\Modules\Platform\Application\Services;

use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemModel;
use App\Modules\Platform\Domain\Repositories\ClinicalCatalogItemAuditLogRepositoryInterface;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogConsumptionRecipeItemModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ClinicalCatalogConsumptionRecipeService
{
    /**
     * @var array<string, array<int, string>>
     */
    private const ELIGIBLE_INVENTORY_CATEGORIES = [
        ClinicalCatalogType::LAB_TEST->value => [
            InventoryItemCategory::LABORATORY->value,
            InventoryItemCategory::MEDICAL_CONSUMABLE->value,
        ],
        ClinicalCatalogType::RADIOLOGY_PROCEDURE->value => [
            InventoryItemCategory::RADIOLOGY->value,
            InventoryItemCategory::MEDICAL_CONSUMABLE->value,
        ],
        ClinicalCatalogType::THEATRE_PROCEDURE->value => [
            InventoryItemCategory::MEDICAL_CONSUMABLE->value,
            InventoryItemCategory::PPE->value,
            InventoryItemCategory::SURGICAL_INSTRUMENT->value,
        ],
    ];

    /**
     * @var array<int, string>
     */
    private const CONSUMPTION_STAGES = ['per_order', 'sample_collection', 'processing', 'result_release', 'procedure_completion', 'manual'];

    public function __construct(
        private readonly ClinicalCatalogItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function recipe(string $clinicalCatalogItemId, string $catalogType): ?array
    {
        $catalogItem = $this->catalogItem($clinicalCatalogItemId, $catalogType);
        if ($catalogItem === null) {
            return null;
        }

        return [
            'catalogItemId' => (string) $catalogItem->id,
            'catalogType' => (string) $catalogItem->catalog_type,
            'isRecipeSupported' => $this->supportsRecipes((string) $catalogItem->catalog_type),
            'eligibleCategories' => self::ELIGIBLE_INVENTORY_CATEGORIES[(string) $catalogItem->catalog_type] ?? [],
            'items' => $this->recipeItemsForCatalogItem((string) $catalogItem->id),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<string, mixed>|null
     */
    public function syncRecipe(string $clinicalCatalogItemId, string $catalogType, array $items, ?int $actorId): ?array
    {
        $catalogItem = $this->catalogItem($clinicalCatalogItemId, $catalogType);
        if ($catalogItem === null) {
            return null;
        }

        if (! $this->supportsRecipes((string) $catalogItem->catalog_type)) {
            throw ValidationException::withMessages([
                'catalogItemId' => ['Consumption recipes are for stock-consuming clinical definitions. Medicines use the formulary-to-pharmaceutical inventory bridge instead.'],
            ]);
        }

        $normalizedItems = $this->validateAndNormalizeRecipeItems((string) $catalogItem->catalog_type, $items);
        $before = $this->recipeItemsForCatalogItem((string) $catalogItem->id);

        DB::transaction(function () use ($catalogItem, $normalizedItems, $actorId): void {
            ClinicalCatalogConsumptionRecipeItemModel::query()
                ->where('clinical_catalog_item_id', $catalogItem->id)
                ->delete();

            foreach ($normalizedItems as $line) {
                ClinicalCatalogConsumptionRecipeItemModel::query()->create([
                    'tenant_id' => $catalogItem->tenant_id,
                    'facility_id' => $catalogItem->facility_id,
                    'clinical_catalog_item_id' => $catalogItem->id,
                    'inventory_item_id' => $line['inventory_item_id'],
                    'quantity_per_order' => $line['quantity_per_order'],
                    'unit' => $line['unit'],
                    'waste_factor_percent' => $line['waste_factor_percent'],
                    'consumption_stage' => $line['consumption_stage'],
                    'is_active' => true,
                    'notes' => $line['notes'],
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);
            }
        });

        $after = $this->recipeItemsForCatalogItem((string) $catalogItem->id);
        $this->auditLogRepository->write(
            clinicalCatalogItemId: (string) $catalogItem->id,
            action: 'consumption_recipe_synced',
            actorId: $actorId,
            changes: [
                'before' => $before,
                'after' => $after,
            ],
            metadata: [
                'catalogType' => $catalogItem->catalog_type,
                'recipeLineCount' => count($after),
            ],
        );

        return [
            'catalogItemId' => (string) $catalogItem->id,
            'catalogType' => (string) $catalogItem->catalog_type,
            'isRecipeSupported' => true,
            'eligibleCategories' => self::ELIGIBLE_INVENTORY_CATEGORIES[(string) $catalogItem->catalog_type],
            'items' => $after,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function eligibleInventoryOptions(string $catalogType, ?string $query = null, int $limit = 100): array
    {
        if (! $this->supportsRecipes($catalogType)) {
            return [];
        }

        $categories = self::ELIGIBLE_INVENTORY_CATEGORIES[$catalogType];
        $limit = min(max($limit, 1), 200);

        $queryBuilder = InventoryItemModel::query()
            ->whereIn('category', $categories)
            ->where('status', 'active')
            ->orderBy('item_name')
            ->limit($limit);

        $this->applyPlatformScopeIfEnabled($queryBuilder);

        $search = trim((string) $query);
        if ($search !== '') {
            $like = '%'.$search.'%';
            $queryBuilder->where(function (Builder $builder) use ($like): void {
                $builder
                    ->where('item_code', 'like', $like)
                    ->orWhere('item_name', 'like', $like)
                    ->orWhere('category', 'like', $like)
                    ->orWhere('subcategory', 'like', $like)
                    ->orWhere('manufacturer', 'like', $like);
            });
        }

        return $queryBuilder
            ->get()
            ->map(fn (InventoryItemModel $item): array => $this->transformInventoryOption($item))
            ->values()
            ->all();
    }

    private function supportsRecipes(string $catalogType): bool
    {
        return array_key_exists($catalogType, self::ELIGIBLE_INVENTORY_CATEGORIES);
    }

    private function catalogItem(string $clinicalCatalogItemId, string $catalogType): ?ClinicalCatalogItemModel
    {
        $query = ClinicalCatalogItemModel::query()
            ->where('catalog_type', $catalogType);
        $this->applyPlatformScopeIfEnabled($query);

        return $query->find($clinicalCatalogItemId);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recipeItemsForCatalogItem(string $clinicalCatalogItemId): array
    {
        return ClinicalCatalogConsumptionRecipeItemModel::query()
            ->with('inventoryItem')
            ->where('clinical_catalog_item_id', $clinicalCatalogItemId)
            ->orderBy('created_at')
            ->get()
            ->map(fn (ClinicalCatalogConsumptionRecipeItemModel $line): array => $this->transformRecipeItem($line))
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    private function validateAndNormalizeRecipeItems(string $catalogType, array $items): array
    {
        if (count($items) > 50) {
            throw ValidationException::withMessages([
                'items' => ['A recipe can contain at most 50 stock lines. Split complex protocols into operational recipes before go-live.'],
            ]);
        }

        $allowedCategories = self::ELIGIBLE_INVENTORY_CATEGORIES[$catalogType] ?? [];
        $normalized = [];
        $seenInventoryItemIds = [];

        foreach ($items as $index => $item) {
            $fieldPrefix = 'items.'.$index;
            $inventoryItemId = $this->nullableText($item['inventoryItemId'] ?? $item['inventory_item_id'] ?? null);
            if ($inventoryItemId === null) {
                throw ValidationException::withMessages([
                    $fieldPrefix.'.inventoryItemId' => ['Select an inventory item for this recipe line.'],
                ]);
            }

            if (in_array($inventoryItemId, $seenInventoryItemIds, true)) {
                throw ValidationException::withMessages([
                    $fieldPrefix.'.inventoryItemId' => ['This inventory item is already in the recipe. Adjust the existing line instead of duplicating it.'],
                ]);
            }
            $seenInventoryItemIds[] = $inventoryItemId;

            $inventoryItem = $this->eligibleInventoryItem($inventoryItemId, $allowedCategories);
            if ($inventoryItem === null) {
                throw ValidationException::withMessages([
                    $fieldPrefix.'.inventoryItemId' => ['This stock item is not eligible for the selected clinical recipe. Lab tests use lab reagents and consumables; medicines stay on the formulary bridge.'],
                ]);
            }

            $quantity = $this->positiveDecimal($item['quantityPerOrder'] ?? $item['quantity_per_order'] ?? null);
            if ($quantity === null) {
                throw ValidationException::withMessages([
                    $fieldPrefix.'.quantityPerOrder' => ['Quantity per order must be greater than zero.'],
                ]);
            }

            $wasteFactor = $this->boundedDecimal($item['wasteFactorPercent'] ?? $item['waste_factor_percent'] ?? 0, 0, 100);
            if ($wasteFactor === null) {
                throw ValidationException::withMessages([
                    $fieldPrefix.'.wasteFactorPercent' => ['Waste factor must be between 0 and 100.'],
                ]);
            }

            $stage = $this->nullableText($item['consumptionStage'] ?? $item['consumption_stage'] ?? null) ?? 'per_order';
            if (! in_array($stage, self::CONSUMPTION_STAGES, true)) {
                throw ValidationException::withMessages([
                    $fieldPrefix.'.consumptionStage' => ['Select a valid consumption stage.'],
                ]);
            }

            $unit = $this->nullableText($item['unit'] ?? null) ?? (string) $inventoryItem->unit;

            $normalized[] = [
                'inventory_item_id' => $inventoryItemId,
                'quantity_per_order' => $quantity,
                'unit' => $unit,
                'waste_factor_percent' => $wasteFactor,
                'consumption_stage' => $stage,
                'notes' => $this->nullableText($item['notes'] ?? null),
            ];
        }

        return $normalized;
    }

    /**
     * @param  array<int, string>  $allowedCategories
     */
    private function eligibleInventoryItem(string $inventoryItemId, array $allowedCategories): ?InventoryItemModel
    {
        $query = InventoryItemModel::query()
            ->whereIn('category', $allowedCategories)
            ->where('status', 'active');
        $this->applyPlatformScopeIfEnabled($query);

        return $query->find($inventoryItemId);
    }

    private function transformRecipeItem(ClinicalCatalogConsumptionRecipeItemModel $line): array
    {
        $inventoryItem = $line->inventoryItem;

        return [
            'id' => (string) $line->id,
            'clinicalCatalogItemId' => (string) $line->clinical_catalog_item_id,
            'inventoryItemId' => (string) $line->inventory_item_id,
            'quantityPerOrder' => (string) $line->quantity_per_order,
            'unit' => $line->unit,
            'wasteFactorPercent' => (string) $line->waste_factor_percent,
            'consumptionStage' => $line->consumption_stage,
            'isActive' => (bool) $line->is_active,
            'notes' => $line->notes,
            'inventoryItem' => $inventoryItem instanceof InventoryItemModel
                ? $this->transformInventoryOption($inventoryItem)
                : null,
            'createdAt' => $line->created_at?->toISOString(),
            'updatedAt' => $line->updated_at?->toISOString(),
        ];
    }

    private function transformInventoryOption(InventoryItemModel $item): array
    {
        return [
            'id' => (string) $item->id,
            'itemCode' => $item->item_code,
            'itemName' => $item->item_name,
            'category' => $item->category,
            'subcategory' => $item->subcategory,
            'unit' => $item->unit,
            'manufacturer' => $item->manufacturer,
            'currentStock' => (string) $item->current_stock,
            'reorderLevel' => (string) $item->reorder_level,
            'status' => $item->status,
        ];
    }

    private function applyPlatformScopeIfEnabled(Builder $query): void
    {
        if (! $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            && ! $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation')) {
            return;
        }

        $this->platformScopeQueryApplier->apply($query);
    }

    private function nullableText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    private function positiveDecimal(mixed $value): ?string
    {
        if (! is_numeric($value)) {
            return null;
        }

        $number = (float) $value;

        return $number > 0 ? number_format($number, 4, '.', '') : null;
    }

    private function boundedDecimal(mixed $value, float $min, float $max): ?string
    {
        if (! is_numeric($value)) {
            return null;
        }

        $number = (float) $value;

        return $number >= $min && $number <= $max ? number_format($number, 2, '.', '') : null;
    }
}
