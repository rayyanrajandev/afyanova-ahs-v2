import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PlatformUser } from './usePlatformUserList';

type PlatformUserResponse = { data: PlatformUser };

/** GET /platform/admin/users/{id} — the authoritative single-user record shown in the details sheet. */
export function usePlatformUserDetails(userId: ComputedRef<number | null>): UseQueryReturnType<PlatformUser, Error> {
    return useQuery({
        queryKey: ['platform-users-details', userId],
        queryFn: async () => {
            const response = await apiGet<PlatformUserResponse>(`/platform/admin/users/${userId.value}`);
            return response.data;
        },
        enabled: computed(() => userId.value !== null),
    });
}
