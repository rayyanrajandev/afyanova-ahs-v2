<?php

namespace App\Modules\Billing\Domain\Repositories;

interface CashBillingPaymentRepositoryInterface
{
    /**
     * Find all payments for an account
     *
     * @return array<int, array<string, mixed>>
     */
    public function findByAccountId(string $accountId): array;
}
