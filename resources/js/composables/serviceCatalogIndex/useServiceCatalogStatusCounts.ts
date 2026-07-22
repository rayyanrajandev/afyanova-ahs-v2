import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { CatalogStatusCounts, StatusCountResponse } from '@/lib/billingServiceCatalog';
import type { ServiceCatalogFilters } from './useServiceCatalogFilters';

export function useServiceCatalogStatusCounts(filters: ServiceCatalogFilters): UseQueryReturnType<CatalogStatusCounts, Error> {
    return useQuery({
        queryKey: ['service-catalog-status-counts', computed(() => ({ ...filters }))],
        queryFn: async () => {
            const response = await apiGet<StatusCountResponse>('/billing-service-catalog/items/status-counts', {
                q: filters.q.trim() || null,
                serviceType: filters.serviceType.trim() || null,
                departmentId: filters.departmentId.trim() || null,
                lifecycle: filters.lifecycle || null,
                linkage: filters.linkage || null,
            });
            return response.data ?? { active: 0, inactive: 0, retired: 0, other: 0, total: 0 };
        },
    });
}
