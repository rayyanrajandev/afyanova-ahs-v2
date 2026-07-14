import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useCreateAdmission } from './useCreateAdmission';

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

describe('useCreateAdmission', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs the admission payload including bedResourceId', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: { id: 'adm-1', status: 'admitted' } });

        const create = await mount(() => useCreateAdmission());
        await create.mutateAsync({
            patientId: 'pat-1',
            bedResourceId: 'bed-1',
            attendingClinicianUserId: 7,
            admittedAt: '2026-07-10T09:00:00',
            admissionReason: 'Observation',
        });

        expect(postSpy).toHaveBeenCalledWith('/admissions', {
            body: {
                patientId: 'pat-1',
                bedResourceId: 'bed-1',
                attendingClinicianUserId: 7,
                admittedAt: '2026-07-10T09:00:00',
                admissionReason: 'Observation',
            },
        });
    });
});
