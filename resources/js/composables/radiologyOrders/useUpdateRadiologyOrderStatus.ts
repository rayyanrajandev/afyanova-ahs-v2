import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { RadiologyOrder, RadiologyOrderStatus } from './useRadiologyOrders';

export type UpdateRadiologyOrderStatusPayload = {
    id: string;
    status: RadiologyOrderStatus;
    reason?: string | null;
    reportSummary?: string | null;
};

type UpdateRadiologyOrderStatusResponse = { data: RadiologyOrder };

/**
 * PATCH /radiology-orders/{id}/status (RadiologyOrderController::updateStatus,
 * matches UpdateRadiologyOrderStatusRequest's validation) — drives
 * ordered -> scheduled -> in_progress -> completed (forward-only,
 * server-enforced), or -> cancelled (reason required). reportSummary is
 * required when status is 'completed' — this is also the report-release
 * step, radiology has no separate verify endpoint.
 */
export function useUpdateRadiologyOrderStatus(): UseMutationReturnType<
    RadiologyOrder,
    Error,
    UpdateRadiologyOrderStatusPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateRadiologyOrderStatusPayload): Promise<RadiologyOrder> => {
            const response = await apiPatch<UpdateRadiologyOrderStatusResponse>(`/radiology-orders/${id}/status`, { body: payload });
            return response.data;
        },
    });
}
