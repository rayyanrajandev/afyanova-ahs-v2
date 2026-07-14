import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { AppointmentListItem } from './useAppointmentList';

/**
 * PATCH /appointments/{id}/status (UpdateAppointmentStatusUseCase) —
 * deliberately typed to only 'cancelled' | 'no_show', not the full
 * AppointmentStatus union. Every other value that endpoint accepts
 * (waiting_triage, waiting_provider, in_consultation, completed) is an
 * operational visit-progression transition that belongs to Reception Queue
 * per reports/appointments-scheduling-workspace-modernization-plan.md §2.1
 * — this composable existing with a narrower type is what keeps that
 * boundary enforced in the type system, not just by convention. Both
 * values require `reason` server-side
 * (UpdateAppointmentStatusRequest.php:23, required_if:status,cancelled,no_show).
 */
export type AppointmentClosureStatus = 'cancelled' | 'no_show';

export type AppointmentStatusActionPayload = {
    appointmentId: string;
    status: AppointmentClosureStatus;
    reason: string;
};

type AppointmentStatusActionResponse = { data: AppointmentListItem };

export function useAppointmentStatusAction(): UseMutationReturnType<AppointmentListItem, Error, AppointmentStatusActionPayload, unknown> {
    return useMutation({
        mutationFn: async ({ appointmentId, status, reason }: AppointmentStatusActionPayload): Promise<AppointmentListItem> => {
            const response = await apiPatch<AppointmentStatusActionResponse>(`/appointments/${appointmentId}/status`, {
                body: { status, reason },
            });
            return response.data;
        },
    });
}
