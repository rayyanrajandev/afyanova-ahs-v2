import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { ClinicalProcedureOrder, ClinicalProcedureOrderStatus } from './useClinicalProcedureOrders';

export type UpdateClinicalProcedureOrderStatusPayload = {
    id: string;
    status: ClinicalProcedureOrderStatus;
    reason?: string | null;
    reportSummary?: string | null;
};

type UpdateClinicalProcedureOrderStatusResponse = { data: ClinicalProcedureOrder };

export function useUpdateClinicalProcedureOrderStatus(): UseMutationReturnType<
    ClinicalProcedureOrder,
    Error,
    UpdateClinicalProcedureOrderStatusPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateClinicalProcedureOrderStatusPayload): Promise<ClinicalProcedureOrder> => {
            const response = await apiPatch<UpdateClinicalProcedureOrderStatusResponse>(`/clinical-procedure-orders/${id}/status`, { body: payload });
            return response.data;
        },
    });
}
