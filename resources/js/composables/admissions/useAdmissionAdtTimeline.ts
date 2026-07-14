import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';
import { buildAdtTimeline, type AdtTimelineEvent } from '@/lib/admissionAdtTimeline';
import type { AdmissionAuditLog } from './useAdmissionAuditLog';
import type { Admission } from './useAdmissions';

type AuditLogListEnvelope = { data: AdmissionAuditLog[]; meta: { currentPage: number; perPage: number; total: number; lastPage: number } };

/**
 * AdmA of the Admission V2 full-parity plan — fetches up to 100 unfiltered
 * audit-log entries for one admission (mirroring the legacy page's own
 * loadDetailsAdtTimeline, Index.vue:2886+) and feeds them through the pure
 * buildAdtTimeline() function. Called only from inside a row's expanded
 * Collapsible content, so its own mount/unmount lifecycle already gates
 * the fetch — same lazy pattern as EmergencyCaseTransfersPanel.vue.
 */
export function useAdmissionAdtTimeline(admission: Ref<Admission> | ComputedRef<Admission>): {
    timeline: ComputedRef<AdtTimelineEvent[]>;
    isPending: UseQueryReturnType<AuditLogListEnvelope, Error>['isPending'];
    isError: UseQueryReturnType<AuditLogListEnvelope, Error>['isError'];
} {
    const query = useQuery({
        queryKey: ['admission-adt-timeline', computed(() => admission.value.id)],
        queryFn: () => apiGet<AuditLogListEnvelope>(`/admissions/${admission.value.id}/audit-logs`, { page: 1, perPage: 100 }),
    });

    const timeline = computed<AdtTimelineEvent[]>(() => buildAdtTimeline(admission.value, query.data.value?.data ?? []));

    return {
        timeline,
        isPending: query.isPending,
        isError: query.isError,
    };
}
