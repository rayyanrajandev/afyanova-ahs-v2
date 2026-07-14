import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { LaboratoryOrderFilters } from './useLaboratoryOrderFilters';

/**
 * Matches ListLaboratoryOrderStatusCountsUseCase's return shape exactly
 * (app/Modules/Laboratory/Application/UseCases/ListLaboratoryOrderStatusCountsUseCase.php
 * -> EloquentLaboratoryOrderRepository::statusCounts()). Flat status tally
 * only — no derived buckets like pharmacy's reconciliation counts. Counts
 * are all-time (not scoped by worklistScope) — only q/patientId/from/to
 * filter them.
 */
export type LaboratoryOrderStatusCounts = {
    ordered: number;
    collected: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};

type LaboratoryOrderStatusCountsResponse = { data: LaboratoryOrderStatusCounts };

export function useLaboratoryOrderStatusCounts(
    filters: LaboratoryOrderFilters,
): UseQueryReturnType<LaboratoryOrderStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'laboratory-orders-status-counts',
            computed(() => ({
                q: filters.q,
                patientId: filters.patientId,
                from: filters.from,
                to: filters.to,
            })),
        ],
        queryFn: async () => {
            const response = await apiGet<LaboratoryOrderStatusCountsResponse>('/laboratory-orders/status-counts', {
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
