import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { CashAccountsFilters } from './useCashAccountsFilters';

export type CashAccountsStatusCounts = {
    all: number;
    active: number;
    settled: number;
    suspended: number;
};

type CashAccountsResponse = { meta: { total: number } };

/**
 * Same trick as useBillingCashierQueueStatusCounts.ts: no dedicated counts
 * endpoint exists, so this reuses /cash-patients itself with perPage=1 per
 * status and reads meta.total (the full filtered-set size regardless of
 * page size — see ListCashBillingAccountsUseCase/CashBillingAccountRepository).
 */
export function useCashAccountsStatusCounts(filters: CashAccountsFilters): UseQueryReturnType<CashAccountsStatusCounts, Error> {
    return useQuery({
        queryKey: ['cash-accounts-status-counts', computed(() => filters.q)],
        queryFn: async () => {
            const q = filters.q.trim() || null;
            const [all, active, settled, suspended] = await Promise.all([
                apiGet<CashAccountsResponse>('/cash-patients', { q, perPage: 1 }),
                apiGet<CashAccountsResponse>('/cash-patients', { q, status: 'active', perPage: 1 }),
                apiGet<CashAccountsResponse>('/cash-patients', { q, status: 'settled', perPage: 1 }),
                apiGet<CashAccountsResponse>('/cash-patients', { q, status: 'suspended', perPage: 1 }),
            ]);

            return {
                all: all.meta.total,
                active: active.meta.total,
                settled: settled.meta.total,
                suspended: suspended.meta.total,
            };
        },
    });
}
