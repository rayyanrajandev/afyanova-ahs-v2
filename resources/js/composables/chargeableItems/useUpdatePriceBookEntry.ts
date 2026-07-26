import { useMutation, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { ChargeableItem } from './useChargeableItems';

export type UpdatePriceBookEntryPayload = {
    chargeableItemId: string;
    priceId: string;
    currencyCode?: string;
    unitPrice?: number;
    taxRatePercent?: number | null;
    isTaxable?: boolean;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    status?: string;
    statusReason?: string | null;
};

type UpdatePriceBookEntryResponse = { success: boolean; data: ChargeableItem };

export function useUpdatePriceBookEntry(): UseMutationReturnType<ChargeableItem, Error, UpdatePriceBookEntryPayload, unknown> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ chargeableItemId, priceId, ...payload }: UpdatePriceBookEntryPayload): Promise<ChargeableItem> => {
            const response = await apiPatch<UpdatePriceBookEntryResponse>(`/chargeable-items/${chargeableItemId}/prices/${priceId}`, { body: payload });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chargeable-items'] });
        },
    });
}
