import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { ClinicalProcedureOrder } from './useClinicalProcedureOrders';

export type ApplyClinicalProcedureOrderLifecycleActionPayload = {
    id: string;
    action: 'cancel' | 'entered_in_error';
    reason: string;
};

type ApplyClinicalProcedureOrderLifecycleActionResponse = { data: ClinicalProcedureOrder };

export function useApplyClinicalProcedureOrderLifecycleAction(): UseMutationReturnType<
    ClinicalProcedureOrder,
    Error,
    ApplyClinicalProcedureOrderLifecycleActionPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: ApplyClinicalProcedureOrderLifecycleActionPayload): Promise<ClinicalProcedureOrder> => {
            const response = await apiPost<ApplyClinicalProcedureOrderLifecycleActionResponse>(`/clinical-procedure-orders/${id}/lifecycle`, { body: payload });
            return response.data;
        },
    });
}
