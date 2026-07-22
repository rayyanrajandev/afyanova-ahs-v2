import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';

export type RecordPaymentInput = {
    invoiceId: string;
    amount: number;
    payerType: string;
    paymentMethod: string;
    paymentReference: string;
    note?: string;
};

type PaymentResponse = {
    data: {
        id: string;
        amount: number;
        paymentMethod: string;
        payerType: string;
    };
};

/**
 * Wraps the Cashier Queue's write endpoints as mutations that invalidate the
 * queue list and the affected patient's invoice detail on success, so the
 * next read of either always reflects the server's state. Optimistic UI
 * (instant balance updates, the undo toast, draft-payment localStorage) stays
 * in billing/IndexV2.vue — that's page-local presentation state, not a data
 * concern this composable should own.
 *
 * Shared by both billing/IndexV2.vue (queryKey 'billing-cashier-patient') and
 * billing/workspace/Workspace.vue + its tabs (queryKeys
 * 'billing-patient-workspace', 'billing-patient-payments',
 * 'billing-patient-audit-logs') — invalidate() must cover every one of these
 * or a mutation succeeds server-side but its caller's own screen goes stale
 * until a full page reload starts a fresh query. (Found: this function only
 * invalidated the two IndexV2-era keys, so every workspace action —
 * recordPayment, reversePayment, issueInvoice, charge capture — silently
 * failed to refresh the workspace, payments tab, or audit tab.)
 */
export function useBillingCashierActions() {
    const queryClient = useQueryClient();

    function invalidate(patientId: string | null) {
        void queryClient.invalidateQueries({ queryKey: ['billing-cashier-queue'] });
        void queryClient.invalidateQueries({ queryKey: ['billing-cashier-queue-status-counts'] });
        if (patientId) {
            void queryClient.invalidateQueries({ queryKey: ['billing-cashier-patient', patientId] });
            void queryClient.invalidateQueries({ queryKey: ['billing-patient-workspace', patientId] });
            void queryClient.invalidateQueries({ queryKey: ['billing-patient-payments', patientId] });
            void queryClient.invalidateQueries({ queryKey: ['billing-patient-audit-logs', patientId] });
        }
    }

    const recordPayment = useMutation({
        mutationFn: ({ invoiceId, amount, payerType, paymentMethod, paymentReference, note }: RecordPaymentInput) =>
            apiPost<PaymentResponse>(`/billing/${invoiceId}/payments`, {
                body: {
                    amount,
                    payerType,
                    paymentMethod,
                    paymentReference: paymentReference || null,
                    note: note || null,
                },
            }),
    });

    /**
     * `/billing/{id}/payments/undo` (what the legacy Cashier Queue
     * called) doesn't exist server-side — grepped routes/api.php and
     * BillingInvoiceController, no such route or method. The only real
     * reversal path is `/billing/{id}/payments/{paymentId}/reversals`
     * (permission billing.payments.reverse, distinct from
     * billing.payments.record), which requires an audited `reason` — see
     * ReverseBillingInvoicePaymentRequest::rules(). billing/IndexV2.vue gates
     * the Undo toast on billing.payments.reverse and collects that reason
     * before calling this.
     */
    const reversePayment = useMutation({
        mutationFn: ({
            invoiceId,
            paymentId,
            amount,
            reason,
        }: {
            invoiceId: string;
            paymentId: string;
            amount: number;
            reason: string;
        }) =>
            apiPost(`/billing/${invoiceId}/payments/${paymentId}/reversals`, {
                body: { amount, reason },
            }),
    });

    const issueInvoice = useMutation({
        mutationFn: (invoiceId: string) =>
            apiPatch(`/billing/${invoiceId}/status`, { body: { status: 'issued' } }),
    });

    const addChargeCandidateToDraft = useMutation({
        mutationFn: ({ draftInvoiceId, lineItems }: { draftInvoiceId: string; lineItems: Record<string, unknown>[] }) =>
            apiPatch(`/billing/${draftInvoiceId}`, { body: { lineItems } }),
    });

    const createInvoiceFromCandidate = useMutation({
        mutationFn: (body: Record<string, unknown>) => apiPost('/billing', { body }),
    });

    async function fetchPatientSummary(patientId: string) {
        return apiGet<{ data: { patientNumber: string | null; firstName: string | null; lastName: string | null; phone: string | null } }>(
            `/patients/${patientId}`,
        ).catch(() => null);
    }

    return {
        recordPayment,
        reversePayment,
        issueInvoice,
        addChargeCandidateToDraft,
        createInvoiceFromCandidate,
        fetchPatientSummary,
        invalidate,
    };
}
