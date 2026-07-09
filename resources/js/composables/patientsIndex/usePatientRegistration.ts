import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { reactive } from 'vue';
import { apiPost } from '@/lib/apiClient';
import type { OfflinePatientRegistrationPayload } from '@/lib/offlinePatientRegistration';
import type { PatientDuplicateMatch } from './usePatientDuplicateCheck';
import type { PatientListItem } from './usePatientList';

/**
 * Phase 2 of reports/patients-index-modernization-plan.md.
 * Field set matches StorePatientRequest exactly
 * (app/Modules/Patient/Presentation/Http/Requests/StorePatientRequest.php)
 * — the same shape OfflinePatientRegistrationPayload already uses, so
 * buildPatientRegistrationPayload() below serves both the online POST body
 * and PatientRegistrationSheet.vue's offline-queue enqueue call with one
 * trim/null-normalization implementation instead of two.
 */
export function usePatientRegistrationForm() {
    return reactive({
        firstName: '',
        middleName: '',
        lastName: '',
        gender: 'female' as 'male' | 'female' | 'other' | 'unknown',
        dateOfBirth: '',
        /** UI-local scratch state — derived into dateOfBirth, never sent to the server on its own (StorePatientRequest has no ageYears/ageMonths field). */
        ageYears: '',
        ageMonths: '',
        phone: '',
        email: '',
        nationalId: '',
        countryCode: 'TZ',
        region: '',
        district: '',
        addressLine: '',
        nextOfKinName: '',
        nextOfKinPhone: '',
    });
}

export type PatientRegistrationForm = ReturnType<typeof usePatientRegistrationForm>;

type PatientStoreResponse = {
    data: PatientListItem;
    warnings: PatientDuplicateMatch[];
};

export type PatientRegistrationResult = {
    patient: PatientListItem;
    warnings: PatientDuplicateMatch[];
};

export function buildPatientRegistrationPayload(form: PatientRegistrationForm): OfflinePatientRegistrationPayload {
    return {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName: form.lastName.trim(),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        nationalId: form.nationalId.trim() || null,
        countryCode: form.countryCode,
        region: form.region.trim(),
        district: form.district.trim(),
        addressLine: form.addressLine.trim(),
        nextOfKinName: form.nextOfKinName.trim() || null,
        nextOfKinPhone: form.nextOfKinPhone.trim() || null,
    };
}

/**
 * POST /patients is itself the final, authoritative duplicate check — it
 * calls the same PatientDuplicateDetectionService::evaluate() the dry-run
 * endpoint does (CreatePatientUseCase.php). A 409 response here means a
 * hard-block duplicate was found; the caller should surface
 * error.value.payload for the conflicting record(s), not re-derive
 * anything client-side.
 */
export function usePatientRegistration(): UseMutationReturnType<
    PatientRegistrationResult,
    Error,
    PatientRegistrationForm,
    unknown
> {
    return useMutation({
        mutationFn: async (form: PatientRegistrationForm): Promise<PatientRegistrationResult> => {
            const response = await apiPost<PatientStoreResponse>('/patients', {
                body: buildPatientRegistrationPayload(form),
            });

            return { patient: response.data, warnings: response.warnings };
        },
    });
}
