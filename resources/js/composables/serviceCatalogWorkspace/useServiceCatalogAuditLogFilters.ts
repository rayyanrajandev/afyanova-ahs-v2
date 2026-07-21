import { reactive } from 'vue';

export function useServiceCatalogAuditLogFilters() {
    return reactive({
        q: '',
        action: '',
        actorType: '',
        actorId: '',
        from: '',
        to: '',
        perPage: 20,
        page: 1,
    });
}

export type ServiceCatalogAuditLogFilters = ReturnType<typeof useServiceCatalogAuditLogFilters>;
