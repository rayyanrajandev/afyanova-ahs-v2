import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { LaboratoryOrderFilters } from './useLaboratoryOrderFilters';

/**
 * Matches LaboratoryOrderResponseTransformer::transform() exactly
 * (app/Modules/Laboratory/Presentation/Http/Transformers/LaboratoryOrderResponseTransformer.php),
 * plus the `patient`/`orderedBy` summaries the controller attaches via
 * ClinicalOrderPatientSummaryEnricher/ClinicalOrderUserSummaryEnricher on
 * list responses (app/Support/ClinicalOrders/*Enricher.php).
 */
export type LaboratoryOrderStatus =
    | 'ordered'
    | 'collected'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export type LaboratoryOrderPriority = 'routine' | 'urgent' | 'stat';

export type LabResultParameter = {
    code: string;
    name: string;
    value: string | null;
    unit: string | null;
    flag: string | null;
    referenceRange: string | null;
};

export type CatalogParameter = {
    code: string;
    name: string;
    unit: string;
    referenceRangeLow: string;
    referenceRangeHigh: string;
};

export type LaboratoryOrderPatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone: string | null;
};

export type LaboratoryOrderClinicianSummary = {
    id: number;
    name: string | null;
};

/**
 * Matches ClinicalCurrentCare::laboratory() exactly
 * (app/Support/ClinicalOrders/ClinicalCurrentCare.php). Unlike pharmacy's
 * currentCare, there is no hidden server-side gate not reflected in
 * `nextAction` here — consume it directly as the row's primary action.
 *
 * `key` is 'review_order' for the collect/start-processing/complete steps
 * (label alone tells you which — derive the actual dialog intent from
 * order.status, not from this key) or 'review_result' for a result to
 * check/verify (label + order.verifiedAt distinguish "needs verification"
 * from "already verified, just reviewing").
 */
export type LaboratoryOrderNextAction = {
    key: 'review_order' | 'review_result';
    label: string;
    emphasis: 'primary' | 'warning' | 'secondary';
};

export type LaboratoryOrderCurrentCare = {
    isCurrent: boolean;
    requiresReview: boolean;
    priorityRank: number;
    isPending?: boolean;
    hasCriticalResult?: boolean;
    hasAbnormalResult?: boolean;
    isRecentlyCompleted?: boolean;
    workflowHint: string | null;
    nextAction: LaboratoryOrderNextAction | null;
};

export type LaboratoryOrder = {
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
    labTestCatalogItemId: string | null;
    testCode: string | null;
    testName: string | null;
    priority: LaboratoryOrderPriority | null;
    specimenType: string | null;
    clinicalNotes: string | null;
    resultSummary: string | null;
    resultParameters: LabResultParameter[] | null;
    catalogUnit: string | null;
    catalogParameters: CatalogParameter[] | null;
    resultedAt: string | null;
    verifiedAt: string | null;
    verifiedByUserId: number | null;
    verificationNote: string | null;
    status: LaboratoryOrderStatus;
    entryState: 'draft' | 'active' | null;
    signedAt: string | null;
    signedByUserId: number | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    currentCare: LaboratoryOrderCurrentCare;
    stockPrecheck: unknown | null;
    createdAt: string | null;
    updatedAt: string | null;
    patient: LaboratoryOrderPatientSummary | null;
    orderedBy: LaboratoryOrderClinicianSummary | null;
};

type LaboratoryOrderListResponse = {
    data: LaboratoryOrder[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

function filterQuery(filters: LaboratoryOrderFilters) {
    return {
        q: filters.q.trim() || null,
        patientId: filters.patientId || null,
        status: filters.status || null,
        priority: filters.priority || null,
        worklistScope: filters.worklistScope || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function useLaboratoryOrders(
    filters: LaboratoryOrderFilters,
): UseQueryReturnType<LaboratoryOrderListResponse, Error> {
    return useQuery({
        queryKey: ['laboratory-orders-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<LaboratoryOrderListResponse>('/laboratory-orders', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
        refetchInterval: 30_000,
    });
}
