import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { ChargeableItem } from './useChargeableItems';

/**
 * Matches StorePriceBookEntryRequest's field set
 * (app/Modules/Billing/Presentation/Http/Requests/StorePriceBookEntryRequest.php).
 * Adds a new price_book_entries row to an existing chargeable item.
 */
export type CreatePriceBookEntryPayload = {
    chargeableItemId: string;
    currencyCode: string;
    unitPrice: number;
    taxRatePercent?: number | null;
    isTaxable?: boolean;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    payerContractId?: string | null;
};

type CreatePriceBookEntryResponse = { success: boolean; data: ChargeableItem };

export function useCreatePriceBookEntry(): UseMutationReturnType<ChargeableItem, Error, CreatePriceBookEntryPayload, unknown> {
    return useMutation({
        mutationFn: async ({ chargeableItemId, ...payload }: CreatePriceBookEntryPayload): Promise<ChargeableItem> => {
            const response = await apiPost<CreatePriceBookEntryResponse>(`/chargeable-items/${chargeableItemId}/prices`, { body: payload });
            return response.data;
        },
    });
}
