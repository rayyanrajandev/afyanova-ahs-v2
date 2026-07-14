import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { PharmacyOrder } from './usePharmacyOrders';

export type VerifyPharmacyOrderDispensePayload = {
    id: string;
    verificationNote?: string | null;
};

type VerifyPharmacyOrderDispenseResponse = { data: PharmacyOrder };

/**
 * PATCH /pharmacy-orders/{id}/verify (PharmacyOrderController::verifyDispense)
 * — pharmacist verification step after dispense, distinct from dispensing
 * itself (separate permission: pharmacy.orders.verify-dispense).
 */
export function useVerifyPharmacyOrderDispense(): UseMutationReturnType<
    PharmacyOrder,
    Error,
    VerifyPharmacyOrderDispensePayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: VerifyPharmacyOrderDispensePayload): Promise<PharmacyOrder> => {
            const response = await apiPatch<VerifyPharmacyOrderDispenseResponse>(`/pharmacy-orders/${id}/verify`, { body: payload });
            return response.data;
        },
    });
}
