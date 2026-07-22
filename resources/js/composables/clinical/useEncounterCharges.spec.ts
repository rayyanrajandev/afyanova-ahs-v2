import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { render, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useEncounterCharges } from './useEncounterCharges';

describe('useEncounterCharges', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    function mountWithQuery(
        patientId: string | null,
        encounterId: string | null,
        enabled: boolean,
    ) {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        const TestComponent = defineComponent({
            setup() {
                const pid = ref(patientId);
                const eid = ref(encounterId);
                const on = ref(enabled);
                const query = useEncounterCharges(pid, eid, on);

                return () =>
                    h('div', [
                        h('span', { 'data-testid': 'status' }, query.status.value),
                        h(
                            'span',
                            { 'data-testid': 'charge-count' },
                            String(query.data.value?.data.length ?? 0),
                        ),
                    ]);
            },
        });

        return render(TestComponent, {
            global: { plugins: [[VueQueryPlugin, { queryClient }]] },
        });
    }

    it('calls the encounter-scoped charge-capture endpoint with includeInvoiced', async () => {
        const apiGetSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                { id: 'appointment_consultation:1', serviceName: 'Consultation', lineTotal: 20000, alreadyInvoiced: false },
                { id: 'laboratory:2', serviceName: 'Full Blood Count', lineTotal: 15000, alreadyInvoiced: true },
            ],
            meta: { currencyCode: 'TZS', includeInvoiced: true, total: 2, pending: 1, alreadyInvoiced: 1, priced: 2, missingPrice: 0 },
        });

        const screen = mountWithQuery('pat-1', 'enc-1', true);
        await flushPromises();

        await waitFor(() => {
            expect(screen.getByTestId('status').textContent).toBe('success');
        });

        expect(apiGetSpy).toHaveBeenCalledWith(
            '/billing/charge-capture-candidates',
            { patientId: 'pat-1', encounterId: 'enc-1', includeInvoiced: true },
        );
        expect(screen.getByTestId('charge-count').textContent).toBe('2');
    });

    it('does not call the API when the billing gate is disabled', async () => {
        const apiGetSpy = vi.spyOn(apiClient, 'apiGet');

        mountWithQuery('pat-1', 'enc-1', false);
        await flushPromises();

        expect(apiGetSpy).not.toHaveBeenCalled();
    });

    it('does not call the API when ids are missing', async () => {
        const apiGetSpy = vi.spyOn(apiClient, 'apiGet');

        mountWithQuery(null, null, true);
        await flushPromises();

        expect(apiGetSpy).not.toHaveBeenCalled();
    });
});
