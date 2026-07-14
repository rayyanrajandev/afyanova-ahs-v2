import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PharmacyOrderFilters } from './usePharmacyOrderFilters';

/**
 * Matches PharmacyOrderResponseTransformer::transform() exactly
 * (app/Modules/Pharmacy/Presentation/Http/Transformers/PharmacyOrderResponseTransformer.php),
 * plus the `patient`/`orderedBy` summaries the controller attaches via
 * ClinicalOrderPatientSummaryEnricher/ClinicalOrderUserSummaryEnricher on
 * list responses (app/Support/ClinicalOrders/*Enricher.php).
 */
export type PharmacyOrderStatus = 'pending' | 'in_preparation' | 'partially_dispensed' | 'dispensed' | 'cancelled';

export type PharmacyOrderPatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone: string | null;
};

export type PharmacyOrderClinicianSummary = {
    id: number;
    name: string | null;
};

/**
 * Matches ClinicalCurrentCare::pharmacy() exactly
 * (app/Support/ClinicalOrders/ClinicalCurrentCare.php) — the server's own
 * "what does this order need next" computation, shared with the patient
 * chart's current-care views. `nextAction` is this worklist's source of
 * truth for the row's primary action button; don't re-derive it
 * client-side (a first pass here duplicated this logic and drifted from
 * a real server-side gate — formulary policy review blocking preparation
 * — that this field already accounts for).
 */
export type PharmacyOrderNextAction = {
    key:
        | 'verify_dispense'
        | 'resolve_reconciliation'
        | 'review_reconciliation'
        | 'review_policy'
        | 'start_preparation'
        | 'record_dispense'
        | 'complete_dispense'
        | 'open_order';
    label: string;
    emphasis: 'primary' | 'warning' | 'secondary';
};

export type PharmacyOrderCurrentCare = {
    isCurrent: boolean;
    requiresReview: boolean;
    priorityRank: number;
    isActiveWorkflow?: boolean;
    awaitingVerification?: boolean;
    awaitingReconciliation?: boolean;
    hasPolicyIssue?: boolean;
    wasRecentlyDispensed?: boolean;
    workflowHint: string | null;
    nextAction: PharmacyOrderNextAction | null;
};

export type PharmacyOrder = {
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
    approvedMedicineCatalogItemId: string | null;
    medicationCode: string | null;
    medicationName: string | null;
    dosageInstruction: string | null;
    doseQuantity: number | null;
    doseUnit: string | null;
    route: string | null;
    frequency: string | null;
    durationValue: number | null;
    durationUnit: string | null;
    clinicalIndication: string | null;
    quantityPrescribed: number | null;
    prescribedUnit: string | null;
    quantityDispensed: number | null;
    dispensedUnit: string | null;
    dispensingNotes: string | null;
    dispensedAt: string | null;
    verifiedAt: string | null;
    verifiedByUserId: number | null;
    verificationNote: string | null;
    formularyDecisionStatus: 'not_reviewed' | 'formulary' | 'non_formulary' | 'restricted' | null;
    formularyDecisionReason: string | null;
    formularyReviewedAt: string | null;
    formularyReviewedByUserId: number | null;
    substitutionAllowed: boolean | null;
    substitutionMade: boolean | null;
    substitutedMedicationCode: string | null;
    substitutedMedicationName: string | null;
    substitutionReason: string | null;
    substitutionApprovedAt: string | null;
    substitutionApprovedByUserId: number | null;
    reconciliationStatus: 'pending' | 'completed' | 'exception' | null;
    reconciliationDecision:
        | 'add_to_current_list'
        | 'continue_on_current_list'
        | 'short_course_only'
        | 'stop_from_current_list'
        | 'review_later'
        | null;
    reconciliationNote: string | null;
    reconciledAt: string | null;
    reconciledByUserId: number | null;
    status: PharmacyOrderStatus;
    entryState: 'draft' | 'active' | null;
    signedAt: string | null;
    signedByUserId: number | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    currentCare: PharmacyOrderCurrentCare;
    createdAt: string | null;
    updatedAt: string | null;
    patient: PharmacyOrderPatientSummary | null;
    orderedBy: PharmacyOrderClinicianSummary | null;
};

type PharmacyOrderListResponse = {
    data: PharmacyOrder[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

function filterQuery(filters: PharmacyOrderFilters) {
    return {
        q: filters.q.trim() || null,
        patientId: filters.patientId || null,
        status: filters.status || null,
        worklistScope: filters.worklistScope || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function usePharmacyOrders(filters: PharmacyOrderFilters): UseQueryReturnType<PharmacyOrderListResponse, Error> {
    return useQuery({
        queryKey: ['pharmacy-orders-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<PharmacyOrderListResponse>('/pharmacy-orders', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
        refetchInterval: 30_000,
    });
}
