import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, type MaybeRefOrGetter, toValue } from 'vue';
import { API_V1_PREFIX, apiGet } from '@/lib/apiClient';
import { type AuditActorSummary, type AuditLogQueryResult } from '@/lib/audit';

export type PharmacyOrderAuditLog = {
    id: string;
    pharmacyOrderId: string | null;
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
    data: PharmacyOrderAuditLog[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * Mirrors useWardBedAuditLog.ts/useAdmissionAuditLog.ts exactly, hitting
 * GET /pharmacy-orders/{id}/audit-logs + .../audit-logs/export, so the
 * shared AuditLogSheet.vue serves this domain via the AuditLogQueryResult
 * contract. Permission: pharmacy-orders.view-audit-logs (hyphenated —
 * confirmed as the key actually enforced by the route middleware).
 */
export function usePharmacyOrderAuditLog(
    orderId: MaybeRefOrGetter<string | null | undefined>,
): AuditLogQueryResult<PharmacyOrderAuditLog> {
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
            'pharmacy-order-audit-logs',
            computed(() => toValue(orderId)),
            computed(() => ({ ...filters })),
        ],
        queryFn: async () => {
            const id = toValue(orderId);
            return apiGet<AuditLogListEnvelope>(`/pharmacy-orders/${id}/audit-logs`, {
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
        enabled: computed(() => Boolean(toValue(orderId))),
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
        const id = toValue(orderId);
        if (!id) return;

        const url = new URL(`${API_V1_PREFIX}/pharmacy-orders/${id}/audit-logs/export`, window.location.origin);
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
