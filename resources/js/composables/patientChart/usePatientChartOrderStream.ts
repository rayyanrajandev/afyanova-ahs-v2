import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type PatientChartListResponse<TItem> = {
    data: TItem[];
    meta?: { total?: number };
};

type CountsResponse<TCounts> = { data: TCounts };

export type PatientChartOrderStreamOptions = {
    patientId: Ref<string>;
    /** Gate the query behind a permission check, mirroring the old page's per-domain read guards. */
    enabled: Ref<boolean>;
    perPage?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
};

export type PatientChartOrderStream<TItem, TCounts> = {
    items: UseQueryReturnType<PatientChartListResponse<TItem>, Error>;
    counts: UseQueryReturnType<TCounts, Error>;
};

/**
 * One list + one status-counts query, parameterized by endpoint. Backs
 * laboratory/pharmacy/radiology/theatre/billing — all patientId-scoped,
 * list + status-counts pairs (see reports/patient-chart-rebuild-plan.md §2).
 */
export function usePatientChartOrderStream<TItem, TCounts>(
    endpoint: string,
    options: PatientChartOrderStreamOptions,
): PatientChartOrderStream<TItem, TCounts> {
    const queryEnabled = computed(
        () => options.enabled.value && options.patientId.value.trim() !== '',
    );

    const items = useQuery({
        queryKey: ['patient-chart-order-stream', endpoint, 'list', options.patientId],
        queryFn: () =>
            apiGet<PatientChartListResponse<TItem>>(endpoint, {
                patientId: options.patientId.value,
                sortBy: options.sortBy ?? 'orderedAt',
                sortDir: options.sortDir ?? 'desc',
                perPage: options.perPage ?? 25,
            }),
        enabled: queryEnabled,
    });

    const counts = useQuery({
        queryKey: ['patient-chart-order-stream', endpoint, 'status-counts', options.patientId],
        queryFn: async () => {
            const response = await apiGet<CountsResponse<TCounts>>(
                `${endpoint}/status-counts`,
                { patientId: options.patientId.value },
            );
            return response.data;
        },
        enabled: queryEnabled,
    });

    return { items, counts };
}
