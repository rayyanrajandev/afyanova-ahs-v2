<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;

class GetBillingServiceCatalogItemUseCase
{
    public function __construct(private readonly BillingServiceCatalogItemRepositoryInterface $repository) {}

    public function execute(string $id): ?array
    {
        return $this->repository->findById($id);
    }
}
