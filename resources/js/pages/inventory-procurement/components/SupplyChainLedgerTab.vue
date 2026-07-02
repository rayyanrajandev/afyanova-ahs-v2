<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatEnumLabel } from '@/lib/labels';
import { stockMovementStripeClass } from '@/lib/listRows';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
                <div v-if="ws.canRead" class="flex min-h-0 flex-1 flex-col overflow-hidden">

                        <!-- Movement rows -->
                        <ScrollArea class="max-h-[min(70vh,42rem)]">
                            <WorkflowQueueSkeleton v-if="!ws.stockMovements.length && ws.stockLedgerLoading" :count="5" />

                            <div
                                v-else-if="!ws.stockMovements.length && !ws.stockLedgerLoading"
                                class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                            >
                                <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                    <AppIcon name="activity" class="size-5 text-muted-foreground/40" />
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-muted-foreground">No stock movements found</p>
                                    <p class="mt-0.5 text-xs text-muted-foreground/70">Movements appear after receipts, issues, adjustments, ws.transfers, or reconciliations.</p>
                                </div>
                                <button class="text-xs text-muted-foreground underline-offset-2 hover:underline" @click="ws.resetStockLedgerFilters">Clear filters</button>
                            </div>

                            <div v-show="ws.stockMovements.length > 0" class="divide-y" :class="{ 'opacity-40 pointer-events-none transition-opacity duration-200': ws.stockLedgerLoading }">
                                <WorkflowQueueRow
                                v-for="movement in ws.stockMovements"
                                :key="movement.id"
                                :stripe-class="stockMovementStripeClass(movement.movementType)"
                            >
                                <template #leading>
                                    <span
                                        class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
                                        :class="movement.movementType === 'receive' ? 'bg-green-100 dark:bg-green-900/40' : movement.movementType === 'issue' ? 'bg-amber-100 dark:bg-amber-900/40' : movement.movementType === 'adjust' ? 'bg-blue-100 dark:bg-blue-900/40' : movement.movementType === 'transfer' ? 'bg-sky-100 dark:bg-sky-900/40' : 'bg-muted/60'"
                                    >
                                        <AppIcon
                                            :name="movement.movementType === 'receive' ? 'arrow-right' : movement.movementType === 'issue' ? 'package' : movement.movementType === 'adjust' ? 'sliders-horizontal' : movement.movementType === 'transfer' ? 'arrow-right' : 'activity'"
                                            class="size-4"
                                            :class="movement.movementType === 'receive' ? 'text-green-600 dark:text-green-400' : movement.movementType === 'issue' ? 'text-amber-600 dark:text-amber-400' : movement.movementType === 'adjust' ? 'text-blue-600 dark:text-blue-400' : movement.movementType === 'transfer' ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'"
                                        />
                                    </span>
                                </template>
                                <div class="min-w-0 space-y-1">
                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                        <p class="text-sm font-medium leading-tight">{{ movement.item?.itemName || movement.itemId }}</p>
                                        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                                            <span
                                                class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                                :class="movement.movementType === 'receive' ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/30' : movement.movementType === 'issue' ? 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/30' : movement.movementType === 'adjust' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30' : movement.movementType === 'transfer' ? 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-900/30 dark:text-sky-400 dark:ring-sky-500/30' : 'bg-muted text-muted-foreground ring-border'"
                                            >
                                                {{ formatEnumLabel(movement.movementType) }}
                                            </span>
                                            <span v-if="movement.sourceLabel" class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                                {{ movement.sourceLabel }}
                                            </span>
                                        </div>
                                    </div>
                                    <!-- Timestamp + reason -->
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span>{{ movement.item?.itemCode || movement.itemId }}</span>
                                        <span>&middot;</span>
                                        <span>{{ ws.formatDateTime(movement.occurredAt || movement.createdAt) }}</span>
                                        <span v-if="movement.reason">&middot; {{ movement.reason }}</span>
                                    </div>
                                    <!-- Stock before/after -->
                                    <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span>Qty: <strong class="text-foreground">{{ movement.quantity }}</strong></span>
                                        <span>Before: <strong class="text-foreground">{{ movement.stockBefore }}</strong></span>
                                        <span>&rarr;</span>
                                        <span>After: <strong class="text-foreground">{{ movement.stockAfter }}</strong></span>
                                        <span v-if="ws.stockMovementSourceSummary(movement)" class="text-muted-foreground/70">&middot; {{ ws.stockMovementSourceSummary(movement) }}</span>
                                    </div>
                                    <!-- Reconciliation detail -->
                                    <div v-if="movement.reconciliation" class="mt-1 text-xs text-muted-foreground">
                                        Expected {{ movement.reconciliation.expectedStock }} &middot; Counted {{ movement.reconciliation.countedStock }} &middot; Variance {{ movement.reconciliation.varianceQuantity }}
                                    </div>
                                    <p v-if="movement.notes" class="mt-1 text-xs italic text-muted-foreground/70">{{ movement.notes }}</p>
                                </div>
                                <template #trailing>
                                    <span
                                        class="mt-0.5 shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums"
                                        :class="(movement.quantityDelta ?? 0) > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : (movement.quantityDelta ?? 0) < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-muted text-muted-foreground'"
                                    >
                                        {{ (movement.quantityDelta ?? 0) > 0 ? '+' : '' }}{{ movement.quantityDelta ?? 0 }}
                                    </span>
                                </template>
                            </WorkflowQueueRow>
                            </div>
                        </ScrollArea>

                        <!-- Footer pagination -->
                        <footer class="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5">
                            <p class="text-xs text-muted-foreground">
                                {{ ws.stockMovements.length }} of {{ ws.stockMovementPagination?.total ?? ws.stockMovements.length }} &middot; Page {{ ws.stockMovementPagination?.currentPage ?? 1 }}/{{ ws.stockMovementPagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs"
                                    :disabled="ws.stockLedgerLoading || !ws.stockMovementPagination || ws.stockMovementPagination.currentPage <= 1"
                                    @click="ws.goToStockLedgerPage((ws.stockMovementPagination?.currentPage ?? 2) - 1)"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Prev
                                </Button>
                                <template v-for="pg in ws.stockLedgerPages" :key="typeof pg === 'number' ? `sl-${pg}` : `sl-e-${Math.random()}`">
                                    <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                    <Button
                                        v-else size="sm"
                                        :variant="pg === (ws.stockMovementPagination?.currentPage ?? 1) ? 'default' : 'outline'"
                                        class="h-8 w-8 rounded-lg p-0 text-xs"
                                        :disabled="ws.stockLedgerLoading"
                                        @click="ws.goToStockLedgerPage(pg as number)"
                                    >
                                        {{ pg }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs"
                                    :disabled="ws.stockLedgerLoading || !ws.stockMovementPagination || ws.stockMovementPagination.currentPage >= ws.stockMovementPagination.lastPage"
                                    @click="ws.goToStockLedgerPage((ws.stockMovementPagination?.currentPage ?? 0) + 1)"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </div>
</template>


