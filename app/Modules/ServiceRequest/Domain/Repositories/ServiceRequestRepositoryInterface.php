<?php

namespace App\Modules\ServiceRequest\Domain\Repositories;

interface ServiceRequestRepositoryInterface
{
    public function create(array $attributes): array;

    public function findById(string $id): ?array;

    public function update(string $id, array $attributes): ?array;

    public function existsByRequestNumber(string $requestNumber): bool;

    public function search(
        ?string $patientId,
        ?string $serviceType,
        ?string $status,
        ?string $priority,
        ?string $fromDateTime,
        ?string $toDateTime,
        int $page,
        int $perPage,
        string $sortDirection,
    ): array;

    public function statusCounts(
        ?string $serviceType,
        ?string $priority,
        ?string $fromDateTime,
        ?string $toDateTime,
    ): array;
}
