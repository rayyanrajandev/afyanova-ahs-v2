import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { EmergencyCaseFilters } from './useEmergencyCaseFilters';

/**
 * Matches ListEmergencyTriageCaseStatusCountsUseCase's repository return
 * shape exactly (EloquentEmergencyTriageCaseRepository::statusCounts()):
 * waiting/triaged/in_treatment/admitted/discharged/cancelled/other/total.
 */
export type EmergencyCaseStatusCounts = {
    waiting: number;
    triaged: number;
    in_treatment: number;
    admitted: number;
    discharged: number;
    cancelled: number;
    other: number;
    total: number;
};

type EmergencyCaseStatusCountsResponse = { data: EmergencyCaseStatusCounts };

export function useEmergencyCaseStatusCounts(filters: EmergencyCaseFilters): UseQueryReturnType<EmergencyCaseStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'emergency-case-status-counts',
            computed(() => ({ q: filters.q, triageLevel: filters.triageLevel, from: filters.from, to: filters.to })),
        ],
        queryFn: async () => {
            const response = await apiGet<EmergencyCaseStatusCountsResponse>('/emergency-triage-cases/status-counts', {
                q: filters.q.trim() || null,
                triageLevel: filters.triageLevel || null,
                from: filters.from || null,
                to: filters.to || null,
            });
            return response.data;
        },
    });
}
