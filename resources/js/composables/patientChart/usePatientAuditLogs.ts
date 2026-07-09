import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

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
