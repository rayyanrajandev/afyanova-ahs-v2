import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';

type AuthPermissionsResponse = {
    data?: Array<{ name?: string | null }>;
    meta?: { total?: number | null };
};

/**
 * Shared, cached replacement for the per-page ad hoc fetch the current
 * Workspace.vue does on every mount (GET /auth/me/permissions, see
 * loadMedicalRecordPermissions() there). Same endpoint, same response shape —
 * only the fetch is centralized so multiple new-rebuild pages/components
 * don't each re-request and re-parse it independently. TanStack Query's
 * default caching means a second component using this composable in the same
 * session reuses the first's result rather than re-fetching.
 */
export function usePermissions() {
    const query = useQuery({
        queryKey: ['auth-permissions'],
        queryFn: async () => {
            const response = await apiGet<AuthPermissionsResponse>('/auth/me/permissions');
            return new Set(
                (response.data ?? [])
                    .map((permission) => permission.name?.trim())
                    .filter((name): name is string => Boolean(name)),
            );
        },
        staleTime: 5 * 60_000,
    });

    function has(name: string): boolean {
        return query.data.value?.has(name) ?? false;
    }

    return {
        isLoading: query.isLoading,
        has,
        names: computed(() => query.data.value ?? new Set<string>()),
    };
}
