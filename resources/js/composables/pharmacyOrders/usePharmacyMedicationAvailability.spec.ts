import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePharmacyMedicationAvailability } from './usePharmacyMedicationAvailability';

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

describe('usePharmacyMedicationAvailability', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /pharmacy-orders/availability when enabled with a code', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: {
                id: 'item-1',
                itemCode: 'ATC:N02BE01',
                itemName: 'Paracetamol 500mg',
                unit: 'tablet',
                dispensingUnit: null,
                conversionFactor: null,
                currentStock: 330,
                onHandStock: '480.000',
                reorderLevel: 120,
                maxStockLevel: 800,
                status: 'active',
                stockState: 'healthy',
                batchTrackingMode: 'untracked',
                blockedBatchQuantity: 0,
            },
        });

        const result = await mount(() =>
            usePharmacyMedicationAvailability(ref('ATC:N02BE01'), ref('Paracetamol 500mg'), ref(true)),
        );

        expect(getSpy).toHaveBeenCalledWith('/pharmacy-orders/availability', {
            medicationCode: 'ATC:N02BE01',
            medicationName: 'Paracetamol 500mg',
        });
        expect(result.data.value?.currentStock).toBe(330);
        expect(result.data.value?.onHandStock).toBe('480.000');
    });

    it('does not fetch when disabled', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: null });

        await mount(() => usePharmacyMedicationAvailability(ref('ATC:N02BE01'), ref('Paracetamol 500mg'), ref(false)));

        expect(getSpy).not.toHaveBeenCalled();
    });

    it('does not fetch when both code and name are blank', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: null });

        await mount(() => usePharmacyMedicationAvailability(ref(''), ref(''), ref(true)));

        expect(getSpy).not.toHaveBeenCalled();
    });

    it('surfaces a null result when no active inventory match exists', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: null });

        const result = await mount(() =>
            usePharmacyMedicationAvailability(ref('NOT-A-REAL-CODE'), ref('Nonexistent'), ref(true)),
        );

        expect(result.data.value).toBeNull();
    });
});
