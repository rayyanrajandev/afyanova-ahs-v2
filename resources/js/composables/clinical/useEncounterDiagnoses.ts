import { reactive, ref } from 'vue';
import { apiDelete, apiPost } from '@/lib/apiClient';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

export type EncounterDiagnosisForm = {
    diagnosisCode: string;
    diagnosisDescription: string;
    diagnosisType: 'primary' | 'secondary';
};

/**
 * Add/remove dialog + mutations for an encounter's structured diagnoses list
 * (see reports/patient-chart-rebuild-plan.md's follow-on Encounter entity
 * work — POST/DELETE encounters/{id}/diagnoses). Recording a new primary
 * diagnosis auto-demotes the previous one on the backend; the frontend just
 * reflects whatever the refetched workspace bundle returns.
 */
export function useEncounterDiagnoses(encounterId: () => string, onChanged: () => void) {
    const dialogOpen = ref(false);
    const submitting = ref(false);
    const error = ref<string | null>(null);
    const removingId = ref<string | null>(null);
    const form = reactive<EncounterDiagnosisForm>({
        diagnosisCode: '',
        diagnosisDescription: '',
        diagnosisType: 'secondary',
    });

    function openDialog(): void {
        form.diagnosisCode = '';
        form.diagnosisDescription = '';
        form.diagnosisType = 'secondary';
        error.value = null;
        dialogOpen.value = true;
    }

    function closeDialog(): void {
        dialogOpen.value = false;
    }

    async function submitDialog(): Promise<void> {
        if (submitting.value) return;
        submitting.value = true;
        error.value = null;

        try {
            await apiPost(`/encounters/${encounterId()}/diagnoses`, {
                body: {
                    diagnosisCode: form.diagnosisCode.trim(),
                    diagnosisDescription: form.diagnosisDescription.trim() || null,
                    diagnosisType: form.diagnosisType,
                },
            });
            notifySuccess('Diagnosis added.');
            closeDialog();
            onChanged();
        } catch (err) {
            error.value = messageFromUnknown(err, 'Unable to add diagnosis.');
            notifyError(error.value);
        } finally {
            submitting.value = false;
        }
    }

    async function removeDiagnosis(diagnosisId: string): Promise<void> {
        removingId.value = diagnosisId;

        try {
            await apiDelete(`/encounters/${encounterId()}/diagnoses/${diagnosisId}`);
            notifySuccess('Diagnosis removed.');
            onChanged();
        } catch (err) {
            notifyError(messageFromUnknown(err, 'Unable to remove diagnosis.'));
        } finally {
            removingId.value = null;
        }
    }

    return {
        dialogOpen,
        submitting,
        error,
        form,
        removingId,
        openDialog,
        closeDialog,
        submitDialog,
        removeDiagnosis,
    };
}
