import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PharmacyOrderFilters } from './usePharmacyOrderFilters';

export type PharmacyOrderStatusCounts = {
    pending: number;
    in_preparation: number;
    partially_dispensed: number;
    dispensed: number;
    cancelled: number;
    reconciliation_pending: number;
    reconciliation_completed: number;
    reconciliation_exception: number;
    other: number;
    total: number;
};

type PharmacyOrderStatusCountsResponse = { data: PharmacyOrderStatusCounts };

function statusCountsQuery(filters: PharmacyOrderFilters) {
    return {
        q: filters.q.trim() || null,
        patientId: filters.patientId || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function usePharmacyOrderStatusCounts(
    filters?: PharmacyOrderFilters,
): UseQueryReturnType<PharmacyOrderStatusCounts, Error> {
    return useQuery({
        queryKey: ['sidebar-pharmacy-order-status-counts', computed(() => (filters ? { ...filters } : {}))],
        queryFn: async () => {
            const response = await apiGet<PharmacyOrderStatusCountsResponse>('/pharmacy-orders/status-counts', filters ? statusCountsQuery(filters) : undefined);
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
