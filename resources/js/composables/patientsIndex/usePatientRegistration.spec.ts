import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientRegistration, usePatientRegistrationForm } from './usePatientRegistration';

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

describe('usePatientRegistration', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('trims fields and sends null for blank optional fields', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { id: 'pat-1', firstName: 'Amina', lastName: 'Moshi' },
            warnings: [],
        });

        const form = usePatientRegistrationForm();
        form.firstName = '  Amina  ';
        form.lastName = '  Moshi  ';
        form.dateOfBirth = '1996-04-21';
        form.phone = ' +255700000001 ';
        form.region = ' Dar es Salaam ';
        form.district = ' Ilala ';
        form.addressLine = ' Msasani ';
        form.middleName = '   ';
        form.email = '';

        const registration = await mount(() => usePatientRegistration());
        const result = await registration.mutateAsync(form);

        expect(postSpy).toHaveBeenCalledWith(
            '/patients',
            expect.objectContaining({
                body: expect.objectContaining({
                    firstName: 'Amina',
                    lastName: 'Moshi',
                    phone: '+255700000001',
                    middleName: null,
                    email: null,
                }),
            }),
        );
        expect(result.patient.id).toBe('pat-1');
        expect(result.warnings).toEqual([]);
    });

    it('returns non-empty warnings on a successful registration with a soft duplicate match', async () => {
        vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { id: 'pat-2', firstName: 'Amina', lastName: 'Moshi' },
            warnings: [{ id: 'pat-1', duplicateConfidenceLabel: 'strong', duplicateMatchType: 'strong_warning' }],
        });

        const form = usePatientRegistrationForm();
        const registration = await mount(() => usePatientRegistration());
        const result = await registration.mutateAsync(form);

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].duplicateConfidenceLabel).toBe('strong');
    });

    it('propagates a hard-block conflict error to the caller', async () => {
        const conflictError = Object.assign(new Error('Duplicate active patient record(s) found.'), {
            status: 409,
            payload: { duplicates: [{ id: 'pat-1' }] },
        });
        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(conflictError);

        const form = usePatientRegistrationForm();
        const registration = await mount(() => usePatientRegistration());

        await expect(registration.mutateAsync(form)).rejects.toThrow('Duplicate active patient record(s) found.');
    });
});
