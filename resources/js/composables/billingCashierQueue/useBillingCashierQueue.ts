import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { BillingCashierQueueFilters } from './useBillingCashierQueueFilters';

export type CashierQueueEntry = {
    patientId: string;
    patientNumber: string;
    patientName: string;
    phone: string | null;
    unpaidInvoiceCount: number;
    totalUnpaidAmount: number;
    paidInvoiceCount: number;
    totalPaidAmount: number;
    unbilledServiceCount: number;
    inConsultation: boolean;
    summaryLabel: string;
};

type CashierQueueResponse = {
    data: CashierQueueEntry[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

export function useBillingCashierQueue(
    filters: BillingCashierQueueFilters,
): UseQueryReturnType<CashierQueueResponse, Error> {
    return useQuery({
        queryKey: ['billing-cashier-queue', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<CashierQueueResponse>('/billing-invoices/cashier-queue', {
                q: filters.q.trim() || null,
                status: filters.status === 'all' ? null : filters.status,
                page: filters.page,
                perPage: filters.perPage,
            }),
        placeholderData: (previousData) => previousData,
    });
}
