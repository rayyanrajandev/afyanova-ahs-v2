import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { TheatreProcedure, TheatreProcedureStatus } from './useTheatreProcedures';

export type UpdateTheatreProcedureStatusPayload = {
    id: string;
    status: TheatreProcedureStatus;
    reason?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
};

type UpdateTheatreProcedureStatusResponse = { data: TheatreProcedure };

/**
 * PATCH /theatre-procedures/{id}/status (TheatreProcedureController::updateStatus,
 * matches UpdateTheatreProcedureStatusRequest's validation) — drives
 * planned -> in_preop -> in_progress -> completed (forward-only,
 * server-enforced), or -> cancelled (reason required). completedAt is
 * required when status is 'completed' (a datetime, unlike radiology's
 * free-text reportSummary — there is no report/note field on this
 * endpoint at all).
 */
export function useUpdateTheatreProcedureStatus(): UseMutationReturnType<
    TheatreProcedure,
    Error,
    UpdateTheatreProcedureStatusPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateTheatreProcedureStatusPayload): Promise<TheatreProcedure> => {
            const response = await apiPatch<UpdateTheatreProcedureStatusResponse>(`/theatre-procedures/${id}/status`, { body: payload });
            return response.data;
        },
    });
}
