import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { TheatreProcedureFilters } from './useTheatreProcedureFilters';

/**
 * Matches ListTheatreProcedureStatusCountsUseCase's return shape exactly
 * (app/Modules/TheatreProcedure/Application/UseCases/ListTheatreProcedureStatusCountsUseCase.php
 * -> EloquentTheatreProcedureRepository::statusCounts()). Flat status tally
 * only — no derived buckets. Counts are all-time (not scoped by
 * worklistScope) — only q/patientId/from/to filter them.
 */
export type TheatreProcedureStatusCounts = {
    planned: number;
    in_preop: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};

type TheatreProcedureStatusCountsResponse = { data: TheatreProcedureStatusCounts };

export function useTheatreProcedureStatusCounts(
    filters: TheatreProcedureFilters,
): UseQueryReturnType<TheatreProcedureStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'theatre-procedures-status-counts',
            computed(() => ({
                q: filters.q,
                patientId: filters.patientId,
                from: filters.from,
                to: filters.to,
            })),
        ],
        queryFn: async () => {
            const response = await apiGet<TheatreProcedureStatusCountsResponse>('/theatre-procedures/status-counts', {
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
