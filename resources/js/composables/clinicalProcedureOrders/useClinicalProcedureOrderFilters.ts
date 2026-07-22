import { reactive } from 'vue';

export function useClinicalProcedureOrderFilters() {
    return reactive({
        q: '',
        patientId: '',
        status: '' as string,
        procedureSetting: '' as '' | 'outpatient' | 'inpatient' | 'bedside' | 'emergency' | 'other',
        worklistScope: '' as '' | 'open',
        from: '',
        to: '',
        page: 1,
        perPage: 50,
        sortBy: 'orderedAt' as string,
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type ClinicalProcedureOrderFilters = ReturnType<typeof useClinicalProcedureOrderFilters>;
