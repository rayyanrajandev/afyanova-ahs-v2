<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications } from '@/composables/useNotifications';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Notifications', href: '/notifications' },
];

const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
    refresh,
} = useNotifications();

const activeTab = ref<'all' | 'unread'>('all');
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

const filtered = computed(() => {
    let items = [...notifications.value];

    if (activeTab.value === 'unread') {
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
        <div class="flex flex-col gap-4 p-4 sm:p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">Notifications</h1>
                    <p class="text-sm text-muted-foreground">
                        {{ unreadCount }} unread · {{ notifications.length }} total
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

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Tabs
                    v-model="activeTab"
                    class="w-full sm:w-auto"
                >
                    <TabsList>
                        <TabsTrigger value="all">
                            All
                            <Badge
                                v-if="notifications.length > 0"
                                variant="secondary"
                                class="ml-1.5 px-1 py-0 text-[10px]"
                            >
                                {{ notifications.length }}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="unread">
                            Unread
                            <Badge
                                v-if="unreadCount > 0"
                                variant="default"
                                class="ml-1.5 px-1 py-0 text-[10px]"
                            >
                                {{ unreadCount }}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div class="flex flex-1 items-center gap-2">
                    <div class="relative flex-1">
                        <AppIcon
                            name="search"
                            class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            v-model="searchQuery"
                            placeholder="Search notifications..."
                            class="h-8 pl-8 text-sm"
                        />
                    </div>
                    <Select v-model="categoryFilter">
                        <SelectTrigger class="h-8 w-[140px] text-sm">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            <SelectItem value="clinical">Clinical</SelectItem>
                            <SelectItem value="laboratory">Laboratory</SelectItem>
                            <SelectItem value="pharmacy">Pharmacy</SelectItem>
                            <SelectItem value="billing">Billing</SelectItem>
                            <SelectItem value="administration">Administration</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div class="rounded-lg border">
                <template v-if="isLoading">
                    <div class="space-y-2 p-4">
                        <Skeleton v-for="i in 5" :key="i" class="h-16 w-full" />
                    </div>
                </template>

                <template v-else-if="filtered.length === 0">
                    <div class="flex flex-col items-center gap-2 px-4 py-16 text-center">
                        <AppIcon name="bell" class="size-10 text-muted-foreground/30" />
                        <p class="text-sm font-medium text-muted-foreground">
                            {{ activeTab === 'unread' ? 'No unread notifications' : 'No notifications' }}
                        </p>
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
                </template>
            </div>
        </div>
    </AppLayout>
</template>
