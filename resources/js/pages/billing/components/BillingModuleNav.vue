<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/lib/icons';
import { usePlatformAccess } from '@/composables/usePlatformAccess';

interface ModuleLink {
    value: string;
    label: string;
    href: string;
    icon: AppIconName;
    permission: string;
}

const moduleLinks = [
    { value: 'invoices', label: 'Invoices', href: '/billing', icon: 'receipt', permission: 'billing.invoices.read' },
    { value: 'cash', label: 'Cash payments', href: '/billing-cash', icon: 'banknote', permission: 'billing.cash-accounts.read' },
    { value: 'refunds', label: 'Refunds', href: '/billing-refunds', icon: 'undo-2', permission: 'billing.refunds.read' },
] as const satisfies ModuleLink[];

const { hasPermission, hasUniversalAdminAccess } = usePlatformAccess();

const visibleLinks = computed(() =>
    moduleLinks.filter((link) => hasUniversalAdminAccess.value || hasPermission(link.permission)),
);

const page = usePage();
const url = computed(() => page.url);

function isActive(value: string): boolean {
    const u = url.value;
    // '/billing' is segment-matched (exact, or '/billing/...') so it doesn't
    // also light up for '/billing-cash' or '/billing-refunds'. '/billing-invoices'
    // (the pre-cutover master-detail page) still counts as the Invoices tab.
    if (value === 'invoices') return u === '/billing' || u.startsWith('/billing/') || u.startsWith('/billing-invoices');
    if (value === 'cash') return u.startsWith('/billing-cash');
    if (value === 'refunds') return u.startsWith('/billing-refunds');
    return false;
}
</script>

<template>
    <nav
        v-if="visibleLinks.length > 1"
        class="flex items-center gap-0.5 overflow-x-auto border-b"
        role="navigation"
        aria-label="Billing module navigation"
    >
        <Link
            v-for="link in visibleLinks"
            :key="link.value"
            :href="link.href"
            class="relative flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
            :class="
                isActive(link.value)
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
            "
        >
            <AppIcon :name="link.icon" class="size-3.5 shrink-0" />
            {{ link.label }}
            <span
                v-if="isActive(link.value)"
                class="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
            />
        </Link>
    </nav>
</template>
