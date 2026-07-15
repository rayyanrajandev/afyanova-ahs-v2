import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type {
    LabResultParameter,
    LaboratoryOrder,
    LaboratoryOrderStatus,
} from './useLaboratoryOrders';

export type UpdateLaboratoryOrderStatusPayload = {
    id: string;
    status: LaboratoryOrderStatus;
    reason?: string | null;
    resultSummary?: string | null;
    resultParameters?: LabResultParameter[] | null;
};

type UpdateLaboratoryOrderStatusResponse = { data: LaboratoryOrder };

/**
 * PATCH /laboratory-orders/{id}/status (LaboratoryOrderController::updateStatus,
 * matches UpdateLaboratoryOrderStatusRequest's validation) — drives
 * ordered -> collected -> in_progress -> completed (forward-only,
 * server-enforced), or -> cancelled (reason required). resultSummary is
 * required when status is 'completed'.
 */
export function useUpdateLaboratoryOrderStatus(): UseMutationReturnType<
    LaboratoryOrder,
    Error,
    UpdateLaboratoryOrderStatusPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({
            id,
            ...payload
        }: UpdateLaboratoryOrderStatusPayload): Promise<LaboratoryOrder> => {
            const response =
                await apiPatch<UpdateLaboratoryOrderStatusResponse>(
                    `/laboratory-orders/${id}/status`,
                    { body: payload },
                );
            return response.data;
        },
    });
}
