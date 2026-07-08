import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render, waitFor } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePermissions } from './usePermissions';

describe('usePermissions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    function mount() {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const TestComponent = defineComponent({
            setup() {
                const permissions = usePermissions();
                return () =>
                    h('span', {
                        'data-testid': 'has-finalize',
                    }, String(permissions.has('medical.records.finalize')));
            },
        });
        return render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    }

    it('exposes has() as true once the permission list loads and contains the name', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ name: 'medical.records.read' }, { name: 'medical.records.finalize' }],
        });

        const screen = mount();
        await flushPromises();

        await waitFor(() => {
            expect(screen.getByTestId('has-finalize').textContent).toBe('true');
        });
    });

    it('returns false for a permission not present in the response', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ name: 'medical.records.read' }],
        });

        const screen = mount();
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(screen.getByTestId('has-finalize').textContent).toBe('false');
    });
});
