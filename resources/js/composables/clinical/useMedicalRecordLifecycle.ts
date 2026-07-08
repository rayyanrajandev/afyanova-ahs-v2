import { useMutation } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import { type MedicalRecordResponse } from '@/types/medicalRecord';

export type LifecycleAction = 'finalized' | 'amended' | 'archived';

type StatusEnvelope = { data: MedicalRecordResponse };

type LifecycleVariables = {
    recordId: string;
    status: LifecycleAction;
    reason?: string | null;
};

/**
 * Discrete, user-initiated status transitions (finalize / amend / archive)
 * against PATCH /medical-records/{id}/status. Unlike the autosave draft path,
 * these use TanStack useMutation — they're one-shot, user-triggered, and
 * benefit directly from its pending/error state.
 *
 * IMPORTANT — the request is the *requested* transition, not necessarily the
 * stored result. Per reports/clinical-note-audit/04-clinical-note-lifecycle.md
 * §4.1, the backend may store something different than requested:
 *   - requesting 'amended' actually reopens the note as 'draft'
 *   - requesting 'finalized' on an already-signed note stores 'amended'
 * The UI must read the returned record's actual `status`, never assume the
 * requested action equals the stored status.
 */
export function useMedicalRecordLifecycle() {
    const mutation = useMutation({
        mutationFn: async (variables: LifecycleVariables): Promise<MedicalRecordResponse> => {
            const response = await apiPatch<StatusEnvelope>(
                `/medical-records/${variables.recordId}/status`,
                {
                    body: {
                        status: variables.status,
                        reason: variables.reason ?? null,
                    },
                },
            );
            return response.data;
        },
    });

    function finalize(recordId: string): Promise<MedicalRecordResponse> {
        return mutation.mutateAsync({ recordId, status: 'finalized' });
    }

    // Reason is required by the backend for amend/archive (required_if rule).
    function amend(recordId: string, reason: string): Promise<MedicalRecordResponse> {
        return mutation.mutateAsync({ recordId, status: 'amended', reason });
    }

    function archive(recordId: string, reason: string): Promise<MedicalRecordResponse> {
        return mutation.mutateAsync({ recordId, status: 'archived', reason });
    }

    return {
        finalize,
        amend,
        archive,
        isPending: mutation.isPending,
        error: mutation.error,
        reset: mutation.reset,
    };
}
