<?php

namespace App\Modules\Billing\Infrastructure\Repositories;

use App\Modules\Billing\Domain\Repositories\CashBillingPaymentRepositoryInterface;
use App\Modules\Billing\Infrastructure\Models\CashBillingPaymentModel;

class CashBillingPaymentRepository implements CashBillingPaymentRepositoryInterface
{
    public function findByAccountId(string $accountId): array
    {
        return CashBillingPaymentModel::query()
            ->where('cash_billing_account_id', $accountId)
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            ->get()
            ->toArray();
    }
}
