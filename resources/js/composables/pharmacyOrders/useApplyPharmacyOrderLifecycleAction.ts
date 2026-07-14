import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { PharmacyOrder } from './usePharmacyOrders';

export type ApplyPharmacyOrderLifecycleActionPayload = {
    id: string;
    action: 'cancel' | 'discontinue' | 'entered_in_error';
    reason: string;
};

type ApplyPharmacyOrderLifecycleActionResponse = { data: PharmacyOrder };

/**
 * POST /pharmacy-orders/{id}/lifecycle (PharmacyOrderController::applyLifecycleAction)
 * — cancel (only allowed if nothing dispensed yet), discontinue, or mark
 * entered-in-error. Reason is always required. Pairs with the shared
 * ClinicalLifecycleActionDialog.vue (resources/js/components/orders/), already
 * used by all four order-domain legacy pages.
 */
export function useApplyPharmacyOrderLifecycleAction(): UseMutationReturnType<
    PharmacyOrder,
    Error,
    ApplyPharmacyOrderLifecycleActionPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: ApplyPharmacyOrderLifecycleActionPayload): Promise<PharmacyOrder> => {
            const response = await apiPost<ApplyPharmacyOrderLifecycleActionResponse>(`/pharmacy-orders/${id}/lifecycle`, { body: payload });
            return response.data;
        },
    });
}
