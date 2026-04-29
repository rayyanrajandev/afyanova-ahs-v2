<?php

namespace App\Modules\Admission\Domain\Repositories;

interface AdmissionRepositoryInterface
{
    public function create(array $attributes): array;

    public function findById(string $id): ?array;

    public function update(string $id, array $attributes): ?array;

    public function existsByAdmissionNumber(string $admissionNumber): bool;

    public function hasActivePlacementConflict(
        string $ward,
        string $bed,
        ?string $tenantId,
        ?string $facilityId,
        ?string $excludeAdmissionId = null
    ): bool;

    public function search(
        ?string $query,
        ?string $patientId,
        ?string $status,
        ?string $ward,
        ?string $fromDateTime,
        ?string $toDateTime,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array;

    public function statusCounts(
        ?string $query,
        ?string $patientId,
        ?string $ward,
        ?string $fromDateTime,
        ?string $toDateTime
    ): array;
}


