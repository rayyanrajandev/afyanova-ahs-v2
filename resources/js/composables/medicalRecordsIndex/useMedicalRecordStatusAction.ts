import { ref } from 'vue';
import { apiPatch } from '@/lib/apiClient';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { MedicalRecordListItem } from './useMedicalRecordList';

export type MedicalRecordStatusAction = 'finalized' | 'amended' | 'archived';

/**
 * Finalize/amend/archive from the registry — same PATCH /medical-records/{id}/status
 * endpoint and transition rules already proven by both the old Index.vue and
 * WorkspaceV2's note composer (UpdateMedicalRecordStatusUseCase.php: finalize
 * only from draft, amend only from finalized — reopens the note as a draft
 * for correction rather than a distinct terminal state, archive from any
 * non-archived status). Reason is required for amend/archive, optional for
 * finalize, matching the old page exactly.
 */
export function useMedicalRecordStatusAction(options: {
    canFinalize: () => boolean;
    canAmend: () => boolean;
    canArchive: () => boolean;
    onChanged: (updated: MedicalRecordListItem) => void;
}) {
    const dialogOpen = ref(false);
    const targetRecord = ref<MedicalRecordListItem | null>(null);
    const action = ref<MedicalRecordStatusAction | null>(null);
    const reason = ref('');
    const error = ref<string | null>(null);
    const submitting = ref(false);

    function canApply(candidateAction: MedicalRecordStatusAction, record: MedicalRecordListItem | null): boolean {
        if (!record) return false;
        const status = (record.status ?? '').toLowerCase();

        switch (candidateAction) {
            case 'finalized':
                return options.canFinalize() && status === 'draft';
            case 'amended':
                return options.canAmend() && status === 'finalized';
            case 'archived':
                return options.canArchive() && status !== 'archived';
        }
    }

    function needsReason(candidateAction: MedicalRecordStatusAction | null): boolean {
        return candidateAction === 'amended' || candidateAction === 'archived';
    }

    function openDialog(record: MedicalRecordListItem, candidateAction: MedicalRecordStatusAction): void {
        if (!canApply(candidateAction, record)) {
            notifyError('This lifecycle action is not available for this user.');
            return;
        }

        targetRecord.value = record;
        action.value = candidateAction;
        error.value = null;
        reason.value = needsReason(candidateAction) ? (record.statusReason ?? '') : '';
        dialogOpen.value = true;
    }

    function closeDialog(): void {
        dialogOpen.value = false;
        error.value = null;
        reason.value = '';
    }

    async function submitDialog(): Promise<void> {
        if (!targetRecord.value || !action.value || submitting.value) return;

        const currentAction = action.value;
        let trimmedReason: string | null = null;
        if (needsReason(currentAction)) {
            trimmedReason = reason.value.trim();
            if (!trimmedReason) {
                error.value = currentAction === 'amended' ? 'Amendment reason is required.' : 'Archive reason is required.';
                return;
            }
        }

        submitting.value = true;
        error.value = null;

        try {
            const response = await apiPatch<{ data: MedicalRecordListItem }>(
                `/medical-records/${targetRecord.value.id}/status`,
                { body: { status: currentAction, reason: trimmedReason } },
            );
            notifySuccess(`Updated ${response.data.recordNumber ?? 'medical record'} to ${currentAction}.`);
            const wasFinalize = currentAction === 'finalized';
            closeDialog();
            options.onChanged(response.data);
            if (wasFinalize) {
                targetRecord.value = response.data;
            }
        } catch (err) {
            error.value = messageFromUnknown(err, 'Unable to update this medical record.');
            notifyError(error.value);
        } finally {
            submitting.value = false;
        }
    }

    return {
        dialogOpen,
        targetRecord,
        action,
        reason,
        error,
        submitting,
        canApply,
        needsReason,
        openDialog,
        closeDialog,
        submitDialog,
    };
}
