import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { AppointmentListFilters } from './useAppointmentListFilters';

/**
 * Matches AppointmentResponseTransformer::transform() exactly
 * (app/Modules/Appointment/Presentation/Http/Transformers/AppointmentResponseTransformer.php)
 * but only declares the fields this scheduling-only list actually renders —
 * same "excludes fields with no consumer" convention usePatientList.ts's own
 * PatientListItem documents. Triage/consultation/referral fields
 * (triageCategory, consultationOwnerUserId, etc.) belong to the operational
 * view this page deliberately does not render — see
 * reports/appointments-scheduling-workspace-modernization-plan.md §2.1.
 */
export type AppointmentListItem = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    clinicianUserId: number | null;
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    appointmentType: string | null;
    status: string | null;
    createdAt: string | null;
};

type AppointmentListResponse = {
    data: AppointmentListItem[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

function filterQuery(filters: AppointmentListFilters) {
    return {
        q: filters.q.trim() || null,
        department: filters.department.trim() || null,
        status: filters.status || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function useAppointmentList(filters: AppointmentListFilters): UseQueryReturnType<AppointmentListResponse, Error> {
    return useQuery({
        queryKey: ['appointments-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<AppointmentListResponse>('/appointments', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
    });
}
