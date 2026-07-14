import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { EmergencyTransfer } from './useEmergencyTransfers';

/**
 * PATCH /emergency-triage-cases/{id}/transfers/{transferId}/status
 * (UpdateEmergencyTriageCaseTransferStatusRequest.php). `reason` is
 * required_if:status,cancelled,rejected server-side — enforced client-side
 * too by EmergencyTransferStatusDialog.vue (the only caller that ever sends
 * a reason; the one-click chip actions for accepted/in_transit/completed
 * never need one).
 */
export type EmergencyTransferStatusTarget = 'accepted' | 'in_transit' | 'completed' | 'cancelled' | 'rejected';

export type UpdateEmergencyTransferStatusPayload = {
    caseId: string;
    transferId: string;
    status: EmergencyTransferStatusTarget;
    reason?: string | null;
    clinicalHandoffNotes?: string | null;
};

type UpdateEmergencyTransferStatusResponse = { data: EmergencyTransfer };

export function useUpdateEmergencyTransferStatus(): UseMutationReturnType<EmergencyTransfer, Error, UpdateEmergencyTransferStatusPayload, unknown> {
    return useMutation({
        mutationFn: async ({ caseId, transferId, status, reason, clinicalHandoffNotes }): Promise<EmergencyTransfer> => {
            const response = await apiPatch<UpdateEmergencyTransferStatusResponse>(`/emergency-triage-cases/${caseId}/transfers/${transferId}/status`, {
                body: { status, reason: reason ?? null, clinicalHandoffNotes: clinicalHandoffNotes ?? null },
            });
            return response.data;
        },
    });
}
