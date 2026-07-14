import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { TheatreProcedureFilters } from './useTheatreProcedureFilters';

/**
 * Matches TheatreProcedureResponseTransformer::transform() exactly
 * (app/Modules/TheatreProcedure/Presentation/Http/Transformers/TheatreProcedureResponseTransformer.php).
 * Unlike lab/pharmacy/radiology, there is NO nested `patient` object and NO
 * `orderedBy` clinician summary — patient info arrives pre-flattened as
 * `patientLabel`/`patientNumber`, and the two surgical-role user ids
 * (`operatingClinicianUserId`/`anesthetistUserId`) have no attached name at
 * all (resolve those via useTheatreClinicianDirectory.ts).
 */
export type TheatreProcedureStatus = 'planned' | 'in_preop' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Matches ClinicalCurrentCare::theatre() exactly
 * (app/Support/ClinicalOrders/ClinicalCurrentCare.php). Unlike lab/radiology,
 * there is a single nextAction key for everything — the label alone
 * distinguishes "Move to Pre-op"/"Start procedure"/"Complete procedure"/
 * "Review completed case", so the row handler must derive the actual
 * dialog intent from order.status, same pattern as lab/radiology's
 * single-key 'review_order'.
 */
export type TheatreProcedureNextAction = {
    key: 'review_case';
    label: string;
    emphasis: 'primary' | 'warning' | 'secondary';
};

export type TheatreProcedureCurrentCare = {
    isCurrent: boolean;
    requiresReview: boolean;
    priorityRank: number;
    isInProgress?: boolean;
    isUpcoming?: boolean;
    wasRecentlyCompleted?: boolean;
    workflowHint: string | null;
    nextAction: TheatreProcedureNextAction | null;
};

export type TheatreProcedure = {
    id: string;
    procedureNumber: string | null;
    patientId: string | null;
    patientNumber: string | null;
    patientLabel: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    encounterId: string | null;
    orderSessionId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    theatreProcedureCatalogItemId: string | null;
    procedureType: string | null;
    procedureName: string | null;
    operatingClinicianUserId: number | null;
    anesthetistUserId: number | null;
    theatreRoomServicePointId: string | null;
    theatreRoomName: string | null;
    theatreRoomCode: string | null;
    theatreRoomServicePointType: string | null;
    theatreRoomLocation: string | null;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    status: TheatreProcedureStatus;
    entryState: 'draft' | 'active' | null;
    signedAt: string | null;
    signedByUserId: number | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    currentCare: TheatreProcedureCurrentCare;
    stockPrecheck: unknown | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type TheatreProcedureListResponse = {
    data: TheatreProcedure[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

function filterQuery(filters: TheatreProcedureFilters) {
    return {
        q: filters.q.trim() || null,
        patientId: filters.patientId || null,
        status: filters.status || null,
        worklistScope: filters.worklistScope || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function useTheatreProcedures(filters: TheatreProcedureFilters): UseQueryReturnType<TheatreProcedureListResponse, Error> {
    return useQuery({
        queryKey: ['theatre-procedures-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<TheatreProcedureListResponse>('/theatre-procedures', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
        refetchInterval: 30_000,
    });
}
