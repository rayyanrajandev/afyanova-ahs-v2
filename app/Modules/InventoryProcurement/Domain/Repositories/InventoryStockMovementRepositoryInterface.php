<?php

namespace App\Modules\InventoryProcurement\Domain\Repositories;

interface InventoryStockMovementRepositoryInterface
{
    public function create(array $attributes): array;

    public function search(
        ?string $query,
        ?string $itemId,
        ?string $movementType,
        ?string $sourceKey,
        ?string $actorType,
        ?int $actorId,
        ?string $fromDateTime,
        ?string $toDateTime,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array;

    public function summary(
        ?string $query,
        ?string $itemId,
        ?string $movementType,
        ?string $sourceKey,
        ?string $actorType,
        ?int $actorId,
        ?string $fromDateTime,
        ?string $toDateTime,
    ): array;
}
