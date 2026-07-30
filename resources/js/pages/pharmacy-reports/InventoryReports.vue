<script setup lang="ts">
import { computed, watch } from 'vue';
import ReportTable from '@/components/pharmacyReports/ReportTable.vue';
import ReportLoadMore from '@/components/pharmacyReports/ReportLoadMore.vue';
import { useLowStock, useOutOfStock, useNearExpiry, useExpired } from '@/composables/pharmacyReports/useInventoryReports';
import { useLoadMore } from '@/composables/pharmacyReports/useLoadMore';
import type { StockStatusItem } from '@/composables/pharmacyReports/useInventoryReports';
import type { ColumnDef } from '@/components/pharmacyReports/ReportTable.vue';

const props = defineProps<{
    filters: { from: string; to: string; q: string };
    subTab: string;
}>();

const baseParams = computed(() => ({
    q: props.filters.q.trim() || null,
    from: props.filters.from || null,
    to: props.filters.to || null,
}));

const stockStatus = useLoadMore<StockStatusItem>('/pharmacy-reports/inventory/stock-status', baseParams.value);
stockStatus.loadMore();

watch(() => props.filters.q, () => { stockStatus.reset(); stockStatus.loadMore(); });
watch(() => props.filters.from, () => { stockStatus.reset(); stockStatus.loadMore(); });
watch(() => props.filters.to, () => { stockStatus.reset(); stockStatus.loadMore(); });

const lowStockQuery = useLowStock(() => props.filters);
const outOfStockQuery = useOutOfStock(() => props.filters);
const nearExpiryQuery = useNearExpiry(() => props.filters);
const expiredQuery = useExpired(() => props.filters);

const lowStockData = computed(() => lowStockQuery?.data?.value?.data ?? null);
const outOfStockData = computed(() => outOfStockQuery?.data?.value?.data ?? null);
const nearExpiryData = computed(() => nearExpiryQuery?.data?.value?.data ?? null);
const expiredData = computed(() => expiredQuery?.data?.value?.data ?? null);

const lowStockCount = computed(() => lowStockQuery?.data?.value?.meta?.total ?? null);
const outOfStockCount = computed(() => outOfStockQuery?.data?.value?.meta?.total ?? null);
const nearExpiryCount = computed(() => nearExpiryQuery?.data?.value?.meta?.total ?? null);
const expiredCount = computed(() => expiredQuery?.data?.value?.meta?.total ?? null);

const stockStatusColumns: ColumnDef<unknown>[] = [
    { key: 'itemCode', label: 'Code' },
    { key: 'itemName', label: 'Medication' },
    { key: 'currentStock', label: 'Stock', align: 'right' },
    { key: 'availableStock', label: 'Available', align: 'right' },
    { key: 'reorderLevel', label: 'Reorder', align: 'right', format: (v) => v ?? '—' },
    { key: 'stockState', label: 'Status', format: (v) => String(v).replace(/_/g, ' ') },
    { key: 'lastMovementDate', label: 'Last Movement', format: (v) => v ? new Date(v as string).toLocaleDateString() : '—' },
];

const lowStockColumns: ColumnDef<unknown>[] = [
    { key: 'itemCode', label: 'Code' },
    { key: 'itemName', label: 'Medication' },
    { key: 'currentStock', label: 'Stock', align: 'right' },
    { key: 'reorderLevel', label: 'Reorder', align: 'right' },
    { key: 'stockRatio', label: 'Ratio', align: 'right' },
    { key: 'manufacturer', label: 'Manufacturer', format: (v) => v ?? '—' },
];

const outOfStockColumns: ColumnDef<unknown>[] = [
    { key: 'itemCode', label: 'Code' },
    { key: 'itemName', label: 'Medication' },
    { key: 'daysOutOfStock', label: 'Days OOS', align: 'right', format: (v) => v !== null ? `${v}d` : '—' },
    { key: 'lastStockedAt', label: 'Last Stocked', format: (v) => v ? new Date(v as string).toLocaleDateString() : 'Never' },
    { key: 'manufacturer', label: 'Manufacturer', format: (v) => v ?? '—' },
];

const nearExpiryColumns: ColumnDef<unknown>[] = [
    { key: 'itemCode', label: 'Code' },
    { key: 'itemName', label: 'Medication' },
    { key: 'batchNumber', label: 'Batch', format: (v) => v ?? '—' },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'expiryDate', label: 'Expiry', format: (v) => v ? new Date(v as string).toLocaleDateString() : '—' },
    { key: 'daysUntilExpiry', label: 'Days Left', align: 'right' },
    { key: 'urgency', label: 'Urgency', format: (v) => String(v) },
];

const expiredColumns: ColumnDef<unknown>[] = [
    { key: 'itemCode', label: 'Code' },
    { key: 'itemName', label: 'Medication' },
    { key: 'batchNumber', label: 'Batch', format: (v) => v ?? '—' },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'expiryDate', label: 'Expired On', format: (v) => v ? new Date(v as string).toLocaleDateString() : '—' },
    { key: 'daysSinceExpiry', label: 'Days Expired', align: 'right' },
    { key: 'estimatedValue', label: 'Value', align: 'right', format: (v) => v !== null ? (v as number).toFixed(2) : '—' },
];
</script>

<template>
    <div class="space-y-4">
        <div v-if="props.subTab === 'stock-status'" class="space-y-4">
            <ReportTable
                :columns="stockStatusColumns"
                :data="stockStatus.data.value"
                :loading="stockStatus.isLoading.value && stockStatus.data.value.length === 0"
                empty-message="No stock status data available."
            />
            <ReportLoadMore
                :loaded="stockStatus.loadedCount.value"
                :total="stockStatus.total.value"
                :loading="stockStatus.isLoading.value"
                :has-more="stockStatus.hasMore.value"
                @load-more="stockStatus.loadMore"
            />
        </div>
        <div v-else-if="props.subTab === 'low-stock'">
            <ReportTable
                :columns="lowStockColumns"
                :data="lowStockData"
                :loading="lowStockQuery?.isLoading?.value ?? false"
                empty-message="No low stock items found."
            />
        </div>
        <div v-else-if="props.subTab === 'out-of-stock'">
            <ReportTable
                :columns="outOfStockColumns"
                :data="outOfStockData"
                :loading="outOfStockQuery?.isLoading?.value ?? false"
                empty-message="No out of stock items."
            />
        </div>
        <div v-else-if="props.subTab === 'near-expiry'">
            <ReportTable
                :columns="nearExpiryColumns"
                :data="nearExpiryData"
                :loading="nearExpiryQuery?.isLoading?.value ?? false"
                empty-message="No near-expiry items found."
            />
        </div>
        <div v-else-if="props.subTab === 'expired'">
            <ReportTable
                :columns="expiredColumns"
                :data="expiredData"
                :loading="expiredQuery?.isLoading?.value ?? false"
                empty-message="No expired items found."
            />
        </div>
    </div>
</template>
