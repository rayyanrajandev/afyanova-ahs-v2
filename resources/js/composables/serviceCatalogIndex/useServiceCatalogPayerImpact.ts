import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { CatalogPayerImpactResponse, CatalogPayerImpactSummary } from '@/lib/billingServiceCatalog';

/** Gate this with the caller's own billing.payer-contracts.read check via `enabled`. */
export function useServiceCatalogPayerImpact(
    itemId: MaybeRefOrGetter<string | null>,
    enabled: MaybeRefOrGetter<boolean>,
): UseQueryReturnType<CatalogPayerImpactSummary, Error> {
    return useQuery({
        queryKey: ['service-catalog-payer-impact', computed(() => toValue(itemId))],
        queryFn: async () => {
            const response = await apiGet<CatalogPayerImpactResponse>(`/billing-service-catalog/items/${toValue(itemId)}/payer-impact`);
            return response.data;
        },
        enabled: computed(() => toValue(itemId) !== null && toValue(enabled)),
    });
}
