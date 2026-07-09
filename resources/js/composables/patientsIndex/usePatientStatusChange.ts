import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { PatientListItem } from './usePatientList';

/** Phase 4 — row-level "Change status" action, backed by PATCH /patients/{id}/status. */
export type PatientStatusChangeVariables = {
    patientId: string;
    status: 'active' | 'inactive';
    reason?: string | null;
};

type PatientStatusChangeResponse = { data: PatientListItem };

export function usePatientStatusChange(): UseMutationReturnType<PatientListItem, Error, PatientStatusChangeVariables, unknown> {
    return useMutation({
        mutationFn: async (variables: PatientStatusChangeVariables): Promise<PatientListItem> => {
            const response = await apiPatch<PatientStatusChangeResponse>(`/patients/${variables.patientId}/status`, {
                body: {
                    status: variables.status,
                    reason: variables.reason?.trim() || null,
                },
            });
            return response.data;
        },
    });
}
