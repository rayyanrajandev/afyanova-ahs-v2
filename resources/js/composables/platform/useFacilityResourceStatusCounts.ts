import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { FacilityResourceFilters } from './useFacilityResourceFilters';

export type FacilityResourceStatusCounts = { active: number; inactive: number; other: number; total: number };

type FacilityResourceStatusCountsResponse = { data: FacilityResourceStatusCounts };

export function useFacilityResourceStatusCounts(
    basePath: string,
    subtypeParam: 'wardName' | 'roomName',
    filters: FacilityResourceFilters,
): UseQueryReturnType<FacilityResourceStatusCounts, Error> {
    return useQuery({
        queryKey: [
            `${basePath}-status-counts`,
            computed(() => ({ q: filters.q, departmentId: filters.departmentId, subtype: filters.subtype })),
        ],
        queryFn: async () => {
            const response = await apiGet<FacilityResourceStatusCountsResponse>(`/platform/admin/${basePath}/status-counts`, {
                q: filters.q.trim() || null,
                departmentId: filters.departmentId || null,
                [subtypeParam]: filters.subtype.trim() || null,
            });
            return response.data;
        },
    });
}
