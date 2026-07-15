import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { MedicalRecordResponse } from '@/types/medicalRecord';

type HandoffPayload = {
    targetUserId: number;
    note?: string;
};

export function useMedicalRecordHandoff() {
    const queryClient = useQueryClient();

    const initiateHandoff = useMutation({
        mutationFn: ({
            medicalRecordId,
            ...body
        }: HandoffPayload & { medicalRecordId: string }) =>
            apiPost<{ data: MedicalRecordResponse }>(
                `/medical-records/${medicalRecordId}/handoff`,
                { body },
            ).then((r) => r.data),
        onSuccess: () => {
            notifySuccess('Handoff initiated. The receiving clinician will be notified.');
        },
        onError: (error) => {
            notifyError(messageFromUnknown(error, 'Unable to initiate handoff.'));
        },
    });

    const respondToHandoff = useMutation({
        mutationFn: ({
            medicalRecordId,
            action,
        }: {
            medicalRecordId: string;
            action: 'accept' | 'decline';
        }) =>
            apiPost<{ data: MedicalRecordResponse }>(
                `/medical-records/${medicalRecordId}/handoff/accept`,
                { body: { action } },
            ).then((r) => r.data),
        onSuccess: (data, variables) => {
            const msg =
                variables.action === 'accept'
                    ? 'Handoff accepted. You are now the note owner.'
                    : 'Handoff declined.';
            notifySuccess(msg);
            void queryClient.invalidateQueries({ queryKey: ['medical-records', data.id] });
        },
        onError: (error) => {
            notifyError(messageFromUnknown(error, 'Unable to respond to handoff.'));
        },
    });

    const cancelHandoff = useMutation({
        mutationFn: (medicalRecordId: string) =>
            apiPost<{ data: MedicalRecordResponse }>(
                `/medical-records/${medicalRecordId}/handoff/cancel`,
            ).then((r) => r.data),
        onSuccess: () => {
            notifySuccess('Handoff cancelled.');
        },
        onError: (error) => {
            notifyError(messageFromUnknown(error, 'Unable to cancel handoff.'));
        },
    });

    return { initiateHandoff, respondToHandoff, cancelHandoff };
}
