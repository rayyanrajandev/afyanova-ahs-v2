import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateWardBedStatus } from './useUpdateWardBedStatus';

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

describe('useUpdateWardBedStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the ward-bed status endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'wb-1', status: 'inactive' } });

        const update = await mount(() => useUpdateWardBedStatus());
        await update.mutateAsync({ id: 'wb-1', status: 'inactive', reason: 'Maintenance' });

        expect(patchSpy).toHaveBeenCalledWith('/platform/admin/ward-beds/wb-1/status', {
            body: { status: 'inactive', reason: 'Maintenance' },
        });
    });

    it('propagates a 422 conflict when the bed is occupied', async () => {
        const error = Object.assign(new Error('This bed is currently occupied by admission ADM0001.'), {
            payload: { errors: { status: ['This bed is currently occupied by admission ADM0001.'] } },
        });
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(error);

        const update = await mount(() => useUpdateWardBedStatus());

        await expect(update.mutateAsync({ id: 'wb-1', status: 'inactive', reason: 'Trying anyway' })).rejects.toThrow(
            'This bed is currently occupied by admission ADM0001.',
        );
    });
});
