import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { ChargeableItem } from './useChargeableItems';

/**
 * Matches UpdateChargeableItemRequest's field set
 * (app/Modules/Billing/Presentation/Http/Requests/UpdateChargeableItemRequest.php).
 */
export type UpdateChargeableItemPayload = {
    chargeableItemId: string;
    name?: string;
    catalogType?: string;
    category?: string | null;
    defaultUnit?: string | null;
    status?: 'active' | 'inactive';
    statusReason?: string | null;
};

type UpdateChargeableItemResponse = { success: boolean; data: ChargeableItem };

export function useUpdateChargeableItem(): UseMutationReturnType<ChargeableItem, Error, UpdateChargeableItemPayload, unknown> {
    return useMutation({
        mutationFn: async ({ chargeableItemId, ...payload }: UpdateChargeableItemPayload): Promise<ChargeableItem> => {
            const response = await apiPatch<UpdateChargeableItemResponse>(`/chargeable-items/${chargeableItemId}`, { body: payload });
            return response.data;
        },
    });
}
