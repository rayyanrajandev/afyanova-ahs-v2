import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { reactive } from 'vue';
import { apiPatch, apiPost } from '@/lib/apiClient';
import type { PlatformUser } from './usePlatformUserList';

type PlatformUserResponse = { data: PlatformUser };

export function usePlatformUserCreateForm() {
    return reactive({ name: '', email: '', roleIds: [] as string[], sendInvite: true });
}

export type PlatformUserCreateForm = ReturnType<typeof usePlatformUserCreateForm>;

/** POST /platform/admin/users — profile + initial role assignment. Invite dispatch is a separate follow-up mutation (usePlatformUserCredentialLink). */
export function usePlatformUserCreate(): UseMutationReturnType<PlatformUser, Error, PlatformUserCreateForm, unknown> {
    return useMutation({
        mutationFn: async (form: PlatformUserCreateForm): Promise<PlatformUser> => {
            const response = await apiPost<PlatformUserResponse>('/platform/admin/users', {
                body: {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    roleIds: form.roleIds,
                },
            });
            return response.data;
        },
    });
}

export function usePlatformUserEditForm() {
    return reactive({ id: null as number | null, name: '', email: '', approvalCaseReference: '' });
}

export type PlatformUserEditForm = ReturnType<typeof usePlatformUserEditForm>;

/** PATCH /platform/admin/users/{id} — profile edit; approvalCaseReference is required server-side only for privileged targets. */
export function usePlatformUserEdit(): UseMutationReturnType<PlatformUser, Error, PlatformUserEditForm, unknown> {
    return useMutation({
        mutationFn: async (form: PlatformUserEditForm): Promise<PlatformUser> => {
            const response = await apiPatch<PlatformUserResponse>(`/platform/admin/users/${form.id}`, {
                body: {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    approvalCaseReference: form.approvalCaseReference.trim() || null,
                },
            });
            return response.data;
        },
    });
}
