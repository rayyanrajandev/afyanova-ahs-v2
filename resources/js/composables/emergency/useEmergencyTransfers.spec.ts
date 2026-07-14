import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useEmergencyTransfers } from './useEmergencyTransfers';

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

describe('useEmergencyTransfers', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('GETs the case transfers endpoint', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 50, total: 0, lastPage: 1 },
        });

        await mount(() => useEmergencyTransfers('case-1'));

        expect(getSpy).toHaveBeenCalledWith('/emergency-triage-cases/case-1/transfers', {
            perPage: 50,
            sortBy: 'requestedAt',
            sortDir: 'desc',
        });
    });
});
