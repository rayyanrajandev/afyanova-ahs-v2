import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { BillingInvoicePayment } from '@/pages/billing/invoices/types';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

export type PatientPaymentWithInvoice = BillingInvoicePayment & {
    invoiceNumber: string | null;
    invoiceStatus: string | null;
    currencyCode: string | null;
};

export function usePatientPayments(
    patientId: MaybeRefOrGetter<string | null>,
    invoices: MaybeRefOrGetter<BillingInvoice[]>,
): UseQueryReturnType<PatientPaymentWithInvoice[], Error> {
    const invoiceList = computed(() => toValue(invoices));
    const hasPaidInvoice = computed(() =>
        invoiceList.value.some((inv) => Number(inv.paidAmount) > 0),
    );

    return useQuery({
        queryKey: ['billing-patient-payments', computed(() => toValue(patientId))],
        queryFn: async () => {
            const id = toValue(patientId);
            if (!id) return [];

            const response = await apiGet<{ data: PatientPaymentWithInvoice[] }>(
                `/billing/${id}/payments`,
            );

            return response.data ?? [];
        },
        enabled: computed(() => Boolean(toValue(patientId)) && hasPaidInvoice.value),
    });
}
