import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useTheatreClinicianDirectory } from './useTheatreClinicianDirectory';

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

describe('useTheatreClinicianDirectory', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches the clinician directory and builds an id->name map', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                { userId: 12, userName: 'Dr. Amina Suleiman' },
                { userId: 34, userName: 'Dr. John Mwangi' },
            ],
            meta: { currentPage: 1, perPage: 200, total: 2, lastPage: 1 },
        });

        const { nameById } = await mount(() => useTheatreClinicianDirectory());

        expect(getSpy).toHaveBeenCalledWith('/theatre-procedures/clinician-directory', { perPage: 200 });
        expect(nameById.value).toEqual({ 12: 'Dr. Amina Suleiman', 34: 'Dr. John Mwangi' });
    });

    it('skips entries missing a userId or userName', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                { userId: null, userName: 'No id' },
                { userId: 5, userName: null },
            ],
            meta: { currentPage: 1, perPage: 200, total: 2, lastPage: 1 },
        });

        const { nameById } = await mount(() => useTheatreClinicianDirectory());

        expect(nameById.value).toEqual({});
    });
});
