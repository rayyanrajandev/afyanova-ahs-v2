import { reactive } from 'vue';

/**
 * Matches ListLaboratoryOrdersUseCase's filter shape 1:1
 * (app/Modules/Laboratory/Application/UseCases/ListLaboratoryOrdersUseCase.php):
 * q, patientId, status, priority, worklistScope, from/to, sortBy, sortDir,
 * page, perPage. `worklistScope` is part of the API contract but isn't
 * surfaced as a separate control here — the status Tabs are the single
 * filter axis, same convention as pharmacy-orders/IndexV2.vue.
 */
export function useLaboratoryOrderFilters() {
    return reactive({
        q: '',
        patientId: '',
        status: '' as string,
        priority: '' as '' | 'routine' | 'urgent' | 'stat',
        worklistScope: '' as '' | 'open',
        from: '',
        to: '',
        page: 1,
        perPage: 50,
        sortBy: 'orderedAt' as string,
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type LaboratoryOrderFilters = ReturnType<typeof useLaboratoryOrderFilters>;
