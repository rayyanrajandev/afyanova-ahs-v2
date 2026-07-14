import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, type MaybeRefOrGetter, toValue } from 'vue';
import { API_V1_PREFIX, apiGet } from '@/lib/apiClient';
import { type AuditActorSummary, type AuditLogQueryResult } from '@/lib/audit';

export type EmergencyCaseAuditLog = {
    id: string;
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
    data: EmergencyCaseAuditLog[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * P0c — mirrors useMedicalRecordAuditLog.ts exactly (same filters/query/
 * exportCsv shape), hitting GET /emergency-triage-cases/{id}/audit-logs +
 * .../audit-logs/export, so the same AuditLogPanel.vue serves this domain
 * via the shared AuditLogQueryResult contract.
 */
export function useEmergencyCaseAuditLog(caseId: MaybeRefOrGetter<string | null | undefined>): AuditLogQueryResult<EmergencyCaseAuditLog> {
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
            'emergency-case-audit-logs',
            computed(() => toValue(caseId)),
            computed(() => ({ ...filters })),
        ],
        queryFn: async () => {
            const id = toValue(caseId);
            return apiGet<AuditLogListEnvelope>(`/emergency-triage-cases/${id}/audit-logs`, {
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
        enabled: computed(() => Boolean(toValue(caseId))),
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
        if (!id) return;

        const url = new URL(`${API_V1_PREFIX}/emergency-triage-cases/${id}/audit-logs/export`, window.location.origin);
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
