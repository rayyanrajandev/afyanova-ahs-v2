import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';

export type RecordChargeInput = {
    accountId: string;
    serviceName: string;
    quantity: number;
    unitPrice: number;
    description?: string;
};

export type RecordPaymentInput = {
    accountId: string;
    amountPaid: number;
    paymentMethod: 'cash' | 'card' | 'mobile_money' | 'check';
    paymentReference?: string;
};

export type RefundPaymentInput = {
    accountId: string;
    paymentId: string;
    refundAmount: number;
    refundReason: string;
};

/**
 * Wraps the Cash Payments write endpoints (all gated
 * billing.cash-accounts.manage, per routes/billing-phase1.php) as mutations
 * that invalidate the accounts list, the status counts, and the affected
 * account's detail query on success.
 */
export function useCashAccountActions() {
    const queryClient = useQueryClient();

    function invalidate(accountId: string | null) {
        void queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
        void queryClient.invalidateQueries({ queryKey: ['cash-accounts-status-counts'] });
        if (accountId) {
            void queryClient.invalidateQueries({ queryKey: ['cash-account', accountId] });
        }
    }

    const createAccount = useMutation({
        mutationFn: (body: { patient_id: string; currency_code?: string; notes?: string }) => apiPost('/cash-patients', { body }),
    });

    const recordCharge = useMutation({
        mutationFn: ({ accountId, serviceName, quantity, unitPrice, description }: RecordChargeInput) =>
            apiPost(`/cash-patients/${accountId}/charges`, {
                body: { service_name: serviceName, quantity, unit_price: unitPrice, description },
            }),
    });

    const recordPayment = useMutation({
        mutationFn: ({ accountId, amountPaid, paymentMethod, paymentReference }: RecordPaymentInput) =>
            apiPost(`/cash-patients/${accountId}/payments`, {
                body: { amount_paid: amountPaid, payment_method: paymentMethod, payment_reference: paymentReference || undefined },
            }),
    });

    const convertToInvoice = useMutation({
        mutationFn: (accountId: string) => apiPost(`/cash-patients/${accountId}/convert-to-invoice`),
    });

    const voidAccount = useMutation({
        mutationFn: ({ accountId, voidReason }: { accountId: string; voidReason: string }) =>
            apiPost(`/cash-patients/${accountId}/void`, { body: { void_reason: voidReason } }),
    });

    const refundPayment = useMutation({
        mutationFn: ({ accountId, paymentId, refundAmount, refundReason }: RefundPaymentInput) =>
            apiPost(`/cash-patients/${accountId}/refund`, {
                body: { payment_id: paymentId, refund_amount: refundAmount, refund_reason: refundReason },
            }),
    });

    return {
        createAccount,
        recordCharge,
        recordPayment,
        convertToInvoice,
        voidAccount,
        refundPayment,
        invalidate,
    };
}
