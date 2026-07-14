import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateTheatreProcedureStatus } from './useUpdateTheatreProcedureStatus';

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

describe('useUpdateTheatreProcedureStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the theatre procedure status endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'th-1', status: 'completed' } });

        const update = await mount(() => useUpdateTheatreProcedureStatus());
        await update.mutateAsync({ id: 'th-1', status: 'completed', completedAt: '2026-01-01T10:00:00.000Z' });

        expect(patchSpy).toHaveBeenCalledWith('/theatre-procedures/th-1/status', {
            body: { status: 'completed', completedAt: '2026-01-01T10:00:00.000Z' },
        });
    });

    it('propagates a forward-only-transition error', async () => {
        const error = Object.assign(new Error('Invalid theatre workflow transition.'), {
            payload: { errors: { status: ['Invalid theatre workflow transition.'] } },
        });
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(error);

        const update = await mount(() => useUpdateTheatreProcedureStatus());

        await expect(update.mutateAsync({ id: 'th-1', status: 'planned' })).rejects.toThrow(
            'Invalid theatre workflow transition.',
        );
    });
});
