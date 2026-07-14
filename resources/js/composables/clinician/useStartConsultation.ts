import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';

/**
 * PATCH /appointments/{id}/start-consultation
 * (AppointmentController::startConsultation), gated
 * `appointments.start-consultation`. Covers three cases with one endpoint,
 * matching the backend's own design (StartAppointmentConsultationRequest.php):
 * - waiting_provider -> in_consultation: fresh start, claims ownership.
 * - waiting_provider with consultation_started_at already set (on hold):
 *   same call, resumes — the backend treats "start" and "resume" as the
 *   same action, it just preserves the original consultation_started_at
 *   this time (see AppointmentController.php's updateProviderWorkflow fix).
 * - in_consultation, owned by someone else: returns 409
 *   CONSULTATION_OWNER_CONFLICT unless forceTakeover is set, in which case
 *   takeoverReason is required server-side
 *   (StartAppointmentConsultationRequest.php: required_if:forceTakeover,true).
 */
export type StartConsultationVariables = {
    appointmentId: string;
    forceTakeover?: boolean;
    takeoverReason?: string;
};

type StartConsultationResponse = { data: { id: string; status: string } };

export function useStartConsultation(): UseMutationReturnType<{ id: string; status: string }, Error, StartConsultationVariables, unknown> {
    return useMutation({
        mutationFn: async ({ appointmentId, forceTakeover, takeoverReason }: StartConsultationVariables): Promise<{ id: string; status: string }> => {
            const response = await apiPatch<StartConsultationResponse>(`/appointments/${appointmentId}/start-consultation`, {
                body: {
                    forceTakeover: forceTakeover ?? false,
                    takeoverReason: takeoverReason ?? null,
                },
            });
            return response.data;
        },
    });
}
