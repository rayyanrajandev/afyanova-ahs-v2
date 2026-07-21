import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useUpdateConsultationMapping } from './useUpdateConsultationMapping';

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

describe('useUpdateConsultationMapping', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /consultation-mappings/{id} with snake_case body, excluding id, and maps the response back to camelCase', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            success: true,
            data: {
                id: '1',
                clinician_tier: 'MD',
                department: 'Outpatient Department (OPD)',
                billing_service_catalog_item_id: 'cat-2',
                catalog_item: null,
                created_at: null,
                updated_at: null,
            },
        });

        const update = await mount(() => useUpdateConsultationMapping());
        const result = await update.mutateAsync({
            id: '1',
            clinicianTier: 'MD',
            department: 'Outpatient Department (OPD)',
            billingServiceCatalogItemId: 'cat-2',
        });

        expect(patchSpy).toHaveBeenCalledWith('/consultation-mappings/1', {
            body: {
                clinician_tier: 'MD',
                department: 'Outpatient Department (OPD)',
                billing_service_catalog_item_id: 'cat-2',
            },
        });
        expect(result).toMatchObject({ id: '1', clinicianTier: 'MD', billingServiceCatalogItemId: 'cat-2' });
    });
});
