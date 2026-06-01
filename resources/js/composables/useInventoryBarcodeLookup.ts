import { ref } from 'vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown } from '@/lib/notify';

export type InventoryBarcodeItem = {
    id: string;
    itemCode: string | null;
    itemName: string | null;
    category: string | null;
    unit: string | null;
    currentStock: number | string | null;
    barcode: string | null;
    msdCode: string | null;
    nhifCode: string | null;
};

function normalizeBarcodeItem(raw: Record<string, unknown> | null | undefined): InventoryBarcodeItem | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const id = String(raw.id ?? '').trim();
    if (!id) {
        return null;
    }

    return {
        id,
        itemCode: (raw.item_code ?? raw.itemCode ?? null) as string | null,
        itemName: (raw.item_name ?? raw.itemName ?? null) as string | null,
        category: (raw.category ?? null) as string | null,
        unit: (raw.unit ?? null) as string | null,
        currentStock: (raw.current_stock ?? raw.currentStock ?? null) as number | string | null,
        barcode: (raw.barcode ?? null) as string | null,
        msdCode: (raw.msd_code ?? raw.msdCode ?? null) as string | null,
        nhifCode: (raw.nhif_code ?? raw.nhifCode ?? null) as string | null,
    };
}

export function useInventoryBarcodeLookup() {
    const barcodeInput = ref('');
    const loading = ref(false);
    const error = ref<string | null>(null);
    const result = ref<InventoryBarcodeItem | null>(null);

    function reset(): void {
        barcodeInput.value = '';
        error.value = null;
        result.value = null;
        loading.value = false;
    }

    async function lookup(): Promise<InventoryBarcodeItem | null> {
        const barcode = barcodeInput.value.trim();
        if (!barcode) {
            error.value = 'Enter or scan a barcode.';
            result.value = null;
            return null;
        }

        loading.value = true;
        error.value = null;
        result.value = null;

        try {
            const response = await apiRequestJson<{ data: Record<string, unknown> | null }>(
                'GET',
                '/inventory-procurement/barcode-lookup',
                { query: { barcode } },
            );
            const item = normalizeBarcodeItem(response.data);
            if (!item) {
                error.value = 'No active item found for this barcode.';
                return null;
            }

            result.value = item;
            return item;
        } catch (lookupError) {
            error.value = messageFromUnknown(lookupError, 'No active item found for this barcode.');
            return null;
        } finally {
            loading.value = false;
        }
    }

    function onEnter(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            void lookup();
        }
    }

    return {
        barcodeInput,
        loading,
        error,
        result,
        reset,
        lookup,
        onEnter,
    };
}
