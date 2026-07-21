import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useCreateConsultationMapping } from './useCreateConsultationMapping';

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

describe('useCreateConsultationMapping', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs /consultation-mappings with snake_case body and maps the response back to camelCase', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            success: true,
            data: {
                id: '1',
                clinician_tier: 'CO',
                department: 'Outpatient Department (OPD)',
                billing_service_catalog_item_id: 'cat-1',
                catalog_item: null,
                created_at: null,
                updated_at: null,
            },
        });

        const create = await mount(() => useCreateConsultationMapping());
        const result = await create.mutateAsync({
            clinicianTier: 'CO',
            department: 'Outpatient Department (OPD)',
            billingServiceCatalogItemId: 'cat-1',
        });

        expect(postSpy).toHaveBeenCalledWith('/consultation-mappings', {
            body: {
                clinician_tier: 'CO',
                department: 'Outpatient Department (OPD)',
                billing_service_catalog_item_id: 'cat-1',
            },
        });
        expect(result).toMatchObject({ id: '1', clinicianTier: 'CO', billingServiceCatalogItemId: 'cat-1' });
    });
});
