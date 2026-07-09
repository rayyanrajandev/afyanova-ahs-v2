import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientStatusChange } from './usePatientStatusChange';

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

describe('usePatientStatusChange', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the status and trimmed reason to /patients/{id}/status', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'pat-1', status: 'inactive' } });

        const statusChange = await mount(() => usePatientStatusChange());
        await statusChange.mutateAsync({ patientId: 'pat-1', status: 'inactive', reason: '  No longer a patient  ' });

        expect(patchSpy).toHaveBeenCalledWith(
            '/patients/pat-1/status',
            expect.objectContaining({ body: { status: 'inactive', reason: 'No longer a patient' } }),
        );
    });

    it('sends a null reason when blank', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'pat-1', status: 'active' } });

        const statusChange = await mount(() => usePatientStatusChange());
        await statusChange.mutateAsync({ patientId: 'pat-1', status: 'active' });

        expect(patchSpy).toHaveBeenCalledWith(
            '/patients/pat-1/status',
            expect.objectContaining({ body: { status: 'active', reason: null } }),
        );
    });
});
