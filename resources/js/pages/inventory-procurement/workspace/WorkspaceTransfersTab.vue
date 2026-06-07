<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
<!-- Attention summary KPI chips (outside card) -->
                    <div v-if="ws.transferAttentionSummary.length > 0" class="flex flex-wrap gap-2">
                        <span
                            v-for="signal in ws.transferAttentionSummary"
                            :key="signal.label"
                            class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm"
                            :class="ws.transferAttentionBadgeClass(signal)"
                        >
                            {{ signal.label }}
                            <span class="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums font-bold">{{ signal.count }}</span>
                        </span>
                    </div>

                    <Card v-if="ws.canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                        <!-- Header -->
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="package" class="size-4 text-muted-foreground" />
                                    Warehouse Transfers
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Inter-store stock movement, pick, dispatch, and receipt tracking.</p>
                            </div>
                            <Button size="sm" class="h-9 gap-1.5 rounded-lg text-xs" @click="ws.createTransferDialogOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                New Transfer
                            </Button>
                        </div>

                        <!-- Toolbar -->
                        <div class="flex items-center gap-2 border-b px-4 py-3">
                            <div class="relative min-w-0 flex-1">
                                <svg class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                <input
                                    v-model="ws.transferSearch.q"
                                    class="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    placeholder="Search transfer number…"
                                    @keyup.enter="ws.transferSearch.page = 1; ws.loadWarehouseTransfers()"
                                />
                            </div>
                            <Select
                                :model-value="ws.toSelectValue(ws.transferSearch.status)"
                                @update:model-value="val => { ws.transferSearch.status = ws.fromSelectValue(String(val ?? ws.EMPTY_SELECT_VALUE)); ws.transferSearch.page = 1; ws.loadWarehouseTransfers() }"
                            >
                                <SelectTrigger class="h-9 w-36 shrink-0 rounded-lg text-xs">
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ws.EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                    <SelectItem v-for="s in ws.TRANSFER_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                :model-value="ws.toSelectValue(ws.transferSearch.varianceReview)"
                                @update:model-value="val => { ws.transferSearch.varianceReview = ws.fromSelectValue(String(val ?? ws.EMPTY_SELECT_VALUE)); ws.transferSearch.page = 1; ws.loadWarehouseTransfers() }"
                            >
                                <SelectTrigger class="h-9 w-40 shrink-0 rounded-lg text-xs">
                                    <SelectValue placeholder="Review queue" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="option in ws.TRANSFER_VARIANCE_REVIEW_FILTER_OPTIONS"
                                        :key="`trf-vr-${option.value || 'all'}`"
                                        :value="option.value || ws.EMPTY_SELECT_VALUE"
                                    >{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" class="h-9 gap-1.5 shrink-0 rounded-lg text-xs text-muted-foreground" :disabled="ws.transferLoading" @click="ws.transferSearch.page = 1; ws.loadWarehouseTransfers()">
                                <AppIcon name="refresh-cw" class="size-3.5" />
                                Refresh
                            </Button>
                        </div>

                        <WorkflowQueueSkeleton v-if="ws.transferLoading" :count="4" />

                        <!-- Empty -->
                        <div
                            v-else-if="ws.transfers.length === 0"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="package" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div>
                                <p class="text-sm font-medium text-muted-foreground">No warehouse transfers found</p>
                                <p class="mt-0.5 text-xs text-muted-foreground/70">Transfers appear after stock is requested, packed, dispatched, and received between store locations.</p>
                            </div>
                            <Button size="sm" variant="outline" class="mt-1 h-8 gap-1.5 rounded-lg text-xs" @click="ws.createTransferDialogOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                New Transfer
                            </Button>
                        </div>

                        <!-- Transfer rows -->
                        <div v-else class="divide-y">
                            <WorkflowQueueRow
                                v-for="t in ws.transfers"
                                :key="t.id"
                                :stripe-class="ws.transferStatusBadgeClass(t.status).includes('green') ? 'bg-green-500'
                                    : ws.transferStatusBadgeClass(t.status).includes('amber') ? 'bg-amber-500'
                                    : ws.transferStatusBadgeClass(t.status).includes('blue') ? 'bg-blue-500'
                                    : ws.transferStatusBadgeClass(t.status).includes('red') ? 'bg-red-500'
                                    : 'bg-muted-foreground/30'"
                            >
                                <div class="min-w-0 space-y-1">
                                    <!-- Row 1: number + priority + status badges -->
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="font-mono text-sm font-semibold">{{ t.transfer_number }}</span>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="ws.transferPriorityBadge(t.priority)"
                                        >{{ t.priority }}</span>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="ws.transferStatusBadgeClass(t.status)"
                                        >{{ (t.status ?? '').replace(/_/g, ' ') }}</span>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="ws.transferReservationStateBadgeClass(t.reservationSummary?.state)"
                                        >{{ ws.transferReservationSummaryLabel(t) }}</span>
                                        <span
                                            v-if="ws.transferCanOpenVarianceReview(t) && ws.transferVarianceReviewState(t) === 'reviewed'"
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="ws.transferVarianceReviewBadgeClass(ws.transferVarianceReviewState(t))"
                                        >{{ ws.transferVarianceReviewStateLabel(ws.transferVarianceReviewState(t)) }}</span>
                                    </div>
                                    <!-- Row 2: route + pick summary -->
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span class="font-medium text-foreground">{{ ws.warehouseLabel(t.source_warehouse_id) ?? 'Unknown' }} → {{ ws.warehouseLabel(t.destination_warehouse_id) ?? 'Unknown' }}</span>
                                        <span v-if="ws.transferPickSummaryLabel(t)">&middot; {{ ws.transferPickSummaryLabel(t) }}</span>
                                        <span v-if="t.lines?.length">&middot; <strong class="text-foreground">{{ t.lines.length }}</strong> line{{ t.lines.length !== 1 ? 's' : '' }}</span>
                                        <span v-if="t.reason" class="max-w-xs truncate">&middot; {{ t.reason }}</span>
                                        <span>&middot; {{ t.created_at ? new Date(t.created_at).toLocaleDateString() : '—' }}</span>
                                    </div>
                                    <!-- Row 3: attention signals -->
                                    <div v-if="ws.transferAttentionSignals(t).length > 0" class="mt-1.5 flex flex-wrap items-center gap-1">
                                        <span
                                            v-for="signal in ws.transferAttentionSignals(t)"
                                            :key="signal.key"
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                            :class="ws.transferAttentionBadgeClass(signal)"
                                        >{{ signal.label }}</span>
                                    </div>
                                </div>
                                <template #actions>
                                    <Button
                                        v-for="ns in (ws.TRANSFER_ACTION_TRANSITIONS[t.status] ?? [])"
                                        :key="ns"
                                        size="sm"
                                        variant="outline"
                                        class="h-7 rounded-lg px-2.5 text-xs"
                                        @click="ws.openTransferStatusDialog(t, ns)"
                                    >{{ ws.transferActionLabel(ns) }}</Button>
                                    <Button
                                        v-if="ws.transferCanOpenVarianceReview(t)"
                                        size="sm"
                                        variant="outline"
                                        class="h-7 rounded-lg px-2.5 text-xs"
                                        @click="ws.openTransferVarianceReviewDialog(t)"
                                    >{{ ws.transferVarianceReviewButtonLabel(t) }}</Button>
                                    <DropdownMenu v-if="ws.transferCanOpenPickSlip(t) || ws.transferCanOpenDispatchNote(t)">
                                        <DropdownMenuTrigger as-child>
                                            <Button size="sm" variant="ghost" class="h-7 rounded-lg px-2 text-xs">
                                                <AppIcon name="clipboard-list" class="size-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" class="w-48">
                                            <DropdownMenuItem v-if="ws.transferCanOpenPickSlip(t)" @click="ws.openTransferPickSlip(t)">
                                                <AppIcon name="clipboard-list" class="mr-2 size-3.5" />
                                                Pick slip
                                            </DropdownMenuItem>
                                            <DropdownMenuItem v-if="ws.transferCanOpenDispatchNote(t)" @click="ws.openTransferDispatchNote(t)">
                                                <AppIcon name="file-text" class="mr-2 size-3.5" />
                                                Dispatch note
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </template>
                            </WorkflowQueueRow>
                        </div>

                        <!-- Footer pagination -->
                        <footer v-if="ws.transferPagination && ws.transferPagination.lastPage > 1" class="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2.5">
                            <p class="text-xs text-muted-foreground">Page {{ ws.transferPagination.currentPage }}/{{ ws.transferPagination.lastPage }}{{ ws.transferPagination.total != null ? ` · ${ws.transferPagination.total} total` : '' }}</p>
                            <div class="flex gap-1">
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="ws.transferPagination.currentPage <= 1" @click="ws.transferSearch.page = ws.transferPagination!.currentPage - 1; ws.loadWarehouseTransfers()">
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Prev
                                </Button>
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="ws.transferPagination.currentPage >= ws.transferPagination.lastPage" @click="ws.transferSearch.page = ws.transferPagination!.currentPage + 1; ws.loadWarehouseTransfers()">
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </Card>
</template>
