import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { reactive } from 'vue';
import { apiPatch } from '@/lib/apiClient';
import type { PatientDuplicateMatch } from './usePatientDuplicateCheck';
import type { PatientListItem } from './usePatientList';

/**
 * Phase 4 of reports/patients-index-modernization-plan.md — row-level
 * "Edit" action for IndexV2.vue's table, backed by PATCH /patients/{id}
 * (UpdatePatientRequest — every field optional/`sometimes`, so this form
 * only sends fields the user actually touched via loadFromPatient()'s
 * hydration, matching the endpoint's own partial-update contract).
 */
export function usePatientEditForm() {
    return reactive({
        id: '',
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

export type PatientEditForm = ReturnType<typeof usePatientEditForm>;

export function loadPatientIntoEditForm(form: PatientEditForm, patient: PatientListItem): void {
    form.id = patient.id;
    form.firstName = patient.firstName ?? '';
    form.middleName = patient.middleName ?? '';
    form.lastName = patient.lastName ?? '';
    form.gender = (patient.gender as PatientEditForm['gender']) || 'female';
    form.dateOfBirth = patient.dateOfBirth ?? '';
    form.phone = patient.phone ?? '';
    form.email = patient.email ?? '';
    form.nationalId = patient.nationalId ?? '';
    form.countryCode = patient.countryCode || 'TZ';
    form.region = patient.region ?? '';
    form.district = patient.district ?? '';
    form.addressLine = patient.addressLine ?? '';
    form.nextOfKinName = patient.nextOfKinName ?? '';
    form.nextOfKinPhone = patient.nextOfKinPhone ?? '';
}

type PatientUpdateResponse = { data: PatientListItem; warnings: PatientDuplicateMatch[] };

export type PatientEditResult = { patient: PatientListItem; warnings: PatientDuplicateMatch[] };

export function usePatientEdit(): UseMutationReturnType<PatientEditResult, Error, PatientEditForm, unknown> {
    return useMutation({
        mutationFn: async (form: PatientEditForm): Promise<PatientEditResult> => {
            const response = await apiPatch<PatientUpdateResponse>(`/patients/${form.id}`, {
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
                    region: form.region.trim() || null,
                    district: form.district.trim() || null,
                    addressLine: form.addressLine.trim() || null,
                    nextOfKinName: form.nextOfKinName.trim() || null,
                    nextOfKinPhone: form.nextOfKinPhone.trim() || null,
                },
            });
            return { patient: response.data, warnings: response.warnings ?? [] };
        },
    });
}
