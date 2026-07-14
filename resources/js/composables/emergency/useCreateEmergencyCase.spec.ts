import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useCreateEmergencyCase } from './useCreateEmergencyCase';

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

describe('useCreateEmergencyCase', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs /emergency-triage-cases with the intake payload', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { id: 'case-1', caseNumber: 'ED0001', status: 'waiting' },
        });

        const create = await mount(() => useCreateEmergencyCase());
        await create.mutateAsync({
            patientId: 'pat-1',
            arrivalAt: '2026-07-10T09:00',
            triageLevel: 'red',
            chiefComplaint: 'Chest pain',
        });

        expect(postSpy).toHaveBeenCalledWith('/emergency-triage-cases', {
            body: {
                patientId: 'pat-1',
                arrivalAt: '2026-07-10T09:00',
                triageLevel: 'red',
                chiefComplaint: 'Chest pain',
            },
        });
    });
});
