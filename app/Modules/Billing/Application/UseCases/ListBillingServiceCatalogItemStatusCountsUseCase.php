<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;

class ListBillingServiceCatalogItemStatusCountsUseCase
{
    public function __construct(private readonly BillingServiceCatalogItemRepositoryInterface $repository) {}

    public function execute(array $filters): array
    {
        $query = isset($filters['q']) ? trim((string) $filters['q']) : null;
        $query = $query === '' ? null : $query;

        $serviceType = isset($filters['serviceType']) ? trim((string) $filters['serviceType']) : null;
        $serviceType = $serviceType === '' ? null : $serviceType;

        $department = isset($filters['departmentId']) ? trim((string) $filters['departmentId']) : null;
        if ($department === '') {
            $department = isset($filters['department']) ? trim((string) $filters['department']) : null;
        }
        $department = $department === '' ? null : $department;

        $currencyCode = isset($filters['currencyCode']) ? strtoupper(trim((string) $filters['currencyCode'])) : null;
        $currencyCode = $currencyCode === '' ? null : $currencyCode;

        $lifecycle = isset($filters['lifecycle']) ? strtolower(trim((string) $filters['lifecycle'])) : null;
        $lifecycle = in_array($lifecycle, ['effective', 'scheduled', 'expired', 'no_window'], true) ? $lifecycle : null;

        return $this->repository->statusCounts(
            query: $query,
            serviceType: $serviceType,
            department: $department,
            currencyCode: $currencyCode,
            lifecycle: $lifecycle,
        );
    }
}
