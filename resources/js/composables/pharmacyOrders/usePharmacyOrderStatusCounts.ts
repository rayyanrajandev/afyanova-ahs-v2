import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

export type PharmacyOrderStatusCounts = {
    pending: number;
    in_preparation: number;
    partially_dispensed: number;
    dispensed: number;
    cancelled: number;
    reconciliation_pending: number;
    reconciliation_completed: number;
    reconciliation_exception: number;
    other: number;
    total: number;
};

type PharmacyOrderStatusCountsResponse = { data: PharmacyOrderStatusCounts };

export function usePharmacyOrderStatusCounts(): UseQueryReturnType<PharmacyOrderStatusCounts, Error> {
    return useQuery({
        queryKey: ['sidebar-pharmacy-order-status-counts'],
        queryFn: async () => {
            const response = await apiGet<PharmacyOrderStatusCountsResponse>('/pharmacy-orders/status-counts');
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
