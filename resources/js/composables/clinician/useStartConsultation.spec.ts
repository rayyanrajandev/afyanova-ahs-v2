import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useStartConsultation } from './useStartConsultation';

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

describe('useStartConsultation', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /appointments/{id}/start-consultation with forceTakeover defaulted to false', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'apt-1', status: 'in_consultation' } });

        const start = await mount(() => useStartConsultation());
        await start.mutateAsync({ appointmentId: 'apt-1' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/start-consultation', {
            body: { forceTakeover: false, takeoverReason: null },
        });
    });

    it('passes forceTakeover and takeoverReason through for a takeover', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'apt-1', status: 'in_consultation' } });

        const start = await mount(() => useStartConsultation());
        await start.mutateAsync({ appointmentId: 'apt-1', forceTakeover: true, takeoverReason: 'Covering for a colleague on break' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/start-consultation', {
            body: { forceTakeover: true, takeoverReason: 'Covering for a colleague on break' },
        });
    });
});
