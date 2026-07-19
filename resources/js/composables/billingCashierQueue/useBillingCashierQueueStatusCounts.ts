import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { BillingCashierQueueFilters } from './useBillingCashierQueueFilters';

export type BillingCashierQueueStatusCounts = {
    all: number;
    inConsultation: number;
    unpaid: number;
    paid: number;
};

type CashierQueueResponse = { meta: { total: number } };

/**
 * Mirrors usePatientStatusCounts.ts's shape (search-aware, status-independent
 * counts for the stat-card row and status Tabs) but has no dedicated
 * counts endpoint to call — ListCashierQueueUseCase doesn't expose one.
 * Reuses /billing-invoices/cashier-queue itself with perPage=1 for each
 * status value and reads meta.total, which is the full filtered-set size
 * regardless of page size (see ListCashierQueueUseCase::execute — total is
 * computed before slicing), so this is accurate without adding a backend
 * endpoint. Four small requests instead of one, but each is cheap (no
 * invoice/order data materialized beyond building patient IDs).
 */
export function useBillingCashierQueueStatusCounts(
    filters: BillingCashierQueueFilters,
): UseQueryReturnType<BillingCashierQueueStatusCounts, Error> {
    return useQuery({
        queryKey: ['billing-cashier-queue-status-counts', computed(() => filters.q)],
        queryFn: async () => {
            const q = filters.q.trim() || null;
            const [all, inConsultation, unpaid, paid] = await Promise.all([
                apiGet<CashierQueueResponse>('/billing-invoices/cashier-queue', { q, perPage: 1 }),
                apiGet<CashierQueueResponse>('/billing-invoices/cashier-queue', { q, status: 'in_consultation', perPage: 1 }),
                apiGet<CashierQueueResponse>('/billing-invoices/cashier-queue', { q, status: 'unpaid', perPage: 1 }),
                apiGet<CashierQueueResponse>('/billing-invoices/cashier-queue', { q, status: 'paid', perPage: 1 }),
            ]);

            return {
                all: all.meta.total,
                inConsultation: inConsultation.meta.total,
                unpaid: unpaid.meta.total,
                paid: paid.meta.total,
            };
        },
    });
}
