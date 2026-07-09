import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { loadPatientIntoEditForm, usePatientEdit, usePatientEditForm } from './usePatientEdit';
import { type PatientListItem } from './usePatientList';

function patientFixture(overrides: Partial<PatientListItem> = {}): PatientListItem {
    return {
        id: 'pat-1',
        patientNumber: 'PT1',
        firstName: 'Amina',
        middleName: null,
        lastName: 'Moshi',
        gender: 'female',
        dateOfBirth: '1996-04-21',
        phone: '+255700000001',
        email: null,
        nationalId: null,
        countryCode: 'TZ',
        region: 'Dar es Salaam',
        district: 'Ilala',
        addressLine: 'Msasani',
        nextOfKinName: null,
        nextOfKinPhone: null,
        status: 'active',
        statusReason: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    await flushPromises();

    return composable;
}

describe('loadPatientIntoEditForm', () => {
    it('hydrates the form from a patient, defaulting nulls to blank strings', () => {
        const form = usePatientEditForm();
        loadPatientIntoEditForm(form, patientFixture({ middleName: null, email: null }));

        expect(form.id).toBe('pat-1');
        expect(form.firstName).toBe('Amina');
        expect(form.middleName).toBe('');
        expect(form.email).toBe('');
        expect(form.region).toBe('Dar es Salaam');
    });
});

describe('usePatientEdit', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the trimmed form to /patients/{id}', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            data: patientFixture({ firstName: 'Amina ' }),
            warnings: [],
        });

        const form = usePatientEditForm();
        loadPatientIntoEditForm(form, patientFixture());
        form.phone = '  +255700000009  ';

        const edit = await mount(() => usePatientEdit());
        const result = await edit.mutateAsync(form);

        expect(patchSpy).toHaveBeenCalledWith(
            '/patients/pat-1',
            expect.objectContaining({ body: expect.objectContaining({ phone: '+255700000009' }) }),
        );
        expect(result.patient.id).toBe('pat-1');
    });
});
