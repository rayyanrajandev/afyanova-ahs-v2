import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { TheatreProcedure } from './useTheatreProcedures';

export type ApplyTheatreProcedureLifecycleActionPayload = {
    id: string;
    action: 'cancel' | 'entered_in_error';
    reason: string;
};

type ApplyTheatreProcedureLifecycleActionResponse = { data: TheatreProcedure };

/**
 * POST /theatre-procedures/{id}/lifecycle (TheatreProcedureController::applyLifecycleAction)
 * — cancel or mark entered-in-error. Reason is always required. Pairs with
 * the shared ClinicalLifecycleActionDialog.vue (resources/js/components/orders/).
 */
export function useApplyTheatreProcedureLifecycleAction(): UseMutationReturnType<
    TheatreProcedure,
    Error,
    ApplyTheatreProcedureLifecycleActionPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: ApplyTheatreProcedureLifecycleActionPayload): Promise<TheatreProcedure> => {
            const response = await apiPost<ApplyTheatreProcedureLifecycleActionResponse>(`/theatre-procedures/${id}/lifecycle`, { body: payload });
            return response.data;
        },
    });
}
