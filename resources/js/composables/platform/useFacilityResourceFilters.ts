import { reactive } from 'vue';

/**
 * Generic counterpart to useWardBedFilters.ts — same shape
 * (q/status/departmentId/subtype/page/perPage), parameterized so any
 * facility_resources resource_type (currently ward-beds and observation-
 * rooms) can share one filters composable instead of a dedicated one per
 * type. `subtype` maps to whichever query param the backend expects for
 * that type (wardName for ward-beds, roomName for observation-rooms — see
 * ListFacilityResourcesUseCase).
 */
export function useFacilityResourceFilters() {
    return reactive({
        q: '',
        status: '' as string,
        departmentId: '',
        subtype: '',
        page: 1,
        perPage: 20,
    });
}

export type FacilityResourceFilters = ReturnType<typeof useFacilityResourceFilters>;
