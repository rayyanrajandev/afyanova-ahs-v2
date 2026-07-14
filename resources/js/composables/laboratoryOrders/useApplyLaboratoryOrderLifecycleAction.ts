import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { LaboratoryOrder } from './useLaboratoryOrders';

export type ApplyLaboratoryOrderLifecycleActionPayload = {
    id: string;
    action: 'cancel' | 'entered_in_error';
    reason: string;
};

type ApplyLaboratoryOrderLifecycleActionResponse = { data: LaboratoryOrder };

/**
 * POST /laboratory-orders/{id}/lifecycle (LaboratoryOrderController::applyLifecycleAction)
 * — cancel or mark entered-in-error. Reason is always required. Pairs with
 * the shared ClinicalLifecycleActionDialog.vue (resources/js/components/orders/).
 */
export function useApplyLaboratoryOrderLifecycleAction(): UseMutationReturnType<
    LaboratoryOrder,
    Error,
    ApplyLaboratoryOrderLifecycleActionPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: ApplyLaboratoryOrderLifecycleActionPayload): Promise<LaboratoryOrder> => {
            const response = await apiPost<ApplyLaboratoryOrderLifecycleActionResponse>(`/laboratory-orders/${id}/lifecycle`, { body: payload });
            return response.data;
        },
    });
}
