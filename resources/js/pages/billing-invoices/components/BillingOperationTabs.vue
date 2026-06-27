<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tabs = [
    { value: 'queue', label: 'Invoice queue', href: '/billing-invoices' },
    { value: 'board', label: 'Board', href: '/billing-invoices?tab=board' },
    { value: 'create', label: 'Create invoice', href: '/billing-invoices?tab=new' },
    { value: 'cash', label: 'Cash payments', href: '/billing-cash' },
    { value: 'adjustments', label: 'Adjustments', href: '/billing-adjustments' },
    { value: 'refunds', label: 'Refunds', href: '/billing-refunds' },
    { value: 'writeoffs', label: 'Write-offs', href: '/billing-write-offs' },
];

const page = usePage();
const url = computed(() => page.url);

const activeTab = computed(() => {
    const u = url.value;
    if (u.startsWith('/billing-cash')) return 'cash';
    if (u.startsWith('/billing-adjustments')) return 'adjustments';
    if (u.startsWith('/billing-refunds')) return 'refunds';
    if (u.startsWith('/billing-write-offs')) return 'writeoffs';
    if (u.startsWith('/billing-invoices') || u.startsWith('/billing')) {
        const params = new URLSearchParams(u.includes('?') ? u.split('?')[1] : '');
        const tab = params.get('tab');
        if (tab === 'board') return 'board';
        if (tab === 'new') return 'create';
        return 'queue';
    }
    return 'queue';
});
</script>

<template>
    <Tabs :default-value="activeTab" class="w-full">
        <TabsList class="w-full flex-wrap h-auto min-h-10">
            <TabsTrigger
                v-for="tab in tabs"
                :key="tab.value"
                :value="tab.value"
                as-child
            >
                <Link :href="tab.href" class="text-xs md:text-sm">
                    {{ tab.label }}
                </Link>
            </TabsTrigger>
        </TabsList>
    </Tabs>
</template>
