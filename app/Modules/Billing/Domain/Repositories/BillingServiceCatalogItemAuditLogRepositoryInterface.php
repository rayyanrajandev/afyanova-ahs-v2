<?php

namespace App\Modules\Billing\Domain\Repositories;

interface BillingServiceCatalogItemAuditLogRepositoryInterface
{
    public function write(
        string $billingServiceCatalogItemId,
        string $action,
        ?int $actorId,
        array $changes = [],
        array $metadata = []
    ): void;

    public function listByBillingServiceCatalogItemId(
        string $billingServiceCatalogItemId,
        int $page,
        int $perPage,
        ?string $query,
        ?string $action,
        ?string $actorType,
        ?int $actorId,
        ?string $fromDateTime,
        ?string $toDateTime,
    ): array;
}
