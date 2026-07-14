import { reactive } from 'vue';

/**
 * Matches ListEmergencyTriageCasesUseCase's filter shape 1:1
 * (app/Modules/EmergencyTriage/Application/UseCases/ListEmergencyTriageCasesUseCase.php
 * — the backend module is genuinely named EmergencyTriage; this composable
 * isn't, on purpose, since "Emergency" and generic appointment "Triage" are
 * unrelated concepts on the frontend — see reports/emergency-queue-
 * modernization-plan.md §1): q, status, triageLevel, from/to, sortBy,
 * sortDir, page, perPage. Same pattern as useAppointmentListFilters.ts. No
 * default status filter (unlike appointments' 'scheduled' default) — an
 * emergency queue's whole point is showing every active case at a glance,
 * not narrowing to one stage by default.
 */
export function useEmergencyCaseFilters() {
    return reactive({
        q: '',
        status: '' as string,
        triageLevel: '' as string,
        from: '',
        to: '',
        page: 1,
        perPage: 15,
        sortBy: 'arrivalAt' as string,
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type EmergencyCaseFilters = ReturnType<typeof useEmergencyCaseFilters>;
