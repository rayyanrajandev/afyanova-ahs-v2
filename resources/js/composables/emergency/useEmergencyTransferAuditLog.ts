import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, type MaybeRefOrGetter, toValue } from 'vue';
import { API_V1_PREFIX, apiGet } from '@/lib/apiClient';
import { type AuditActorSummary, type AuditLogQueryResult } from '@/lib/audit';

export type EmergencyTransferAuditLog = {
    id: string;
    emergencyTriageCaseTransferId: string | null;
    emergencyTriageCaseId: string | null;
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
    data: EmergencyTransferAuditLog[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * P0c — transfer-level counterpart to useEmergencyCaseAuditLog.ts, same
 * shape, hitting GET /emergency-triage-cases/{id}/transfers/{transferId}/
 * audit-logs + .../audit-logs/export.
 */
export function useEmergencyTransferAuditLog(
    caseId: MaybeRefOrGetter<string | null | undefined>,
    transferId: MaybeRefOrGetter<string | null | undefined>,
): AuditLogQueryResult<EmergencyTransferAuditLog> {
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
            'emergency-transfer-audit-logs',
            computed(() => toValue(caseId)),
            computed(() => toValue(transferId)),
            computed(() => ({ ...filters })),
        ],
        queryFn: async () => {
            const id = toValue(caseId);
            const tid = toValue(transferId);
            return apiGet<AuditLogListEnvelope>(`/emergency-triage-cases/${id}/transfers/${tid}/audit-logs`, {
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
        enabled: computed(() => Boolean(toValue(caseId)) && Boolean(toValue(transferId))),
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
        const id = toValue(caseId);
        const tid = toValue(transferId);
        if (!id || !tid) return;

        const url = new URL(`${API_V1_PREFIX}/emergency-triage-cases/${id}/transfers/${tid}/audit-logs/export`, window.location.origin);
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
