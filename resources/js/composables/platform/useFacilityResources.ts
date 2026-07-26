import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { FacilityResourceFilters } from './useFacilityResourceFilters';

/**
 * Generic counterpart to useWardBeds.ts's WardBed type — matches
 * FacilityResourceResponseTransformer::transform() plus the occupancy
 * fields the controller merges on for ward-beds/observation-rooms. Covers
 * both wardName/bedNumber (ward-beds) and roomName/roomNumber/
 * genderRestriction (observation-rooms) since the transformer always
 * includes all of them regardless of resource_type.
 */
export type FacilityResource = {
    id: string | null;
    tenantId: string | null;
    facilityId: string | null;
    resourceType: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    servicePointType: string | null;
    wardName: string | null;
    bedNumber: string | null;
    roomName: string | null;
    roomNumber: string | null;
    genderRestriction: string | null;
    location: string | null;
    chargeableItemId: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    isOccupied: boolean;
    occupiedByAdmissionId: string | null;
    occupiedByAdmissionNumber: string | null;
};

type FacilityResourceListResponse = {
    data: FacilityResource[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

function filterQuery(subtypeParam: 'wardName' | 'roomName', filters: FacilityResourceFilters) {
    return {
        q: filters.q.trim() || null,
        status: filters.status || null,
        departmentId: filters.departmentId || null,
        [subtypeParam]: filters.subtype.trim() || null,
        sortBy: 'name',
        sortDir: 'asc',
    };
}

/**
 * @param basePath URL segment under /platform/admin/, e.g. 'ward-beds' or 'observation-rooms'.
 * @param subtypeParam which query param name the backend expects for the subtype filter.
 */
export function useFacilityResources(
    basePath: string,
    subtypeParam: 'wardName' | 'roomName',
    filters: FacilityResourceFilters,
): UseQueryReturnType<FacilityResourceListResponse, Error> {
    return useQuery({
        queryKey: [basePath, computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<FacilityResourceListResponse>(`/platform/admin/${basePath}`, {
                ...filterQuery(subtypeParam, filters),
                page: filters.page,
                perPage: filters.perPage,
            }),
    });
}
