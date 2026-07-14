import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import { type ReceptionAppointmentSummary } from '@/composables/reception/useCheckIn';

/**
 * PATCH /appointments/{id}/triage (RecordAppointmentTriageUseCase), gated
 * `appointments.record-triage` server-side (RecordAppointmentTriageRequest.php).
 * This is the correct permission to gate the UI on too — the legacy
 * appointments/Index.vue's own Triage sheet button is gated on
 * `emergency.triage.create`/`emergency.triage.update-status` instead
 * (appointments/Index.vue:759-761), a real, pre-existing mismatch against
 * what the endpoint it calls actually authorizes. Not fixed there (that
 * page is being replaced, not patched) — just not repeated here.
 *
 * Reuses ReceptionAppointmentSummary's type (not the composable itself) —
 * this response shape is Reception's own "just enough for a queue row"
 * contract, not duplicated here.
 *
 * Phase 3 of reports/appointments-scheduling-workspace-modernization-plan.md
 * — lives under composables/triage/, not composables/reception/: triage
 * recording is nurse/clinical work, not front-desk work, and an earlier
 * version of this phase put it on reception/Queue.vue before that was
 * corrected. See the plan's Phase 3 correction note.
 */
type RecordTriageResponse = { data: ReceptionAppointmentSummary };

export type RecordTriageVariables = {
    appointmentId: string;
    triageVitalsSummary: string;
    triageNotes?: string | null;
    triageCategory?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | null;
    department?: string | null;
    clinicianUserId?: number | null;
};

export function useRecordTriage(): UseMutationReturnType<
    ReceptionAppointmentSummary,
    Error,
    RecordTriageVariables,
    unknown
> {
    return useMutation({
        mutationFn: async (variables: RecordTriageVariables): Promise<ReceptionAppointmentSummary> => {
            const { appointmentId, ...payload } = variables;
            const response = await apiPatch<RecordTriageResponse>(`/appointments/${appointmentId}/triage`, {
                body: payload,
            });
            return response.data;
        },
    });
}
