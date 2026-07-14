import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useWardBedDepartmentOptions } from './useWardBedDepartmentOptions';

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
    await new Promise((resolve) => setTimeout(resolve, 0));

    return composable;
}

describe('useWardBedDepartmentOptions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches departments and maps them to searchable options', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'dept-1', code: 'CARD', name: 'Cardiology' }],
        });

        const { options } = await mount(() => useWardBedDepartmentOptions());

        expect(getSpy).toHaveBeenCalledWith('/departments', { page: 1, perPage: 100, sortBy: 'name', sortDir: 'asc' });
        expect(options.value).toHaveLength(1);
        expect(options.value[0].value).toBe('dept-1');
        expect(options.value[0].label).toBe('CARD - Cardiology');
    });

    it('falls back to name or code when one is missing', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'dept-2', code: null, name: 'Radiology' }],
        });

        const { options } = await mount(() => useWardBedDepartmentOptions());

        expect(options.value[0].label).toBe('Radiology');
    });
});
