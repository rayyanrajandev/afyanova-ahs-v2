import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { DirectServiceFilters } from './useDirectServiceFilters';

/**
 * Matches ListServiceRequestStatusCountsUseCase/EloquentServiceRequestRepository
 * ::statusCounts()'s return shape exactly: pending/in_progress/completed/
 * cancelled/total — ServiceRequestStatus has only these 4 values plus no
 * "other" bucket (unlike Appointment/Emergency's status enums).
 */
export type DirectServiceStatusCounts = {
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    total: number;
};

type DirectServiceStatusCountsResponse = {
    data: DirectServiceStatusCounts;
    meta: { departmentScopeMissing: boolean };
};

export function useDirectServiceStatusCounts(
    filters: DirectServiceFilters,
): UseQueryReturnType<DirectServiceStatusCountsResponse, Error> {
    return useQuery({
        queryKey: [
            'direct-service-status-counts',
            computed(() => ({ priority: filters.priority, departmentId: filters.departmentId, from: filters.from, to: filters.to })),
        ],
        queryFn: () =>
            apiGet<DirectServiceStatusCountsResponse>('/service-requests/status-counts', {
                priority: filters.priority || null,
                departmentId: filters.departmentId || null,
                from: filters.from || null,
                to: filters.to || null,
            }),
        refetchInterval: 30_000,
    });
}
