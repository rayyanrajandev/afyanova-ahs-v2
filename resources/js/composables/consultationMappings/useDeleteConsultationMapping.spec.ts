import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useDeleteConsultationMapping } from './useDeleteConsultationMapping';

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

describe('useDeleteConsultationMapping', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('DELETEs /consultation-mappings/{id}', async () => {
        const deleteSpy = vi.spyOn(apiClient, 'apiDelete').mockResolvedValue(undefined);

        const del = await mount(() => useDeleteConsultationMapping());
        await del.mutateAsync('1');

        expect(deleteSpy).toHaveBeenCalledWith('/consultation-mappings/1');
    });
});
