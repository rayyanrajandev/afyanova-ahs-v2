import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { CatalogListResponse } from '@/lib/billingServiceCatalog';
import type { ServiceCatalogFilters } from './useServiceCatalogFilters';

function filterQuery(filters: ServiceCatalogFilters) {
    return {
        q: filters.q.trim() || null,
        serviceType: filters.serviceType.trim() || null,
        status: filters.status || null,
        departmentId: filters.departmentId.trim() || null,
        lifecycle: filters.lifecycle || null,
        linkage: filters.linkage || null,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        perPage: filters.perPage,
        page: filters.page,
    };
}

export function useServiceCatalogItems(filters: ServiceCatalogFilters): UseQueryReturnType<CatalogListResponse, Error> {
    return useQuery({
        queryKey: ['service-catalog-items', computed(() => ({ ...filters }))],
        queryFn: () => apiGet<CatalogListResponse>('/billing-service-catalog/items', filterQuery(filters)),
    });
}
