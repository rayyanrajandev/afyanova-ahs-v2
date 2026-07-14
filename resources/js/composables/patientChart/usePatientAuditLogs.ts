import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { API_V1_PREFIX, apiGet } from '@/lib/apiClient';

/** Backs ShowV2.vue's Audit tab — GET /patients/{id}/audit-logs, gated by patients.view-audit-logs. */
export type PatientChartAuditLog = {
    id: string;
    patientId: string | null;
    actorId: number | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, unknown>;
    metadata: Record<string, unknown>;
    createdAt: string | null;
};

type PatientAuditLogListResponse = {
    data: PatientChartAuditLog[];
    meta: { currentPage: number; lastPage: number; total: number };
};

export function usePatientAuditLogs(
    patientId: Ref<string>,
    page: Ref<number>,
    enabled: Ref<boolean>,
): UseQueryReturnType<PatientAuditLogListResponse, Error> {
    return useQuery({
        queryKey: ['patient-chart-audit-logs', patientId, page],
        queryFn: () =>
            apiGet<PatientAuditLogListResponse>(`/patients/${patientId.value}/audit-logs`, {
                page: page.value,
                perPage: 20,
            }),
        enabled: computed(() => patientId.value.trim() !== '' && enabled.value),
    });
}

/**
 * Opens GET /patients/{id}/audit-logs/export in a new tab, the same
 * window.open-based download the legacy patients/Index.vue's
 * exportDetailsAuditLogsCsv used (Phase 6 feature-parity checklist,
 * reports/patients-index-modernization-plan.md §2.1) — matching
 * useMedicalRecordAuditLog.ts's exportCsv() convention. No filter params:
 * ShowV2.vue's Audit tab is deliberately simpler than the legacy filter
 * sheet (paginated only), so this exports everything, not a filtered view.
 */
export function exportPatientAuditLogsCsv(patientId: string): void {
    if (!patientId) return;
    const url = new URL(`${API_V1_PREFIX}/patients/${patientId}/audit-logs/export`, window.location.origin);
    window.open(url.toString(), '_blank', 'noopener');
}
