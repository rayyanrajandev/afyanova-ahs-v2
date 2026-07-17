import { reactive } from 'vue';

/**
 * Filters for the platform/facility users registry — matches
 * PlatformUserAdminController::index()'s query contract 1:1: q, status,
 * verification, roleId, facilityId, sortBy, sortDir, page, perPage.
 * Same pattern as usePatientListFilters.ts.
 */
export function usePlatformUserListFilters() {
    return reactive({
        q: '',
        status: '' as string,
        verification: '' as string,
        roleId: '' as string,
        facilityId: '' as string,
        sortBy: 'name' as string,
        sortDir: 'asc' as 'asc' | 'desc',
        page: 1,
        perPage: 12,
    });
}

export type PlatformUserListFilters = ReturnType<typeof usePlatformUserListFilters>;
