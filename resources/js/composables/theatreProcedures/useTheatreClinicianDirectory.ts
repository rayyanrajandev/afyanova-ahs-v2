import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches StaffProfileResponseTransformer::transform() exactly
 * (app/Modules/Staff/Presentation/Http/Transformers/StaffProfileResponseTransformer.php).
 * Only the fields this composable actually uses are typed here.
 */
type StaffProfile = {
    userId: number | null;
    userName: string | null;
};

type ClinicianDirectoryResponse = {
    data: StaffProfile[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * GET /theatre-procedures/clinician-directory (TheatreProcedureController::clinicianDirectory,
 * gated by Gate::any(['theatre.procedures.read', 'theatre.procedures.create',
 * 'theatre.procedures.update']) — theatre.procedures.read alone suffices).
 * Server always forces status=active, clinicalOnly=true regardless of query.
 *
 * No precedent in lab/pharmacy/radiology — theatre procedures have no
 * `orderedBy` enrichment for its two named surgical roles
 * (operatingClinicianUserId/anesthetistUserId), so the worklist resolves
 * names itself via this slow-changing staff roster, fetched once and
 * cached as an id->name lookup map rather than per-order.
 */
export function useTheatreClinicianDirectory(): {
    query: UseQueryReturnType<ClinicianDirectoryResponse, Error>;
    nameById: ComputedRef<Record<number, string>>;
} {
    const query = useQuery({
        queryKey: ['theatre-clinician-directory'],
        queryFn: () => apiGet<ClinicianDirectoryResponse>('/theatre-procedures/clinician-directory', { perPage: 200 }),
        staleTime: 5 * 60_000,
    });

    const nameById = computed<Record<number, string>>(() => {
        const map: Record<number, string> = {};
        for (const profile of query.data.value?.data ?? []) {
            if (profile.userId !== null && profile.userName) {
                map[profile.userId] = profile.userName;
            }
        }
        return map;
    });

    return { query, nameById };
}
