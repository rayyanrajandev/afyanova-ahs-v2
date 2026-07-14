import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { EmergencyTransfer } from './useEmergencyTransfers';

/**
 * Matches StoreEmergencyTriageCaseTransferRequest's field set
 * (app/Modules/EmergencyTriage/Presentation/Http/Requests/
 * StoreEmergencyTriageCaseTransferRequest.php). Only transferType/priority/
 * destinationLocation are backend-required.
 */
export type CreateEmergencyTransferPayload = {
    caseId: string;
    transferType: 'internal' | 'external';
    priority: 'routine' | 'urgent' | 'critical';
    destinationLocation: string;
    sourceLocation?: string | null;
    destinationFacilityName?: string | null;
    acceptingClinicianUserId?: number | null;
    requestedAt?: string | null;
    clinicalHandoffNotes?: string | null;
    transportMode?: string | null;
};

type CreateEmergencyTransferResponse = { data: EmergencyTransfer };

export function useCreateEmergencyTransfer(): UseMutationReturnType<EmergencyTransfer, Error, CreateEmergencyTransferPayload, unknown> {
    return useMutation({
        mutationFn: async ({ caseId, ...body }: CreateEmergencyTransferPayload): Promise<EmergencyTransfer> => {
            const response = await apiPost<CreateEmergencyTransferResponse>(`/emergency-triage-cases/${caseId}/transfers`, { body });
            return response.data;
        },
    });
}
