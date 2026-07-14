import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { EmergencyCase } from './useEmergencyCases';

/**
 * PATCH /emergency-triage-cases/{id}/status
 * (UpdateEmergencyTriageCaseStatusUseCase), gated
 * `emergency.triage.update-status`. `reason` required server-side for
 * `cancelled`, `dispositionNotes` required for `admitted`/`discharged`
 * (UpdateEmergencyTriageCaseStatusRequest.php) — enforced client-side too
 * by EmergencyStatusDialog.vue. The backend enforces no transition graph
 * at all (any status can PATCH to any status) — the allowed-transitions
 * matrix lives entirely in the UI, extracted from the legacy page's
 * queue-row button gating (emergency-triage/Index.vue:3400-3405), not
 * invented here.
 */
export type EmergencyCaseStatusTarget = 'triaged' | 'in_treatment' | 'admitted' | 'discharged' | 'cancelled';

export type UpdateEmergencyCaseStatusPayload = {
    caseId: string;
    status: EmergencyCaseStatusTarget;
    reason?: string | null;
    dispositionNotes?: string | null;
    bedResourceId?: string | null;
};

type UpdateEmergencyCaseStatusResponse = { data: EmergencyCase };

export function useUpdateEmergencyCaseStatus(): UseMutationReturnType<EmergencyCase, Error, UpdateEmergencyCaseStatusPayload, unknown> {
    return useMutation({
        mutationFn: async ({ caseId, status, reason, dispositionNotes, bedResourceId }): Promise<EmergencyCase> => {
            const response = await apiPatch<UpdateEmergencyCaseStatusResponse>(`/emergency-triage-cases/${caseId}/status`, {
                body: { status, reason: reason ?? null, dispositionNotes: dispositionNotes ?? null, bedResourceId: bedResourceId ?? null },
            });
            return response.data;
        },
    });
}
