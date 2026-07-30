import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type AnalyticsReportFilters = {
    from: string;
    to: string;
    q: string;
    granularity?: 'daily' | 'weekly' | 'monthly';
    days?: number;
};

export type PrescriptionTrendItem = {
    period: string;
    orderCount: number;
    dispensedCount: number;
    totalPrescribed: number;
};

export type ConsumptionTrendItem = {
    period: string;
    totalConsumed: number;
    movementCount: number;
};

export type DashboardKpis = {
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringIn30Days: number;
    dispensedToday: number;
    controlledDrugDispensesToday: number;
    pendingInsuranceClaims: number;
};

type ListResponse<T> = {
    data: T[];
};

type KpiResponse = {
    data: DashboardKpis;
};

export function usePrescriptionTrends(filters: MaybeRefOrGetter<AnalyticsReportFilters>): UseQueryReturnType<ListResponse<PrescriptionTrendItem>, Error> {
    const filtersKey = computed(() => JSON.stringify(toValue(filters)));
    return useQuery({
        queryKey: ['pharmacy-reports', 'analytics', 'prescription-trends', filtersKey],
        queryFn: () => {
            const f = toValue(filters);
            return apiGet<ListResponse<PrescriptionTrendItem>>('/pharmacy-reports/analytics/prescription-trends', {
                granularity: f.granularity || 'daily',
                days: f.days ? String(f.days) : '90',
            });
        },
    });
}

export function useMedicineConsumption(filters: MaybeRefOrGetter<AnalyticsReportFilters>): UseQueryReturnType<ListResponse<ConsumptionTrendItem>, Error> {
    const filtersKey = computed(() => JSON.stringify(toValue(filters)));
    return useQuery({
        queryKey: ['pharmacy-reports', 'analytics', 'medicine-consumption', filtersKey],
        queryFn: () => {
            const f = toValue(filters);
            return apiGet<ListResponse<ConsumptionTrendItem>>('/pharmacy-reports/analytics/medicine-consumption', {
                granularity: f.granularity || 'daily',
                days: f.days ? String(f.days) : '30',
            });
        },
    });
}

export function useDashboardKpis(): UseQueryReturnType<KpiResponse, Error> {
    return useQuery({
        queryKey: ['pharmacy-reports', 'dashboard-kpis'],
        queryFn: () => apiGet<KpiResponse>('/pharmacy-reports/dashboard-kpis'),
        refetchInterval: 60_000,
    });
}
