import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

export type BillingInvoiceStatusCounts = {
    draft: number;
    issued: number;
    partially_paid: number;
    paid: number;
    cancelled: number;
    voided: number;
    other: number;
    total: number;
};

type BillingInvoiceStatusCountsResponse = { data: BillingInvoiceStatusCounts };

export function useBillingInvoiceStatusCounts(): UseQueryReturnType<BillingInvoiceStatusCounts, Error> {
    return useQuery({
        queryKey: ['sidebar-billing-invoice-status-counts'],
        queryFn: async () => {
            const response = await apiGet<BillingInvoiceStatusCountsResponse>('/billing-invoices/status-counts');
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
