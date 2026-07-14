import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { PharmacyOrder } from './usePharmacyOrders';

export type UpdatePharmacyOrderPolicyPayload = {
    id: string;
    formularyDecisionStatus: 'not_reviewed' | 'formulary' | 'non_formulary' | 'restricted';
    formularyDecisionReason?: string | null;
    substitutionAllowed: boolean;
    substitutionMade: boolean;
    substitutedMedicationCode?: string | null;
    substitutedMedicationName?: string | null;
    substitutionReason?: string | null;
};

type UpdatePharmacyOrderPolicyResponse = { data: PharmacyOrder };

/**
 * PATCH /pharmacy-orders/{id}/policy (PharmacyOrderController::updatePolicy,
 * matches UpdatePharmacyOrderPolicyRequest's validation) — records the
 * formulary decision and any substitution metadata.
 */
export function useUpdatePharmacyOrderPolicy(): UseMutationReturnType<
    PharmacyOrder,
    Error,
    UpdatePharmacyOrderPolicyPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdatePharmacyOrderPolicyPayload): Promise<PharmacyOrder> => {
            const response = await apiPatch<UpdatePharmacyOrderPolicyResponse>(`/pharmacy-orders/${id}/policy`, { body: payload });
            return response.data;
        },
    });
}
