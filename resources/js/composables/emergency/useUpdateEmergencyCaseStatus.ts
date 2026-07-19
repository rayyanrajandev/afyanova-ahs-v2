import {
    useMutation,
    useQueryClient,
    type UseMutationReturnType,
} from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { EmergencyCase } from './useEmergencyCases';

/**
 * PATCH /emergency-triage-cases/{id}/status
 * (UpdateEmergencyTriageCaseStatusUseCase), gated
 * `emergency.triage.update-status`. `reason` required server-side for
 * `cancelled`, `dispositionNotes` required for `admitted`/`discharged`
 * (UpdateEmergencyTriageCaseStatusRequest.php) — enforced client-side too
 * by EmergencyStatusDialog.vue. The backend enforces no transition graph
 * at all (any status can PATCH to any status) — the allowed-transitions
 * matrix lives entirely in the UI, extracted from the legacy page's
 * queue-row button gating (emergency-triage/Index.vue:3400-3405), not
 * invented here.
 */
export type EmergencyCaseStatusTarget =
    | 'triaged'
    | 'in_treatment'
    | 'admitted'
    | 'discharged'
    | 'cancelled';

export type UpdateEmergencyCaseStatusPayload = {
    caseId: string;
    status: EmergencyCaseStatusTarget;
    reason?: string | null;
    dispositionNotes?: string | null;
    bedResourceId?: string | null;
};

type UpdateEmergencyCaseStatusResponse = { data: EmergencyCase };

type EmergencyCaseListCache = {
    data: EmergencyCase[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type UpdateEmergencyCaseStatusContext = {
    previousQueries: Array<
        [readonly unknown[], EmergencyCaseListCache | undefined]
    >;
};

export function useUpdateEmergencyCaseStatus(): UseMutationReturnType<
    EmergencyCase,
    Error,
    UpdateEmergencyCaseStatusPayload,
    UpdateEmergencyCaseStatusContext
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            caseId,
            status,
            reason,
            dispositionNotes,
            bedResourceId,
        }): Promise<EmergencyCase> => {
            const response = await apiPatch<UpdateEmergencyCaseStatusResponse>(
                `/emergency-triage-cases/${caseId}/status`,
                {
                    body: {
                        status,
                        reason: reason ?? null,
                        dispositionNotes: dispositionNotes ?? null,
                        bedResourceId: bedResourceId ?? null,
                    },
                },
            );
            return response.data;
        },
        // Optimistic: patch the case's status in every cached emergency-cases
        // list immediately (Queue.vue's Tabs filter by exact status), and drop
        // it from any list whose filter no longer matches the new status —
        // e.g. marking triage complete removes the row from a "waiting" tab
        // view right away instead of waiting for the round trip + the
        // follow-up invalidateQueries refetch (which still runs afterward and
        // also reconciles secondary state this doesn't touch, like bed counts).
        onMutate: async ({ caseId, status, reason, dispositionNotes }) => {
            await queryClient.cancelQueries({ queryKey: ['emergency-cases'] });
            const queries = queryClient.getQueriesData<EmergencyCaseListCache>({
                queryKey: ['emergency-cases'],
            });
            const previousQueries = queries.map(
                ([queryKey, data]) => [queryKey, data] as const,
            );
            const nowIso = new Date().toISOString();

            for (const [queryKey, data] of queries) {
                if (!data) continue;
                const filterStatus =
                    (queryKey[1] as { status?: string | null } | undefined)
                        ?.status || null;

                const patched = data.data.map((item) => {
                    if (item.id !== caseId) return item;
                    return {
                        ...item,
                        status,
                        statusReason:
                            status === 'cancelled'
                                ? (reason ?? item.statusReason)
                                : item.statusReason,
                        dispositionNotes:
                            dispositionNotes ?? item.dispositionNotes,
                        triagedAt:
                            status === 'triaged' ? nowIso : item.triagedAt,
                        completedAt:
                            status === 'discharged' || status === 'cancelled'
                                ? nowIso
                                : item.completedAt,
                    };
                });

                const visible = filterStatus
                    ? patched.filter(
                          (item) =>
                              item.id !== caseId ||
                              item.status === filterStatus,
                      )
                    : patched;
                if (visible.length === data.data.length) {
                    queryClient.setQueryData(queryKey, {
                        ...data,
                        data: visible,
                    });
                    continue;
                }

                queryClient.setQueryData(queryKey, {
                    ...data,
                    data: visible,
                    meta: {
                        ...data.meta,
                        total: Math.max(0, data.meta.total - 1),
                    },
                });
            }

            return { previousQueries };
        },
        onError: (_error, _variables, context) => {
            context?.previousQueries?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });
        },
    });
}
