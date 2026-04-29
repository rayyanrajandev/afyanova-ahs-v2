<?php

namespace App\Modules\InventoryProcurement\Domain\Repositories;

interface InventoryItemRepositoryInterface
{
    public function create(array $attributes): array;

    public function findById(string $id): ?array;

    public function findBestActiveMatchByCodeOrName(
        ?string $itemCode,
        ?string $itemName
    ): ?array;

    public function update(string $id, array $attributes): ?array;

    public function existsByItemCode(string $itemCode, ?string $excludeId = null): bool;

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
    ): array;

    public function stockAlertCounts(
        ?string $query,
        ?string $category
    ): array;
}
