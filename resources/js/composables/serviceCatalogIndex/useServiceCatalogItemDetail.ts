import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { CatalogItem, CatalogResponse } from '@/lib/billingServiceCatalog';

export function useServiceCatalogItemDetail(itemId: MaybeRefOrGetter<string | null>): UseQueryReturnType<CatalogItem, Error> {
    return useQuery({
        queryKey: ['service-catalog-item-detail', computed(() => toValue(itemId))],
        queryFn: async () => {
            const response = await apiGet<CatalogResponse>(`/billing-service-catalog/items/${toValue(itemId)}`);
            return response.data;
        },
        enabled: computed(() => toValue(itemId) !== null),
    });
}
