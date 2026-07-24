import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
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

export function useChargeableItems(filters: ChargeableItemFilters = {}): UseQueryReturnType<ChargeableItem[], Error> {
    return useQuery({
        queryKey: ['chargeable-items', filters],
        queryFn: async () => {
            const response = await apiGet<ChargeableItemListResponse>('/chargeable-items', {
                catalogType: filters.catalogType ?? null,
                status: filters.status ?? null,
            });
            return response.data;
        },
    });
}
