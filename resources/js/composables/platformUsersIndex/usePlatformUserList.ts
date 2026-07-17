import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PlatformUserListFilters } from './usePlatformUserListFilters';

export type PlatformRole = {
    id: string | null;
    name: string | null;
    code: string | null;
    riskTier?: 'hospital' | 'platform' | 'system' | 'other' | null;
    isElevated?: boolean | null;
};

export type PlatformUserFacilityAssignment = {
    facilityId: string | null;
    role?: string | null;
    isPrimary?: boolean;
    isActive?: boolean;
};

export type PlatformUserPrivilegedContext = {
    isPrivileged?: boolean;
    matchedPermissionNames?: string[];
    roleCodes?: string[];
    systemRoleCodes?: string[];
} | null;

/** Matches PlatformUserResponseTransformer::transform() (app/Modules/Platform/Presentation/Http/Transformers). */
export type PlatformUser = {
    id: number | null;
    name: string | null;
    email: string | null;
    emailVerifiedAt: string | null;
    status: string | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    roleIds: string[];
    roles: PlatformRole[];
    requiresApprovalCaseForSensitiveChanges?: boolean;
    privilegedTargetUser?: PlatformUserPrivilegedContext;
    facilityAssignments: PlatformUserFacilityAssignment[];
};

export type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };

type PlatformUserListResponse = { data: PlatformUser[]; meta: Pagination };

export type PlatformUserStatusCounts = { active: number; inactive: number; other: number; total: number };

type PlatformUserStatusCountsResponse = { data: PlatformUserStatusCounts };

/**
 * The list endpoint always sends the caller's scoped facility (when present)
 * in place of any manually chosen filter — matches legacy Index.vue's
 * `scopedFacilityId.value ?? searchForm.facilityId` (loadUsers()). A
 * facility-scoped admin cannot broaden the query past their own facility.
 */
export function usePlatformUserList(
    filters: PlatformUserListFilters,
    scopedFacilityId: ComputedRef<string | null>,
): UseQueryReturnType<PlatformUserListResponse, Error> {
    return useQuery({
        queryKey: ['platform-users-index', computed(() => ({ ...filters, scopedFacilityId: scopedFacilityId.value }))],
        queryFn: () =>
            apiGet<PlatformUserListResponse>('/platform/admin/users', {
                q: filters.q.trim() || null,
                status: filters.status || null,
                verification: filters.verification || null,
                roleId: filters.roleId || null,
                facilityId: scopedFacilityId.value ?? (filters.facilityId || null),
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
                page: filters.page,
                perPage: filters.perPage,
            }),
    });
}

/**
 * PlatformUserAdminController::statusCounts() only honors q/verification/
 * roleId/facilityId (no status/sortBy/paging) — matches legacy
 * Index.vue's loadStatusCounts() exactly, including that it does NOT
 * force-override facilityId with the caller's scope (unlike the list
 * query above); the backend already scopes visibility for facility-scoped
 * callers regardless of this param.
 */
export function usePlatformUserStatusCounts(filters: PlatformUserListFilters): UseQueryReturnType<PlatformUserStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'platform-users-index-status-counts',
            computed(() => ({ q: filters.q, verification: filters.verification, roleId: filters.roleId, facilityId: filters.facilityId })),
        ],
        queryFn: async () => {
            const response = await apiGet<PlatformUserStatusCountsResponse>('/platform/admin/users/status-counts', {
                q: filters.q.trim() || null,
                verification: filters.verification || null,
                roleId: filters.roleId || null,
                facilityId: filters.facilityId || null,
            });
            return response.data;
        },
    });
}
