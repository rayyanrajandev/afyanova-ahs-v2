import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, type MaybeRefOrGetter, toValue } from 'vue';
import { API_V1_PREFIX, apiGet } from '@/lib/apiClient';
import { type AuditActorSummary, type AuditLogQueryResult } from '@/lib/audit';

export type FacilityResourceAuditLog = {
    id: string;
    facilityResourceId: string | null;
    actorId: number | null;
    actorType: 'system' | 'user' | string | null;
    actor?: AuditActorSummary | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
};

type AuditLogListEnvelope = {
    data: FacilityResourceAuditLog[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * Generic counterpart to useWardBedAuditLog.ts — identical shape, just
 * parameterized by basePath so observation-rooms (and any future
 * facility_resources type) can reuse it instead of a dedicated file per type.
 */
export function useFacilityResourceAuditLog(
    basePath: string,
    resourceId: MaybeRefOrGetter<string | null | undefined>,
): AuditLogQueryResult<FacilityResourceAuditLog> {
    const filters = reactive({
        q: '',
        action: '',
        actorType: '',
        actorId: '',
        from: '',
        to: '',
        page: 1,
        perPage: 20,
    });

    const query = useQuery({
        queryKey: [
            `${basePath}-audit-logs`,
            computed(() => toValue(resourceId)),
            computed(() => ({ ...filters })),
        ],
        queryFn: async () => {
            const id = toValue(resourceId);
            return apiGet<AuditLogListEnvelope>(`/platform/admin/${basePath}/${id}/audit-logs`, {
                q: filters.q.trim() || null,
                action: filters.action.trim() || null,
                actorType: filters.actorType || null,
                actorId: filters.actorId.trim() || null,
                from: filters.from || null,
                to: filters.to || null,
                page: filters.page,
                perPage: filters.perPage,
            });
        },
        enabled: computed(() => Boolean(toValue(resourceId))),
    });

    function resetFilters(): void {
        filters.q = '';
        filters.action = '';
        filters.actorType = '';
        filters.actorId = '';
        filters.from = '';
        filters.to = '';
        filters.page = 1;
    }

    function goToPage(page: number): void {
        const last = query.data.value?.meta.lastPage ?? 1;
        filters.page = Math.max(1, Math.min(page, last));
    }

    function exportCsv(): void {
        const id = toValue(resourceId);
        if (!id) return;

        const url = new URL(`${API_V1_PREFIX}/platform/admin/${basePath}/${id}/audit-logs/export`, window.location.origin);
        const params: Record<string, string | number | null> = {
            q: filters.q.trim() || null,
            action: filters.action.trim() || null,
            actorType: filters.actorType || null,
            actorId: filters.actorId.trim() || null,
            from: filters.from || null,
            to: filters.to || null,
        };
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === '') return;
            url.searchParams.set(key, String(value));
        });
        window.open(url.toString(), '_blank', 'noopener');
    }

    return {
        filters,
        logs: computed(() => query.data.value?.data ?? []),
        meta: computed(() => query.data.value?.meta ?? null),
        isLoading: query.isPending,
        error: query.error,
        resetFilters,
        goToPage,
        exportCsv,
    };
}
