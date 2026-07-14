import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateAdmissionStatus } from './useUpdateAdmissionStatus';

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

describe('useUpdateAdmissionStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the admission status endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'adm-1', status: 'discharged' } });

        const update = await mount(() => useUpdateAdmissionStatus());
        await update.mutateAsync({
            admissionId: 'adm-1',
            status: 'discharged',
            reason: 'Recovered',
            dischargeDestination: 'Home',
        });

        expect(patchSpy).toHaveBeenCalledWith('/admissions/adm-1/status', {
            body: { status: 'discharged', reason: 'Recovered', dischargeDestination: 'Home' },
        });
    });

    it('sends receivingBedResourceId when transferring', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'adm-1', status: 'transferred' } });

        const update = await mount(() => useUpdateAdmissionStatus());
        await update.mutateAsync({
            admissionId: 'adm-1',
            status: 'transferred',
            reason: 'Moved to ICU',
            receivingBedResourceId: 'bed-2',
        });

        expect(patchSpy).toHaveBeenCalledWith('/admissions/adm-1/status', {
            body: { status: 'transferred', reason: 'Moved to ICU', receivingBedResourceId: 'bed-2' },
        });
    });
});
