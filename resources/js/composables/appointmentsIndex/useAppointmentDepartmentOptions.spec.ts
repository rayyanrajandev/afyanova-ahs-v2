import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAppointmentDepartmentOptions } from './useAppointmentDepartmentOptions';

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

describe('useAppointmentDepartmentOptions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches department options from GET /appointments/department-options', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ value: 'OPD', label: 'OPD - Outpatient', group: null, description: null, keywords: [] }],
        });

        const options = await mount(() => useAppointmentDepartmentOptions());

        expect(getSpy).toHaveBeenCalledWith('/appointments/department-options');
        expect(options.data.value).toHaveLength(1);
        expect(options.data.value?.[0]?.value).toBe('OPD');
    });
});
