import { ref } from 'vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown } from '@/lib/notify';

export type SupplyChainStockStats = {
    outOfStock: number;
    lowStock: number;
    healthy: number;
    total: number;
};

const emptyStats = (): SupplyChainStockStats => ({
    outOfStock: 0,
    lowStock: 0,
    healthy: 0,
    total: 0,
});

export function useSupplyChainStockStats() {
    const loading = ref(false);
    const error = ref<string | null>(null);
    const stats = ref<SupplyChainStockStats>(emptyStats());

    async function load(): Promise<void> {
        loading.value = true;
        error.value = null;

        try {
            const response = await apiRequestJson<{ data: SupplyChainStockStats }>(
                'GET',
                '/inventory-procurement/stock-alert-counts',
                { query: { limit: 1 } },
            );
            stats.value = response.data ?? emptyStats();
        } catch (loadError) {
            error.value = messageFromUnknown(loadError, 'Unable to load store statistics.');
            stats.value = emptyStats();
        } finally {
            loading.value = false;
        }
    }

    return {
        loading,
        error,
        stats,
        load,
    };
}
