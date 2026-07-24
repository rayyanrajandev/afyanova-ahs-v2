import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import type { ChargeableItem } from './useChargeableItems';

function formatPrice(item: ChargeableItem): string | null {
    const activePrice = item.prices.find((price) => price.status === 'active') ?? item.prices[0];
    if (!activePrice) return null;

    return `${activePrice.unitPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${activePrice.currencyCode}`;
}

/**
 * GET /chargeable-items?status=active&catalogType=... — feeds the new
 * pricing engine's "pricing item" pickers (ward-bed admin, consultation
 * mapping admin). Filtered by catalogType so, e.g., a bed-day picker only
 * ever shows bed_day chargeable items.
 */
export function useChargeableItemOptions(catalogType: string): {
    options: ComputedRef<SearchableSelectOption[]>;
    query: UseQueryReturnType<ChargeableItem[], Error>;
} {
    const query = useQuery({
        queryKey: ['chargeable-item-options', catalogType],
        queryFn: async () => {
            const response = await apiGet<{ success: boolean; data: ChargeableItem[] }>('/chargeable-items', {
                status: 'active',
                catalogType,
            });
            return response.data;
        },
        staleTime: 60 * 1000,
    });

    const options = computed<SearchableSelectOption[]>(() =>
        (query.data.value ?? [])
            .map((item): SearchableSelectOption | null => {
                const value = item.id?.trim();
                if (!value) return null;
                return {
                    value,
                    label: `${item.code} — ${item.name}`,
                    description: formatPrice(item),
                    group: item.category ?? null,
                };
            })
            .filter((option): option is SearchableSelectOption => option !== null),
    );

    return { options, query };
}
