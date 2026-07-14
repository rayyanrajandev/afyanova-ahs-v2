import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { EmergencyCaseFilters } from './useEmergencyCaseFilters';

/**
 * Matches EmergencyTriageCaseResponseTransformer::transform() exactly
 * (app/Modules/EmergencyTriage/Presentation/Http/Transformers/EmergencyTriageCaseResponseTransformer.php
 * — that's the backend's real class name; the frontend deliberately doesn't
 * echo "Triage" in its own naming, see useEmergencyCaseFilters.ts's
 * docblock). Phase 1 of reports/emergency-queue-modernization-plan.md is
 * queue + status workflow only — dispositionNotes/statusReason are read
 * here (shown on the case row/details) but not written except through the
 * status dialog.
 */
export type EmergencyCase = {
    id: string;
    caseNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    assignedClinicianUserId: number | null;
    arrivalAt: string | null;
    triageLevel: 'red' | 'yellow' | 'green' | null;
    chiefComplaint: string | null;
    vitalsSummary: string | null;
    triagedAt: string | null;
    dispositionNotes: string | null;
    completedAt: string | null;
    status: 'waiting' | 'triaged' | 'in_treatment' | 'admitted' | 'discharged' | 'cancelled' | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type EmergencyCaseListResponse = {
    data: EmergencyCase[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

function filterQuery(filters: EmergencyCaseFilters) {
    return {
        q: filters.q.trim() || null,
        status: filters.status || null,
        triageLevel: filters.triageLevel || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function useEmergencyCases(filters: EmergencyCaseFilters): UseQueryReturnType<EmergencyCaseListResponse, Error> {
    return useQuery({
        queryKey: ['emergency-cases', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<EmergencyCaseListResponse>('/emergency-triage-cases', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
    });
}
