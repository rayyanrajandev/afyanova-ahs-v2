<script setup lang="ts">
import { computed, ref } from 'vue';
import ReportTable from '@/components/pharmacyReports/ReportTable.vue';
import { usePrescriptionTrends, useMedicineConsumption } from '@/composables/pharmacyReports/useAnalyticsReports';
import type { ColumnDef } from '@/components/pharmacyReports/ReportTable.vue';

const props = defineProps<{
    filters: { from: string; to: string; q: string };
    subTab: string;
}>();

const granularity = ref<'daily' | 'weekly' | 'monthly'>('daily');

const trendsFilters = computed(() => ({
    ...props.filters,
    granularity: granularity.value,
}));

const prescriptionTrendsQuery = usePrescriptionTrends(() => trendsFilters.value);
const medicineConsumptionQuery = useMedicineConsumption(() => trendsFilters.value);

const trendsData = computed(() => prescriptionTrendsQuery?.data?.value?.data ?? null);
const consumptionData = computed(() => medicineConsumptionQuery?.data?.value?.data ?? null);

const trendsColumns: ColumnDef<unknown>[] = [
    { key: 'period', label: 'Period' },
    { key: 'orderCount', label: 'Orders', align: 'right' },
    { key: 'dispensedCount', label: 'Dispensed', align: 'right' },
    { key: 'totalPrescribed', label: 'Total', align: 'right' },
];

const consumptionColumns: ColumnDef<unknown>[] = [
    { key: 'period', label: 'Period' },
    { key: 'totalConsumed', label: 'Consumed', align: 'right' },
    { key: 'movementCount', label: 'Movements', align: 'right' },
];
</script>

<template>
    <div class="space-y-4">
        <div v-if="props.subTab === 'prescription-trends'" class="space-y-6">
            <div class="flex items-center gap-2">
                <label class="text-sm font-medium text-muted-foreground">Granularity:</label>
                <select
                    v-model="granularity"
                    class="rounded-md border px-3 py-1.5 text-sm"
                >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
            </div>
            <ReportTable
                :columns="trendsColumns"
                :data="trendsData"
                :loading="prescriptionTrendsQuery?.isLoading?.value ?? false"
                empty-message="No prescription trend data found."
            />
        </div>
        <div v-else-if="props.subTab === 'medicine-consumption'" class="space-y-6">
            <ReportTable
                :columns="consumptionColumns"
                :data="consumptionData"
                :loading="medicineConsumptionQuery?.isLoading?.value ?? false"
                empty-message="No consumption data found."
            />
        </div>
    </div>
</template>
