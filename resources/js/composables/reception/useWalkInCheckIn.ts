import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import { type ReceptionAppointmentSummary } from '@/composables/reception/useCheckIn';

type WalkInResponse = { data: ReceptionAppointmentSummary };

export type WalkInArrivalMode = 'walk_in' | 'emergency';

type WalkInVariables = {
    patientId: string;
    arrivalMode: WalkInArrivalMode;
    reason?: string | null;
};

/**
 * POST /reception/walk-ins (Phase 1 of
 * reports/patient-arrival-checkin-modernization-plan.md) — creates the
 * appointment and checks it in atomically, replacing the two-sequential-call
 * pattern named in reports/patient-arrival-checkin-audit.md §4. Distinct
 * from useCheckIn, which only checks in an appointment that already exists.
 */
export function useWalkInCheckIn(): UseMutationReturnType<
    ReceptionAppointmentSummary,
    Error,
    WalkInVariables,
    unknown
> {
    return useMutation({
        mutationFn: async (variables: WalkInVariables): Promise<ReceptionAppointmentSummary> => {
            const response = await apiPost<WalkInResponse>('/reception/walk-ins', {
                body: {
                    patientId: variables.patientId,
                    arrivalMode: variables.arrivalMode,
                    reason: variables.reason ?? null,
                },
            });
            return response.data;
        },
    });
}
