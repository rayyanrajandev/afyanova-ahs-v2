import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useClaimTriage } from './useClaimTriage';

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

describe('useClaimTriage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /appointments/{id}/claim-triage with forceTakeover defaulted to false', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'apt-1', triageOwnerUserId: 42 } });

        const claim = await mount(() => useClaimTriage());
        await claim.mutateAsync({ appointmentId: 'apt-1' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/claim-triage', { body: { forceTakeover: false } });
    });

    it('passes forceTakeover through when set', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'apt-1' } });

        const claim = await mount(() => useClaimTriage());
        await claim.mutateAsync({ appointmentId: 'apt-1', forceTakeover: true });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/claim-triage', { body: { forceTakeover: true } });
    });
});
