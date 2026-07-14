import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { WardBedFilters } from './useWardBedFilters';

/**
 * Matches FacilityResourceResponseTransformer::transform() plus the
 * occupancy fields FacilityResourceRegistryController::wardBeds()/wardBed()
 * merge on top (occupancy visibility follow-through to the Reception/
 * Emergency/Admission/Bed-Management audit — same field names as
 * AvailableBedResponseTransformer for cross-page consistency).
 */
export type WardBed = {
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
    location: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    isOccupied: boolean;
    occupiedByAdmissionId: string | null;
    occupiedByAdmissionNumber: string | null;
};

type WardBedListResponse = {
    data: WardBed[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

function filterQuery(filters: WardBedFilters) {
    return {
        q: filters.q.trim() || null,
        status: filters.status || null,
        departmentId: filters.departmentId || null,
        wardName: filters.wardName.trim() || null,
        sortBy: 'name',
        sortDir: 'asc',
    };
}

export function useWardBeds(filters: WardBedFilters): UseQueryReturnType<WardBedListResponse, Error> {
    return useQuery({
        queryKey: ['ward-beds', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<WardBedListResponse>('/platform/admin/ward-beds', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
            }),
    });
}
