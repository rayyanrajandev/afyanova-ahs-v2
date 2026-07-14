import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { RadiologyOrderFilters } from './useRadiologyOrderFilters';

/**
 * Matches RadiologyOrderResponseTransformer::transform() exactly
 * (app/Modules/Radiology/Presentation/Http/Transformers/RadiologyOrderResponseTransformer.php),
 * plus the `patient`/`orderedBy` summaries the controller attaches via
 * ClinicalOrderPatientSummaryEnricher/ClinicalOrderUserSummaryEnricher on
 * list responses (app/Support/ClinicalOrders/*Enricher.php).
 */
export type RadiologyOrderStatus = 'ordered' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type RadiologyOrderModality = 'xray' | 'ultrasound' | 'ct' | 'mri' | 'other';

export type RadiologyOrderPatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone: string | null;
};

export type RadiologyOrderClinicianSummary = {
    id: number;
    name: string | null;
};

/**
 * Matches ClinicalCurrentCare::radiology() exactly
 * (app/Support/ClinicalOrders/ClinicalCurrentCare.php). No hidden
 * server-side gate not reflected in `nextAction` — consume it directly.
 * Radiology has no verify step (unlike lab): `review_report`'s only
 * action is opening the detail sheet, there's nothing to submit.
 */
export type RadiologyOrderNextAction = {
    key: 'review_order' | 'review_report';
    label: string;
    emphasis: 'primary' | 'warning' | 'secondary';
};

export type RadiologyOrderCurrentCare = {
    isCurrent: boolean;
    requiresReview: boolean;
    priorityRank: number;
    isPending?: boolean;
    hasCriticalReport?: boolean;
    hasAbnormalReport?: boolean;
    isRecentlyCompleted?: boolean;
    workflowHint: string | null;
    nextAction: RadiologyOrderNextAction | null;
};

export type RadiologyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    encounterId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    orderSessionId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedByUserId: number | null;
    orderedAt: string | null;
    radiologyProcedureCatalogItemId: string | null;
    procedureCode: string | null;
    modality: RadiologyOrderModality | null;
    studyDescription: string | null;
    clinicalIndication: string | null;
    scheduledFor: string | null;
    reportSummary: string | null;
    completedAt: string | null;
    status: RadiologyOrderStatus;
    entryState: 'draft' | 'active' | null;
    signedAt: string | null;
    signedByUserId: number | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    currentCare: RadiologyOrderCurrentCare;
    stockPrecheck: unknown | null;
    createdAt: string | null;
    updatedAt: string | null;
    patient: RadiologyOrderPatientSummary | null;
    orderedBy: RadiologyOrderClinicianSummary | null;
};

type RadiologyOrderListResponse = {
    data: RadiologyOrder[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

function filterQuery(filters: RadiologyOrderFilters) {
    return {
        q: filters.q.trim() || null,
        patientId: filters.patientId || null,
        status: filters.status || null,
        modality: filters.modality || null,
        worklistScope: filters.worklistScope || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function useRadiologyOrders(filters: RadiologyOrderFilters): UseQueryReturnType<RadiologyOrderListResponse, Error> {
    return useQuery({
        queryKey: ['radiology-orders-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<RadiologyOrderListResponse>('/radiology-orders', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
        refetchInterval: 30_000,
    });
}
