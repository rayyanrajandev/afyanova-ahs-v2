<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatEnumLabel } from '@/lib/labels';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
    <div class="mt-0 flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <AppIcon name="package" class="size-4 text-muted-foreground" />
                </span>
                <div class="min-w-0">
                    <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">MSD Orders</p>
                    <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.msdOrderPagination?.total ?? ws.msdOrders.length }}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-blue-200/70 bg-blue-50/50 px-4 py-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                    <AppIcon name="activity" class="size-4 text-blue-600 dark:text-blue-400" />
                </span>
                <div class="min-w-0">
                    <p class="text-[11px] font-medium uppercase tracking-wider text-blue-700/70 dark:text-blue-400/70">Submitted</p>
                    <p class="text-xl font-bold leading-tight tabular-nums text-blue-700 dark:text-blue-300">{{ ws.msdOrders.filter((order) => ['submitted', 'acknowledged'].includes(order.status)).length }}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-amber-200/70 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                    <AppIcon name="clock" class="size-4 text-amber-600 dark:text-amber-400" />
                </span>
                <div class="min-w-0">
                    <p class="text-[11px] font-medium uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">Pending</p>
                    <p class="text-xl font-bold leading-tight tabular-nums text-amber-700 dark:text-amber-300">{{ ws.msdOrders.filter((order) => ['draft', 'pending', 'pending_submission'].includes(order.status)).length }}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-green-200/70 bg-green-50/50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                    <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                </span>
                <div class="min-w-0">
                    <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Fulfilled</p>
                    <p class="text-xl font-bold leading-tight tabular-nums text-green-700 dark:text-green-300">{{ ws.msdOrders.filter((order) => ['fulfilled', 'received', 'closed'].includes(order.status)).length }}</p>
                </div>
            </div>
        </div>

        <Card class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">
            <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                <div class="min-w-0">
                    <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                        <AppIcon name="package" class="size-4 text-muted-foreground" />
                        MSD Electronic Orders
                    </h3>
                    <p class="mt-1 text-xs text-muted-foreground">Create, submit, synchronize, and monitor Medical Stores Department supply orders.</p>
                </div>
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-9 gap-1.5 rounded-lg text-xs"
                        :disabled="ws.shortageMsdDraftLines.length === 0"
                        @click="ws.openMsdOrderFromDraft(ws.shortageMsdDraftLines, 'shortage queue')"
                    >
                        <AppIcon name="alert-triangle" class="size-3.5" />
                        Draft shortages
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-9 gap-1.5 rounded-lg text-xs"
                        :disabled="ws.lowStockMsdDraftLines.length === 0"
                        @click="ws.openMsdOrderFromDraft(ws.lowStockMsdDraftLines, 'low-stock reorder policy')"
                    >
                        <AppIcon name="package" class="size-3.5" />
                        Draft low stock
                    </Button>
                    <Button size="sm" class="h-9 gap-1.5 rounded-lg text-xs" @click="ws.openBlankMsdOrder">
                        <AppIcon name="plus" class="size-3.5" />
                        Blank order
                    </Button>
                </div>
            </div>

            <div class="flex items-center gap-2 border-b px-4 py-3">
                <SearchInput
                    v-model="ws.msdOrderSearch.q"
                    placeholder="Search order number, reference..."
                    class="min-w-0 flex-1 text-xs"
                    @keyup.enter="ws.msdOrderSearch.page = 1; ws.loadMsdOrders()"
                />
                <Select :model-value="ws.toSelectValue(ws.msdOrderSearch.status)" @update:model-value="val => { ws.msdOrderSearch.status = ws.fromSelectValue(String(val ?? ws.EMPTY_SELECT_VALUE)); ws.msdOrderSearch.page = 1; ws.loadMsdOrders() }">
                    <SelectTrigger class="h-9 w-44 rounded-lg text-xs">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">All statuses</SelectItem>
                        <SelectItem v-for="s in ws.MSD_ORDER_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground" @click="ws.msdOrderSearch.page = 1; ws.loadMsdOrders()">
                    <AppIcon name="refresh-cw" class="size-3.5" />
                    Refresh
                </Button>
            </div>

            <CardContent class="flex min-h-0 flex-1 flex-col p-0">
                <WorkflowQueueSkeleton v-if="ws.msdOrderLoading" :count="4" />
                <div
                    v-else-if="ws.msdOrders.length === 0"
                    class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                >
                    <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                        <AppIcon name="package" class="size-5 text-muted-foreground/40" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-semibold">No MSD orders found</p>
                        <p class="max-w-xs text-xs text-muted-foreground">MSD orders appear after public-sector procurement orders are created, submitted, or synchronized.</p>
                    </div>
                    <Button size="sm" class="mt-1 h-8 gap-1.5 rounded-lg text-xs" @click="ws.openBlankMsdOrder">
                        <AppIcon name="plus" class="size-3.5" />
                        Blank MSD order
                    </Button>
                </div>
                <div v-else-if="ws.msdOrders.length > 0" class="divide-y">
                    <WorkflowQueueRow
                        v-for="order in ws.msdOrders"
                        :key="order.id"
                        :stripe-class="ws.msdStatusBadgeClass(order.status).includes('red') ? 'bg-destructive' : ws.msdStatusBadgeClass(order.status).includes('green') ? 'bg-green-500' : ws.msdStatusBadgeClass(order.status).includes('amber') ? 'bg-amber-500' : ws.msdStatusBadgeClass(order.status).includes('blue') ? 'bg-blue-500' : 'bg-muted-foreground/30'"
                    >
                        <div class="min-w-0 space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="font-mono text-sm font-semibold">{{ order.msd_order_number }}</p>
                                <Badge :class="ws.msdStatusBadgeClass(order.status)">{{ formatEnumLabel(order.status) }}</Badge>
                            </div>
                            <p class="text-xs text-muted-foreground">
                                Facility {{ order.facility_msd_code || 'not set' }}
                                <span>&middot;</span>
                                {{ Array.isArray(order.order_lines) ? order.order_lines.length : 0 }} line{{ Array.isArray(order.order_lines) && order.order_lines.length === 1 ? '' : 's' }}
                                <span>&middot;</span>
                                Order {{ order.order_date || 'N/A' }}
                                <span>&middot;</span>
                                TZS {{ order.total_amount != null ? Number(order.total_amount).toLocaleString() : 'N/A' }}
                                <span>&middot;</span>
                                {{ order.submission_reference || 'Not submitted' }}
                            </p>
                        </div>
                        <template #actions>
                            <Button
                                v-if="order.submission_reference"
                                variant="outline"
                                size="sm"
                                class="h-7 gap-1.5 rounded-lg px-2.5 text-xs"
                                @click="ws.syncMsdOrderStatus(order.id)"
                            >
                                <AppIcon name="refresh-cw" class="size-3.5" />
                                Sync
                            </Button>
                        </template>
                    </WorkflowQueueRow>
                </div>
                <footer v-if="ws.msdOrderPagination && ws.msdOrderPagination.lastPage > 1" class="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
                    <span>Page {{ ws.msdOrderPagination.currentPage }} of {{ ws.msdOrderPagination.lastPage }}{{ ws.msdOrderPagination.total != null ? ` (${ws.msdOrderPagination.total} total)` : '' }}</span>
                    <div class="flex gap-1">
                        <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="ws.msdOrderPagination.currentPage <= 1" @click="ws.msdOrderSearch.page = ws.msdOrderPagination!.currentPage - 1; ws.loadMsdOrders()">Prev</Button>
                        <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="ws.msdOrderPagination.currentPage >= ws.msdOrderPagination.lastPage" @click="ws.msdOrderSearch.page = ws.msdOrderPagination!.currentPage + 1; ws.loadMsdOrders()">Next</Button>
                    </div>
                </footer>
            </CardContent>
        </Card>
    </div>
</template>
