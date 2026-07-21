import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { ServiceTypeCounts, ServiceTypeCountResponse } from '@/lib/billingServiceCatalog';
import type { ServiceCatalogFilters } from './useServiceCatalogFilters';

export function useServiceCatalogTypeCounts(filters: ServiceCatalogFilters): UseQueryReturnType<ServiceTypeCounts, Error> {
    return useQuery({
        queryKey: ['service-catalog-type-counts', computed(() => ({ ...filters }))],
        queryFn: async () => {
            const response = await apiGet<ServiceTypeCountResponse>('/billing-service-catalog/items/service-type-counts', {
                q: filters.q.trim() || null,
                departmentId: filters.departmentId.trim() || null,
                lifecycle: filters.lifecycle || null,
            });
            return response.data ?? { total: 0 };
        },
    });
}
