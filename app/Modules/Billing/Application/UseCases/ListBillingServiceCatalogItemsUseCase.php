<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Billing\Domain\ValueObjects\BillingServiceCatalogItemStatus;

class ListBillingServiceCatalogItemsUseCase
{
    public function __construct(private readonly BillingServiceCatalogItemRepositoryInterface $repository) {}

    public function execute(array $filters): array
    {
        $page = max((int) ($filters['page'] ?? 1), 1);
        $perPage = min(max((int) ($filters['perPage'] ?? 15), 1), 100);

        $sortMap = [
            'serviceCode' => 'service_code',
            'serviceName' => 'service_name',
            'serviceType' => 'service_type',
            'department' => 'department',
            'basePrice' => 'base_price',
            'currencyCode' => 'currency_code',
            'status' => 'status',
            'effectiveFrom' => 'effective_from',
            'updatedAt' => 'updated_at',
            'createdAt' => 'created_at',
        ];
        $sortBy = $filters['sortBy'] ?? 'serviceName';
        $sortBy = $sortMap[$sortBy] ?? 'service_name';

        $sortDirection = strtolower((string) ($filters['sortDir'] ?? 'asc'));
        $sortDirection = $sortDirection === 'desc' ? 'desc' : 'asc';

        $query = isset($filters['q']) ? trim((string) $filters['q']) : null;
        $query = $query === '' ? null : $query;

        $serviceType = isset($filters['serviceType']) ? trim((string) $filters['serviceType']) : null;
        $serviceType = $serviceType === '' ? null : $serviceType;

        $status = isset($filters['status']) ? strtolower(trim((string) $filters['status'])) : null;
        $status = in_array($status, BillingServiceCatalogItemStatus::values(), true) ? $status : null;

        $department = isset($filters['departmentId']) ? trim((string) $filters['departmentId']) : null;
        if ($department === '') {
            $department = isset($filters['department']) ? trim((string) $filters['department']) : null;
        }
        $department = $department === '' ? null : $department;

        $currencyCode = isset($filters['currencyCode']) ? strtoupper(trim((string) $filters['currencyCode'])) : null;
        $currencyCode = $currencyCode === '' ? null : $currencyCode;

        $lifecycle = isset($filters['lifecycle']) ? strtolower(trim((string) $filters['lifecycle'])) : null;
        $lifecycle = in_array($lifecycle, ['effective', 'scheduled', 'expired', 'no_window'], true) ? $lifecycle : null;

        return $this->repository->search(
            query: $query,
            serviceType: $serviceType,
            status: $status,
            department: $department,
            currencyCode: $currencyCode,
            lifecycle: $lifecycle,
            page: $page,
            perPage: $perPage,
            sortBy: $sortBy,
            sortDirection: $sortDirection,
        );
    }
}
