import { reactive } from 'vue';

/**
 * Matches ListPharmacyOrdersUseCase's filter shape 1:1
 * (app/Modules/Pharmacy/Application/UseCases/ListPharmacyOrdersUseCase.php):
 * q, patientId, status, worklistScope, from/to, sortBy, sortDir, page,
 * perPage. `worklistScope` is part of the API contract (the legacy page
 * uses `worklistScope=open` for its default queue) but isn't surfaced as
 * a separate control here — the status Tabs are the single filter axis,
 * same "all/status1/.../statusN" convention as every other V2 page
 * (admissions/IndexV2.vue, encounters/List.vue), so `status` alone drives
 * both the Tabs and this filter's `status` field. Left in the type for API
 * parity, always empty in practice.
 */
export function usePharmacyOrderFilters() {
    return reactive({
        q: '',
        patientId: '',
        status: '' as string,
        worklistScope: '' as '' | 'open',
        from: '',
        to: '',
        page: 1,
        perPage: 50,
        sortBy: 'orderedAt' as string,
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type PharmacyOrderFilters = ReturnType<typeof usePharmacyOrderFilters>;
