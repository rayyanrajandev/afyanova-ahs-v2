import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

export type ClinicianDirectoryEntry = {
    id: string;
    userId: number | null;
    userName: string | null;
    department: string | null;
    jobTitle: string | null;
};

type ClinicianDirectoryResponse = { data: ClinicianDirectoryEntry[] };

/**
 * GET /staff/clinical-directory — same query shape the legacy
 * appointments/Index.vue's triage routing already uses
 * (appointments/Index.vue:2932-2938): active, clinical staff only, a
 * single page large enough to cover a facility's roster without pagination
 * UI (200, matching the legacy page's own choice, not invented here).
 *
 * Deliberately role/page-neutral (query key has no "triage" or "reception"
 * prefix) — triage/Queue.vue is its first consumer, but a future
 * consultation-takeover UI (Phase 4) would want the exact same roster, and
 * a shared cache entry is correct there, not a coincidence to avoid.
 *
 * `physicianOnly` (patient flow redesign) narrows clinicalOnly's
 * deliberately-broad set (which includes lab/pharmacy/radiology/theatre
 * staff, correct for triage/referral routing) down to actual
 * doctor-tier providers — for AppointmentCreateSheet.vue/
 * AppointmentEditSheet.vue's clinician picker only. Defaults to false so
 * every other existing consumer's roster is unaffected; gets its own cache
 * entry (distinct query key) since it's a genuinely different result set,
 * not a client-side filter of the same one.
 */
export function useClinicianDirectory(options?: { physicianOnly?: boolean }): UseQueryReturnType<ClinicianDirectoryEntry[], Error> {
    const physicianOnly = options?.physicianOnly ?? false;

    return useQuery({
        queryKey: ['clinician-directory', physicianOnly],
        queryFn: async () => {
            const response = await apiGet<ClinicianDirectoryResponse>('/staff/clinical-directory', {
                status: 'active',
                clinicalOnly: 'true',
                physicianOnly: physicianOnly ? 'true' : null,
                page: 1,
                perPage: 200,
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}
