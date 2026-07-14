import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useDirectServiceStatusCounts } from './useDirectServiceStatusCounts';
import { useDirectServiceFilters } from './useDirectServiceFilters';

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

describe('useDirectServiceStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches status counts and surfaces departmentScopeMissing', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { pending: 2, in_progress: 1, completed: 0, cancelled: 0, total: 3 },
            meta: { departmentScopeMissing: false },
        });

        const filters = useDirectServiceFilters();
        const result = await mount(() => useDirectServiceStatusCounts(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/service-requests/status-counts',
            expect.objectContaining({ priority: null, departmentId: null }),
        );
        expect(result.data.value?.data.total).toBe(3);
        expect(result.data.value?.meta.departmentScopeMissing).toBe(false);
    });
});
