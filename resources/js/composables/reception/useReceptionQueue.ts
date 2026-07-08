import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, reactive } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches ReceptionQueueEntryResponseTransformer 1:1
 * (app/Modules/Reception/Presentation/Http/Transformers/ReceptionQueueEntryResponseTransformer.php).
 */
export type ReceptionQueueEntry = {
    appointmentId: string;
    patientId: string | null;
    patientName: string | null;
    patientNumber: string | null;
    department: string | null;
    clinicianUserId: number | null;
    arrivalMode: string | null;
    tier: number | null;
    waitStartedAt: string | null;
    waitMinutes: number | null;
};

export type ReceptionQueueStage = 'waiting_triage' | 'waiting_provider';

type ReceptionQueueResponse = { data: ReceptionQueueEntry[] };

export function useReceptionQueueFilters() {
    return reactive({
        stage: 'waiting_triage' as ReceptionQueueStage,
    });
}

export type ReceptionQueueFilters = ReturnType<typeof useReceptionQueueFilters>;

/**
 * GET /reception/queue (Phase 4 of
 * reports/patient-arrival-checkin-modernization-plan.md) — a live read, not a
 * synced table (see GetReceptionQueueUseCase's own docblock), so there is
 * nothing here to invalidate on write beyond the normal query refetch —
 * refetchInterval keeps a front-desk/triage screen left open on this page
 * reasonably current without requiring a manual refresh or websocket wiring
 * neither of which this codebase has for this view yet.
 */
export function useReceptionQueue(
    filters: ReceptionQueueFilters,
): UseQueryReturnType<ReceptionQueueEntry[], Error> {
    return useQuery({
        queryKey: ['reception-queue', computed(() => ({ ...filters }))],
        queryFn: async () => {
            const response = await apiGet<ReceptionQueueResponse>('/reception/queue', {
                stage: filters.stage,
            });
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
