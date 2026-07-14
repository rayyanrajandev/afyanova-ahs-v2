import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { RadiologyOrder } from './useRadiologyOrders';

export type ApplyRadiologyOrderLifecycleActionPayload = {
    id: string;
    action: 'cancel' | 'entered_in_error';
    reason: string;
};

type ApplyRadiologyOrderLifecycleActionResponse = { data: RadiologyOrder };

/**
 * POST /radiology-orders/{id}/lifecycle (RadiologyOrderController::applyLifecycleAction)
 * — cancel or mark entered-in-error. Reason is always required. Pairs with
 * the shared ClinicalLifecycleActionDialog.vue (resources/js/components/orders/).
 */
export function useApplyRadiologyOrderLifecycleAction(): UseMutationReturnType<
    RadiologyOrder,
    Error,
    ApplyRadiologyOrderLifecycleActionPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: ApplyRadiologyOrderLifecycleActionPayload): Promise<RadiologyOrder> => {
            const response = await apiPost<ApplyRadiologyOrderLifecycleActionResponse>(`/radiology-orders/${id}/lifecycle`, { body: payload });
            return response.data;
        },
    });
}
