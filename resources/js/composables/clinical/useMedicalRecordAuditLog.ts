import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, type MaybeRefOrGetter, toValue } from 'vue';
import { API_V1_PREFIX, apiGet } from '@/lib/apiClient';
import { type AuditActorSummary } from '@/lib/audit';

export type MedicalRecordAuditLog = {
    id: string;
    medicalRecordId: string | null;
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
    data: MedicalRecordAuditLog[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * Audit log listing with filters (reports/clinical-notes-frontend-rebuild-plan.md
 * §3/§4). Same endpoint as the current Workspace.vue
 * (GET /medical-records/{id}/audit-logs). Gated by the
 * medical-records.view-audit-logs permission — caller's job, same as the
 * attestation eligibility split in useMedicalRecordAttestations. Includes
 * CSV export (exportCsv), matching the old page's window.open-based download.
 */
export function useMedicalRecordAuditLog(recordId: MaybeRefOrGetter<string | null | undefined>) {
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
            'medical-record-audit-logs',
            computed(() => toValue(recordId)),
            computed(() => ({ ...filters })),
        ],
        queryFn: async () => {
            const id = toValue(recordId);
            const response = await apiGet<AuditLogListEnvelope>(`/medical-records/${id}/audit-logs`, {
                q: filters.q.trim() || null,
                action: filters.action.trim() || null,
                actorType: filters.actorType || null,
                actorId: filters.actorId.trim() || null,
                from: filters.from || null,
                to: filters.to || null,
                page: filters.page,
                perPage: filters.perPage,
            });
            return response;
        },
        enabled: computed(() => Boolean(toValue(recordId))),
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

    /**
     * Opens the CSV export in a new tab, same as the current Workspace.vue's
     * exportDetailsAuditLogsCsv — a plain authenticated GET the browser
     * streams as a file download, not a fetch/blob round-trip.
     */
    function exportCsv(): void {
        const id = toValue(recordId);
        if (!id) return;

        const url = new URL(`${API_V1_PREFIX}/medical-records/${id}/audit-logs/export`, window.location.origin);
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
