import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { CatalogItem, CatalogVersionsResponse } from '@/lib/billingServiceCatalog';

export function useServiceCatalogVersionHistory(itemId: MaybeRefOrGetter<string | null>): UseQueryReturnType<CatalogItem[], Error> {
    return useQuery({
        queryKey: ['service-catalog-version-history', computed(() => toValue(itemId))],
        queryFn: async () => {
            const response = await apiGet<CatalogVersionsResponse>(`/billing-service-catalog/items/${toValue(itemId)}/versions`);
            return response.data ?? [];
        },
        enabled: computed(() => toValue(itemId) !== null),
    });
}
