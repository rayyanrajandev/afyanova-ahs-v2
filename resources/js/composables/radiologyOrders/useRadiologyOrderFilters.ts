import { reactive } from 'vue';

/**
 * Matches ListRadiologyOrdersUseCase's filter shape 1:1
 * (app/Modules/Radiology/Application/UseCases/ListRadiologyOrdersUseCase.php):
 * q, patientId, status, modality, worklistScope, from/to, sortBy, sortDir,
 * page, perPage. `worklistScope` is part of the API contract but isn't
 * surfaced as a separate control here — the status Tabs are the single
 * filter axis, same convention as laboratory-orders/IndexV2.vue.
 */
export function useRadiologyOrderFilters() {
    return reactive({
        q: '',
        patientId: '',
        status: '' as string,
        modality: '' as '' | 'xray' | 'ultrasound' | 'ct' | 'mri' | 'other',
        worklistScope: '' as '' | 'open',
        from: '',
        to: '',
        page: 1,
        perPage: 50,
        sortBy: 'orderedAt' as string,
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type RadiologyOrderFilters = ReturnType<typeof useRadiologyOrderFilters>;
