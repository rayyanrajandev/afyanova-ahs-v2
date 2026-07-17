import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { PlatformUser } from './usePlatformUserList';

type PlatformUserResponse = { data: PlatformUser };

export type PlatformUserStatusChangeInput = {
    userId: number;
    status: 'active' | 'inactive';
    reason: string;
    approvalCaseReference: string;
};

/** PATCH /platform/admin/users/{id}/status — single-row and single-target activate/deactivate. */
export function usePlatformUserStatusChange(): UseMutationReturnType<PlatformUser, Error, PlatformUserStatusChangeInput, unknown> {
    return useMutation({
        mutationFn: async (input: PlatformUserStatusChangeInput): Promise<PlatformUser> => {
            const response = await apiPatch<PlatformUserResponse>(`/platform/admin/users/${input.userId}/status`, {
                body: {
                    status: input.status,
                    reason: input.status === 'inactive' ? input.reason.trim() : null,
                    approvalCaseReference: input.approvalCaseReference.trim() || null,
                },
            });
            return response.data;
        },
    });
}

export type PlatformUserBulkStatusChangeInput = {
    userIds: number[];
    status: 'active' | 'inactive';
    reason: string;
    approvalCaseReference: string;
};

export type PlatformUserBulkStatusChangeResult = {
    requestedCount: number;
    updatedCount: number;
    skippedUserIds: number[];
    users: PlatformUser[];
};

type PlatformUserBulkStatusResponse = { data: PlatformUserBulkStatusChangeResult };

/** PATCH /platform/admin/users/bulk-status — bulk toolbar activate/deactivate. */
export function usePlatformUserBulkStatusChange(): UseMutationReturnType<
    PlatformUserBulkStatusChangeResult,
    Error,
    PlatformUserBulkStatusChangeInput,
    unknown
> {
    return useMutation({
        mutationFn: async (input: PlatformUserBulkStatusChangeInput): Promise<PlatformUserBulkStatusChangeResult> => {
            const response = await apiPatch<PlatformUserBulkStatusResponse>('/platform/admin/users/bulk-status', {
                body: {
                    userIds: input.userIds,
                    status: input.status,
                    reason: input.status === 'inactive' ? input.reason.trim() : null,
                    approvalCaseReference: input.approvalCaseReference.trim() || null,
                },
            });
            return response.data;
        },
    });
}
