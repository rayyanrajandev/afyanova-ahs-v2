import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';

/**
 * PATCH /appointments/{id}/claim-triage (ClaimAppointmentTriageUseCase),
 * gated `appointments.record-triage` server-side — same permission
 * useRecordTriage.ts uses, since claiming is a lighter-weight action on the
 * same nurse workflow, not a separate capability.
 *
 * A conflicting claim (someone else already owns it) returns 409
 * TRIAGE_CLAIM_CONFLICT (AppointmentController::triageClaimConflictResponse) —
 * surfaced to the caller via the rejected promise, not swallowed here;
 * forceTakeover lets the caller explicitly override it.
 */
export type ClaimTriageVariables = {
    appointmentId: string;
    forceTakeover?: boolean;
};

type ClaimTriageResponse = { data: { id: string; triageOwnerUserId?: number | null } };

export function useClaimTriage(): UseMutationReturnType<{ id: string }, Error, ClaimTriageVariables, unknown> {
    return useMutation({
        mutationFn: async ({ appointmentId, forceTakeover }: ClaimTriageVariables): Promise<{ id: string }> => {
            const response = await apiPatch<ClaimTriageResponse>(`/appointments/${appointmentId}/claim-triage`, {
                body: { forceTakeover: forceTakeover ?? false },
            });
            return response.data;
        },
    });
}
