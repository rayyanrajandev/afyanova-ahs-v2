import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { ClinicalProcedureOrderFilters } from './useClinicalProcedureOrderFilters';

export type ClinicalProcedureOrderStatus = 'ordered' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type ClinicalProcedureOrderProcedureSetting = 'outpatient' | 'inpatient' | 'bedside' | 'emergency' | 'other';

export type ClinicalProcedureOrderPatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone: string | null;
};

export type ClinicalProcedureOrderClinicianSummary = {
    id: number;
    name: string | null;
};

export type ClinicalProcedureOrderNextAction = {
    key: 'review_order' | 'review_report';
    label: string;
    emphasis: 'primary' | 'warning' | 'secondary';
};

export type ClinicalProcedureOrderCurrentCare = {
    isCurrent: boolean;
    requiresReview: boolean;
    priorityRank: number;
    isPending?: boolean;
    hasCriticalReport?: boolean;
    hasAbnormalReport?: boolean;
    isRecentlyCompleted?: boolean;
    workflowHint: string | null;
    nextAction: ClinicalProcedureOrderNextAction | null;
};

export type ClinicalProcedureOrder = {
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
    clinicalProcedureCatalogItemId: string | null;
    procedureCode: string | null;
    procedureSetting: ClinicalProcedureOrderProcedureSetting | null;
    procedureDescription: string | null;
    clinicalIndication: string | null;
    scheduledFor: string | null;
    reportSummary: string | null;
    completedAt: string | null;
    status: ClinicalProcedureOrderStatus;
    entryState: 'draft' | 'active' | null;
    signedAt: string | null;
    signedByUserId: number | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    currentCare: ClinicalProcedureOrderCurrentCare;
    stockPrecheck: unknown | null;
    createdAt: string | null;
    updatedAt: string | null;
    patient: ClinicalProcedureOrderPatientSummary | null;
    orderedBy: ClinicalProcedureOrderClinicianSummary | null;
};

type ClinicalProcedureOrderListResponse = {
    data: ClinicalProcedureOrder[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

function filterQuery(filters: ClinicalProcedureOrderFilters) {
    return {
        q: filters.q.trim() || null,
        patientId: filters.patientId || null,
        status: filters.status || null,
        procedureSetting: filters.procedureSetting || null,
        worklistScope: filters.worklistScope || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function useClinicalProcedureOrders(filters: ClinicalProcedureOrderFilters): UseQueryReturnType<ClinicalProcedureOrderListResponse, Error> {
    return useQuery({
        queryKey: ['clinical-procedure-orders-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<ClinicalProcedureOrderListResponse>('/clinical-procedure-orders', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
        refetchInterval: 30_000,
    });
}
