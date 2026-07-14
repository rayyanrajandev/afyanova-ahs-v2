import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useClinicianDirectory } from './useClinicianDirectory';

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

describe('useClinicianDirectory', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches active clinical staff from GET /staff/clinical-directory', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'staff-1', userId: 7, userName: 'Dr. Amina Moshi', department: 'OPD', jobTitle: 'Physician' }],
        });

        const directory = await mount(() => useClinicianDirectory());

        expect(getSpy).toHaveBeenCalledWith('/staff/clinical-directory', {
            status: 'active',
            clinicalOnly: 'true',
            physicianOnly: null,
            page: 1,
            perPage: 200,
        });
        expect(directory.data.value).toHaveLength(1);
        expect(directory.data.value?.[0]?.userName).toBe('Dr. Amina Moshi');
    });

    it('requests physicianOnly when asked, for the appointment clinician picker', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [] });

        await mount(() => useClinicianDirectory({ physicianOnly: true }));

        expect(getSpy).toHaveBeenCalledWith(
            '/staff/clinical-directory',
            expect.objectContaining({ physicianOnly: 'true' }),
        );
    });
});
