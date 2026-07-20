import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type BillingInvoiceLineItem = {
    description: string;
    quantity: number;
    unitPrice: number;
    serviceCode: string | null;
};

export type BillingInvoice = {
    id: string;
    invoiceNumber: string | null;
    status: string;
    currencyCode?: string;
    subtotalAmount?: number;
    discountAmount?: number;
    taxAmount?: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    invoiceDate: string;
    paymentDueAt: string | null;
    notes?: string | null;
    lineItems: BillingInvoiceLineItem[];
};

export type ChargeCaptureCandidate = {
    id: string;
    serviceName?: string;
    sourceWorkflowLabel?: string;
    sourceWorkflowKind?: string;
    serviceType?: string;
    pricingStatus: string;
    alreadyInvoiced: boolean;
    performedAt?: string | null;
    currencyCode?: string;
    unitPrice?: number;
    lineTotal?: number;
    appointmentId?: string | null;
    admissionId?: string | null;
    suggestedLineItem: Record<string, unknown>;
};

export type BillingPatientInvoicesResult = {
    invoices: BillingInvoice[];
    candidates: ChargeCaptureCandidate[];
};

/**
 * BillingInvoiceResponseTransformer passes totalAmount/paidAmount/balanceAmount
 * straight through from the DB's decimal columns without a numeric cast, so
 * they arrive as strings ("15000.00") despite the API contract's declared
 * `number` type — confirmed live: summing them with `reduce((sum, inv) =>
 * sum + inv.totalAmount, 0)` silently string-concatenates into an
 * unparseable value (e.g. "015000.000.00"), which Intl.NumberFormat then
 * renders as "NaN". Coercing once here keeps every consumer (the totals
 * cards, applyOptimisticPayment's arithmetic) working with real numbers.
 */
function normalizeInvoiceAmounts(invoice: BillingInvoice): BillingInvoice {
    return {
        ...invoice,
        subtotalAmount: Number(invoice.subtotalAmount) || 0,
        discountAmount: Number(invoice.discountAmount) || 0,
        taxAmount: Number(invoice.taxAmount) || 0,
        totalAmount: Number(invoice.totalAmount) || 0,
        paidAmount: Number(invoice.paidAmount) || 0,
        balanceAmount: Number(invoice.balanceAmount) || 0,
    };
}

/**
 * Cached per-patient (queryKey includes patientId) so re-selecting a patient
 * already viewed this session — the core "serve patient, move on, come back
 * to fix something" loop of the Cashier Queue — is instant instead of
 * re-fetching both endpoints.
 */
export function useBillingPatientInvoices(
    patientId: MaybeRefOrGetter<string | null>,
): UseQueryReturnType<BillingPatientInvoicesResult, Error> {
    return useQuery({
        queryKey: ['billing-cashier-patient', computed(() => toValue(patientId))],
        queryFn: async () => {
            const id = toValue(patientId);
            const [invoicesResponse, candidatesResponse] = await Promise.all([
                apiGet<{ data: BillingInvoice[] }>('/billing-invoices', {
                    patientId: id,
                    perPage: 50,
                    sortBy: 'invoiceDate',
                    sortDir: 'desc',
                }),
                apiGet<{ data: ChargeCaptureCandidate[] }>('/billing-invoices/charge-capture-candidates', {
                    patientId: id,
                    includeInvoiced: 'false',
                    limit: 100,
                }),
            ]);

            return { invoices: invoicesResponse.data.map(normalizeInvoiceAmounts), candidates: candidatesResponse.data };
        },
        enabled: computed(() => Boolean(toValue(patientId))),
    });
}
