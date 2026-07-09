import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientAuditLogs } from './usePatientAuditLogs';

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

describe('usePatientAuditLogs', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches the audit log page for the given patient', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'log-1', action: 'patient.updated', actionLabel: 'Patient Profile Updated' }],
            meta: { currentPage: 1, lastPage: 1, total: 1 },
        });

        const audit = await mount(() => usePatientAuditLogs(ref('pat-1'), ref(1), ref(true)));

        expect(getSpy).toHaveBeenCalledWith('/patients/pat-1/audit-logs', { page: 1, perPage: 20 });
        expect(audit.data.value?.data[0]?.actionLabel).toBe('Patient Profile Updated');
    });

    it('does not fetch when disabled', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet');

        await mount(() => usePatientAuditLogs(ref('pat-1'), ref(1), ref(false)));

        expect(getSpy).not.toHaveBeenCalled();
    });

    it('refetches when the page changes', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, lastPage: 2, total: 30 },
        });
        const page = ref(1);

        await mount(() => usePatientAuditLogs(ref('pat-1'), page, ref(true)));
        expect(getSpy).toHaveBeenCalledTimes(1);

        page.value = 2;
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));
        expect(getSpy).toHaveBeenLastCalledWith('/patients/pat-1/audit-logs', { page: 2, perPage: 20 });
    });
});
