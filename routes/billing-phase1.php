<?php

use App\Http\Middleware\EnforceTenantIsolationWhenEnabled;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use App\Http\Middleware\ResolvePlatformScopeContext;
use App\Modules\Billing\Presentation\Http\Controllers\BillingDiscountController;
use App\Modules\Billing\Presentation\Http\Controllers\BillingRefundController;
use App\Modules\Billing\Presentation\Http\Controllers\BillingRoutingController;
use App\Modules\Billing\Presentation\Http\Controllers\CashBillingController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', ResolvePlatformScopeContext::class, EnforceTenantIsolationWhenEnabled::class, EnsureMappedFacilitySubscriptionEntitlement::class])
    ->prefix('api/v1')
    ->group(function () {
    // Cash Billing Routes
    Route::prefix('cash-patients')->group(function () {
        Route::get('/', [CashBillingController::class, 'index'])
            ->middleware('can:billing.cash-accounts.read')
            ->name('cash-billing.index');
        Route::post('/', [CashBillingController::class, 'createAccount'])
            ->middleware('can:billing.cash-accounts.manage')
            ->name('cash-billing.create-account');
        Route::get('{accountId}', [CashBillingController::class, 'getAccount'])
            ->middleware('can:billing.cash-accounts.read')
            ->name('cash-billing.get-account');
        Route::get('{accountId}/balance', [CashBillingController::class, 'getBalance'])
            ->middleware('can:billing.cash-accounts.read')
            ->name('cash-billing.get-balance');
        Route::post('{accountId}/charges', [CashBillingController::class, 'recordCharge'])
            ->middleware('can:billing.cash-accounts.manage')
            ->name('cash-billing.record-charge');
        Route::post('{accountId}/payments', [CashBillingController::class, 'recordPayment'])
            ->middleware('can:billing.cash-accounts.manage')
            ->name('cash-billing.record-payment');
    });

    // Discount Routes
    Route::prefix('discount-policies')->group(function () {
        Route::post('/', [BillingDiscountController::class, 'createPolicy'])
            ->middleware('can:billing.discounts.manage')
            ->name('discounts.create-policy');
        Route::get('/', [BillingDiscountController::class, 'listPolicies'])
            ->middleware('can:billing.discounts.read')
            ->name('discounts.list-policies');
        Route::get('{policyId}', [BillingDiscountController::class, 'getPolicy'])
            ->middleware('can:billing.discounts.read')
            ->name('discounts.get-policy');
    });

    // Apply discounts
    Route::post('invoices/{invoiceId}/apply-discount', [BillingDiscountController::class, 'applyToInvoice'])
        ->middleware('can:billing.discounts.manage')
        ->name('discounts.apply-to-invoice');
    Route::post('discount-applications', [BillingDiscountController::class, 'applyDirect'])
        ->middleware('can:billing.discounts.manage')
        ->name('discounts.apply-direct');

    // Refunds
    Route::prefix('billing-refunds')->group(function () {
        Route::get('/', [BillingRefundController::class, 'listRefunds'])
            ->middleware('can:billing.refunds.read')
            ->name('billing-refunds.index');
        Route::post('/', [BillingRefundController::class, 'createRefund'])
            ->middleware('can:billing.refunds.create')
            ->name('billing-refunds.create');
        Route::get('pending', [BillingRefundController::class, 'listPendingRefunds'])
            ->middleware('can:billing.refunds.read')
            ->name('billing-refunds.pending');
        Route::get('{refundId}', [BillingRefundController::class, 'getRefund'])
            ->middleware('can:billing.refunds.read')
            ->name('billing-refunds.show');
        Route::post('{refundId}/approve', [BillingRefundController::class, 'approveRefund'])
            ->middleware('can:billing.refunds.approve')
            ->name('billing-refunds.approve');
        Route::post('{refundId}/process', [BillingRefundController::class, 'processRefund'])
            ->middleware('can:billing.refunds.process')
            ->name('billing-refunds.process');
    });

    Route::get('billing-invoices/{invoiceId}/refunds', [BillingRefundController::class, 'getInvoiceRefunds'])
        ->middleware('can:billing.refunds.read')
        ->name('billing-refunds.invoice-index');

    // Billing routing
    Route::post('billing-routing/determine', [BillingRoutingController::class, 'determine'])
        ->middleware('can:billing.routing.read')
        ->name('billing-routing.determine');
});
