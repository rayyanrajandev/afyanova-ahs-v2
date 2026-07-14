import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches EmergencyTriageCaseTransferResponseTransformer::transform()
 * exactly (app/Modules/EmergencyTriage/Presentation/Http/Transformers/
 * EmergencyTriageCaseTransferResponseTransformer.php).
 */
export type EmergencyTransfer = {
    id: string;
    emergencyTriageCaseId: string | null;
    transferNumber: string | null;
    transferType: 'internal' | 'external' | null;
    priority: 'routine' | 'urgent' | 'critical' | null;
    sourceLocation: string | null;
    destinationLocation: string | null;
    destinationFacilityName: string | null;
    acceptingClinicianUserId: number | null;
    requestedAt: string | null;
    acceptedAt: string | null;
    departedAt: string | null;
    arrivedAt: string | null;
    completedAt: string | null;
    status: 'requested' | 'accepted' | 'in_transit' | 'completed' | 'cancelled' | 'rejected' | null;
    statusReason: string | null;
    clinicalHandoffNotes: string | null;
    transportMode: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type EmergencyTransferListResponse = {
    data: EmergencyTransfer[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * GET /emergency-triage-cases/{id}/transfers. Called only from inside a
 * case row's expanded Collapsible content (EmergencyCaseTransfersPanel.vue),
 * so this composable's own mount/unmount lifecycle already gates the
 * fetch — no manual `enabled` flag needed, unlike a query that lives at
 * page level for the whole session.
 */
export function useEmergencyTransfers(caseId: string | Ref<string>): UseQueryReturnType<EmergencyTransferListResponse, Error> {
    const id = computed(() => (typeof caseId === 'string' ? caseId : caseId.value));

    return useQuery({
        queryKey: ['emergency-transfers', id],
        queryFn: () => apiGet<EmergencyTransferListResponse>(`/emergency-triage-cases/${id.value}/transfers`, { perPage: 50, sortBy: 'requestedAt', sortDir: 'desc' }),
    });
}
