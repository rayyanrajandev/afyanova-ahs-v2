import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useConsultationMappings } from './useConsultationMappings';

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

describe('useConsultationMappings', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches /consultation-mappings and maps snake_case fields to camelCase', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            success: true,
            data: [{
                id: '1',
                clinician_tier: 'CO',
                department: 'Outpatient Department (OPD)',
                billing_service_catalog_item_id: 'cat-1',
                catalog_item: { id: 'cat-1', service_code: 'CONSULT-CO-OPD', service_name: 'CO Consultation', base_price: '12000.00', status: 'active' },
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
            }],
        });

        const result = await mount(() => useConsultationMappings());

        expect(result.data.value).toHaveLength(1);
        expect(result.data.value?.[0]).toMatchObject({
            id: '1',
            clinicianTier: 'CO',
            department: 'Outpatient Department (OPD)',
            billingServiceCatalogItemId: 'cat-1',
            catalogItem: { serviceCode: 'CONSULT-CO-OPD', serviceName: 'CO Consultation' },
        });
    });
});
