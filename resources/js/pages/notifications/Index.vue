<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications } from '@/composables/useNotifications';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Notifications', href: '/notifications' },
];

const { isLive } = useNotifications();

const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
    refresh,
} = useNotifications();

const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

const canView = (perm: string) => isFacilitySuperAdmin.value || hasPermission(perm);

const isAdmin = computed(() => isFacilitySuperAdmin.value || hasPermission('platform.users.read') || hasPermission('platform.rbac.read') || hasPermission('platform.settings.manage-branding'));

const categoryOptions = computed(() => {
    const options: { value: string; label: string }[] = [{ value: 'all', label: 'All categories' }];
    if (canView('appointments.read') || canView('emergency.triage.read')) {
        options.push({ value: 'clinical', label: 'Clinical' });
    }
    if (canView('laboratory.orders.read')) {
        options.push({ value: 'laboratory', label: 'Laboratory' });
    }
    if (canView('pharmacy.orders.read')) {
        options.push({ value: 'pharmacy', label: 'Pharmacy' });
    }
    if (canView('billing.invoices.read')) {
        options.push({ value: 'billing', label: 'Billing' });
    }
    if (isAdmin.value) {
        options.push({ value: 'administration', label: 'Administration' });
        options.push({ value: 'system', label: 'System' });
    }
    return options;
});

const selectedTab = ref<'all' | 'unread'>('all');
const categoryFilter = ref<string>('all');
const searchQuery = ref('');

const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    informational: 3,
};

const categoryIconMap: Record<string, string> = {
    clinical: 'heart-pulse',
    laboratory: 'flask-conical',
    pharmacy: 'pill',
    billing: 'receipt',
    administration: 'building-2',
    system: 'shield-check',
};

const criticalCount = computed(() => notifications.value.filter((n) => n.priority === 'critical').length);
const highCount = computed(() => notifications.value.filter((n) => n.priority === 'high').length);

const kpis = computed(() => [
    { label: 'Critical', count: criticalCount.value, variant: 'destructive' as const },
    { label: 'High', count: highCount.value, variant: 'default' as const },
    { label: 'Unread', count: unreadCount.value, variant: 'secondary' as const },
]);

const filtered = computed(() => {
    let items = [...notifications.value];

    if (selectedTab.value === 'unread') {
        items = items.filter((n) => !n.readAt);
    }

    if (categoryFilter.value !== 'all') {
        items = items.filter((n) => n.category === categoryFilter.value);
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        items = items.filter(
            (n) =>
                n.title.toLowerCase().includes(q) ||
                (n.body ?? '').toLowerCase().includes(q),
        );
    }

    items.sort(
        (a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99),
    );

    return items;
});

function handleClick(n: { id: string; readAt: string | null; actionUrl: string | null }) {
    if (!n.readAt) {
        markAsRead(n.id);
    }
    if (n.actionUrl) {
        router.visit(n.actionUrl);
    }
}

function priorityBadgeClass(p: string): string {
    switch (p) {
        case 'critical': return 'border-destructive text-destructive';
        case 'high': return 'border-orange-500 text-orange-600';
        case 'normal': return 'border-blue-500 text-blue-600';
        default: return 'border-muted-foreground/30 text-muted-foreground';
    }
}
</script>

<template>
    <Head title="Notifications" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg">
            <Tabs v-model="selectedTab" class="contents">
                <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div class="flex items-center justify-between">
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex items-center gap-2">
                                <h1 class="text-lg font-bold tracking-tight md:text-xl">Notifications</h1>
                                <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <span class="size-1.5 rounded-full" :class="isLive ? 'bg-emerald-500' : 'bg-muted-foreground/40'" aria-hidden="true" />
                                    {{ isLive ? 'Live' : 'Polling' }}
                                </span>
                            </div>
                            <p class="text-xs text-muted-foreground">
                                Prioritised alerts from clinical, lab, pharmacy, and system workflows.
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Button
                                v-if="unreadCount > 0"
                                variant="outline"
                                size="sm"
                                @click="markAllAsRead()"
                            >
                                <AppIcon name="check" class="mr-1.5 size-3.5" />
                                Mark all as read
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                @click="refresh()"
                            >
                                <AppIcon name="refresh-cw" class="mr-1.5 size-3.5" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    <div class="mt-3 grid grid-cols-3 gap-2">
                        <div
                            v-for="kpi in kpis"
                            :key="kpi.label"
                            class="rounded-md border bg-muted/50 px-2.5 py-1.5"
                            :class="kpi.variant === 'destructive' ? 'border-destructive/30' : ''"
                        >
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{{ kpi.label }}</p>
                            <p class="text-sm font-bold tabular-nums">{{ kpi.count }}</p>
                        </div>
                    </div>

                    <TabsList class="mt-3 grid w-full grid-cols-2">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge v-if="notifications.length" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                                {{ notifications.length }}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="unread" class="inline-flex items-center gap-1.5">
                            Unread
                            <Badge v-if="unreadCount" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                                {{ unreadCount }}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div class="space-y-4 px-6 pb-6">
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="relative min-w-72 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                v-model="searchQuery"
                                placeholder="Search notifications…"
                                class="h-9 pl-9"
                            />
                        </div>
                        <Select v-model="categoryFilter">
                            <SelectTrigger class="h-9 w-44">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <TabsContent value="all">
                        <template v-if="isLoading">
                            <div class="space-y-2">
                                <Skeleton v-for="i in 5" :key="i" class="h-16 w-full" />
                            </div>
                        </template>

                        <template v-else-if="filtered.length === 0">
                            <div class="flex flex-col items-center gap-2 py-16 text-center">
                                <AppIcon name="bell" class="size-10 text-muted-foreground/30" />
                                <p class="text-sm font-medium text-muted-foreground">No notifications</p>
                                <p class="text-xs text-muted-foreground/60">
                                    <template v-if="searchQuery || categoryFilter !== 'all'">
                                        Try adjusting your filters.
                                    </template>
                                    <template v-else>
                                        Notifications will appear here when something needs your attention.
                                    </template>
                                </p>
                            </div>
                        </template>

                        <template v-else>
                            <div class="rounded-lg border">
                                <div class="divide-y">
                                    <div
                                        v-for="n in filtered"
                                        :key="n.id"
                                        class="group relative flex cursor-pointer gap-3 px-4 py-3.5 transition-colors hover:bg-accent/30"
                                        :class="{ 'bg-muted/15': !n.readAt }"
                                        @click="handleClick(n)"
                                    >
                                        <AppIcon
                                            :name="categoryIconMap[n.category] ?? 'bell'"
                                            class="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                        />
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-start justify-between gap-2">
                                                <p
                                                    class="truncate text-sm"
                                                    :class="n.readAt ? 'text-muted-foreground' : 'font-medium text-foreground'"
                                                >
                                                    {{ n.title }}
                                                </p>
                                                <div class="flex shrink-0 items-center gap-1.5">
                                                    <Badge
                                                        variant="outline"
                                                        class="px-1.5 py-0 text-[10px] font-normal capitalize"
                                                        :class="priorityBadgeClass(n.priority)"
                                                    >
                                                        {{ n.priority }}
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        class="px-1.5 py-0 text-[10px] font-normal"
                                                    >
                                                        {{ n.category }}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <p v-if="n.body" class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                {{ n.body }}
                                            </p>
                                            <p class="mt-0.5 text-[10px] text-muted-foreground/50">
                                                {{ new Date(n.createdAt).toLocaleString() }}
                                            </p>
                                        </div>
                                        <button
                                            class="absolute top-2 right-2 hidden size-5 items-center justify-center rounded-sm text-muted-foreground/40 hover:text-muted-foreground group-hover:flex"
                                            title="Dismiss"
                                            @click.stop="dismiss(n.id)"
                                        >
                                            <AppIcon name="x" class="size-3.5" />
                                        </button>
                                        <span
                                            v-if="!n.readAt"
                                            class="absolute top-3.5 right-3 size-2 rounded-full bg-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TabsContent>

                    <TabsContent value="unread">
                        <template v-if="isLoading">
                            <div class="space-y-2">
                                <Skeleton v-for="i in 5" :key="i" class="h-16 w-full" />
                            </div>
                        </template>

                        <template v-else-if="filtered.length === 0">
                            <div class="flex flex-col items-center gap-2 py-16 text-center">
                                <AppIcon name="bell" class="size-10 text-muted-foreground/30" />
                                <p class="text-sm font-medium text-muted-foreground">No unread notifications</p>
                                <p class="text-xs text-muted-foreground/60">
                                    You're all caught up.
                                </p>
                            </div>
                        </template>

                        <template v-else>
                            <div class="rounded-lg border">
                                <div class="divide-y">
                                    <div
                                        v-for="n in filtered"
                                        :key="n.id"
                                        class="group relative flex cursor-pointer gap-3 px-4 py-3.5 transition-colors hover:bg-accent/30"
                                        :class="{ 'bg-muted/15': !n.readAt }"
                                        @click="handleClick(n)"
                                    >
                                        <AppIcon
                                            :name="categoryIconMap[n.category] ?? 'bell'"
                                            class="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                        />
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-start justify-between gap-2">
                                                <p
                                                    class="truncate text-sm"
                                                    :class="n.readAt ? 'text-muted-foreground' : 'font-medium text-foreground'"
                                                >
                                                    {{ n.title }}
                                                </p>
                                                <div class="flex shrink-0 items-center gap-1.5">
                                                    <Badge
                                                        variant="outline"
                                                        class="px-1.5 py-0 text-[10px] font-normal capitalize"
                                                        :class="priorityBadgeClass(n.priority)"
                                                    >
                                                        {{ n.priority }}
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        class="px-1.5 py-0 text-[10px] font-normal"
                                                    >
                                                        {{ n.category }}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <p v-if="n.body" class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                {{ n.body }}
                                            </p>
                                            <p class="mt-0.5 text-[10px] text-muted-foreground/50">
                                                {{ new Date(n.createdAt).toLocaleString() }}
                                            </p>
                                        </div>
                                        <button
                                            class="absolute top-2 right-2 hidden size-5 items-center justify-center rounded-sm text-muted-foreground/40 hover:text-muted-foreground group-hover:flex"
                                            title="Dismiss"
                                            @click.stop="dismiss(n.id)"
                                        >
                                            <AppIcon name="x" class="size-3.5" />
                                        </button>
                                        <span
                                            v-if="!n.readAt"
                                            class="absolute top-3.5 right-3 size-2 rounded-full bg-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    </AppLayout>
</template>
