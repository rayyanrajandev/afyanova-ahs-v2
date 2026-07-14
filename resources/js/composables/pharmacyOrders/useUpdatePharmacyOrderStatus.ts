import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { PharmacyOrder, PharmacyOrderStatus } from './usePharmacyOrders';

export type UpdatePharmacyOrderStatusPayload = {
    id: string;
    status: PharmacyOrderStatus;
    reason?: string | null;
    quantityDispensed?: number | null;
    dispensedUnit?: string | null;
    dispensingNotes?: string | null;
};

type UpdatePharmacyOrderStatusResponse = { data: PharmacyOrder };

/**
 * PATCH /pharmacy-orders/{id}/status (PharmacyOrderController::updateStatus,
 * matches UpdatePharmacyOrderStatusRequest's validation) — drives
 * pending -> in_preparation -> partially_dispensed/dispensed, or
 * -> cancelled (reason required for cancel). Deducts inventory stock
 * (FEFO) server-side on dispense; can 422 on insufficient stock.
 */
export function useUpdatePharmacyOrderStatus(): UseMutationReturnType<
    PharmacyOrder,
    Error,
    UpdatePharmacyOrderStatusPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdatePharmacyOrderStatusPayload): Promise<PharmacyOrder> => {
            const response = await apiPatch<UpdatePharmacyOrderStatusResponse>(`/pharmacy-orders/${id}/status`, { body: payload });
            return response.data;
        },
    });
}
