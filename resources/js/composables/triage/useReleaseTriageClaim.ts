import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';

/**
 * PATCH /appointments/{id}/release-triage-claim
 * (ReleaseAppointmentTriageClaimUseCase), gated `appointments.record-triage`
 * — same permission as claiming/recording. Releasing an unclaimed visit is
 * a no-op success server-side; releasing someone else's claim returns 409
 * TRIAGE_CLAIM_CONFLICT.
 */
export type ReleaseTriageClaimVariables = {
    appointmentId: string;
};

type ReleaseTriageClaimResponse = { data: { id: string } };

export function useReleaseTriageClaim(): UseMutationReturnType<{ id: string }, Error, ReleaseTriageClaimVariables, unknown> {
    return useMutation({
        mutationFn: async ({ appointmentId }: ReleaseTriageClaimVariables): Promise<{ id: string }> => {
            const response = await apiPatch<ReleaseTriageClaimResponse>(`/appointments/${appointmentId}/release-triage-claim`, {
                body: {},
            });
            return response.data;
        },
    });
}
