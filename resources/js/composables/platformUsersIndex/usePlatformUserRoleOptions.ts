import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PlatformRole } from './usePlatformUserList';

type PlatformRoleListResponse = {
    data: PlatformRole[];
    meta?: { roleAssignmentPolicy?: 'full' | 'hospital_operational' };
};

export type PlatformUserRoleOptions = {
    roles: PlatformRole[];
    roleAssignmentPolicy: 'full' | 'hospital_operational';
};

/**
 * GET /platform/admin/roles, scoped to the caller's facility when present —
 * the response's `meta.roleAssignmentPolicy` tells PlatformRoleAssignmentPicker
 * whether the caller may only assign hospital-operational roles (matches
 * legacy Index.vue's loadRoles()).
 */
export function usePlatformUserRoleOptions(scopedFacilityId: ComputedRef<string | null>): UseQueryReturnType<PlatformUserRoleOptions, Error> {
    return useQuery({
        queryKey: ['platform-users-role-options', computed(() => scopedFacilityId.value)],
        queryFn: async () => {
            const response = await apiGet<PlatformRoleListResponse>('/platform/admin/roles', {
                page: 1,
                perPage: 100,
                sortBy: 'name',
                sortDir: 'asc',
                facilityId: scopedFacilityId.value || null,
            });
            return {
                roles: (response.data ?? []).filter((entry) => entry.id !== null),
                roleAssignmentPolicy: response.meta?.roleAssignmentPolicy === 'hospital_operational' ? 'hospital_operational' : 'full',
            };
        },
    });
}
