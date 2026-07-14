import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { DirectServiceFilters } from './useDirectServiceFilters';

/**
 * Matches ServiceRequestResponseTransformer::transform() exactly
 * (app/Modules/ServiceRequest/Presentation/Http/Transformers/ServiceRequestResponseTransformer.php).
 */
export type DirectServiceDepartmentSummary = {
    id: string | null;
    name: string | null;
    code: string | null;
    serviceType: string | null;
    label: string;
};

export type DirectServiceRequest = {
    id: string;
    requestNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    departmentId: string | null;
    department: DirectServiceDepartmentSummary | null;
    departmentLabel: string | null;
    requestedByUserId: number | null;
    serviceType: 'laboratory' | 'pharmacy' | 'radiology' | 'theatre_procedure' | null;
    priority: 'routine' | 'urgent' | null;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | null;
    notes: string | null;
    requestedAt: string | null;
    acknowledgedAt: string | null;
    acknowledgedByUserId: number | null;
    completedAt: string | null;
    statusReason: string | null;
    linkedOrderType: string | null;
    linkedOrderId: string | null;
    linkedOrderNumber: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type DirectServiceRequestListResponse = {
    data: DirectServiceRequest[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number; departmentScopeMissing: boolean };
};

function filterQuery(filters: DirectServiceFilters) {
    return {
        status: filters.status || null,
        priority: filters.priority || null,
        departmentId: filters.departmentId || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

/**
 * GET /service-requests. departmentId scoping is enforced server-side
 * (ServiceRequestDepartmentScopeResolver) — a department-scoped actor
 * always sees only their own department regardless of what's sent here;
 * meta.departmentScopeMissing signals an actor with no department assigned
 * at all (empty data, not an error).
 */
export function useDirectServiceRequests(
    filters: DirectServiceFilters,
): UseQueryReturnType<DirectServiceRequestListResponse, Error> {
    return useQuery({
        queryKey: ['direct-service-requests', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<DirectServiceRequestListResponse>('/service-requests', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortDir: filters.sortDir,
            }),
        refetchInterval: 30_000,
    });
}
