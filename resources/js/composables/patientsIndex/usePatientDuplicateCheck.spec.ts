import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientDuplicateCheck, type PatientDuplicateCheckIdentity } from './usePatientDuplicateCheck';

function identity(overrides: Partial<PatientDuplicateCheckIdentity> = {}): PatientDuplicateCheckIdentity {
    return {
        firstName: '',
        lastName: '',
        gender: '',
        dateOfBirth: '',
        phone: '',
        nationalId: '',
        addressLine: '',
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
    await new Promise((resolve) => setTimeout(resolve, 0));

    return composable;
}

describe('usePatientDuplicateCheck', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('does not call the server when firstName/lastName are too short', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost');

        const id = ref(identity({ firstName: 'A' }));
        await mount(() => usePatientDuplicateCheck(id));

        expect(postSpy).not.toHaveBeenCalled();
    });

    it('calls the server on a phone number alone, without any name', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { severity: 'none', duplicates: [] },
        });

        const id = ref(identity({ phone: '+255700000001' }));
        await mount(() => usePatientDuplicateCheck(id));

        expect(postSpy).toHaveBeenCalledWith(
            '/patients/duplicate-check',
            expect.objectContaining({ body: expect.objectContaining({ phone: '+255700000001', firstName: null, lastName: null }) }),
        );
    });

    it('calls the server on a national ID alone, without any name', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { severity: 'none', duplicates: [] },
        });

        const id = ref(identity({ nationalId: 'NIDA-12345' }));
        await mount(() => usePatientDuplicateCheck(id));

        expect(postSpy).toHaveBeenCalledWith(
            '/patients/duplicate-check',
            expect.objectContaining({ body: expect.objectContaining({ nationalId: 'NIDA-12345' }) }),
        );
    });

    it('calls the server once enough identity is present', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { severity: 'none', duplicates: [] },
        });

        const id = ref(identity({ firstName: 'Amina', lastName: 'Moshi' }));
        const check = await mount(() => usePatientDuplicateCheck(id));

        expect(postSpy).toHaveBeenCalledWith(
            '/patients/duplicate-check',
            expect.objectContaining({ body: expect.objectContaining({ firstName: 'Amina', lastName: 'Moshi' }) }),
        );
        expect(check.data.value?.severity).toBe('none');
    });

    it('refetches when the identity ref changes', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { severity: 'none', duplicates: [] },
        });

        const id = ref(identity({ firstName: 'Amina', lastName: 'Moshi' }));
        await mount(() => usePatientDuplicateCheck(id));
        expect(postSpy).toHaveBeenCalledTimes(1);

        id.value = identity({ firstName: 'Amina', lastName: 'Moshi', phone: '+255700000001' });
        await vi.waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2));
    });

    it('surfaces a strong_warning result with the matched duplicate', async () => {
        vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: {
                severity: 'strong_warning',
                duplicates: [
                    {
                        id: 'pat-1',
                        firstName: 'Amina',
                        lastName: 'Moshi',
                        duplicateMatchType: 'strong_warning',
                        duplicateConfidence: 90,
                        duplicateConfidenceLabel: 'strong',
                    },
                ],
            },
        });

        const id = ref(identity({ firstName: 'Amina', lastName: 'Moshi' }));
        const check = await mount(() => usePatientDuplicateCheck(id));

        expect(check.data.value?.severity).toBe('strong_warning');
        expect(check.data.value?.duplicates[0]?.id).toBe('pat-1');
    });
});
