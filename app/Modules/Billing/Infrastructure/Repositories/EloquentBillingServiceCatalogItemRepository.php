<?php

namespace App\Modules\Billing\Infrastructure\Repositories;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use App\Support\CatalogGovernance\FacilityTierSupport;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

class EloquentBillingServiceCatalogItemRepository implements BillingServiceCatalogItemRepositoryInterface
{
    public function __construct(
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
    ) {}

    public function create(array $attributes): array
    {
        $item = new BillingServiceCatalogItemModel();
        $item->fill($this->filterAttributesForCurrentSchema($attributes));
        $item->save();
        if ($this->supportsClinicalCatalogLink()) {
            $item->load('clinicalCatalogItem');
        }

        return $item->toArray();
    }

    public function findById(string $id): ?array
    {
        $query = BillingServiceCatalogItemModel::query();
        if ($this->supportsClinicalCatalogLink()) {
            $query->with('clinicalCatalogItem');
        }
        $this->applyPlatformScopeIfEnabled($query);
        $item = $query->find($id);

        return $item?->toArray();
    }

    public function findActivePricingByServiceCode(
        string $serviceCode,
        string $currencyCode,
        ?string $asOfDateTime = null
    ): ?array {
        $effectiveDateTime = $asOfDateTime ?? now()->toDateTimeString();

        $query = BillingServiceCatalogItemModel::query()
            ->where('service_code', strtoupper(trim($serviceCode)))
            ->where('currency_code', strtoupper(trim($currencyCode)))
            ->where('status', 'active')
            ->where(function (Builder $builder) use ($effectiveDateTime): void {
                $builder->whereNull('effective_from')
                    ->orWhere('effective_from', '<=', $effectiveDateTime);
            })
            ->where(function (Builder $builder) use ($effectiveDateTime): void {
                $builder->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $effectiveDateTime);
            })
            ->orderByDesc('effective_from')
            ->orderByDesc('updated_at');

        if ($this->supportsClinicalCatalogLink()) {
            $query->with('clinicalCatalogItem');
        }

        $this->applyPlatformScopeIfEnabled($query);
        $this->applyFacilityTierAvailability($query);

        $item = $query->first();

        return $item?->toArray();
    }

    public function update(string $id, array $attributes): ?array
    {
        $query = BillingServiceCatalogItemModel::query();
        if ($this->supportsClinicalCatalogLink()) {
            $query->with('clinicalCatalogItem');
        }
        $this->applyPlatformScopeIfEnabled($query);
        $item = $query->find($id);
        if (! $item) {
            return null;
        }

        $item->fill($this->filterAttributesForCurrentSchema($attributes));
        $item->save();

        return $item->toArray();
    }

    public function existsByServiceCode(
        string $serviceCode,
        ?string $tenantId = null,
        ?string $facilityId = null,
        ?string $excludeId = null
    ): bool {
        return BillingServiceCatalogItemModel::query()
            ->where('service_code', $serviceCode)
            ->when(
                $tenantId !== null,
                fn (Builder $builder) => $builder->where('tenant_id', $tenantId),
            )
            ->when(
                $facilityId !== null,
                fn (Builder $builder) => $builder->where('facility_id', $facilityId),
            )
            ->when(
                $excludeId !== null,
                fn (Builder $builder) => $builder->where('id', '!=', $excludeId),
            )
            ->exists();
    }

    public function nextTariffVersion(
        string $serviceCode,
        ?string $tenantId = null,
        ?string $facilityId = null
    ): int {
        if (! $this->supportsTariffVersioning()) {
            return 1;
        }

        $maxVersion = BillingServiceCatalogItemModel::query()
            ->where('service_code', $serviceCode)
            ->when(
                $tenantId !== null,
                fn (Builder $builder) => $builder->where('tenant_id', $tenantId),
            )
            ->when(
                $facilityId !== null,
                fn (Builder $builder) => $builder->where('facility_id', $facilityId),
            )
            ->max('tariff_version');

        return max((int) $maxVersion, 0) + 1;
    }

    public function listVersionsByServiceCodeFamily(
        string $serviceCode,
        ?string $tenantId = null,
        ?string $facilityId = null
    ): array {
        $query = BillingServiceCatalogItemModel::query()
            ->where('service_code', strtoupper(trim($serviceCode)))
            ->when(
                $tenantId !== null,
                fn (Builder $builder) => $builder->where('tenant_id', $tenantId),
            )
            ->when(
                $facilityId !== null,
                fn (Builder $builder) => $builder->where('facility_id', $facilityId),
            );

        if ($this->supportsTariffVersioning()) {
            $query->orderByDesc('tariff_version');
        }

        if ($this->supportsClinicalCatalogLink()) {
            $query->with('clinicalCatalogItem');
        }
        $this->applyFacilityTierAvailability($query);

        return $query
            ->orderByDesc('effective_from')
            ->orderByDesc('updated_at')
            ->get()
            ->map(static fn (BillingServiceCatalogItemModel $item): array => $item->toArray())
            ->all();
    }

    public function search(
        ?string $query,
        ?string $serviceType,
        ?string $status,
        ?string $department,
        ?string $currencyCode,
        ?string $lifecycle,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array {
        $sortBy = in_array(
            $sortBy,
            [
                'service_code',
                'service_name',
                'service_type',
                'department',
                'base_price',
                'currency_code',
                'status',
                'effective_from',
                'updated_at',
                'created_at',
            ],
            true
        ) ? $sortBy : 'service_name';

        $queryBuilder = BillingServiceCatalogItemModel::query();
        if ($this->supportsClinicalCatalogLink()) {
            $queryBuilder->with('clinicalCatalogItem');
        }
        $this->applyPlatformScopeIfEnabled($queryBuilder);
        $this->applyFacilityTierAvailability($queryBuilder);

        $queryBuilder
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $like = '%'.$searchTerm.'%';
                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->where('service_code', 'like', $like)
                        ->orWhere('service_name', 'like', $like)
                        ->orWhere('service_type', 'like', $like)
                        ->orWhere('department', 'like', $like);
                });
            })
            ->when($serviceType, fn (Builder $builder, string $requestedServiceType) => $builder->where('service_type', $requestedServiceType))
            ->when($status, fn (Builder $builder, string $requestedStatus) => $builder->where('status', $requestedStatus))
            ->when($department, fn (Builder $builder, string $requestedDepartment) => $this->applyDepartmentFilter($builder, $requestedDepartment))
            ->when($currencyCode, fn (Builder $builder, string $requestedCurrencyCode) => $builder->where('currency_code', $requestedCurrencyCode))
            ->when($lifecycle, fn (Builder $builder, string $requestedLifecycle) => $this->applyLifecycleFilter($builder, $requestedLifecycle))
            ->orderBy($sortBy, $sortDirection);

        $paginator = $queryBuilder->paginate(
            perPage: $perPage,
            columns: ['*'],
            pageName: 'page',
            page: $page,
        );

        return $this->toSearchResult($paginator);
    }

    public function statusCounts(
        ?string $query,
        ?string $serviceType,
        ?string $department,
        ?string $currencyCode,
        ?string $lifecycle
    ): array {
        $queryBuilder = BillingServiceCatalogItemModel::query();
        $this->applyPlatformScopeIfEnabled($queryBuilder);
        $this->applyFacilityTierAvailability($queryBuilder);

        $queryBuilder
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $like = '%'.$searchTerm.'%';
                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->where('service_code', 'like', $like)
                        ->orWhere('service_name', 'like', $like)
                        ->orWhere('service_type', 'like', $like)
                        ->orWhere('department', 'like', $like);
                });
            })
            ->when($serviceType, fn (Builder $builder, string $requestedServiceType) => $builder->where('service_type', $requestedServiceType))
            ->when($department, fn (Builder $builder, string $requestedDepartment) => $this->applyDepartmentFilter($builder, $requestedDepartment))
            ->when($currencyCode, fn (Builder $builder, string $requestedCurrencyCode) => $builder->where('currency_code', $requestedCurrencyCode))
            ->when($lifecycle, fn (Builder $builder, string $requestedLifecycle) => $this->applyLifecycleFilter($builder, $requestedLifecycle));

        $rows = $queryBuilder
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->get();

        $counts = [
            'active' => 0,
            'inactive' => 0,
            'retired' => 0,
            'other' => 0,
            'total' => 0,
        ];

        foreach ($rows as $row) {
            $status = strtolower((string) $row->status);
            $aggregate = (int) $row->aggregate;

            if (array_key_exists($status, $counts) && $status !== 'other' && $status !== 'total') {
                $counts[$status] += $aggregate;
            } else {
                $counts['other'] += $aggregate;
            }

            $counts['total'] += $aggregate;
        }

        return $counts;
    }

    private function applyPlatformScopeIfEnabled(Builder $query): void
    {
        if (! $this->isPlatformScopingEnabled()) {
            return;
        }

        $this->platformScopeQueryApplier->apply($query);
    }

    private function applyFacilityTierAvailability(Builder $query): void
    {
        app(FacilityTierSupport::class)->applyAvailabilityFilter(
            $query,
            'billing_service_catalog_items',
            app(CurrentPlatformScopeContextInterface::class)->facilityId(),
        );
    }

    private function isPlatformScopingEnabled(): bool
    {
        return $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            || $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation');
    }

    private function supportsTariffVersioning(): bool
    {
        return Schema::hasColumn('billing_service_catalog_items', 'tariff_version')
            && Schema::hasColumn('billing_service_catalog_items', 'supersedes_billing_service_catalog_item_id');
    }

    private function supportsDepartmentMapping(): bool
    {
        return Schema::hasColumn('billing_service_catalog_items', 'department_id');
    }

    private function supportsClinicalCatalogLink(): bool
    {
        return Schema::hasColumn('billing_service_catalog_items', 'clinical_catalog_item_id');
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function filterAttributesForCurrentSchema(array $attributes): array
    {
        if (! $this->supportsTariffVersioning()) {
            unset($attributes['tariff_version'], $attributes['supersedes_billing_service_catalog_item_id']);
        }

        if (! $this->supportsDepartmentMapping()) {
            unset($attributes['department_id']);
        }

        if (! $this->supportsClinicalCatalogLink()) {
            unset($attributes['clinical_catalog_item_id']);
        }

        if (! Schema::hasColumn('billing_service_catalog_items', 'codes')) {
            unset($attributes['codes']);
        }

        if (! Schema::hasColumn('billing_service_catalog_items', 'facility_tier')) {
            unset($attributes['facility_tier']);
        }

        return $attributes;
    }

    private function applyDepartmentFilter(Builder $query, string $departmentFilter): void
    {
        if ($this->supportsDepartmentMapping() && $this->looksLikeUuid($departmentFilter)) {
            $query->where('department_id', $departmentFilter);

            return;
        }

        $query->where('department', $departmentFilter);
    }

    private function looksLikeUuid(string $value): bool
    {
        return preg_match(
            '/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/',
            $value,
        ) === 1;
    }

    private function applyLifecycleFilter(Builder $query, string $lifecycle): void
    {
        $effectiveDateTime = now()->toDateTimeString();

        match ($lifecycle) {
            'scheduled' => $query->whereNotNull('effective_from')->where('effective_from', '>', $effectiveDateTime),
            'expired' => $query->whereNotNull('effective_to')->where('effective_to', '<', $effectiveDateTime),
            'no_window' => $query->whereNull('effective_from')->whereNull('effective_to'),
            'effective' => $query
                ->where(function (Builder $builder) use ($effectiveDateTime): void {
                    $builder->whereNull('effective_from')->orWhere('effective_from', '<=', $effectiveDateTime);
                })
                ->where(function (Builder $builder) use ($effectiveDateTime): void {
                    $builder->whereNull('effective_to')->orWhere('effective_to', '>=', $effectiveDateTime);
                })
                ->where(function (Builder $builder): void {
                    $builder->whereNotNull('effective_from')->orWhereNotNull('effective_to');
                }),
            default => null,
        };
    }

    private function toSearchResult(LengthAwarePaginator $paginator): array
    {
        return [
            'data' => array_map(
                static fn (BillingServiceCatalogItemModel $item): array => $item->toArray(),
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
