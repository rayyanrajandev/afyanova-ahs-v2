<?php

namespace App\Modules\Billing\Domain\Repositories;

interface BillingServiceCatalogItemRepositoryInterface
{
    public function create(array $attributes): array;

    public function findById(string $id): ?array;

    public function findActivePricingByServiceCode(
        string $serviceCode,
        string $currencyCode,
        ?string $asOfDateTime = null
    ): ?array;

    public function update(string $id, array $attributes): ?array;

    public function existsByServiceCode(
        string $serviceCode,
        ?string $tenantId = null,
        ?string $facilityId = null,
        ?string $excludeId = null
    ): bool;

    public function nextTariffVersion(
        string $serviceCode,
        ?string $tenantId = null,
        ?string $facilityId = null
    ): int;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listVersionsByServiceCodeFamily(
        string $serviceCode,
        ?string $tenantId = null,
        ?string $facilityId = null
    ): array;

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
    ): array;

    public function statusCounts(
        ?string $query,
        ?string $serviceType,
        ?string $department,
        ?string $currencyCode,
        ?string $lifecycle
    ): array;
}
