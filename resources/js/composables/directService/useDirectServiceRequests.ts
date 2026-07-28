import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { DirectServiceFilters } from './useDirectServiceFilters';
import type { ServiceRequestItem, ServiceRequestItemStatus } from '@/types/serviceRequestItem';

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
    items: Array<{
        id: string | null;
        catalogItemId: string | null;
        itemName: string | null;
        itemCode: string | null;
        quantity: number;
        status: ServiceRequestItemStatus;
        clinicalIndication: string | null;
        instructions: string | null;
        requestedByUserId: number | null;
        requestedAt: string | null;
        orderedAt: string | null;
        completedAt: string | null;
        failedAt: string | null;
        cancelledAt: string | null;
        failureReason: string | null;
    }>;
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
