import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useDirectServiceDepartmentOptions } from './useDirectServiceDepartmentOptions';

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

describe('useDirectServiceDepartmentOptions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches department options from GET /service-requests/department-options', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ value: 'dept-1', label: 'LAB - Laboratory' }],
        });

        const options = await mount(() => useDirectServiceDepartmentOptions());

        expect(getSpy).toHaveBeenCalledWith('/service-requests/department-options', { serviceType: null });
        expect(options.data.value?.[0]?.value).toBe('dept-1');
    });

    it('refetches when a reactive serviceType changes', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [] });

        const serviceType = ref('laboratory');
        await mount(() => useDirectServiceDepartmentOptions(serviceType));
        expect(getSpy).toHaveBeenCalledWith('/service-requests/department-options', { serviceType: 'laboratory' });

        serviceType.value = 'pharmacy';
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledWith('/service-requests/department-options', { serviceType: 'pharmacy' }));
    });
});
