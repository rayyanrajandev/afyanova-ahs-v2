<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

const sorted = computed(() => {
    const priorityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        normal: 2,
        informational: 3,
    };
    return [...notifications.value].sort(
        (a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99),
    );
});

const categoryIconMap: Record<string, string> = {
    clinical: 'heart-pulse',
    laboratory: 'flask-conical',
    pharmacy: 'pill',
    billing: 'receipt',
    administration: 'building-2',
    system: 'shield-check',
};

function handleClick(n: { id: string; readAt: string | null; actionUrl: string | null }) {
    if (!n.readAt) {
        markAsRead(n.id);
    }
    if (n.actionUrl) {
        window.location.href = n.actionUrl;
    }
}
</script>

<template>
    <Head title="Notifications" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">Notifications</h1>
                    <p class="text-sm text-muted-foreground">
                        {{ isLoading ? 'Loading...' : `${unreadCount} unread · ${notifications.length} total` }}
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <Button
                        v-if="unreadCount > 0"
                        variant="outline"
                        size="sm"
                        @click="markAllAsRead()"
                    >
                        Mark all as read
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        @click="refresh()"
                    >
                        <AppIcon name="refresh-cw" class="mr-1 size-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader class="pb-3">
                    <CardTitle class="text-base">All notifications</CardTitle>
                    <CardDescription>
                        Notifications are ordered by priority: Critical, High, Normal, Informational.
                    </CardDescription>
                </CardHeader>
                <CardContent class="p-0">
                    <template v-if="isLoading">
                        <div class="space-y-2 p-4">
                            <Skeleton v-for="i in 5" :key="i" class="h-16 w-full" />
                        </div>
                    </template>

                    <template v-else-if="notifications.length === 0">
                        <div class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                            <AppIcon name="bell" class="size-8 text-muted-foreground/40" />
                            <p class="text-sm font-medium text-muted-foreground">No notifications</p>
                            <p class="text-xs text-muted-foreground/60">
                                You're all caught up. Notifications will appear here when something needs your attention.
                            </p>
                        </div>
                    </template>

                    <template v-else>
                        <div class="divide-y">
                            <div
                                v-for="n in sorted"
                                :key="n.id"
                                class="group relative flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-accent/30"
                                :class="{ 'bg-muted/10': !n.readAt }"
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
                                                :class="{
                                                    'border-destructive text-destructive': n.priority === 'critical',
                                                    'border-orange-500 text-orange-600': n.priority === 'high',
                                                    'border-blue-500 text-blue-600': n.priority === 'normal',
                                                }"
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
                                    class="absolute top-3 right-3 size-2 rounded-full bg-blue-500"
                                />
                            </div>
                        </div>
                    </template>
                </CardContent>
            </Card>
        </div>
    </AppLayout>
</template>
