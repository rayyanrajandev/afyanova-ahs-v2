<script setup lang="ts">
import { computed } from 'vue';
import VueApexCharts from 'vue3-apexcharts';

const props = defineProps<{
    series: { name: string; data: { x: string; y: number }[] }[];
    title?: string;
    loading?: boolean;
}>();

const chartOptions = computed(() => ({
    chart: {
        type: 'line' as const,
        toolbar: { show: false },
        zoom: { enabled: true },
        height: 350,
    },
    title: {
        text: props.title ?? '',
        align: 'left' as const,
        style: { fontSize: '14px', fontWeight: 600 },
    },
    xaxis: {
        type: 'datetime' as const,
        labels: { format: 'dd MMM', style: { fontSize: '11px' } },
    },
    yaxis: {
        labels: { style: { fontSize: '11px' } },
    },
    stroke: {
        curve: 'smooth' as const,
        width: 2,
    },
    colors: ['#2563eb', '#16a34a', '#d97706'],
    dataLabels: { enabled: false },
    grid: { borderColor: '#e2e8f0' },
    legend: { position: 'bottom' as const },
}));
</script>

<template>
    <div class="rounded-md border bg-white p-4">
        <VueApexCharts
            v-if="!loading && series.length > 0"
            :options="chartOptions"
            :series="series"
            height="350"
        />
        <div v-else-if="loading" class="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
            Loading chart...
        </div>
        <div v-else class="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
            No data available for the selected period.
        </div>
    </div>
</template>
