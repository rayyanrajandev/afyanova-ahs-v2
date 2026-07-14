import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, reactive } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches ReceptionQueueEntryResponseTransformer 1:1
 * (app/Modules/Reception/Presentation/Http/Transformers/ReceptionQueueEntryResponseTransformer.php).
 */
export type ReceptionQueueEntry = {
    appointmentId: string;
    appointmentNumber: string | null;
    status: string | null;
    patientId: string | null;
    patientName: string | null;
    patientNumber: string | null;
    department: string | null;
    clinicianUserId: number | null;
    triageOwnerUserId: number | null;
    triageOwnerAssignedAt: string | null;
    consultationOwnerUserId: number | null;
    consultationStartedAt: string | null;
    /** Only ever true for in_consultation entries — see GetReceptionQueueUseCase's docblock. */
    hasSignedConsultationNote: boolean;
    /**
     * Only ever set for in_consultation entries — 'waiting_lab' | 'waiting_imaging' |
     * 'waiting_lab_and_imaging' | 'in_lab' | 'in_imaging' | 'in_lab_and_imaging' |
     * 'waiting_pharmacy' | 'with_clinician' (ResolveConsultationDiagnosticStepsUseCase).
     * Null for every other stage.
     */
    consultationStep: string | null;
    arrivalMode: string | null;
    tier: number | null;
    waitStartedAt: string | null;
    waitMinutes: number | null;
};

export type ReceptionQueueStage = 'waiting_triage' | 'waiting_provider' | 'in_consultation';

type ReceptionQueueResponse = {
    data: ReceptionQueueEntry[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * P2+P5 of the Reception/Emergency/Admission/Bed-Management audit
 * follow-through: added q/department/clinicianUserId/page/perPage,
 * mirroring useEmergencyCaseFilters.ts's shape. `stage` stays required and
 * distinct from the others — it selects which of the three queue views a
 * given `useReceptionQueue()` instance represents (this page runs two
 * instances in parallel, one per visible tab), not a filter on one shared list.
 */
export function useReceptionQueueFilters() {
    return reactive({
        stage: 'waiting_triage' as ReceptionQueueStage,
        q: '',
        department: '',
        clinicianUserId: '',
        page: 1,
        perPage: 20,
    });
}

export type ReceptionQueueFilters = ReturnType<typeof useReceptionQueueFilters>;

function filterQuery(filters: ReceptionQueueFilters) {
    return {
        stage: filters.stage,
        q: filters.q.trim() || null,
        department: filters.department || null,
        clinicianUserId: filters.clinicianUserId || null,
    };
}

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
): UseQueryReturnType<ReceptionQueueResponse, Error> {
    return useQuery({
        queryKey: ['reception-queue', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<ReceptionQueueResponse>('/reception/queue', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
            }),
        refetchInterval: 30_000,
    });
}
