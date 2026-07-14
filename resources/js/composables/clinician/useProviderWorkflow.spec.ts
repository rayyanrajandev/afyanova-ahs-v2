import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useProviderWorkflow } from './useProviderWorkflow';

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

describe('useProviderWorkflow', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /appointments/{id}/provider-workflow with the target status', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'apt-1', status: 'waiting_provider' } });

        const workflow = await mount(() => useProviderWorkflow());
        await workflow.mutateAsync({ appointmentId: 'apt-1', status: 'waiting_provider' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/provider-workflow', {
            body: { status: 'waiting_provider', reason: null },
        });
    });

    it('sends a reason when sending a visit back to triage', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'apt-1', status: 'waiting_triage' } });

        const workflow = await mount(() => useProviderWorkflow());
        await workflow.mutateAsync({ appointmentId: 'apt-1', status: 'waiting_triage', reason: 'Repeat vitals before continuing.' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/provider-workflow', {
            body: { status: 'waiting_triage', reason: 'Repeat vitals before continuing.' },
        });
    });
});
