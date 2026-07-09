import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PatientListFilters } from './usePatientListFilters';

/**
 * Matches PatientResponseTransformer::transform() exactly
 * (app/Modules/Patient/Presentation/Http/Transformers/PatientResponseTransformer.php).
 * Deliberately excludes routingHandoffSummary/activeRoutingTickets, which
 * PatientController::index() merges in conditionally for walk-in routing
 * context — that's Visit Handoff sheet territory (Phase 5), not core list
 * data, and adding it here before it has a consumer would be a type with no
 * reader.
 */
export type PatientListItem = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    email: string | null;
    nationalId: string | null;
    countryCode: string | null;
    region: string | null;
    district: string | null;
    addressLine: string | null;
    nextOfKinName: string | null;
    nextOfKinPhone: string | null;
    status: string | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type PatientListResponse = {
    data: PatientListItem[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

export type PatientStatusCounts = {
    active: number;
    inactive: number;
    other: number;
    total: number;
};

type PatientStatusCountsResponse = { data: PatientStatusCounts };

function filterQuery(filters: PatientListFilters) {
    return {
        q: filters.q.trim() || null,
        status: filters.status || null,
        gender: filters.gender || null,
        region: filters.region.trim() || null,
        district: filters.district.trim() || null,
    };
}

export function usePatientList(filters: PatientListFilters): UseQueryReturnType<PatientListResponse, Error> {
    return useQuery({
        queryKey: ['patients-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<PatientListResponse>('/patients', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
    });
}

/**
 * ListPatientStatusCountsUseCase only accepts `q`
 * (app/Modules/Patient/Application/UseCases/ListPatientStatusCountsUseCase.php)
 * — status/gender/region/district are deliberately not sent, matching the
 * backend contract exactly rather than sending filters the endpoint ignores.
 */
export function usePatientStatusCounts(filters: PatientListFilters): UseQueryReturnType<PatientStatusCounts, Error> {
    return useQuery({
        queryKey: ['patients-index-status-counts', computed(() => filters.q)],
        queryFn: async () => {
            const response = await apiGet<PatientStatusCountsResponse>('/patients/status-counts', {
                q: filters.q.trim() || null,
            });
            return response.data;
        },
    });
}
