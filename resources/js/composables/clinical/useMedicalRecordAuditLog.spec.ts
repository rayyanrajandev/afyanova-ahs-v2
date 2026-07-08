import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useMedicalRecordAuditLog } from './useMedicalRecordAuditLog';

async function mount(build: () => ReturnType<typeof useMedicalRecordAuditLog>) {
    let composable!: ReturnType<typeof useMedicalRecordAuditLog>;
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

describe('useMedicalRecordAuditLog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('loads audit log entries with default pagination', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                { id: 'log-1', medicalRecordId: 'rec-1', actorId: 5, actorType: 'user', action: 'medical-record.created', changes: null, metadata: null, createdAt: '2026-01-01T00:00:00Z' },
            ],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });

        const audit = await mount(() => useMedicalRecordAuditLog(() => 'rec-1'));

        expect(audit.logs.value).toHaveLength(1);
        expect(audit.meta.value?.total).toBe(1);
        expect(getSpy).toHaveBeenCalledWith(
            '/medical-records/rec-1/audit-logs',
            expect.objectContaining({ page: 1, perPage: 20 }),
        );
    });

    it('clamps goToPage within the known last page', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 40, lastPage: 2 },
        });

        const audit = await mount(() => useMedicalRecordAuditLog(() => 'rec-1'));

        audit.goToPage(99);
        expect(audit.filters.page).toBe(2);

        audit.goToPage(-5);
        expect(audit.filters.page).toBe(1);
    });

    it('resets all filters back to defaults', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1 },
        });

        const audit = await mount(() => useMedicalRecordAuditLog(() => 'rec-1'));
        audit.filters.q = 'search term';
        audit.filters.action = 'medical-record.created';
        audit.filters.page = 3;

        audit.resetFilters();

        expect(audit.filters.q).toBe('');
        expect(audit.filters.action).toBe('');
        expect(audit.filters.page).toBe(1);
    });

    it('opens the export URL with the current filters applied, excluding empty ones', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1 },
        });
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

        const audit = await mount(() => useMedicalRecordAuditLog(() => 'rec-1'));
        audit.filters.q = 'signed';
        audit.filters.action = '';

        audit.exportCsv();

        expect(openSpy).toHaveBeenCalledTimes(1);
        const [url, target, features] = openSpy.mock.calls[0];
        expect(String(url)).toContain('/medical-records/rec-1/audit-logs/export');
        expect(String(url)).toContain('q=signed');
        expect(String(url)).not.toContain('action=');
        expect(target).toBe('_blank');
        expect(features).toBe('noopener');
    });

    it('does nothing when there is no record id yet', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        const audit = await mount(() => useMedicalRecordAuditLog(() => null));

        audit.exportCsv();

        expect(openSpy).not.toHaveBeenCalled();
    });
});
