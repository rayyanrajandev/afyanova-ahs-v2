import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PharmacyOrderFilters } from './usePharmacyOrderFilters';

/**
 * Matches ListPharmacyOrderStatusCountsUseCase's return shape exactly
 * (app/Modules/Pharmacy/Application/UseCases/ListPharmacyOrderStatusCountsUseCase.php
 * -> EloquentPharmacyOrderRepository::statusCounts()). Counts are all-time
 * (not scoped by worklistScope) — only q/patientId/from/to filter them.
 */
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

export function usePharmacyOrderStatusCounts(
    filters: PharmacyOrderFilters,
): UseQueryReturnType<PharmacyOrderStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'pharmacy-orders-status-counts',
            computed(() => ({
                q: filters.q,
                patientId: filters.patientId,
                from: filters.from,
                to: filters.to,
            })),
        ],
        queryFn: async () => {
            const response = await apiGet<PharmacyOrderStatusCountsResponse>('/pharmacy-orders/status-counts', {
                q: filters.q.trim() || null,
                patientId: filters.patientId || null,
                from: filters.from || null,
                to: filters.to || null,
            });
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
