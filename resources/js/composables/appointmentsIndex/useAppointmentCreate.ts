import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { AppointmentListItem } from './useAppointmentList';

/**
 * Matches StoreAppointmentRequest's field set
 * (app/Modules/Appointment/Presentation/Http/Requests/StoreAppointmentRequest.php)
 * but only the subset Phase 1 of reports/appointments-scheduling-workspace-
 * modernization-plan.md ships plus clinicianUserId (added for the patient
 * flow redesign's appointment workflow A2 — the endpoint already validated
 * it, but no form exposed it, so a booking could never be tied to a
 * specific doctor): sourceAdmissionId/appointmentType/financialClass/
 * billingPayerContractId/coverageReference/coverageNotes remain unexposed,
 * a scoping choice for this phase, not a contract limitation. Add them here
 * (and to the create sheet) if a later phase needs them; the endpoint
 * already accepts them.
 */
export type CreateAppointmentPayload = {
    patientId: string;
    scheduledAt: string;
    clinicianUserId?: number | null;
    department?: string | null;
    durationMinutes?: number | null;
    reason?: string | null;
    notes?: string | null;
};

type CreateAppointmentResponse = { data: AppointmentListItem };

export function useAppointmentCreate(): UseMutationReturnType<AppointmentListItem, Error, CreateAppointmentPayload, unknown> {
    return useMutation({
        mutationFn: async (payload: CreateAppointmentPayload): Promise<AppointmentListItem> => {
            const response = await apiPost<CreateAppointmentResponse>('/appointments', { body: payload });
            return response.data;
        },
    });
}
