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

/**
 * A live read, not a synced table — matches useReceptionQueue.ts's
 * refetchInterval so a cashier screen left open stays reasonably current
 * without a manual refresh button or websocket wiring.
 */
export function useBillingCashierQueue(
    filters: BillingCashierQueueFilters,
): UseQueryReturnType<CashierQueueResponse, Error> {
    return useQuery({
        queryKey: ['billing-cashier-queue', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<CashierQueueResponse>('/billing/cashier-queue', {
                q: filters.q.trim() || null,
                status: filters.status === 'all' ? null : filters.status,
                page: filters.page,
                perPage: filters.perPage,
            }),
        placeholderData: (previousData) => previousData,
        refetchInterval: 30_000,
    });
}
