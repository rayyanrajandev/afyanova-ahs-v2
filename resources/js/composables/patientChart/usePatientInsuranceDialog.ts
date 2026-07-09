import { reactive, ref, type Ref } from 'vue';
import { apiPatch, apiPost, isApiClientError } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';

export type PatientInsuranceForm = {
    insuranceType: string;
    insuranceProvider: string;
    planName: string;
    policyNumber: string;
    memberId: string;
    cardNumber: string;
    effectiveDate: string;
    expiryDate: string;
    notes: string;
};

function validationErrorsFromError(error: unknown): Record<string, string[]> {
    if (isApiClientError(error) && error.payload && typeof error.payload === 'object' && 'errors' in error.payload) {
        return (error.payload as { errors?: Record<string, string[]> }).errors ?? {};
    }
    return {};
}

function emptyForm(): PatientInsuranceForm {
    return {
        insuranceType: 'insurance',
        insuranceProvider: '',
        planName: '',
        policyNumber: '',
        memberId: '',
        cardNumber: '',
        effectiveDate: '',
        expiryDate: '',
        notes: '',
    };
}

/**
 * Add-record dialog for ShowV2.vue's Insurance tab, mirroring
 * usePatientAllergyDialog.ts's established shape 1:1. Deliberately no edit
 * mode in this first pass — StorePatientInsuranceRecordRequest's
 * memberId-or-cardNumber requirement and the payer-contract linking field
 * are real fields the legacy sheet exposed that this form doesn't yet;
 * add is the common case (correcting a typo on an existing record is rare
 * enough to defer, not silently dropped).
 */
export function usePatientInsuranceDialog(patientId: Ref<string>, onSaved: () => void) {
    const open = ref(false);
    const submitting = ref(false);
    const error = ref<string | null>(null);
    const formErrors = ref<Record<string, string[]>>({});
    const form = reactive<PatientInsuranceForm>(emptyForm());

    function reset(): void {
        error.value = null;
        formErrors.value = {};
        Object.assign(form, emptyForm());
    }

    function openDialog(): void {
        reset();
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
            insuranceType: form.insuranceType || null,
            insuranceProvider: form.insuranceProvider.trim() || null,
            planName: form.planName.trim() || null,
            policyNumber: form.policyNumber.trim() || null,
            memberId: form.memberId.trim() || null,
            cardNumber: form.cardNumber.trim() || null,
            effectiveDate: form.effectiveDate || null,
            expiryDate: form.expiryDate || null,
            notes: form.notes.trim() || null,
        };

        try {
            await apiPost(`/patients/${patientId.value}/insurance`, { body: payload });
            notifySuccess('Insurance record added.');
            closeDialog();
            onSaved();
        } catch (caught) {
            formErrors.value = validationErrorsFromError(caught);
            error.value = caught instanceof Error ? caught.message : 'Unable to add insurance record.';
            notifyError(error.value);
        } finally {
            submitting.value = false;
        }
    }

    const verifyingId = ref<string | null>(null);

    async function verifyRecord(recordId: string, verificationStatus: 'verified' | 'failed'): Promise<void> {
        verifyingId.value = recordId;
        try {
            await apiPatch(`/patients/${patientId.value}/insurance/${recordId}/verify`, {
                body: { verificationStatus },
            });
            notifySuccess(verificationStatus === 'verified' ? 'Insurance verified.' : 'Insurance marked as failed verification.');
            onSaved();
        } catch (caught) {
            notifyError(caught instanceof Error ? caught.message : 'Unable to update verification status.');
        } finally {
            verifyingId.value = null;
        }
    }

    return { open, submitting, error, formErrors, form, openDialog, closeDialog, submitDialog, verifyingId, verifyRecord };
}
