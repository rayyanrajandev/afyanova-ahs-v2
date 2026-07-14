import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches GetTriageCompletedTodayUseCase/TriageCompletedEntryResponseTransformer
 * exactly (app/Modules/Reception/Application/UseCases/GetTriageCompletedTodayUseCase.php).
 * `status` is the appointment's *current* status (waiting_provider,
 * in_consultation, completed, or rarely cancelled) — not a fixed "completed"
 * value — since this list answers "where did today's triaged patients end
 * up," not just "who was triaged."
 */
export type TriageCompletedEntry = {
    appointmentId: string;
    appointmentNumber: string | null;
    status: string | null;
    patientId: string | null;
    patientName: string | null;
    patientNumber: string | null;
    department: string | null;
    triagedAt: string | null;
    triageOwnerUserId: number | null;
};

type TriageCompletedTodayResponse = {
    data: TriageCompletedEntry[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * Lazy by design — `enabled` only turns on while the caller reports the
 * "Completed" tab is active, matching the lifecycle-gates-the-fetch pattern
 * used elsewhere in this codebase (e.g. EmergencyCaseTransfersPanel.vue),
 * so switching tabs on triage/Queue.vue doesn't fetch this list until it's
 * actually being looked at.
 */
export function useTriageCompletedToday(
    enabled: MaybeRefOrGetter<boolean>,
    page: MaybeRefOrGetter<number>,
): UseQueryReturnType<TriageCompletedTodayResponse, Error> {
    return useQuery({
        queryKey: ['triage-completed-today', computed(() => toValue(page))],
        queryFn: () =>
            apiGet<TriageCompletedTodayResponse>('/reception/triage-queue/completed-today', {
                page: toValue(page),
                perPage: 20,
            }),
        enabled: computed(() => toValue(enabled)),
    });
}
