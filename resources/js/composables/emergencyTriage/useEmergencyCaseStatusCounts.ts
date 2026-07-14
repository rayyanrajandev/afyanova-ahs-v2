import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

export type EmergencyCaseStatusCounts = {
    waiting: number;
    triaged: number;
    in_treatment: number;
    admitted: number;
    discharged: number;
    cancelled: number;
    other: number;
    total: number;
};

type EmergencyCaseStatusCountsResponse = { data: EmergencyCaseStatusCounts };

export function useEmergencyCaseStatusCounts(): UseQueryReturnType<EmergencyCaseStatusCounts, Error> {
    return useQuery({
        queryKey: ['sidebar-emergency-case-status-counts'],
        queryFn: async () => {
            const response = await apiGet<EmergencyCaseStatusCountsResponse>('/emergency-triage-cases/status-counts');
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
