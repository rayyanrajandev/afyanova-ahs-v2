import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches ChargeableItemController::transform()
 * (app/Modules/Billing/Presentation/Http/Controllers/ChargeableItemController.php).
 */
export type ChargeableItemPrice = {
    id: string;
    currencyCode: string;
    unitPrice: number;
    taxRatePercent: number | null;
    isTaxable: boolean;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    status: string;
};

export type ChargeableItem = {
    id: string;
    clinicalCatalogItemId: string | null;
    catalogType: string;
    chargeModel: string;
    code: string;
    name: string;
    departmentId: string | null;
    category: string | null;
    defaultUnit: string | null;
    status: string;
    statusReason: string | null;
    prices: ChargeableItemPrice[];
    createdAt: string | null;
    updatedAt: string | null;
};

export type ChargeableItemFilters = {
    catalogType?: string | null;
    status?: string | null;
};

type ChargeableItemListResponse = { success: boolean; data: ChargeableItem[] };

/**
 * Accepts a ref/computed/getter, not just a plain object -- a plain object
 * snapshot (e.g. `someComputed.value`) breaks reactivity entirely, since
 * Vue Query's queryKey never sees the change and never refetches. This bit
 * ChargeableItemsV2.vue's catalog-type tabs: clicking a tab updated the
 * filter ref but the query stayed locked to whatever value was passed in
 * at setup time. toValue() + a computed queryKey keeps this reactive the
 * same way useServiceCatalogItems() already does for the legacy page.
 */
export function useChargeableItems(filters: MaybeRefOrGetter<ChargeableItemFilters> = {}): UseQueryReturnType<ChargeableItem[], Error> {
    return useQuery({
        queryKey: ['chargeable-items', computed(() => ({ ...toValue(filters) }))],
        queryFn: async () => {
            const resolved = toValue(filters);
            const response = await apiGet<ChargeableItemListResponse>('/chargeable-items', {
                catalogType: resolved.catalogType ?? null,
                status: resolved.status ?? null,
            });
            return response.data;
        },
    });
}
