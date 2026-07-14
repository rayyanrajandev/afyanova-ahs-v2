import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { WardBedFilters } from './useWardBedFilters';

export type WardBedStatusCounts = { active: number; inactive: number; other: number; total: number };

type WardBedStatusCountsResponse = { data: WardBedStatusCounts };

export function useWardBedStatusCounts(filters: WardBedFilters): UseQueryReturnType<WardBedStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'ward-beds-status-counts',
            computed(() => ({ q: filters.q, departmentId: filters.departmentId, wardName: filters.wardName })),
        ],
        queryFn: async () => {
            const response = await apiGet<WardBedStatusCountsResponse>('/platform/admin/ward-beds/status-counts', {
                q: filters.q.trim() || null,
                departmentId: filters.departmentId || null,
                wardName: filters.wardName.trim() || null,
            });
            return response.data;
        },
    });
}
