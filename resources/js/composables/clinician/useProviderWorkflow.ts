import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';

/**
 * PATCH /appointments/{id}/provider-workflow
 * (AppointmentController::updateProviderWorkflow), gated
 * `appointments.manage-provider-session`. Deliberately typed to only the
 * three targets this endpoint's own allowedTransitions map supports from
 * in_consultation (UpdateAppointmentProviderWorkflowRequest.php):
 * - 'waiting_provider' — hold (sent for labs/pharmacy, will return); reason
 *   optional.
 * - 'waiting_triage' — send all the way back to triage; reason REQUIRED
 *   server-side (required_if:status,waiting_triage).
 * - 'completed' — close the visit; gated on a finalized (signed, non-draft)
 *   consultation note server-side, surfaced as a 422 with
 *   requiresFinalizedConsultationNote if not met. Reason optional.
 */
export type ProviderWorkflowStatus = 'waiting_provider' | 'waiting_triage' | 'completed';

export type ProviderWorkflowVariables = {
    appointmentId: string;
    status: ProviderWorkflowStatus;
    reason?: string | null;
};

type ProviderWorkflowResponse = { data: { id: string; status: string } };

export function useProviderWorkflow(): UseMutationReturnType<{ id: string; status: string }, Error, ProviderWorkflowVariables, unknown> {
    return useMutation({
        mutationFn: async ({ appointmentId, status, reason }: ProviderWorkflowVariables): Promise<{ id: string; status: string }> => {
            const response = await apiPatch<ProviderWorkflowResponse>(`/appointments/${appointmentId}/provider-workflow`, {
                body: { status, reason: reason ?? null },
            });
            return response.data;
        },
    });
}
