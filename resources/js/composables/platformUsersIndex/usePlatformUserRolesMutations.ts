import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { PlatformRole } from './usePlatformUserList';

export type PlatformUserRolesSyncInput = {
    userId: number;
    roleIds: string[];
    approvalCaseReference: string;
};

export type PlatformUserRolesSyncResult = { roleIds: string[]; roles: PlatformRole[] };

type PlatformUserRolesSyncResponse = { data: PlatformUserRolesSyncResult };

/** PATCH /platform/admin/users/{userId}/roles (PlatformRbacController::syncUserRoles) — details sheet's Access tab. */
export function usePlatformUserRolesSync(): UseMutationReturnType<PlatformUserRolesSyncResult, Error, PlatformUserRolesSyncInput, unknown> {
    return useMutation({
        mutationFn: async (input: PlatformUserRolesSyncInput): Promise<PlatformUserRolesSyncResult> => {
            const response = await apiPatch<PlatformUserRolesSyncResponse>(`/platform/admin/users/${input.userId}/roles`, {
                body: {
                    roleIds: input.roleIds,
                    approvalCaseReference: input.approvalCaseReference.trim() || null,
                },
            });
            return response.data;
        },
    });
}

export type PlatformUserBulkRolesSyncInput = {
    userIds: number[];
    roleIds: string[];
    approvalCaseReference: string;
};

export type PlatformUserBulkRolesSyncResult = {
    requestedCount: number;
    updatedCount: number;
    skippedUserIds: number[];
    updates: Array<{ userId: number | null; roleIds: string[]; roles: PlatformRole[] }>;
};

type PlatformUserBulkRolesSyncResponse = { data: PlatformUserBulkRolesSyncResult };

/** PATCH /platform/admin/users/bulk-roles (PlatformRbacController::bulkSyncUserRoles) — bulk toolbar role assignment. */
export function usePlatformUserBulkRolesSync(): UseMutationReturnType<
    PlatformUserBulkRolesSyncResult,
    Error,
    PlatformUserBulkRolesSyncInput,
    unknown
> {
    return useMutation({
        mutationFn: async (input: PlatformUserBulkRolesSyncInput): Promise<PlatformUserBulkRolesSyncResult> => {
            const response = await apiPatch<PlatformUserBulkRolesSyncResponse>('/platform/admin/users/bulk-roles', {
                body: {
                    userIds: input.userIds,
                    roleIds: input.roleIds,
                    approvalCaseReference: input.approvalCaseReference.trim() || null,
                },
            });
            return response.data;
        },
    });
}
