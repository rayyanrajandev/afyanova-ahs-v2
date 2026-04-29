<?php

namespace App\Modules\InventoryProcurement\Infrastructure\Repositories;

use App\Modules\InventoryProcurement\Domain\Repositories\InventoryItemRepositoryInterface;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemModel;
use App\Modules\InventoryProcurement\Application\Services\DepartmentRequisitionScopeResolver;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

class EloquentInventoryItemRepository implements InventoryItemRepositoryInterface
{
    public function __construct(
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
        private readonly DepartmentRequisitionScopeResolver $departmentRequisitionScopeResolver,
    ) {}

    public function create(array $attributes): array
    {
        $item = new InventoryItemModel();
        $item->fill($this->filterAttributesForCurrentSchema($attributes));
        $item->save();

        return $item->toArray();
    }

    public function findById(string $id): ?array
    {
        $query = InventoryItemModel::query();
        $this->applyPlatformScopeIfEnabled($query);
        $item = $query->find($id);

        return $item?->toArray();
    }

    public function findBestActiveMatchByCodeOrName(?string $itemCode, ?string $itemName): ?array
    {
        $normalizedCode = $this->normalizeLookupText($itemCode);
        $normalizedName = $this->normalizeLookupText($itemName);

        if ($normalizedCode === '' && $normalizedName === '') {
            return null;
        }

        $query = InventoryItemModel::query()
            ->where('status', 'active');
        $this->applyPlatformScopeIfEnabled($query);

        $query->where(function (Builder $builder) use ($itemCode, $itemName): void {
            if ($itemCode !== null && trim($itemCode) !== '') {
                $builder->orWhere('item_code', 'like', '%'.trim($itemCode).'%');
            }

            if ($itemName !== null && trim($itemName) !== '') {
                $builder->orWhere('item_name', 'like', '%'.trim($itemName).'%');
            }
        });

        $candidates = $query
            ->limit(25)
            ->get();

        $bestMatch = $candidates
            ->map(fn (InventoryItemModel $item) => [
                'item' => $item,
                'score' => $this->inventoryItemMatchScore(
                    itemCode: (string) $item->item_code,
                    itemName: (string) $item->item_name,
                    requestedCode: $normalizedCode,
                    requestedName: $normalizedName,
                ),
            ])
            ->filter(fn (array $entry): bool => $entry['score'] > 0)
            ->sort(function (array $left, array $right): int {
                if ($right['score'] !== $left['score']) {
                    return $right['score'] <=> $left['score'];
                }

                return strcmp(
                    (string) ($left['item']->item_name ?? ''),
                    (string) ($right['item']->item_name ?? ''),
                );
            })
            ->first();

        if ($bestMatch === null) {
            return null;
        }

        return $bestMatch['item']->toArray();
    }

    public function update(string $id, array $attributes): ?array
    {
        $query = InventoryItemModel::query();
        $this->applyPlatformScopeIfEnabled($query);
        $item = $query->find($id);
        if (! $item) {
            return null;
        }

        $item->fill($this->filterAttributesForCurrentSchema($attributes));
        $item->save();

        return $item->toArray();
    }

    public function existsByItemCode(string $itemCode, ?string $excludeId = null): bool
    {
        return InventoryItemModel::query()
            ->where('item_code', $itemCode)
            ->when(
                $excludeId,
                fn (Builder $builder, string $id) => $builder->where('id', '!=', $id),
            )
            ->exists();
    }

    public function search(
        ?string $query,
        ?string $category,
        ?string $subcategory,
        ?string $requestingDepartmentId,
        ?string $stockState,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array {
        $sortBy = in_array($sortBy, ['item_code', 'item_name', 'category', 'current_stock', 'reorder_level', 'created_at', 'updated_at', 'generic_name', 'ven_classification', 'manufacturer'], true)
            ? $sortBy
            : 'item_name';

        $queryBuilder = InventoryItemModel::query()->withCount('stockMovements');
        $this->applyPlatformScopeIfEnabled($queryBuilder);

        $queryBuilder
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $like = '%'.$searchTerm.'%';
                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->where('item_code', 'like', $like)
                        ->orWhere('item_name', 'like', $like)
                        ->orWhere('generic_name', 'like', $like)
                        ->orWhere('category', 'like', $like)
                        ->orWhere('msd_code', 'like', $like)
                        ->orWhere('barcode', 'like', $like);
                });
            })
            ->when($category, fn (Builder $builder, string $requestedCategory) => $builder->where('category', $requestedCategory))
            ->when($subcategory, fn (Builder $builder, string $requestedSubcategory) => $builder->where('subcategory', $requestedSubcategory))
            ->when($stockState === 'out_of_stock', fn (Builder $builder) => $builder->where('current_stock', '<=', 0))
            ->when($stockState === 'low_stock', fn (Builder $builder) => $builder->where('current_stock', '>', 0)->whereColumn('current_stock', '<=', 'reorder_level'))
            ->when($stockState === 'healthy', fn (Builder $builder) => $builder->whereColumn('current_stock', '>', 'reorder_level'))
            ->orderBy($sortBy, $sortDirection);

        $this->departmentRequisitionScopeResolver->applyItemScope($queryBuilder, $requestingDepartmentId);

        $paginator = $queryBuilder->paginate(
            perPage: $perPage,
            columns: ['*'],
            pageName: 'page',
            page: $page,
        );

        return $this->toSearchResult($paginator);
    }

    public function stockAlertCounts(?string $query, ?string $category): array
    {
        $queryBuilder = InventoryItemModel::query();
        $this->applyPlatformScopeIfEnabled($queryBuilder);

        $queryBuilder
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $like = '%'.$searchTerm.'%';
                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->where('item_code', 'like', $like)
                        ->orWhere('item_name', 'like', $like)
                        ->orWhere('category', 'like', $like);
                });
            })
            ->when($category, fn (Builder $builder, string $requestedCategory) => $builder->where('category', $requestedCategory));

        $all = (clone $queryBuilder)->count();
        $outOfStock = (clone $queryBuilder)->where('current_stock', '<=', 0)->count();
        $lowStock = (clone $queryBuilder)->where('current_stock', '>', 0)->whereColumn('current_stock', '<=', 'reorder_level')->count();
        $healthy = max($all - $outOfStock - $lowStock, 0);

        return [
            'outOfStock' => $outOfStock,
            'lowStock' => $lowStock,
            'healthy' => $healthy,
            'total' => $all,
        ];
    }

    private function applyPlatformScopeIfEnabled(Builder $query): void
    {
        if (! $this->isPlatformScopingEnabled()) {
            return;
        }

        $this->platformScopeQueryApplier->apply($query);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function filterAttributesForCurrentSchema(array $attributes): array
    {
        if (! Schema::hasColumn('inventory_items', 'codes')) {
            unset($attributes['codes']);
        }

        if (! Schema::hasColumn('inventory_items', 'clinical_catalog_item_id')) {
            unset($attributes['clinical_catalog_item_id']);
        }

        return $attributes;
    }

    private function isPlatformScopingEnabled(): bool
    {
        return $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            || $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation');
    }

    private function normalizeLookupText(?string $value): string
    {
        return mb_strtolower(trim((string) $value));
    }

    private function inventoryItemMatchScore(
        string $itemCode,
        string $itemName,
        string $requestedCode,
        string $requestedName
    ): int {
        $normalizedItemCode = $this->normalizeLookupText($itemCode);
        $normalizedItemName = $this->normalizeLookupText($itemName);

        $score = 0;

        if ($requestedCode !== '') {
            if ($normalizedItemCode === $requestedCode) {
                $score = max($score, 700);
            } elseif (str_ends_with($normalizedItemCode, '-'.$requestedCode)) {
                $score = max($score, 560);
            } elseif (str_contains($normalizedItemCode, $requestedCode)) {
                $score = max($score, 460);
            }
        }

        if ($requestedName !== '') {
            if ($normalizedItemName === $requestedName) {
                $score = max($score, 640);
            } elseif (
                str_contains($normalizedItemName, $requestedName)
                || str_contains($requestedName, $normalizedItemName)
            ) {
                $score = max($score, 420);
            }
        }

        return $score;
    }

    private function toSearchResult(LengthAwarePaginator $paginator): array
    {
        return [
            'data' => array_map(
                static fn (InventoryItemModel $item): array => $item->toArray(),
                $paginator->items(),
            ),
            'meta' => [
                'currentPage' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ];
    }
}
