import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { BillingInvoice, ChargeCaptureCandidate } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

export type BillingPatientSummary = {
    id: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
};

export type BillingWorkspaceSummary = {
    totalBilled: number;
    totalPaid: number;
    totalUnpaid: number;
    invoiceCount: number;
    unpaidInvoiceCount: number;
};

export type BillingWorkspaceResponse = {
    patient: BillingPatientSummary | null;
    invoices: BillingInvoice[];
    summary: BillingWorkspaceSummary;
    charges: ChargeCaptureCandidate[];
};

export function useBillingPatientWorkspace(
    patientId: MaybeRefOrGetter<string | null>,
): UseQueryReturnType<BillingWorkspaceResponse, Error> {
    return useQuery({
        queryKey: ['billing-patient-workspace', computed(() => toValue(patientId))],
        queryFn: async () => {
            const id = toValue(patientId);
            if (!id) throw new Error('Patient ID is required.');

            const [workspaceResponse, candidatesResponse] = await Promise.all([
                apiGet<{ data: { patient: BillingPatientSummary | null; invoices: BillingInvoice[]; summary: BillingWorkspaceSummary } }>(`/billing/${id}/workspace`),
                apiGet<{ data: ChargeCaptureCandidate[] }>('/billing-invoices/charge-capture-candidates', {
                    patientId: id,
                    includeInvoiced: 'false',
                    limit: 100,
                }),
            ]);

            const workspace = workspaceResponse.data;

            return {
                patient: workspace?.patient ?? null,
                invoices: (workspace?.invoices ?? []).map(normalizeInvoiceAmounts),
                summary: workspace?.summary ?? { totalBilled: 0, totalPaid: 0, totalUnpaid: 0, invoiceCount: 0, unpaidInvoiceCount: 0 },
                charges: candidatesResponse.data ?? [],
            };
        },
        enabled: computed(() => Boolean(toValue(patientId))),
    });
}

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
