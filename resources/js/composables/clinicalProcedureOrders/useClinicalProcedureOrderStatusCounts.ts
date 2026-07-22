import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { ClinicalProcedureOrderFilters } from './useClinicalProcedureOrderFilters';

export type ClinicalProcedureOrderStatusCounts = {
    ordered: number;
    scheduled: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};

type ClinicalProcedureOrderStatusCountsResponse = { data: ClinicalProcedureOrderStatusCounts };

export function useClinicalProcedureOrderStatusCounts(
    filters: ClinicalProcedureOrderFilters,
): UseQueryReturnType<ClinicalProcedureOrderStatusCounts, Error> {
    return useQuery({
        queryKey: [
            'clinical-procedure-orders-status-counts',
            computed(() => ({
                q: filters.q,
                patientId: filters.patientId,
                from: filters.from,
                to: filters.to,
            })),
        ],
        queryFn: async () => {
            const response = await apiGet<ClinicalProcedureOrderStatusCountsResponse>('/clinical-procedure-orders/status-counts', {
                q: filters.q.trim() || null,
                patientId: filters.patientId || null,
                from: filters.from || null,
                to: filters.to || null,
            });
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
