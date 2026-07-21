import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';
import { toApiDateTime, type CatalogAuditLog, type CatalogAuditLogListResponse } from '@/lib/billingServiceCatalog';
import type { Pagination } from '@/lib/billingServiceCatalog';
import type { ServiceCatalogAuditLogFilters } from './useServiceCatalogAuditLogFilters';

export function useServiceCatalogAuditLogs(
    itemId: MaybeRefOrGetter<string | null>,
    filters: ServiceCatalogAuditLogFilters,
    enabled: MaybeRefOrGetter<boolean>,
): UseQueryReturnType<{ data: CatalogAuditLog[]; meta: Pagination | null }, Error> {
    return useQuery({
        queryKey: ['service-catalog-audit-logs', computed(() => toValue(itemId)), computed(() => ({ ...filters }))],
        queryFn: async () => {
            const response = await apiGet<CatalogAuditLogListResponse>(`/billing-service-catalog/items/${toValue(itemId)}/audit-logs`, {
                q: filters.q.trim() || null,
                action: filters.action.trim() || null,
                actorType: filters.actorType || null,
                actorId: filters.actorId.trim() || null,
                from: toApiDateTime(filters.from),
                to: toApiDateTime(filters.to),
                perPage: filters.perPage,
                page: filters.page,
            });
            return { data: response.data ?? [], meta: response.meta ?? null };
        },
        enabled: computed(() => toValue(itemId) !== null && toValue(enabled)),
    });
}
