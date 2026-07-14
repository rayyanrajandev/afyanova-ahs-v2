import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { RadiologyOrderFilters } from './useRadiologyOrderFilters';

/**
 * Matches ListRadiologyOrderStatusCountsUseCase's return shape exactly
 * (app/Modules/Radiology/Application/UseCases/ListRadiologyOrderStatusCountsUseCase.php
 * -> EloquentRadiologyOrderRepository::statusCounts()). Flat status tally
 * only — no derived buckets. Counts are all-time (not scoped by
 * worklistScope) — only q/patientId/from/to/modality filter them. This
 * endpoint does NOT accept encounterId (unlike the list endpoint).
 */
export type RadiologyOrderStatusCounts = {
    ordered: number;
    scheduled: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};

type RadiologyOrderStatusCountsResponse = { data: RadiologyOrderStatusCounts };

export function useRadiologyOrderStatusCounts(
    filters: RadiologyOrderFilters,
): UseQueryReturnType<RadiologyOrderStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'radiology-orders-status-counts',
            computed(() => ({
                q: filters.q,
                patientId: filters.patientId,
                from: filters.from,
                to: filters.to,
            })),
        ],
        queryFn: async () => {
            const response = await apiGet<RadiologyOrderStatusCountsResponse>('/radiology-orders/status-counts', {
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
