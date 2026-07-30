<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import ReportFilters from '@/components/pharmacyReports/ReportFilters.vue';
import InventoryReports from './InventoryReports.vue';
import DispensingReports from './DispensingReports.vue';
import ComplianceReports from './ComplianceReports.vue';
import AnalyticsReports from './AnalyticsReports.vue';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Pharmacy', href: '/pharmacy-orders' },
    { title: 'Reports', href: '/pharmacy-reports' },
];

const { scrollContainerHeight } = useStickyScrollContainer();

const activeTab = ref('inventory');
const subTab = ref('stock-status');

watch(activeTab, (tab) => {
    if (tab === 'inventory') subTab.value = 'stock-status';
    else if (tab === 'dispensing') subTab.value = 'dispensed-medicines';
    else if (tab === 'compliance') subTab.value = 'controlled-drugs';
    else if (tab === 'analytics') subTab.value = 'prescription-trends';
});

const filters = reactive({
    from: '',
    to: '',
    q: '',
});

const tabs = [
    { value: 'inventory', label: 'Inventory Health' },
    { value: 'dispensing', label: 'Dispensing' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'analytics', label: 'Analytics' },
];

const subNavs: Record<string, { value: string; label: string }[]> = {
    inventory: [
        { value: 'stock-status', label: 'Stock Status' },
        { value: 'low-stock', label: 'Low Stock' },
        { value: 'out-of-stock', label: 'Out of Stock' },
        { value: 'near-expiry', label: 'Near Expiry' },
        { value: 'expired', label: 'Expired' },
    ],
    dispensing: [
        { value: 'dispensed-medicines', label: 'Dispensed Medicines' },
        { value: 'batch-tracking', label: 'Batch Tracking' },
        { value: 'by-clinician', label: 'By Clinician' },
    ],
    compliance: [
        { value: 'controlled-drugs', label: 'Controlled Drugs Register' },
        { value: 'insurance-claims', label: 'Insurance Claims' },
    ],
    analytics: [
        { value: 'prescription-trends', label: 'Prescription Trends' },
        { value: 'medicine-consumption', label: 'Medicine Consumption' },
    ],
};

function setSubTab(value: string) {
    subTab.value = value;
}
</script>

<template>
    <Head title="Pharmacy Reports" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <Tabs v-model="activeTab" class="contents">
                <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div class="flex items-start justify-between">
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Pharmacy Reports</h1>
                            <p class="text-xs text-muted-foreground">Inventory, dispensing, compliance, and analytics reports</p>
                        </div>
                    </div>

                    <TabsList class="mt-3 grid w-full grid-cols-2 sm:grid-cols-4">
                        <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value">
                            {{ tab.label }}
                        </TabsTrigger>
                    </TabsList>

                    <nav class="mt-2 flex flex-wrap gap-1 border-b">
                        <button
                            v-for="item in subNavs[activeTab]"
                            :key="item.value"
                            @click="setSubTab(item.value)"
                            class="relative px-3 py-2 text-sm font-medium transition-colors"
                            :class="subTab === item.value ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary' : 'text-muted-foreground hover:text-foreground'"
                        >
                            {{ item.label }}
                        </button>
                    </nav>

                    <ReportFilters
                        class="mt-3"
                        v-model:from="filters.from"
                        v-model:to="filters.to"
                        v-model:q="filters.q"
                    />
                </div>

                <div class="px-6 pb-6">
                    <TabsContent value="inventory">
                        <InventoryReports :filters="filters" :sub-tab="subTab" />
                    </TabsContent>
                    <TabsContent value="dispensing">
                        <DispensingReports :filters="filters" :sub-tab="subTab" />
                    </TabsContent>
                    <TabsContent value="compliance">
                        <ComplianceReports :filters="filters" :sub-tab="subTab" />
                    </TabsContent>
                    <TabsContent value="analytics">
                        <AnalyticsReports :filters="filters" :sub-tab="subTab" />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    </AppLayout>
</template>
