<script setup lang="ts">
import { computed } from 'vue';
import VueApexCharts from 'vue3-apexcharts';

const props = defineProps<{
    series: { name: string; data: number[] }[];
    categories: string[];
    title?: string;
    loading?: boolean;
}>();

const chartOptions = computed(() => ({
    chart: {
        type: 'bar' as const,
        toolbar: { show: false },
        height: 350,
    },
    title: {
        text: props.title ?? '',
        align: 'left' as const,
        style: { fontSize: '14px', fontWeight: 600 },
    },
    xaxis: {
        categories: props.categories,
        labels: { rotate: -45, style: { fontSize: '10px' } },
    },
    yaxis: {
        labels: { style: { fontSize: '11px' } },
    },
    colors: ['#2563eb', '#16a34a'],
    dataLabels: { enabled: false },
    grid: { borderColor: '#e2e8f0' },
    legend: { position: 'bottom' as const },
    plotOptions: {
        bar: {
            horizontal: false,
            columnWidth: '60%',
        },
    },
}));
</script>

<template>
    <div class="rounded-md border bg-white p-4">
        <VueApexCharts
            v-if="!loading && series.length > 0 && categories.length > 0"
            :options="chartOptions"
            :series="series"
            height="350"
        />
        <div v-else-if="loading" class="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
            Loading chart...
        </div>
        <div v-else class="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
            No consumption data available.
        </div>
    </div>
</template>
