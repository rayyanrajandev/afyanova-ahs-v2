import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches AvailableBedResponseTransformer::transform() exactly
 * (app/Modules/Admission/Presentation/Http/Transformers/AvailableBedResponseTransformer.php).
 * Server-computed occupancy (ListAvailableBedsUseCase) — replaces the
 * legacy admissions/Index.vue's client-side wardBedRegistry/
 * WardRegistryBedOption cross-reference logic. Deliberately no occupying
 * patient name — the bed picker's job is showing what's free, not another
 * patient's identity.
 */
export type AvailableBed = {
    id: string;
    code: string | null;
    name: string | null;
    wardName: string | null;
    bedNumber: string | null;
    departmentId: string | null;
    location: string | null;
    status: string | null;
    isOccupied: boolean;
    occupiedByAdmissionId: string | null;
    occupiedByAdmissionNumber: string | null;
};

type AvailableBedListResponse = {
    data: AvailableBed[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

export type AvailableBedFilters = {
    wardName?: string;
    departmentId?: string;
    q?: string;
};

/**
 * GET /admissions/available-beds. Shared by Admission V2's create/transfer
 * bed pickers and the Emergency admitted-dialog bed picker — cross-page
 * reuse, same precedent as useClinicianDirectory.ts. `filters` may be a
 * plain object (static) or a Ref/computed (reactive, refetches on change).
 */
export function useAvailableBeds(
    filters?: AvailableBedFilters | Ref<AvailableBedFilters>,
): UseQueryReturnType<AvailableBedListResponse, Error> {
    const resolvedFilters = computed<AvailableBedFilters>(() => {
        if (!filters) return {};
        return 'value' in filters ? filters.value : filters;
    });

    return useQuery({
        queryKey: ['available-beds', resolvedFilters],
        queryFn: () =>
            apiGet<AvailableBedListResponse>('/admissions/available-beds', {
                wardName: resolvedFilters.value.wardName || null,
                departmentId: resolvedFilters.value.departmentId || null,
                q: resolvedFilters.value.q || null,
                perPage: 200,
            }),
        staleTime: 30_000,
        // P6 of the Reception/Emergency/Admission/Bed-Management audit
        // follow-through: belt-and-suspenders self-healing for any
        // invalidation call site that's missed (e.g. a bed picker left open
        // in one tab while another tab occupies that bed) — matches
        // useAdmissions.ts/useAdmissionStatusCounts.ts's existing pattern.
        // staleTime alone only suppresses refetch-on-focus, it isn't a poll.
        refetchInterval: 30_000,
    });
}
