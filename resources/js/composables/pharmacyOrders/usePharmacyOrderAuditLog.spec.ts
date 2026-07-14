import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePharmacyOrderAuditLog } from './usePharmacyOrderAuditLog';

async function mount(build: () => ReturnType<typeof usePharmacyOrderAuditLog>) {
    let composable!: ReturnType<typeof usePharmacyOrderAuditLog>;
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

describe('usePharmacyOrderAuditLog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('loads audit log entries for the pharmacy order', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'log-1', pharmacyOrderId: 'ph-1', actorId: 5, action: 'pharmacy-order.status.updated', changes: null, metadata: null, createdAt: '2026-01-01T00:00:00Z' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });

        const audit = await mount(() => usePharmacyOrderAuditLog(() => 'ph-1'));

        expect(audit.logs.value).toHaveLength(1);
        expect(getSpy).toHaveBeenCalledWith('/pharmacy-orders/ph-1/audit-logs', expect.objectContaining({ page: 1, perPage: 20 }));
    });

    it('opens the export URL scoped to the order', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [], meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1 } });
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

        const audit = await mount(() => usePharmacyOrderAuditLog(() => 'ph-1'));
        audit.exportCsv();

        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(String(openSpy.mock.calls[0][0])).toContain('/pharmacy-orders/ph-1/audit-logs/export');
    });

    it('does nothing when there is no order id yet', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        const audit = await mount(() => usePharmacyOrderAuditLog(() => null));

        audit.exportCsv();

        expect(openSpy).not.toHaveBeenCalled();
    });
});
