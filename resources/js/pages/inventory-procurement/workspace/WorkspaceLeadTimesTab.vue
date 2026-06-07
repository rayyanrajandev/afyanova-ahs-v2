<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
    <Card v-if="ws.canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

        <!-- Header -->
        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
            <div class="min-w-0">
                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                    <AppIcon name="calendar-clock" class="size-4 text-muted-foreground" />
                    Supplier Lead Times
                </h3>
                <p class="mt-1 text-xs text-muted-foreground">Track delivery performance and lead times per supplier.</p>
            </div>
            <Button size="sm" class="h-9 gap-1.5 rounded-lg text-xs" @click="ws.createLeadTimeDialogOpen = true">
                <AppIcon name="plus" class="size-3.5" />
                Record Order
            </Button>
        </div>

        <!-- Toolbar -->
        <div class="flex items-center gap-2 border-b px-4 py-3">
            <Select
                :model-value="ws.toSelectValue(ws.leadTimeSearch.supplierId)"
                @update:model-value="ws.leadTimeSearch.supplierId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))"
            >
                <SelectTrigger class="h-9 min-w-0 flex-1 rounded-lg text-xs">
                    <SelectValue placeholder="Select supplier…">
                        {{ ws.supplierLabel(ws.leadTimeSearch.supplierId) || 'Select supplier…' }}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem :value="ws.EMPTY_SELECT_VALUE">All suppliers</SelectItem>
                    <SelectItem v-for="s in (ws.suppliers ?? [])" :key="s.id" :value="s.id" :text-value="ws.lookupOptionText(s)">{{ s.name }}</SelectItem>
                </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground" :disabled="ws.leadTimeLoading" @click="ws.leadTimeSearch.page = 1; ws.loadLeadTimes()">
                <AppIcon name="refresh-cw" class="size-3.5" />
                Refresh
            </Button>
        </div>

        <!-- Supplier performance KPI strip -->
        <div v-if="ws.supplierPerformance" class="grid grid-cols-2 gap-3 border-b px-4 py-3 sm:grid-cols-4">
            <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-3 py-2.5 shadow-sm">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <AppIcon name="calendar-clock" class="size-3.5 text-muted-foreground" />
                </span>
                <div>
                    <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Avg Lead</p>
                    <p class="text-base font-bold tabular-nums">{{ ws.supplierPerformance.avgLeadTimeDays ?? '—' }}<span class="ml-0.5 text-xs font-normal text-muted-foreground">d</span></p>
                </div>
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-3 py-2.5 shadow-sm">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <AppIcon name="check-circle" class="size-3.5 text-muted-foreground" />
                </span>
                <div>
                    <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fulfillment</p>
                    <p class="text-base font-bold tabular-nums">{{ ws.supplierPerformance.avgFulfillmentRate != null ? ws.supplierPerformance.avgFulfillmentRate + '%' : '—' }}</p>
                </div>
            </div>
        </div>

        <WorkflowQueueSkeleton v-if="ws.leadTimeLoading" :count="4" />

        <!-- No supplier selected -->
        <div
            v-else-if="!ws.leadTimeSearch.supplierId"
            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
        >
            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                <AppIcon name="calendar-clock" class="size-5 text-muted-foreground/40" />
            </div>
            <div>
                <p class="text-sm font-medium text-muted-foreground">Select a supplier</p>
                <p class="mt-0.5 text-xs text-muted-foreground/70">Choose a supplier to review lead-time performance, fulfillment variance, and receiving reliability.</p>
            </div>
        </div>

        <!-- Empty -->
        <div
            v-else-if="ws.leadTimes.length === 0"
            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
        >
            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                <AppIcon name="calendar-clock" class="size-5 text-muted-foreground/40" />
            </div>
            <p class="text-sm font-medium text-muted-foreground">No lead time records found</p>
            <p class="text-xs text-muted-foreground/70">Records appear after supplier orders are received and actual delivery dates are captured.</p>
        </div>

        <!-- Lead time rows -->
        <div v-else class="divide-y">
            <WorkflowQueueRow
                v-for="lt in ws.leadTimes"
                :key="lt.id"
                :stripe-class="lt.delivery_status === 'on_time' ? 'bg-green-500' : lt.delivery_status === 'late' ? 'bg-red-500' : lt.delivery_status === 'early' ? 'bg-sky-500' : 'bg-muted-foreground/30'"
            >
                <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-medium">{{ lt.order_date ? new Date(lt.order_date).toLocaleDateString() : '—' }}</span>
                        <span class="text-xs text-muted-foreground">→</span>
                        <span class="text-sm">{{ lt.actual_delivery_date ? new Date(lt.actual_delivery_date).toLocaleDateString() : lt.expected_delivery_date ? new Date(lt.expected_delivery_date).toLocaleDateString() : '—' }}</span>
                        <span
                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                            :class="ws.deliveryStatusBadge(lt.delivery_status)"
                        >
                            {{ (lt.delivery_status ?? 'pending').replace(/_/g, ' ') }}
                        </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>Lead: <strong class="text-foreground">{{ lt.actual_lead_time_days ?? lt.expected_lead_time_days ?? '—' }}d</strong></span>
                        <span v-if="lt.quantity_ordered != null">&middot; Ordered: <strong class="text-foreground">{{ lt.quantity_ordered }}</strong></span>
                        <span v-if="lt.quantity_received != null">&middot; Received: <strong class="text-foreground">{{ lt.quantity_received }}</strong></span>
                        <span v-if="lt.fulfillment_rate != null">&middot; Fulfillment: <strong class="text-foreground">{{ lt.fulfillment_rate }}%</strong></span>
                    </div>
                </div>
                <template #actions>
                    <Button
                        v-if="lt.delivery_status === 'pending'"
                        size="sm"
                        variant="outline"
                        class="h-7 rounded-lg px-2.5 text-xs"
                        @click="ws.openRecordDelivery(lt)"
                    >
                        Record delivery
                    </Button>
                </template>
            </WorkflowQueueRow>
        </div>

        <!-- Footer pagination -->
        <footer v-if="ws.leadTimePagination && ws.leadTimePagination.lastPage > 1" class="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2.5">
            <p class="text-xs text-muted-foreground">Page {{ ws.leadTimePagination.currentPage }}/{{ ws.leadTimePagination.lastPage }}{{ ws.leadTimePagination.total != null ? ` · ${ws.leadTimePagination.total} total` : '' }}</p>
            <div class="flex gap-1">
                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="ws.leadTimePagination.currentPage <= 1" @click="ws.leadTimeSearch.page = ws.leadTimePagination!.currentPage - 1; ws.loadLeadTimes()">
                    <AppIcon name="chevron-left" class="size-3.5" />
                    Prev
                </Button>
                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="ws.leadTimePagination.currentPage >= ws.leadTimePagination.lastPage" @click="ws.leadTimeSearch.page = ws.leadTimePagination!.currentPage + 1; ws.loadLeadTimes()">
                    Next
                    <AppIcon name="chevron-right" class="size-3.5" />
                </Button>
            </div>
        </footer>
    </Card>
</template>
