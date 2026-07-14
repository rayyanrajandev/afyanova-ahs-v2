import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientQuickSearch } from './usePatientQuickSearch';

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent);
    await flushPromises();

    return composable;
}

describe('usePatientQuickSearch', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('debounces and fetches matching patients once the query is long enough', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'pat-1', firstName: 'Amina', lastName: 'Moshi', patientNumber: 'PT1' }],
        });

        const search = await mount(() => usePatientQuickSearch({ perPage: 5 }));
        void search.search('Am');
        await vi.advanceTimersByTimeAsync(300);
        await flushPromises();

        expect(getSpy).toHaveBeenCalledWith('/patients', { q: 'Am', perPage: 5 });
        expect(search.results.value).toHaveLength(1);
        expect(search.displayName(search.results.value[0])).toBe('Amina Moshi');
    });

    it('clears results without a request for a short query', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet');

        const search = await mount(() => usePatientQuickSearch());
        void search.search('a');
        await vi.advanceTimersByTimeAsync(300);
        await flushPromises();

        expect(getSpy).not.toHaveBeenCalled();
        expect(search.results.value).toHaveLength(0);
    });

    it('clear() empties the results', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'pat-1', firstName: 'Amina', lastName: 'Moshi', patientNumber: 'PT1' }],
        });

        const search = await mount(() => usePatientQuickSearch());
        void search.search('Amina');
        await vi.advanceTimersByTimeAsync(300);
        await flushPromises();
        expect(search.results.value).toHaveLength(1);

        search.clear();
        expect(search.results.value).toHaveLength(0);
    });
});
