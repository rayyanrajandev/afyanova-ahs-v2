import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateWardBed } from './useUpdateWardBed';

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

describe('useUpdateWardBed', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the ward-bed detail endpoint without the id in the body', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'wb-1', name: 'Updated' } });

        const update = await mount(() => useUpdateWardBed());
        await update.mutateAsync({
            id: 'wb-1',
            code: 'WB-01',
            name: 'Updated',
            departmentId: null,
            wardName: 'Ward A',
            bedNumber: '01',
        });

        expect(patchSpy).toHaveBeenCalledWith('/platform/admin/ward-beds/wb-1', {
            body: { code: 'WB-01', name: 'Updated', departmentId: null, wardName: 'Ward A', bedNumber: '01' },
        });
    });
});
