import { reactive, ref, type Ref } from 'vue';
import { apiPatch, apiPost, isApiClientError } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { PatientChartAllergy } from '@/composables/patientChart/usePatientAllergies';

export type PatientAllergyForm = {
    substanceCode: string;
    substanceName: string;
    reaction: string;
    severity: string;
    status: string;
    notedAt: string;
    lastReactionAt: string;
    notes: string;
};

function validationErrorsFromError(error: unknown): Record<string, string[]> {
    if (isApiClientError(error) && error.payload && typeof error.payload === 'object' && 'errors' in error.payload) {
        return (error.payload as { errors?: Record<string, string[]> }).errors ?? {};
    }
    return {};
}

function emptyForm(): PatientAllergyForm {
    return {
        substanceCode: '',
        substanceName: '',
        reaction: '',
        severity: 'unknown',
        status: 'active',
        notedAt: '',
        lastReactionAt: '',
        notes: '',
    };
}

/** Create/edit dialog for a single patient allergy entry, mirrors the old Show.vue's allergy workspace 1:1. */
export function usePatientAllergyDialog(patientId: Ref<string>, onSaved: () => void) {
    const open = ref(false);
    const submitting = ref(false);
    const error = ref<string | null>(null);
    const formErrors = ref<Record<string, string[]>>({});
    const editingId = ref('');
    const form = reactive<PatientAllergyForm>(emptyForm());

    function reset(): void {
        editingId.value = '';
        error.value = null;
        formErrors.value = {};
        Object.assign(form, emptyForm());
    }

    function openDialog(allergy?: PatientChartAllergy | null): void {
        reset();
        if (allergy) {
            editingId.value = allergy.id;
            form.substanceCode = allergy.substanceCode ?? '';
            form.substanceName = allergy.substanceName ?? '';
            form.reaction = allergy.reaction ?? '';
            form.severity = allergy.severity ?? 'unknown';
            form.status = allergy.status ?? 'active';
            form.notedAt = allergy.notedAt ? String(allergy.notedAt).slice(0, 10) : '';
            form.lastReactionAt = allergy.lastReactionAt ?? '';
            form.notes = allergy.notes ?? '';
        }
        open.value = true;
    }

    function closeDialog(): void {
        open.value = false;
        reset();
    }

    async function submitDialog(): Promise<void> {
        submitting.value = true;
        error.value = null;
        formErrors.value = {};

        const payload = {
            substanceCode: form.substanceCode.trim() || null,
            substanceName: form.substanceName.trim(),
            reaction: form.reaction.trim() || null,
            severity: form.severity,
            status: form.status,
            notedAt: form.notedAt || null,
            lastReactionAt: form.lastReactionAt || null,
            notes: form.notes.trim() || null,
        };

        try {
            if (editingId.value) {
                await apiPatch(`/patients/${patientId.value}/allergies/${editingId.value}`, { body: payload });
                notifySuccess('Patient allergy updated.');
            } else {
                await apiPost(`/patients/${patientId.value}/allergies`, { body: payload });
                notifySuccess('Patient allergy recorded.');
            }
            closeDialog();
            onSaved();
        } catch (caught) {
            formErrors.value = validationErrorsFromError(caught);
            error.value = caught instanceof Error ? caught.message : 'Unable to save patient allergy.';
            notifyError(error.value);
        } finally {
            submitting.value = false;
        }
    }

    return { open, submitting, error, formErrors, editingId, form, openDialog, closeDialog, submitDialog };
}
