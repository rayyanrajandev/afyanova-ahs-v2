import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { AppointmentListFilters } from './useAppointmentListFilters';

/**
 * Matches ListAppointmentStatusCountsUseCase's return shape exactly
 * (app/Modules/Appointment/Infrastructure/Repositories/EloquentAppointmentRepository.php:178-188)
 * — only the fields this scheduling-only page's sticky-header mini-stat
 * cards use are declared; waiting_triage/waiting_provider/in_consultation/
 * checked_in are operational-queue counts, not this page's concern (same
 * scope line every other composable in this folder draws).
 */
export type AppointmentStatusCounts = {
    scheduled: number;
    completed: number;
    cancelled: number;
    no_show: number;
    total: number;
};

type AppointmentStatusCountsResponse = { data: AppointmentStatusCounts };

/**
 * Only sends `q` — matches usePatientList.ts's usePatientStatusCounts
 * convention of not re-sending every list filter to a counts endpoint that
 * ignores most of them for this page's purposes. Unlike the patients
 * version, ListAppointmentStatusCountsUseCase does accept department/from/to
 * too, so those are included — they're genuinely scoping filters here, not
 * ignored ones.
 */
export function useAppointmentStatusCounts(filters: AppointmentListFilters): UseQueryReturnType<AppointmentStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'appointments-index-status-counts',
            computed(() => ({ q: filters.q, department: filters.department, from: filters.from, to: filters.to })),
        ],
        queryFn: async () => {
            const response = await apiGet<AppointmentStatusCountsResponse>('/appointments/status-counts', {
                q: filters.q.trim() || null,
                department: filters.department.trim() || null,
                from: filters.from || null,
                to: filters.to || null,
            });
            return response.data;
        },
    });
}
