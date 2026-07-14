import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useDirectServiceRequest } from './useDirectServiceRequest';

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

describe('useDirectServiceRequest', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs the service request with defaults applied', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { id: 'sr-1', requestNumber: 'SR1', serviceType: 'laboratory', status: 'pending' },
        });

        const request = await mount(() => useDirectServiceRequest());
        const result = await request.mutateAsync({ patientId: 'pat-1', serviceType: 'laboratory' });

        expect(postSpy).toHaveBeenCalledWith(
            '/service-requests',
            expect.objectContaining({
                body: { patientId: 'pat-1', serviceType: 'laboratory', departmentId: null, priority: 'routine', notes: null },
            }),
        );
        expect(result.requestNumber).toBe('SR1');
    });

    it('trims notes and sends null when blank', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { id: 'sr-1', requestNumber: 'SR1', serviceType: 'pharmacy', status: 'pending' },
        });

        const request = await mount(() => useDirectServiceRequest());
        await request.mutateAsync({ patientId: 'pat-1', serviceType: 'pharmacy', priority: 'urgent', notes: '  needs review  ' });

        expect(postSpy).toHaveBeenCalledWith(
            '/service-requests',
            expect.objectContaining({
                body: { patientId: 'pat-1', serviceType: 'pharmacy', departmentId: null, priority: 'urgent', notes: 'needs review' },
            }),
        );
    });

    it('sends the selected department id', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { id: 'sr-1', requestNumber: 'SR1', serviceType: 'laboratory', status: 'pending' },
        });

        const request = await mount(() => useDirectServiceRequest());
        await request.mutateAsync({ patientId: 'pat-1', serviceType: 'laboratory', departmentId: 'dept-1' });

        expect(postSpy).toHaveBeenCalledWith(
            '/service-requests',
            expect.objectContaining({
                body: { patientId: 'pat-1', serviceType: 'laboratory', departmentId: 'dept-1', priority: 'routine', notes: null },
            }),
        );
    });
});
