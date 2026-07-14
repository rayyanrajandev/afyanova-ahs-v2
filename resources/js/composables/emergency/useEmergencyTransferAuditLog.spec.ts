import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useEmergencyTransferAuditLog } from './useEmergencyTransferAuditLog';

async function mount(build: () => ReturnType<typeof useEmergencyTransferAuditLog>) {
    let composable!: ReturnType<typeof useEmergencyTransferAuditLog>;
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

describe('useEmergencyTransferAuditLog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('loads audit log entries for the transfer', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'log-1', emergencyTriageCaseTransferId: 'transfer-1', emergencyTriageCaseId: 'case-1', actorId: 5, action: 'transfer.created', changes: null, metadata: null, createdAt: '2026-01-01T00:00:00Z' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });

        const audit = await mount(() => useEmergencyTransferAuditLog(() => 'case-1', () => 'transfer-1'));

        expect(audit.logs.value).toHaveLength(1);
        expect(getSpy).toHaveBeenCalledWith(
            '/emergency-triage-cases/case-1/transfers/transfer-1/audit-logs',
            expect.objectContaining({ page: 1, perPage: 20 }),
        );
    });

    it('does nothing when there is no transfer id yet', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        const audit = await mount(() => useEmergencyTransferAuditLog(() => 'case-1', () => null));

        audit.exportCsv();

        expect(openSpy).not.toHaveBeenCalled();
    });
});
