import { reactive, ref, type Ref } from 'vue';
import { apiPatch, apiPost, isApiClientError } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { PatientChartMedicationProfile } from '@/composables/patientChart/usePatientMedicationProfile';
import type { PatientChartReconciliationPharmacyOrder } from '@/composables/patientChart/usePatientMedicationReconciliation';

export type PatientMedicationProfileForm = {
    medicationCode: string;
    medicationName: string;
    dose: string;
    route: string;
    frequency: string;
    source: string;
    status: string;
    startedAt: string;
    stoppedAt: string;
    indication: string;
    notes: string;
    lastReconciledAt: string;
    reconciliationNote: string;
};

function validationErrorsFromError(error: unknown): Record<string, string[]> {
    if (isApiClientError(error) && error.payload && typeof error.payload === 'object' && 'errors' in error.payload) {
        return (error.payload as { errors?: Record<string, string[]> }).errors ?? {};
    }
    return {};
}

function emptyForm(): PatientMedicationProfileForm {
    return {
        medicationCode: '',
        medicationName: '',
        dose: '',
        route: '',
        frequency: '',
        source: 'home_medication',
        status: 'active',
        startedAt: '',
        stoppedAt: '',
        indication: '',
        notes: '',
        lastReconciledAt: '',
        reconciliationNote: '',
    };
}

function todayDateValue(): string {
    return new Date().toISOString().slice(0, 10);
}

function normalizedText(value: string | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
}

function appendReconciliationNote(existing: string | null | undefined, addition: string): string {
    const baseline = String(existing ?? '').trim();
    if (baseline === '') return addition;
    return baseline.includes(addition) ? baseline : `${baseline}\n${addition}`;
}

function shortId(value: string | null | undefined): string {
    if (!value) return 'N/A';
    return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

/** Create/edit dialog for a current-medication-list entry, plus the "link from a dispensed order" prefill flow used by the reconciliation workspace. Mirrors the old Show.vue's medication profile workspace 1:1. */
export function usePatientMedicationProfileDialog(
    patientId: Ref<string>,
    medicationProfile: Ref<PatientChartMedicationProfile[]>,
    onSaved: () => void,
) {
    const open = ref(false);
    const submitting = ref(false);
    const error = ref<string | null>(null);
    const formErrors = ref<Record<string, string[]>>({});
    const editingId = ref('');
    const form = reactive<PatientMedicationProfileForm>(emptyForm());
    const actionKey = ref('');

    function reset(): void {
        editingId.value = '';
        error.value = null;
        formErrors.value = {};
        Object.assign(form, emptyForm());
    }

    function openDialog(profile?: PatientChartMedicationProfile | null): void {
        reset();
        if (profile) {
            editingId.value = profile.id;
            form.medicationCode = profile.medicationCode ?? '';
            form.medicationName = profile.medicationName ?? '';
            form.dose = profile.dose ?? '';
            form.route = profile.route ?? '';
            form.frequency = profile.frequency ?? '';
            form.source = profile.source ?? 'home_medication';
            form.status = profile.status ?? 'active';
            form.startedAt = profile.startedAt ? String(profile.startedAt).slice(0, 10) : '';
            form.stoppedAt = profile.stoppedAt ? String(profile.stoppedAt).slice(0, 10) : '';
            form.indication = profile.indication ?? '';
            form.notes = profile.notes ?? '';
            form.lastReconciledAt = profile.lastReconciledAt ? String(profile.lastReconciledAt).slice(0, 10) : '';
            form.reconciliationNote = profile.reconciliationNote ?? '';
        }
        open.value = true;
    }

    function closeDialog(): void {
        open.value = false;
        reset();
    }

    function matchingProfileForOrder(order: PatientChartReconciliationPharmacyOrder): PatientChartMedicationProfile | null {
        const medicationCode = normalizedText(order.medicationCode);
        const medicationName = normalizedText(order.medicationName);

        return (
            medicationProfile.value.find((profile) => {
                const profileCode = normalizedText(profile.medicationCode);
                const profileName = normalizedText(profile.medicationName);
                if (medicationCode !== '' && profileCode !== '') return medicationCode === profileCode;
                return medicationName !== '' && profileName !== '' && medicationName === profileName;
            }) ?? null
        );
    }

    function openDialogFromOrder(order: PatientChartReconciliationPharmacyOrder, mode: 'continue' | 'add'): void {
        const matching = matchingProfileForOrder(order);
        const today = todayDateValue();
        const orderLabel = order.orderNumber || `order ${shortId(order.id)}`;
        const reconciliationText =
            mode === 'continue'
                ? `Therapy reviewed from ${orderLabel} in the medication reconciliation workspace.`
                : `Current medication list updated from dispensed ${orderLabel} in the medication reconciliation workspace.`;

        if (matching) {
            openDialog(matching);
            form.lastReconciledAt = form.lastReconciledAt || today;
            form.reconciliationNote = appendReconciliationNote(form.reconciliationNote, reconciliationText);
            form.notes = appendReconciliationNote(form.notes, `Linked pharmacy order: ${orderLabel}.`);
            return;
        }

        openDialog();
        form.medicationCode = order.medicationCode ?? '';
        form.medicationName = order.medicationName ?? '';
        form.dose = order.dosageInstruction ?? '';
        form.source = 'manual_entry';
        form.status = 'active';
        form.startedAt = today;
        form.lastReconciledAt = today;
        form.reconciliationNote = reconciliationText;
        form.notes = `Linked pharmacy order: ${orderLabel}.`;
    }

    async function submitDialog(): Promise<void> {
        submitting.value = true;
        error.value = null;
        formErrors.value = {};

        const payload = {
            medicationCode: form.medicationCode.trim() || null,
            medicationName: form.medicationName.trim(),
            dose: form.dose.trim() || null,
            route: form.route.trim() || null,
            frequency: form.frequency.trim() || null,
            source: form.source,
            status: form.status,
            startedAt: form.startedAt || null,
            stoppedAt: form.stoppedAt || null,
            indication: form.indication.trim() || null,
            notes: form.notes.trim() || null,
            lastReconciledAt: form.lastReconciledAt || null,
            reconciliationNote: form.reconciliationNote.trim() || null,
        };

        try {
            if (editingId.value) {
                await apiPatch(`/patients/${patientId.value}/medication-profile/${editingId.value}`, { body: payload });
                notifySuccess('Current medication entry updated.');
            } else {
                await apiPost(`/patients/${patientId.value}/medication-profile`, { body: payload });
                notifySuccess('Current medication entry recorded.');
            }
            closeDialog();
            onSaved();
        } catch (caught) {
            formErrors.value = validationErrorsFromError(caught);
            error.value = caught instanceof Error ? caught.message : 'Unable to save current medication entry.';
            notifyError(error.value);
        } finally {
            submitting.value = false;
        }
    }

    function isQuickReconcileLoading(profile: PatientChartMedicationProfile): boolean {
        return actionKey.value === `profile-review:${profile.id}`;
    }

    async function quickReconcile(profile: PatientChartMedicationProfile): Promise<void> {
        actionKey.value = `profile-review:${profile.id}`;
        try {
            await apiPatch(`/patients/${patientId.value}/medication-profile/${profile.id}`, {
                body: {
                    lastReconciledAt: todayDateValue(),
                    reconciliationNote: appendReconciliationNote(
                        profile.reconciliationNote,
                        'Reviewed from the patient chart medication reconciliation workspace.',
                    ),
                },
            });
            notifySuccess('Current medication review recorded.');
            onSaved();
        } catch (caught) {
            notifyError(caught instanceof Error ? caught.message : 'Unable to record current medication review.');
        } finally {
            actionKey.value = '';
        }
    }

    return {
        open,
        submitting,
        error,
        formErrors,
        editingId,
        form,
        openDialog,
        openDialogFromOrder,
        closeDialog,
        submitDialog,
        isQuickReconcileLoading,
        quickReconcile,
    };
}
