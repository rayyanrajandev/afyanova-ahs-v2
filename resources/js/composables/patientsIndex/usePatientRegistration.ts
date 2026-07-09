import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { reactive } from 'vue';
import { apiPost } from '@/lib/apiClient';
import type { PatientDuplicateMatch } from './usePatientDuplicateCheck';
import type { PatientListItem } from './usePatientList';

/**
 * Phase 2 of reports/patients-index-modernization-plan.md.
 * Field set matches StorePatientRequest exactly
 * (app/Modules/Patient/Presentation/Http/Requests/StorePatientRequest.php).
 *
 * Deliberately excludes the legacy page's draft-autosave and offline-queue
 * wiring (reports/patients-index-audit.md §1, §5) — this is Phase 2's core
 * online registration path; offline-queue wiring into the already-extracted
 * @/lib/offlinePatientRegistration.ts is a documented follow-up slice, not
 * silently dropped (reports/patients-index-modernization-plan.md's Phase 2
 * update note).
 */
export function usePatientRegistrationForm() {
    return reactive({
        firstName: '',
        middleName: '',
        lastName: '',
        gender: 'female' as 'male' | 'female' | 'other' | 'unknown',
        dateOfBirth: '',
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
                body: {
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
                },
            });

            return { patient: response.data, warnings: response.warnings };
        },
    });
}
