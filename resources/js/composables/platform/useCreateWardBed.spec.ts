import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useCreateWardBed } from './useCreateWardBed';

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

describe('useCreateWardBed', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs the ward-bed create endpoint', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: { id: 'wb-1', code: 'WB-01' } });

        const create = await mount(() => useCreateWardBed());
        await create.mutateAsync({
            code: 'WB-01',
            name: 'Ward A Bed 1',
            departmentId: null,
            wardName: 'Ward A',
            bedNumber: '01',
        });

        expect(postSpy).toHaveBeenCalledWith('/platform/admin/ward-beds', {
            body: { code: 'WB-01', name: 'Ward A Bed 1', departmentId: null, wardName: 'Ward A', bedNumber: '01' },
        });
    });
});
