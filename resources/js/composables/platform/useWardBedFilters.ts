import { reactive } from 'vue';

/**
 * Matches ListFacilityResourcesUseCase's ward_bed filter shape
 * (app/Modules/Platform/Application/UseCases/ListFacilityResourcesUseCase.php):
 * q, status, departmentId, wardName, page, perPage. Same pattern as
 * useAdmissionFilters.ts.
 */
export function useWardBedFilters() {
    return reactive({
        q: '',
        status: '' as string,
        departmentId: '',
        wardName: '',
        page: 1,
        perPage: 20,
    });
}

export type WardBedFilters = ReturnType<typeof useWardBedFilters>;
