<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformAccess } from '@/composables/usePlatformAccess';

interface InvoiceViewTab {
    value: string;
    label: string;
    href: string;
    permission: string;
}

const allTabs: InvoiceViewTab[] = [
    { value: 'queue', label: 'Queue', href: '/billing-invoices', permission: 'billing.invoices.read' },
    { value: 'board', label: 'Board', href: '/billing-invoices?tab=board', permission: 'billing.invoices.read' },
    { value: 'new', label: 'New', href: '/billing-invoices?tab=new', permission: 'billing.invoices.create' },
];

const { hasPermission, hasUniversalAdminAccess } = usePlatformAccess();

const tabs = computed(() =>
    allTabs.filter((t) => hasUniversalAdminAccess.value || hasPermission(t.permission)),
);

const page = usePage();
const url = computed(() => page.url);

const activeTab = computed(() => {
    const u = url.value;
    if (u.startsWith('/billing-invoices')) {
        const params = new URLSearchParams(u.includes('?') ? u.split('?')[1] : '');
        if (params.get('tab') === 'board') return 'board';
        if (params.get('tab') === 'new') return 'new';
        return 'queue';
    }
    return 'queue';
});
</script>

<template>
    <Tabs v-if="tabs.length > 0" :model-value="activeTab" class="w-full">
        <TabsList class="h-auto min-h-9 w-full flex-wrap">
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
