import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';

export type PlatformUserCredentialLinkResult = {
    userId: number | null;
    message: string | null;
    previewUrl?: string | null;
    deliveryMode?: string | null;
};

type PlatformUserCredentialLinkResponse = { data: PlatformUserCredentialLinkResult };

export type PlatformUserCredentialLinkInput = {
    userId: number;
    /** True when the target has never verified their email — dispatches an invite link instead of a password reset. */
    isInvite: boolean;
};

/** POST /platform/admin/users/{id}/invite-link or /password-reset-link, chosen by the caller from `emailVerifiedAt`. */
export function usePlatformUserCredentialLink(): UseMutationReturnType<
    PlatformUserCredentialLinkResult,
    Error,
    PlatformUserCredentialLinkInput,
    unknown
> {
    return useMutation({
        mutationFn: async (input: PlatformUserCredentialLinkInput): Promise<PlatformUserCredentialLinkResult> => {
            const endpoint = input.isInvite ? 'invite-link' : 'password-reset-link';
            const response = await apiPost<PlatformUserCredentialLinkResponse>(`/platform/admin/users/${input.userId}/${endpoint}`);
            return response.data;
        },
    });
}

export type PlatformUserBulkCredentialLinksResult = {
    requestedCount: number;
    dispatchedCount: number;
    inviteCount: number;
    resetCount: number;
    skippedUserIds: number[];
    failedCount: number;
    failedUserIds: number[];
    failed: Array<{ userId: number | null; message: string }>;
};

type PlatformUserBulkCredentialLinksResponse = { data: PlatformUserBulkCredentialLinksResult };

/** POST /platform/admin/users/bulk-credential-links — bulk toolbar "Send links" (no confirmation dialog, matches legacy). */
export function usePlatformUserBulkCredentialLinks(): UseMutationReturnType<
    PlatformUserBulkCredentialLinksResult,
    Error,
    number[],
    unknown
> {
    return useMutation({
        mutationFn: async (userIds: number[]): Promise<PlatformUserBulkCredentialLinksResult> => {
            const response = await apiPost<PlatformUserBulkCredentialLinksResponse>('/platform/admin/users/bulk-credential-links', {
                body: { userIds },
            });
            return response.data;
        },
    });
}
