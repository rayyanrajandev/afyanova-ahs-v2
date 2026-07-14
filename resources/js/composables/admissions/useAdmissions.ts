import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { AdmissionFilters } from './useAdmissionFilters';

/**
 * Matches AdmissionResponseTransformer::transform() exactly
 * (app/Modules/Admission/Presentation/Http/Transformers/AdmissionResponseTransformer.php).
 */
export type AdmissionBedResourceSummary = {
    id: string;
    code: string | null;
    name: string | null;
    wardName: string | null;
    bedNumber: string | null;
};

export type Admission = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    attendingClinicianUserId: number | null;
    ward: string | null;
    bed: string | null;
    bedResourceId: string | null;
    bedResource: AdmissionBedResourceSummary | null;
    admittedAt: string | null;
    dischargedAt: string | null;
    admissionReason: string | null;
    notes: string | null;
    financialClass: string | null;
    billingPayerContractId: string | null;
    coverageReference: string | null;
    coverageNotes: string | null;
    status: 'admitted' | 'discharged' | 'transferred' | 'cancelled' | null;
    statusReason: string | null;
    dischargeDestination: string | null;
    followUpPlan: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type AdmissionListResponse = {
    data: Admission[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

function filterQuery(filters: AdmissionFilters) {
    return {
        q: filters.q.trim() || null,
        status: filters.status || null,
        ward: filters.ward.trim() || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function useAdmissions(filters: AdmissionFilters): UseQueryReturnType<AdmissionListResponse, Error> {
    return useQuery({
        queryKey: ['admissions-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<AdmissionListResponse>('/admissions', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
        refetchInterval: 30_000,
    });
}
