import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { EmergencyCase } from './useEmergencyCases';

/**
 * POST /emergency-triage-cases (StoreEmergencyTriageCaseRequest), open to
 * any authenticated user server-side (no dedicated create permission
 * beyond route-level `emergency.triage.create`). Scoped to the fields a
 * lean V2 intake form actually needs — deliberately excludes admissionId/
 * appointmentId (edge-case context linking the legacy 3-tab picker
 * exposed, not needed for a fast ED intake) and triagedAt/dispositionNotes
 * (those are set later, through the status-transition workflow
 * useUpdateEmergencyCaseStatus.ts already owns — not at creation time).
 */
export type CreateEmergencyCasePayload = {
    patientId: string;
    assignedClinicianUserId?: number | null;
    arrivalAt: string;
    triageLevel: 'red' | 'yellow' | 'green';
    chiefComplaint: string;
    vitalsSummary?: string | null;
};

type CreateEmergencyCaseResponse = { data: EmergencyCase };

export function useCreateEmergencyCase(): UseMutationReturnType<EmergencyCase, Error, CreateEmergencyCasePayload, unknown> {
    return useMutation({
        mutationFn: async (payload: CreateEmergencyCasePayload): Promise<EmergencyCase> => {
            const response = await apiPost<CreateEmergencyCaseResponse>('/emergency-triage-cases', { body: payload });
            return response.data;
        },
    });
}
