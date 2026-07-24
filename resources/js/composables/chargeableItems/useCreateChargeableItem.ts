import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { ChargeableItem } from './useChargeableItems';

/**
 * Matches StoreChargeableItemRequest's field set
 * (app/Modules/Billing/Presentation/Http/Requests/StoreChargeableItemRequest.php).
 * Creates a chargeable_items row and its first price_book_entries row in
 * one request.
 */
export type CreateChargeableItemPayload = {
    catalogType: string;
    chargeModel: string;
    clinicalCatalogItemId?: string | null;
    code?: string | null;
    name?: string | null;
    departmentId?: string | null;
    category?: string | null;
    defaultUnit?: string | null;
    currencyCode: string;
    unitPrice: number;
    taxRatePercent?: number | null;
    isTaxable?: boolean;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
};

type CreateChargeableItemResponse = { success: boolean; data: ChargeableItem };

export function useCreateChargeableItem(): UseMutationReturnType<ChargeableItem, Error, CreateChargeableItemPayload, unknown> {
    return useMutation({
        mutationFn: async (payload: CreateChargeableItemPayload): Promise<ChargeableItem> => {
            const response = await apiPost<CreateChargeableItemResponse>('/chargeable-items', { body: payload });
            return response.data;
        },
    });
}
