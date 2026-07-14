import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { LaboratoryOrder } from './useLaboratoryOrders';

export type VerifyLaboratoryOrderResultPayload = {
    id: string;
    verificationNote?: string | null;
};

type VerifyLaboratoryOrderResultResponse = { data: LaboratoryOrder };

/**
 * PATCH /laboratory-orders/{id}/verify (LaboratoryOrderController::verifyResult)
 * — only allowed once, on a completed order with a result summary and no
 * prior verification (VerifyLaboratoryOrderResultUseCase). Server rejects
 * with a 422 if the result is critical and verificationNote is blank.
 */
export function useVerifyLaboratoryOrderResult(): UseMutationReturnType<
    LaboratoryOrder,
    Error,
    VerifyLaboratoryOrderResultPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: VerifyLaboratoryOrderResultPayload): Promise<LaboratoryOrder> => {
            const response = await apiPatch<VerifyLaboratoryOrderResultResponse>(`/laboratory-orders/${id}/verify`, { body: payload });
            return response.data;
        },
    });
}
