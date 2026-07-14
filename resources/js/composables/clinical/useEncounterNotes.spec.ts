import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { render, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useEncounterNotes } from './useEncounterNotes';

describe('useEncounterNotes', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    function mountWithQuery(encounterId: string | null) {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        const TestComponent = defineComponent({
            setup() {
                const id = ref(encounterId);
                const query = useEncounterNotes(id);

                return () =>
                    h('div', [
                        h('span', { 'data-testid': 'status' }, query.status.value),
                        h(
                            'span',
                            { 'data-testid': 'note-count' },
                            String(query.data.value?.data.length ?? 0),
                        ),
                    ]);
            },
        });

        return render(TestComponent, {
            global: { plugins: [[VueQueryPlugin, { queryClient }]] },
        });
    }

    it('calls GET /medical-records filtered by encounterId and exposes every note', async () => {
        const apiGetSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                { id: 'rec-1', recordType: 'consultation_note', status: 'finalized' },
                { id: 'rec-2', recordType: 'progress_note', status: 'draft' },
            ],
            meta: { currentPage: 1, perPage: 100, total: 2, lastPage: 1 },
        });

        const screen = mountWithQuery('enc-123');
        await flushPromises();

        await waitFor(() => {
            expect(screen.getByTestId('status').textContent).toBe('success');
        });

        expect(apiGetSpy).toHaveBeenCalledWith('/medical-records', {
            encounterId: 'enc-123',
            perPage: 100,
        });
        expect(screen.getByTestId('note-count').textContent).toBe('2');
    });

    it('does not call the API when no encounter id is provided', async () => {
        const apiGetSpy = vi.spyOn(apiClient, 'apiGet');

        mountWithQuery(null);
        await flushPromises();

        expect(apiGetSpy).not.toHaveBeenCalled();
    });
});
