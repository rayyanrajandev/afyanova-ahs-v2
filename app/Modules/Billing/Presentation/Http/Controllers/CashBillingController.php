<?php

namespace App\Modules\Billing\Presentation\Http\Controllers;

use App\Modules\Billing\Application\UseCases\CreateCashBillingAccountUseCase;
use App\Modules\Billing\Application\UseCases\ListCashBillingAccountsUseCase;
use App\Modules\Billing\Application\UseCases\RecordCashChargeUseCase;
use App\Modules\Billing\Application\UseCases\RecordCashPaymentUseCase;
use App\Modules\Billing\Domain\Repositories\CashBillingAccountRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\CashBillingChargeRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\CashBillingPaymentRepositoryInterface;
use App\Modules\Billing\Presentation\Http\Concerns\RespondsWithBillingApi;
use App\Modules\Billing\Presentation\Http\Requests\CreateCashBillingAccountRequest;
use App\Modules\Billing\Presentation\Http\Requests\ListCashBillingAccountsRequest;
use App\Modules\Billing\Presentation\Http\Requests\RecordCashBillingChargeRequest;
use App\Modules\Billing\Presentation\Http\Requests\RecordCashBillingPaymentRequest;
use App\Modules\Billing\Presentation\Http\Transformers\CashBillingAccountResponseTransformer;
use App\Modules\Billing\Presentation\Http\Transformers\CashBillingChargeResponseTransformer;
use App\Modules\Billing\Presentation\Http\Transformers\CashBillingPaymentResponseTransformer;
use Illuminate\Http\JsonResponse;

class CashBillingController
{
    use RespondsWithBillingApi;

    public function __construct(
        private readonly ListCashBillingAccountsUseCase $listAccountsUseCase,
        private readonly CreateCashBillingAccountUseCase $createAccountUseCase,
        private readonly RecordCashChargeUseCase $recordChargeUseCase,
        private readonly RecordCashPaymentUseCase $recordPaymentUseCase,
        private readonly CashBillingAccountRepositoryInterface $accountRepository,
        private readonly CashBillingChargeRepositoryInterface $chargeRepository,
        private readonly CashBillingPaymentRepositoryInterface $paymentRepository,
    ) {}

    public function index(ListCashBillingAccountsRequest $request): JsonResponse
    {
        $result = $this->listAccountsUseCase->execute($request->validated());

        return $this->successResponse(
            data: array_map([CashBillingAccountResponseTransformer::class, 'transform'], $result['data']),
            meta: $result['meta'],
        );
    }

    /**
     * Create a cash billing account for a patient
     */
    public function createAccount(CreateCashBillingAccountRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $account = $this->createAccountUseCase->execute($validated);

        return $this->successResponse(
            data: CashBillingAccountResponseTransformer::transform($account),
            status: 201,
        );
    }

    /**
     * Get cash billing account details
     */
    public function getAccount(string $accountId): JsonResponse
    {
        $account = $this->accountRepository->findById($accountId);

        if ($account === null) {
            return $this->notFoundResponse('Cash billing account not found');
        }

        $payments = $this->paymentRepository->findByAccountId($accountId);
        $charges = $this->chargeRepository->findByAccountId($accountId);

        return $this->successResponse([
            'account' => CashBillingAccountResponseTransformer::transform($account),
            'charges' => array_map([CashBillingChargeResponseTransformer::class, 'transform'], $charges),
            'payments' => array_map([CashBillingPaymentResponseTransformer::class, 'transform'], $payments),
        ]);
    }

    /**
     * Get account balance
     */
    public function getBalance(string $accountId): JsonResponse
    {
        $account = $this->accountRepository->findById($accountId);

        if ($account === null) {
            return $this->notFoundResponse('Cash billing account not found');
        }

        return $this->successResponse([
            'account_id' => $accountId,
            'balance' => (float) $account['account_balance'],
            'total_charged' => (float) $account['total_charged'],
            'total_paid' => (float) $account['total_paid'],
            'currency' => $account['currency_code'],
        ]);
    }

    /**
     * Record a charge against the account
     */
    public function recordCharge(string $accountId, RecordCashBillingChargeRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $validated['cash_billing_account_id'] = $accountId;
        $validated['recorded_by_user_id'] = $request->user()?->id;

        $charge = $this->recordChargeUseCase->execute($validated);

        return $this->successResponse(
            data: CashBillingChargeResponseTransformer::transform($charge),
            status: 201,
        );
    }

    /**
     * Record a payment against the account
     */
    public function recordPayment(string $accountId, RecordCashBillingPaymentRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $validated['cash_billing_account_id'] = $accountId;
        $validated['confirmed_by_user_id'] = $request->user()?->id;

        $payment = $this->recordPaymentUseCase->execute($validated);

        return $this->successResponse(
            data: CashBillingPaymentResponseTransformer::transform($payment),
            status: 201,
        );
    }
}
