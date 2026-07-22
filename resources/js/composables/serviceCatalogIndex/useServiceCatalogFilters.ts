import { reactive } from 'vue';

/** Matches ListBillingServiceCatalogItemsUseCase's accepted filter set. */
export function useServiceCatalogFilters() {
    return reactive({
        q: '',
        serviceType: '',
        status: '',
        departmentId: '',
        lifecycle: '',
        linkage: '' as '' | 'clinical' | 'standalone',
        sortBy: 'serviceName',
        sortDir: 'asc' as 'asc' | 'desc',
        perPage: 50,
        page: 1,
    });
}

export type ServiceCatalogFilters = ReturnType<typeof useServiceCatalogFilters>;
