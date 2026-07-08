import { QueryClient } from '@tanstack/vue-query';

/**
 * Factory, not a singleton — SSR needs a fresh QueryClient per request to
 * avoid leaking cached data between users; the client entry point calls this
 * once at boot, the SSR entry point calls it fresh per render.
 */
export function createAppQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Inertia already delivers the initial page payload synchronously as
                // props; queries built on top of that (see useEncounterWorkspace)
                // should not immediately refetch on every mount by default.
                refetchOnWindowFocus: false,
                retry: 1,
                staleTime: 30_000,
            },
        },
    });
}
