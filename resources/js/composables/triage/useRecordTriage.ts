import {
    useMutation,
    useQueryClient,
    type UseMutationReturnType,
} from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import { type ReceptionAppointmentSummary } from '@/composables/reception/useCheckIn';
import { type ReceptionQueueEntry } from '@/composables/reception/useReceptionQueue';

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

type ReceptionQueueCache = {
    data: ReceptionQueueEntry[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type RecordTriageContext = {
    previousQueries: Array<
        [readonly unknown[], ReceptionQueueCache | undefined]
    >;
};

export function useRecordTriage(): UseMutationReturnType<
    ReceptionAppointmentSummary,
    Error,
    RecordTriageVariables,
    RecordTriageContext
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (
            variables: RecordTriageVariables,
        ): Promise<ReceptionAppointmentSummary> => {
            const { appointmentId, ...payload } = variables;
            const response = await apiPatch<RecordTriageResponse>(
                `/appointments/${appointmentId}/triage`,
                {
                    body: payload,
                },
            );
            return response.data;
        },
        // Optimistic: recording triage always moves an appointment out of
        // the waiting_triage stage, so drop it from any cached
        // waiting_triage queue view immediately rather than waiting for the
        // round trip + invalidateQueries refetch — the nurse's queue row
        // disappears the instant they submit. Other stages' cached queues
        // (e.g. waiting_provider) aren't optimistically populated here since
        // this mutation's response shape doesn't carry a full
        // ReceptionQueueEntry; the follow-up invalidate still reconciles them.
        onMutate: async ({ appointmentId }) => {
            await queryClient.cancelQueries({ queryKey: ['reception-queue'] });
            const queries = queryClient.getQueriesData<ReceptionQueueCache>({
                queryKey: ['reception-queue'],
            });
            const previousQueries = queries.map(
                ([queryKey, data]) => [queryKey, data] as const,
            );

            for (const [queryKey, data] of queries) {
                if (!data) continue;
                const stage = (queryKey[1] as { stage?: string } | undefined)
                    ?.stage;
                if (stage !== 'waiting_triage') continue;

                const visible = data.data.filter(
                    (entry) => entry.appointmentId !== appointmentId,
                );
                if (visible.length === data.data.length) continue;

                queryClient.setQueryData(queryKey, {
                    ...data,
                    data: visible,
                    meta: {
                        ...data.meta,
                        total: Math.max(0, data.meta.total - 1),
                    },
                });
            }

            return { previousQueries };
        },
        onError: (_error, _variables, context) => {
            context?.previousQueries?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });
        },
    });
}
