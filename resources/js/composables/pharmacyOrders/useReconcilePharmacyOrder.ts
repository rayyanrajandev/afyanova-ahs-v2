import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { PharmacyOrder } from './usePharmacyOrders';

export type ReconcilePharmacyOrderPayload = {
    id: string;
    reconciliationStatus: 'pending' | 'completed' | 'exception';
    reconciliationDecision?:
        | 'add_to_current_list'
        | 'continue_on_current_list'
        | 'short_course_only'
        | 'stop_from_current_list'
        | 'review_later'
        | null;
    reconciliationNote?: string | null;
};

type ReconcilePharmacyOrderResponse = { data: PharmacyOrder };

/**
 * PATCH /pharmacy-orders/{id}/reconciliation (PharmacyOrderController::reconcile,
 * matches ReconcilePharmacyOrderRequest's validation) — records the
 * medication-reconciliation outcome after dispense, and updates the
 * patient's active medication profile server-side.
 */
export function useReconcilePharmacyOrder(): UseMutationReturnType<
    PharmacyOrder,
    Error,
    ReconcilePharmacyOrderPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: ReconcilePharmacyOrderPayload): Promise<PharmacyOrder> => {
            const response = await apiPatch<ReconcilePharmacyOrderResponse>(`/pharmacy-orders/${id}/reconciliation`, { body: payload });
            return response.data;
        },
    });
}
