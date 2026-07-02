<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatEnumLabel } from '@/lib/labels';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
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
    </div>
</template>


