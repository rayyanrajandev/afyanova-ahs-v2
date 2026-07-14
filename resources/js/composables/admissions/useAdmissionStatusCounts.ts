import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { AdmissionFilters } from './useAdmissionFilters';

/**
 * Matches EloquentAdmissionRepository::statusCounts()'s return shape exactly:
 * admitted/discharged/transferred/cancelled/other/total, plus
 * dischargedInRange — a second, independent count (discharged_at-scoped,
 * not admitted_at-scoped) since a patient discharged today may have been
 * admitted days ago and wouldn't otherwise show up in a same-filter count.
 */
export type AdmissionStatusCounts = {
    admitted: number;
    discharged: number;
    transferred: number;
    cancelled: number;
    other: number;
    total: number;
    dischargedInRange?: number;
};

type AdmissionStatusCountsResponse = { data: AdmissionStatusCounts };

function todayDateTimeRange(): { from: string; to: string } {
    const now = new Date();
    const pad = (segment: number) => String(segment).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return { from: `${date}T00:00:00`, to: `${date}T23:59:59` };
}

export function useAdmissionStatusCounts(filters: AdmissionFilters): UseQueryReturnType<AdmissionStatusCounts, Error> {
    return useQuery({
        queryKey: ['admissions-index-status-counts', computed(() => ({ q: filters.q, ward: filters.ward, from: filters.from, to: filters.to }))],
        queryFn: async () => {
            const { from, to } = todayDateTimeRange();
            const response = await apiGet<AdmissionStatusCountsResponse>('/admissions/status-counts', {
                q: filters.q.trim() || null,
                ward: filters.ward.trim() || null,
                from: filters.from || null,
                to: filters.to || null,
                dischargedFrom: from,
                dischargedTo: to,
            });
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
