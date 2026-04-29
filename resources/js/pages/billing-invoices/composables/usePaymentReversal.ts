import { ref, type Ref } from 'vue';

import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

import {
    amountToNumber,
    billingPaymentIsReversal,
    normalizeLocalDateTimeForApi,
} from '../helpers';
import type {
    BillingInvoice,
    BillingInvoicePayment,
    ReverseBillingInvoicePaymentResponse,
    ValidationErrorResponse,
} from '../types';

type BillingApiRequest = <T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | boolean | string[] | null | undefined>;
        body?: Record<string, unknown>;
    },
) => Promise<T>;

type PaymentReversalSubmitPayload = {
    amount: number;
    reason: string;
    approvalCaseReference: string | null;
    note: string | null;
    reversalAt: string | null;
};

type UsePaymentReversalOptions = {
    apiRequest: BillingApiRequest;
    invoiceDetailsInvoice: Ref<BillingInvoice | null>;
    invoiceDetailsPayments: Ref<BillingInvoicePayment[]>;
    canReverseBillingPayments: Ref<boolean>;
    canViewBillingPaymentHistory: Ref<boolean>;
    canViewBillingInvoiceAuditLogs: Ref<boolean>;
    loadInvoiceDetailsPayments: (invoiceId: string) => Promise<void>;
    loadInvoiceDetailsAuditLogs: (invoiceId: string) => Promise<void>;
    reloadQueueAndSummary: () => Promise<void>;
    formatMoney: (
        value: string | number | null,
        currencyCode: string | null,
    ) => string;
};

export function usePaymentReversal(options: UsePaymentReversalOptions) {
    const paymentReversalDialogOpen = ref(false);
    const paymentReversalDialogInvoice = ref<BillingInvoice | null>(null);
    const paymentReversalDialogPayment = ref<BillingInvoicePayment | null>(null);
    const paymentReversalDialogError = ref<string | null>(null);
    const paymentReversalSubmitting = ref(false);

    function billingPaymentReversedAmountFor(paymentId: string): number {
        return Math.round(
            options.invoiceDetailsPayments.value
                .filter(
                    (entry) =>
                        billingPaymentIsReversal(entry) &&
                        entry.reversalOfPaymentId === paymentId,
                )
                .reduce(
                    (sum, entry) =>
                        sum + Math.abs(amountToNumber(entry.amount) ?? 0),
                    0,
                ) * 100,
        ) / 100;
    }

    function billingPaymentRemainingReversibleAmount(
        payment: BillingInvoicePayment,
    ): number {
        const originalAmount = Math.abs(amountToNumber(payment.amount) ?? 0);
        const reversedAmount = billingPaymentReversedAmountFor(payment.id);
        return Math.round(Math.max(originalAmount - reversedAmount, 0) * 100) / 100;
    }

    function billingPaymentCanBeReversed(payment: BillingInvoicePayment): boolean {
        if (!options.canReverseBillingPayments.value) return false;
        if (billingPaymentIsReversal(payment)) return false;
        if ((amountToNumber(payment.amount) ?? 0) <= 0) return false;

        const invoiceStatus = (
            options.invoiceDetailsInvoice.value?.status ?? ''
        ).toLowerCase();
        if (['draft', 'cancelled', 'voided'].includes(invoiceStatus)) return false;

        return billingPaymentRemainingReversibleAmount(payment) > 0;
    }

    function clearPaymentReversalDialogError() {
        paymentReversalDialogError.value = null;
    }

    function closePaymentReversalDialog() {
        if (paymentReversalSubmitting.value) return;

        paymentReversalDialogOpen.value = false;
        paymentReversalDialogInvoice.value = null;
        paymentReversalDialogPayment.value = null;
        paymentReversalDialogError.value = null;
    }

    function handlePaymentReversalDialogOpenChange(open: boolean) {
        if (open) {
            paymentReversalDialogOpen.value = true;
            return;
        }

        closePaymentReversalDialog();
    }

    function openPaymentReversalDialog(payment: BillingInvoicePayment) {
        if (!options.invoiceDetailsInvoice.value) return;
        if (!billingPaymentCanBeReversed(payment)) return;

        paymentReversalDialogInvoice.value = options.invoiceDetailsInvoice.value;
        paymentReversalDialogPayment.value = payment;
        paymentReversalDialogError.value = null;
        paymentReversalDialogOpen.value = true;
    }

    async function submitPaymentReversalDialog(
        payload: PaymentReversalSubmitPayload,
    ) {
        const invoice = paymentReversalDialogInvoice.value;
        const payment = paymentReversalDialogPayment.value;

        if (!invoice || !payment) return;
        if (paymentReversalSubmitting.value) return;

        const parsedAmount = Number(payload.amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            paymentReversalDialogError.value =
                'Reversal amount must be a valid number greater than zero.';
            return;
        }

        const remainingReversible = billingPaymentRemainingReversibleAmount(
            payment,
        );
        if (parsedAmount > remainingReversible) {
            paymentReversalDialogError.value =
                'Reversal amount cannot exceed the remaining reversible amount for this payment.';
            return;
        }

        const reason = payload.reason.trim();
        if (!reason) {
            paymentReversalDialogError.value = 'Reversal reason is required.';
            return;
        }

        paymentReversalDialogError.value = null;
        paymentReversalSubmitting.value = true;

        try {
            const response =
                await options.apiRequest<ReverseBillingInvoicePaymentResponse>(
                    'POST',
                    `/billing-invoices/${invoice.id}/payments/${payment.id}/reversals`,
                    {
                        body: {
                            amount: parsedAmount,
                            reason,
                            approvalCaseReference: payload.approvalCaseReference,
                            note: payload.note,
                            reversalAt: normalizeLocalDateTimeForApi(
                                payload.reversalAt,
                            ),
                        },
                    },
                );

            const updatedInvoice = response.data.invoice;
            const reversal = response.data.reversal;

            notifySuccess(
                `Reversed ${options.formatMoney(
                    Math.abs(amountToNumber(reversal.amount) ?? 0),
                    updatedInvoice.currencyCode,
                )} on ${updatedInvoice.invoiceNumber ?? 'billing invoice'}.`,
            );

            if (options.invoiceDetailsInvoice.value?.id === updatedInvoice.id) {
                options.invoiceDetailsInvoice.value = updatedInvoice;
                if (options.canViewBillingPaymentHistory.value) {
                    await options.loadInvoiceDetailsPayments(updatedInvoice.id);
                }
                if (options.canViewBillingInvoiceAuditLogs.value) {
                    await options.loadInvoiceDetailsAuditLogs(updatedInvoice.id);
                }
            }

            await options.reloadQueueAndSummary();
            closePaymentReversalDialog();
        } catch (error) {
            const apiError = error as Error & {
                status?: number;
                payload?: ValidationErrorResponse;
            };

            if (apiError.status === 422 && apiError.payload?.errors) {
                paymentReversalDialogError.value =
                    apiError.payload.errors.amount?.[0] ??
                    apiError.payload.errors.approvalCaseReference?.[0] ??
                    apiError.payload.errors.reason?.[0] ??
                    apiError.payload.message ??
                    'Unable to reverse payment.';
            } else {
                paymentReversalDialogError.value = messageFromUnknown(
                    error,
                    'Unable to reverse payment.',
                );
            }
            notifyError(paymentReversalDialogError.value);
        } finally {
            paymentReversalSubmitting.value = false;
        }
    }

    return {
        paymentReversalDialogOpen,
        paymentReversalDialogInvoice,
        paymentReversalDialogPayment,
        paymentReversalDialogError,
        paymentReversalSubmitting,
        billingPaymentCanBeReversed,
        openPaymentReversalDialog,
        handlePaymentReversalDialogOpenChange,
        clearPaymentReversalDialogError,
        submitPaymentReversalDialog,
    };
}
