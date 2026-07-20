import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { BillingInvoiceAuditLog } from '@/pages/billing/invoices/types';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

export type PatientAuditLogWithInvoice = BillingInvoiceAuditLog & {
    invoiceNumber: string | null;
};

export function usePatientAuditLogs(
    patientId: MaybeRefOrGetter<string | null>,
    invoices: MaybeRefOrGetter<BillingInvoice[]>,
): UseQueryReturnType<PatientAuditLogWithInvoice[], Error> {
    const invoiceList = computed(() => toValue(invoices));
    const hasInvoice = computed(() => invoiceList.value.length > 0);

    return useQuery({
        queryKey: ['billing-patient-audit-logs', computed(() => toValue(patientId))],
        queryFn: async () => {
            const id = toValue(patientId);
            if (!id) return [];

            const response = await apiGet<{ data: PatientAuditLogWithInvoice[] }>(
                `/billing/${id}/audit-logs`,
            );

            return response.data ?? [];
        },
        enabled: computed(() => Boolean(toValue(patientId)) && hasInvoice.value),
    });
}
