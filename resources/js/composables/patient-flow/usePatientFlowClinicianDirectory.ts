import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches StaffProfileResponseTransformer::transform() exactly — only the
 * fields this composable actually uses are typed here.
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
 * GET /patient-flow/clinician-directory (PatientFlowController::clinicianDirectory,
 * gated by can:appointments.read — the same permission the board route
 * requires). Server always forces status=active, clinicalOnly=true regardless
 * of query. Mirrors useTheatreClinicianDirectory.ts exactly: fetched once and
 * cached as an id->name lookup map rather than per-card.
 */
export function usePatientFlowClinicianDirectory(): {
    query: UseQueryReturnType<ClinicianDirectoryResponse, Error>;
    nameById: ComputedRef<Record<number, string>>;
} {
    const query = useQuery({
        queryKey: ['patient-flow-clinician-directory'],
        queryFn: () => apiGet<ClinicianDirectoryResponse>('/patient-flow/clinician-directory', { perPage: 200 }),
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
