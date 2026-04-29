<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;

class ListBillingServiceCatalogItemVersionsUseCase
{
    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $repository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
    ) {}

    public function execute(string $id): ?array
    {
        $item = $this->repository->findById($id);
        if (! $item) {
            return null;
        }

        $serviceCode = (string) ($item['service_code'] ?? '');
        if ($serviceCode === '') {
            return [];
        }

        return $this->repository->listVersionsByServiceCodeFamily(
            serviceCode: $serviceCode,
            tenantId: $this->platformScopeContext->tenantId(),
            facilityId: $this->platformScopeContext->facilityId(),
        );
    }
}
