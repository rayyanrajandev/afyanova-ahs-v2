import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { ReceptionQueueFilters } from './useReceptionQueue';

/**
 * Matches GetReceptionQueueStatusCountsUseCase's return shape exactly.
 * Keyed on non-paging filters only (q/department/clinicianUserId, not
 * stage/page/perPage) — same "counts independent of the current page/tab"
 * shape as useEmergencyCaseStatusCounts.ts, replacing the previous
 * client-side `.length` of an already-loaded, unpaginated query result.
 */
export type ReceptionQueueStatusCounts = {
    waiting_triage: number;
    waiting_provider: number;
    in_consultation: number;
    total: number;
};

type ReceptionQueueStatusCountsResponse = { data: ReceptionQueueStatusCounts };

export function useReceptionQueueStatusCounts(
    filters: ReceptionQueueFilters,
): UseQueryReturnType<ReceptionQueueStatusCounts, Error> {
    return useQuery({
        queryKey: ['reception-queue-status-counts', computed(() => ({ q: filters.q, department: filters.department, clinicianUserId: filters.clinicianUserId }))],
        queryFn: async () => {
            const response = await apiGet<ReceptionQueueStatusCountsResponse>('/reception/queue/status-counts', {
                q: filters.q.trim() || null,
                department: filters.department || null,
                clinicianUserId: filters.clinicianUserId || null,
            });
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
