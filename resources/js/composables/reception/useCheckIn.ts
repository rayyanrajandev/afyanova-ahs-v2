import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';

/**
 * Deliberately minimal — only what the reception queue UI actually displays
 * (see resources/js/pages/reception/Queue.vue), not the full ~25-field shape
 * AppointmentResponseTransformer returns
 * (app/Modules/Appointment/Presentation/Http/Transformers/AppointmentResponseTransformer.php).
 */
export type ReceptionAppointmentSummary = {
    id: string;
    patientId: string | null;
    status: string | null;
    department: string | null;
    checkedInAt: string | null;
};

type CheckInResponse = { data: ReceptionAppointmentSummary };

type CheckInVariables = {
    appointmentId: string;
    verificationNotes?: string | null;
};

/**
 * PATCH /appointments/{id}/check-in (Phase 1 of
 * reports/patient-arrival-checkin-modernization-plan.md) — checks in a
 * pre-existing scheduled appointment. Distinct from useWalkInCheckIn, which
 * additionally creates the appointment atomically for a patient with no
 * prior booking.
 */
export function useCheckIn(): UseMutationReturnType<
    ReceptionAppointmentSummary,
    Error,
    CheckInVariables,
    unknown
> {
    return useMutation({
        mutationFn: async (variables: CheckInVariables): Promise<ReceptionAppointmentSummary> => {
            const response = await apiPatch<CheckInResponse>(
                `/appointments/${variables.appointmentId}/check-in`,
                {
                    body: {
                        verificationNotes: variables.verificationNotes ?? null,
                    },
                },
            );
            return response.data;
        },
    });
}
