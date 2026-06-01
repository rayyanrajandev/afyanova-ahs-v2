<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import {
    INVENTORY_PROCUREMENT_HOME_PATH,
    INVENTORY_PROCUREMENT_WORKSPACE_PATH,
    inventoryWorkspaceHref,
    inventoryWorkspaceSectionLabels,
    type InventoryWorkspaceSection,
} from '@/lib/inventoryProcurement';
import { messageFromUnknown } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

type StockAlertCounts = {
    outOfStock: number;
    lowStock: number;
    healthy: number;
    total: number;
};

type ShortageQueueMeta = {
    total?: number;
    readyLineCount?: number;
    waitingLineCount?: number;
};

type TaskCard = {
    id: string;
    title: string;
    description: string;
    icon: 'package' | 'clipboard-list' | 'activity' | 'alert-triangle' | 'building-2' | 'shield-check';
    href: string;
    badge?: string | number | null;
    badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
    permission?: boolean;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
];

const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin } = usePlatformAccess();

const loading = ref(true);
const error = ref<string | null>(null);

const canRead = ref(false);
const canManageItems = ref(false);
const canCreateMovement = ref(false);
const canCreateRequest = ref(false);
const canUpdateRequestStatus = ref(false);
const canManageSuppliers = ref(false);
const canManageWarehouses = ref(false);

const stockCounts = ref<StockAlertCounts>({ outOfStock: 0, lowStock: 0, healthy: 0, total: 0 });
const shortageMeta = ref<ShortageQueueMeta | null>(null);
const pendingApprovalCount = ref(0);
const approvedAwaitingOrderCount = ref(0);

function resolvePermissions(names: Iterable<string>, hasSuperAdmin: boolean): void {
    const set = new Set(
        Array.from(names)
            .map((name) => String(name ?? '').trim())
            .filter((name) => name.length > 0),
    );

    canRead.value = hasSuperAdmin || set.has('inventory.procurement.read');
    canManageItems.value = hasSuperAdmin || set.has('inventory.procurement.manage-items');
    canCreateMovement.value = hasSuperAdmin || set.has('inventory.procurement.create-movement');
    canCreateRequest.value = hasSuperAdmin || set.has('inventory.procurement.create-request');
    canUpdateRequestStatus.value = hasSuperAdmin || set.has('inventory.procurement.update-request-status');
    canManageSuppliers.value = hasSuperAdmin || set.has('inventory.procurement.manage-suppliers');
    canManageWarehouses.value = hasSuperAdmin || set.has('inventory.procurement.manage-warehouses');
}

async function loadPermissions(): Promise<void> {
    resolvePermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);

    try {
        const response = await apiRequestJson<{ data?: Array<{ name?: string }> }>('GET', '/auth/me/permissions');
        resolvePermissions(
            (response.data ?? []).map((item) => item.name ?? ''),
            isFacilitySuperAdmin.value,
        );
    } catch {
        resolvePermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);
    }
}

async function loadDashboard(): Promise<void> {
    if (!canRead.value) {
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        const [countsResponse, shortageResponse, pendingResponse, approvedResponse] = await Promise.all([
            apiRequestJson<{ data: StockAlertCounts }>('GET', '/inventory-procurement/stock-alert-counts', {
                query: { limit: 1 },
            }),
            apiRequestJson<{ data: unknown[]; meta: ShortageQueueMeta }>('GET', '/inventory-procurement/shortage-queue', {
                query: { page: 1, perPage: 1, readiness: 'all' },
            }),
            apiRequestJson<{ data: unknown[]; meta: { total?: number } }>('GET', '/inventory-procurement/procurement-requests', {
                query: { status: 'pending_approval', page: 1, perPage: 1 },
            }),
            apiRequestJson<{ data: unknown[]; meta: { total?: number } }>('GET', '/inventory-procurement/procurement-requests', {
                query: { status: 'approved', page: 1, perPage: 1 },
            }),
        ]);

        stockCounts.value = countsResponse.data ?? stockCounts.value;
        shortageMeta.value = shortageResponse.meta ?? null;
        pendingApprovalCount.value = pendingResponse.meta?.total ?? 0;
        approvedAwaitingOrderCount.value = approvedResponse.meta?.total ?? 0;
    } catch (loadError) {
        error.value = messageFromUnknown(loadError, 'Unable to load supply chain overview.');
    } finally {
        loading.value = false;
    }
}

function workspaceSection(section: InventoryWorkspaceSection, extra: Record<string, string> = {}): string {
    return inventoryWorkspaceHref({ section, ...extra });
}

const storeTasks = computed<TaskCard[]>(() => [
    {
        id: 'receive',
        title: 'Receive & procure',
        description: 'Approve requests, place orders, and receive deliveries into store stock.',
        icon: 'clipboard-list',
        href: workspaceSection('procurement'),
        badge: pendingApprovalCount.value + approvedAwaitingOrderCount.value || null,
        badgeVariant: pendingApprovalCount.value > 0 ? 'destructive' : 'secondary',
        permission: canRead.value,
    },
    {
        id: 'issue',
        title: 'Issue to departments',
        description: 'Fulfill ward requisitions and monitor department stock positions.',
        icon: 'package',
        href: workspaceSection('requisitions'),
        badge: shortageMeta.value?.readyLineCount ?? null,
        badgeVariant: (shortageMeta.value?.readyLineCount ?? 0) > 0 ? 'destructive' : 'outline',
        permission: canRead.value,
    },
    {
        id: 'movements',
        title: 'Stock ledger',
        description: 'Record movements, reconcile counts, and trace clinical consumption.',
        icon: 'activity',
        href: workspaceSection('ledger'),
        permission: canCreateMovement.value || canRead.value,
    },
    {
        id: 'shortage',
        title: 'Shortage queue',
        description: 'Prioritise VEN-sensitive lines waiting for replenishment or procurement.',
        icon: 'alert-triangle',
        href: workspaceSection('shortage-queue'),
        badge: shortageMeta.value?.readyLineCount ?? null,
        badgeVariant: 'destructive',
        permission: canRead.value,
    },
]);

const masterDataTasks = computed<TaskCard[]>(() => [
    {
        id: 'items',
        title: 'Item master',
        description: 'Create consumables, medicines, lab reagents, and set reorder defaults.',
        icon: 'package',
        href: workspaceSection('inventory'),
        permission: canRead.value,
    },
    {
        id: 'suppliers',
        title: 'Suppliers',
        description: 'Vendor registry, contacts, and supplier performance.',
        icon: 'building-2',
        href: '/inventory-procurement/suppliers',
        permission: canRead.value,
    },
    {
        id: 'warehouses',
        title: 'Warehouses',
        description: 'Store locations, transfers, and warehouse lifecycle.',
        icon: 'building-2',
        href: '/inventory-procurement/warehouses',
        permission: canRead.value,
    },
]);

const planningTasks = computed<TaskCard[]>(() => [
    {
        id: 'msd',
        title: 'MSD orders',
        description: 'National Medical Store e-ordering and delivery sync.',
        icon: 'clipboard-list',
        href: workspaceSection('msd-orders'),
        permission: canRead.value && canCreateRequest.value,
    },
    {
        id: 'analytics',
        title: 'Analytics',
        description: 'ABC/VEN matrix, expiry wastage, turnover, and consumption trends.',
        icon: 'activity',
        href: workspaceSection('analytics'),
        permission: canRead.value,
    },
    {
        id: 'transfers',
        title: 'Transfers',
        description: 'Move stock between warehouses with pick slips and variance review.',
        icon: 'package',
        href: workspaceSection('transfers'),
        permission: canRead.value,
    },
]);

const sectionQuickLinks = computed(() =>
    (Object.keys(inventoryWorkspaceSectionLabels) as InventoryWorkspaceSection[]).map((section) => ({
        section,
        label: inventoryWorkspaceSectionLabels[section],
        href: workspaceSection(section),
    })),
);

onMounted(async () => {
    await loadPermissions();
    await loadDashboard();
});
</script>

<template>
    <Head title="Supply chain" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="package" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Hospital supply chain</h1>
                            <p class="text-xs text-muted-foreground">
                                Stores, procurement, and clinical consumables — start with a task below or open the full workspace.
                            </p>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="loading" @click="loadDashboard">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            {{ loading ? 'Refreshing…' : 'Refresh' }}
                        </Button>
                        <Button v-if="canRead" size="sm" class="h-8 gap-1.5" as-child>
                            <Link :href="INVENTORY_PROCUREMENT_WORKSPACE_PATH">
                                <AppIcon name="layout-grid" class="size-3.5" />
                                Full workspace
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            <Alert v-if="!canRead && !loading" variant="destructive">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription>You do not have permission to view hospital supply chain data.</AlertDescription>
            </Alert>

            <Alert v-else-if="error" variant="destructive">
                <AlertTitle>Overview unavailable</AlertTitle>
                <AlertDescription>{{ error }}</AlertDescription>
            </Alert>

            <template v-if="canRead">
                <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <template v-if="loading">
                        <Card v-for="n in 4" :key="n" class="rounded-lg shadow-sm">
                            <CardContent class="px-4 py-4">
                                <Skeleton class="h-4 w-24" />
                                <Skeleton class="mt-2 h-8 w-16" />
                            </CardContent>
                        </Card>
                    </template>
                    <template v-else>
                        <Card class="rounded-lg border-destructive/25 bg-destructive/5 shadow-sm">
                            <CardContent class="flex items-center gap-3 px-4 py-3">
                                <AppIcon name="alert-triangle" class="size-5 text-destructive" />
                                <div>
                                    <p class="text-[11px] font-medium uppercase tracking-wider text-destructive/80">Store out</p>
                                    <p class="text-2xl font-bold tabular-nums text-destructive">{{ stockCounts.outOfStock }}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card class="rounded-lg border-amber-200/70 bg-amber-50/50 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                            <CardContent class="flex items-center gap-3 px-4 py-3">
                                <AppIcon name="activity" class="size-5 text-amber-600 dark:text-amber-400" />
                                <div>
                                    <p class="text-[11px] font-medium uppercase tracking-wider text-amber-700/80 dark:text-amber-400/80">Store low</p>
                                    <p class="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{{ stockCounts.lowStock }}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card class="rounded-lg border-green-200/70 bg-green-50/50 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                            <CardContent class="flex items-center gap-3 px-4 py-3">
                                <AppIcon name="check-circle" class="size-5 text-green-600 dark:text-green-400" />
                                <div>
                                    <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/80 dark:text-green-400/80">Store healthy</p>
                                    <p class="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">{{ stockCounts.healthy }}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card class="rounded-lg shadow-sm">
                            <CardContent class="flex items-center gap-3 px-4 py-3">
                                <AppIcon name="package" class="size-5 text-muted-foreground" />
                                <div>
                                    <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Active items</p>
                                    <p class="text-2xl font-bold tabular-nums">{{ stockCounts.total }}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </template>
                </div>

                <div class="grid gap-4 lg:grid-cols-3">
                    <Card class="rounded-lg shadow-sm lg:col-span-2">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Store operations</CardTitle>
                            <CardDescription>Daily tasks for storekeepers and issuing clerks.</CardDescription>
                        </CardHeader>
                        <CardContent class="grid gap-3 sm:grid-cols-2">
                            <Link
                                v-for="task in storeTasks.filter((entry) => entry.permission)"
                                :key="task.id"
                                :href="task.href"
                                class="group flex flex-col rounded-lg border bg-muted/15 p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
                            >
                                <div class="flex items-start justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <AppIcon :name="task.icon" class="size-4 text-muted-foreground group-hover:text-primary" />
                                        <span class="text-sm font-medium">{{ task.title }}</span>
                                    </div>
                                    <Badge v-if="task.badge != null && task.badge !== 0" :variant="task.badgeVariant ?? 'secondary'" class="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                                        {{ task.badge }}
                                    </Badge>
                                </div>
                                <p class="mt-2 text-xs leading-relaxed text-muted-foreground">{{ task.description }}</p>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card class="rounded-lg shadow-sm">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Procurement signals</CardTitle>
                            <CardDescription>Queues needing officer attention.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-3 text-sm">
                            <div class="flex items-center justify-between rounded-md border px-3 py-2">
                                <span class="text-muted-foreground">Pending approval</span>
                                <Badge :variant="pendingApprovalCount > 0 ? 'destructive' : 'outline'">{{ pendingApprovalCount }}</Badge>
                            </div>
                            <div class="flex items-center justify-between rounded-md border px-3 py-2">
                                <span class="text-muted-foreground">Approved — place order</span>
                                <Badge variant="secondary">{{ approvedAwaitingOrderCount }}</Badge>
                            </div>
                            <div class="flex items-center justify-between rounded-md border px-3 py-2">
                                <span class="text-muted-foreground">Shortage — ready lines</span>
                                <Badge :variant="(shortageMeta?.readyLineCount ?? 0) > 0 ? 'destructive' : 'outline'">
                                    {{ shortageMeta?.readyLineCount ?? 0 }}
                                </Badge>
                            </div>
                            <Button v-if="canCreateRequest" size="sm" variant="outline" class="mt-1 w-full gap-1.5" as-child>
                                <Link :href="workspaceSection('procurement')">
                                    <AppIcon name="plus" class="size-3.5" />
                                    New procurement request
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div class="grid gap-4 lg:grid-cols-2">
                    <Card class="rounded-lg shadow-sm">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Master data</CardTitle>
                            <CardDescription>Items, suppliers, and warehouses.</CardDescription>
                        </CardHeader>
                        <CardContent class="grid gap-3 sm:grid-cols-3">
                            <Link
                                v-for="task in masterDataTasks.filter((entry) => entry.permission)"
                                :key="task.id"
                                :href="task.href"
                                class="rounded-lg border bg-muted/10 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/25"
                            >
                                <AppIcon :name="task.icon" class="mb-2 size-4 text-muted-foreground" />
                                <p class="font-medium">{{ task.title }}</p>
                                <p class="mt-1 text-xs text-muted-foreground">{{ task.description }}</p>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card class="rounded-lg shadow-sm">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Planning & national supply</CardTitle>
                            <CardDescription>MSD, analytics, and inter-store transfers.</CardDescription>
                        </CardHeader>
                        <CardContent class="grid gap-3 sm:grid-cols-3">
                            <Link
                                v-for="task in planningTasks.filter((entry) => entry.permission)"
                                :key="task.id"
                                :href="task.href"
                                class="rounded-lg border bg-muted/10 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/25"
                            >
                                <AppIcon :name="task.icon" class="mb-2 size-4 text-muted-foreground" />
                                <p class="font-medium">{{ task.title }}</p>
                                <p class="mt-1 text-xs text-muted-foreground">{{ task.description }}</p>
                            </Link>
                        </CardContent>
                    </Card>
                </div>

                <Card class="rounded-lg border-dashed shadow-sm">
                    <CardHeader class="pb-2">
                        <CardTitle class="text-sm font-medium text-muted-foreground">All workspace areas</CardTitle>
                    </CardHeader>
                    <CardContent class="flex flex-wrap gap-2">
                        <Button
                            v-for="link in sectionQuickLinks"
                            :key="link.section"
                            variant="outline"
                            size="sm"
                            class="h-8"
                            as-child
                        >
                            <Link :href="link.href">{{ link.label }}</Link>
                        </Button>
                    </CardContent>
                </Card>
            </template>
        </div>
    </AppLayout>
</template>
