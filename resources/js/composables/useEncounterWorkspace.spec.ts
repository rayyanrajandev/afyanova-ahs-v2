import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { render, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useEncounterWorkspace } from './useEncounterWorkspace';

describe('useEncounterWorkspace', () => {
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
                const query = useEncounterWorkspace(id);

                return () =>
                    h('div', [
                        h('span', { 'data-testid': 'status' }, query.status.value),
                        h(
                            'span',
                            { 'data-testid': 'encounter-id' },
                            (query.data.value?.encounter?.id as string | undefined) ?? '',
                        ),
                    ]);
            },
        });

        return render(TestComponent, {
            global: { plugins: [[VueQueryPlugin, { queryClient }]] },
        });
    }

    it('calls the existing GET /encounters/{id}?view=workspace endpoint and exposes the response', async () => {
        const apiGetSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: {
                encounter: { id: 'enc-123', status: 'in_progress' },
                appointment: null,
                primaryMedicalRecord: null,
                laboratoryOrders: [],
                pharmacyOrders: [],
                radiologyOrders: [],
                theatreProcedures: [],
                closeReadiness: {
                    canClose: false,
                    requiresAcknowledgement: false,
                    blockingCount: 1,
                    warningCount: 0,
                    items: [],
                    billingSummary: {},
                },
            },
        });

        const screen = mountWithQuery('enc-123');
        await flushPromises();

        await waitFor(() => {
            expect(screen.getByTestId('status').textContent).toBe('success');
        });

        expect(apiGetSpy).toHaveBeenCalledWith('/encounters/enc-123', { view: 'workspace' });
        expect(screen.getByTestId('encounter-id').textContent).toBe('enc-123');
    });

    it('does not call the API when no encounter id is provided', async () => {
        const apiGetSpy = vi.spyOn(apiClient, 'apiGet');

        mountWithQuery(null);
        await flushPromises();

        expect(apiGetSpy).not.toHaveBeenCalled();
    });
});
