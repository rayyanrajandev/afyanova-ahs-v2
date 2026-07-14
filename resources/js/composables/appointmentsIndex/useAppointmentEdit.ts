import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { AppointmentListItem } from './useAppointmentList';

/**
 * PATCH /appointments/{id} (UpdateAppointmentUseCase). Same field-scoping
 * choice as useAppointmentCreate.ts: patientId is left out of this phase's
 * form — UpdateAppointmentRequest allows changing it (`sometimes`), but
 * reassigning which patient an existing scheduled visit belongs to is
 * unusual UX, not a Phase 2 requirement. Doubles as "reschedule" — the
 * legacy page's separate Reschedule dialog calls this exact same endpoint
 * with a narrower field set (appointments/Index.vue:3693-3703); one
 * composable/one sheet covers both here rather than two UIs for one
 * endpoint. clinicianUserId added for the patient flow redesign's
 * appointment workflow A2, same reasoning as useAppointmentCreate.ts.
 */
export type EditAppointmentPayload = {
    appointmentId: string;
    scheduledAt?: string | null;
    clinicianUserId?: number | null;
    durationMinutes?: number | null;
    department?: string | null;
    reason?: string | null;
    notes?: string | null;
};

type EditAppointmentResponse = { data: AppointmentListItem };

export function useAppointmentEdit(): UseMutationReturnType<AppointmentListItem, Error, EditAppointmentPayload, unknown> {
    return useMutation({
        mutationFn: async ({ appointmentId, ...payload }: EditAppointmentPayload): Promise<AppointmentListItem> => {
            const response = await apiPatch<EditAppointmentResponse>(`/appointments/${appointmentId}`, { body: payload });
            return response.data;
        },
    });
}
