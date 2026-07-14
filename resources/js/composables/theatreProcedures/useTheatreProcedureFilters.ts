import { reactive } from 'vue';

/**
 * Matches ListTheatreProceduresUseCase's filter shape 1:1
 * (app/Modules/TheatreProcedure/Application/UseCases/ListTheatreProceduresUseCase.php):
 * q, patientId, status, worklistScope, from/to, sortBy, sortDir, page,
 * perPage. No domain-specific filter field (unlike lab's priority,
 * radiology's modality) — theatre procedures have no such concept.
 */
export function useTheatreProcedureFilters() {
    return reactive({
        q: '',
        patientId: '',
        status: '' as string,
        worklistScope: '' as '' | 'open',
        from: '',
        to: '',
        page: 1,
        perPage: 50,
        sortBy: 'scheduledAt' as string,
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type TheatreProcedureFilters = ReturnType<typeof useTheatreProcedureFilters>;
