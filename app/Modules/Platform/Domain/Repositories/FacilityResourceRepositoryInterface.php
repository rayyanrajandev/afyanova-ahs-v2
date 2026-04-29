<?php

namespace App\Modules\Platform\Domain\Repositories;

interface FacilityResourceRepositoryInterface
{
    public function create(array $attributes): array;

    public function findById(string $id): ?array;

    public function update(string $id, array $attributes): ?array;

    public function existsByCodeInScope(
        string $resourceType,
        string $code,
        ?string $tenantId,
        ?string $facilityId,
        ?string $excludeId = null
    ): bool;

    public function search(
        string $resourceType,
        ?string $query,
        ?string $status,
        ?string $departmentId,
        ?string $subtype,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array;

    public function statusCounts(
        string $resourceType,
        ?string $query,
        ?string $departmentId,
        ?string $subtype
    ): array;

    public function activeWardBedExistsInScope(
        string $wardName,
        string $bedNumber,
        ?string $tenantId,
        ?string $facilityId
    ): bool;
}

