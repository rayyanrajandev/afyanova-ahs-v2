<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatEnumLabel } from '@/lib/labels';
import { stockMovementStripeClass } from '@/lib/listRows';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
<!-- KPI stat strip -->
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            </span>
                            <div>
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Movements</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.stockLedgerSummary.total ?? '—' }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                                <AppIcon name="arrow-right" class="size-4 text-green-600 dark:text-green-400" />
                            </span>
                            <div>
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Receipts</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.stockLedgerSummary.receive ?? '—' }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                                <AppIcon name="package" class="size-4 text-amber-600 dark:text-amber-400" />
                            </span>
                            <div>
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Issues</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.stockLedgerSummary.issue ?? '—' }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            </span>
                            <div>
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Net Qty Δ</p>
                                <p
                                    class="text-xl font-bold leading-tight tabular-nums"
                                    :class="(ws.stockLedgerSummary.netQuantityDelta ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : (ws.stockLedgerSummary.netQuantityDelta ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : ''"
                                >
                                    {{ ws.stockLedgerSummary.netQuantityDelta ?? '—' }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Card v-if="ws.canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                        <!-- Header -->
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                    Stock Ledger
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Receive, issue, adjustment, transfer, and reconciliation movements.</p>
                            </div>
                            <div class="flex shrink-0 items-center gap-2">
                                <Button
                                    variant="outline" size="sm"
                                    class="h-9 gap-1.5 rounded-lg text-xs md:hidden"
                                    @click="ws.mobileLedgerDrawerOpen = true"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Filters
                                </Button>
                                <Button
                                    variant="outline" size="sm"
                                    class="h-9 gap-1.5 rounded-lg text-xs"
                                    :disabled="ws.stockLedgerLoading"
                                    @click="ws.exportStockLedgerCsv"
                                >
                                    <AppIcon name="file-text" class="size-3.5" />
                                    Export CSV
                                </Button>
                                <Button
                                    :variant="ws.stockLedgerFiltersOpen ? 'default' : 'outline'" size="sm"
                                    class="hidden h-9 gap-1.5 rounded-lg text-xs md:inline-flex"
                                    :disabled="ws.stockLedgerLoading"
                                    @click="ws.stockLedgerFiltersOpen = !ws.stockLedgerFiltersOpen"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Filters
                                </Button>
                            </div>
                        </div>

                        <!-- Main toolbar -->
                        <div class="flex items-center gap-2 border-b px-4 py-3">
                            <div class="relative min-w-0 flex-1">
                                <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    v-model="ws.stockLedgerFilters.q"
                                    class="h-9 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    placeholder="Search item, reason, notes, reference…"
                                    @keydown.enter="ws.applyStockLedgerFilters"
                                />
                            </div>
                            <Select
                                :model-value="ws.toSelectValue(ws.stockLedgerFilters.movementType)"
                                @update:model-value="ws.stockLedgerFilters.movementType = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))"
                            >
                                <SelectTrigger class="h-9 w-44 rounded-lg text-xs">
                                    <SelectValue placeholder="All types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ws.EMPTY_SELECT_VALUE">All types</SelectItem>
                                    <SelectItem v-for="opt in ws.movementTypeOptions" :key="`lt-${opt}`" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                :model-value="ws.toSelectValue(ws.stockLedgerFilters.sourceKey)"
                                @update:model-value="ws.stockLedgerFilters.sourceKey = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))"
                            >
                                <SelectTrigger class="h-9 w-48 rounded-lg text-xs">
                                    <SelectValue placeholder="All sources" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in ws.stockLedgerSourceOptions" :key="`ls-${option.value || 'all'}`" :value="ws.toSelectValue(option.value)">{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground" :disabled="ws.stockLedgerLoading" @click="ws.applyStockLedgerFilters">
                                <AppIcon name="refresh-cw" class="size-3.5" />
                                Refresh
                            </Button>
                        </div>

                        <!-- Advanced filters panel (collapsible) -->
                        <div v-if="ws.stockLedgerFiltersOpen" class="grid gap-3 border-b bg-muted/20 px-4 py-3 md:grid-cols-4">
                            <div class="grid gap-1">
                                <label class="text-xs font-medium text-muted-foreground">Item ID</label>
                                <input
                                    v-model="ws.stockLedgerFilters.itemId"
                                    class="h-9 rounded-lg border border-input bg-transparent px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    placeholder="Inventory item UUID"
                                />
                            </div>
                            <div class="grid gap-1">
                                <label class="text-xs font-medium text-muted-foreground">Actor Type</label>
                                <Select
                                    :model-value="ws.toSelectValue(ws.stockLedgerFilters.actorType)"
                                    @update:model-value="ws.stockLedgerFilters.actorType = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))"
                                >
                                    <SelectTrigger class="h-9 rounded-lg text-xs">
                                        <SelectValue placeholder="All actors" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="option in ws.auditActorTypeOptions" :key="`la-${option.value || 'all'}`" :value="ws.toSelectValue(option.value)">{{ option.label }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-1">
                                <label class="text-xs font-medium text-muted-foreground">From</label>
                                <input
                                    v-model="ws.stockLedgerFilters.from"
                                    type="datetime-local"
                                    class="h-9 rounded-lg border border-input bg-transparent px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </div>
                            <div class="grid gap-1">
                                <label class="text-xs font-medium text-muted-foreground">To</label>
                                <input
                                    v-model="ws.stockLedgerFilters.to"
                                    type="datetime-local"
                                    class="h-9 rounded-lg border border-input bg-transparent px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </div>
                            <div class="flex items-end gap-2 md:col-span-4">
                                <Button size="sm" class="h-9 rounded-lg text-xs" :disabled="ws.stockLedgerLoading" @click="ws.applyStockLedgerFilters">
                                    {{ ws.stockLedgerLoading ? 'Applying…' : 'Apply Filters' }}
                                </Button>
                                <Button size="sm" variant="outline" class="h-9 rounded-lg text-xs" :disabled="ws.stockLedgerLoading" @click="ws.resetStockLedgerFilters">
                                    Reset
                                </Button>
                            </div>
                        </div>

                        <!-- Active filter chips -->
                        <div
                            v-if="ws.stockLedgerFilters.q || ws.stockLedgerFilters.movementType || ws.stockLedgerFilters.sourceKey || ws.stockLedgerFilters.from || ws.stockLedgerFilters.to || ws.stockLedgerFilters.itemId"
                            class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2"
                        >
                            <span class="text-[11px] text-muted-foreground">Filters:</span>
                            <button v-if="ws.stockLedgerFilters.q" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80" @click="ws.stockLedgerFilters.q = ''; ws.applyStockLedgerFilters()">
                                "{{ ws.stockLedgerFilters.q }}" <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button v-if="ws.stockLedgerFilters.movementType" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80" @click="ws.stockLedgerFilters.movementType = ''; ws.applyStockLedgerFilters()">
                                {{ formatEnumLabel(ws.stockLedgerFilters.movementType) }} <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button v-if="ws.stockLedgerFilters.sourceKey" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80" @click="ws.stockLedgerFilters.sourceKey = ''; ws.applyStockLedgerFilters()">
                                {{ ws.stockLedgerSourceOptions.find(o => o.value === ws.stockLedgerFilters.sourceKey)?.label ?? ws.stockLedgerFilters.sourceKey }} <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button v-if="ws.stockLedgerFilters.from || ws.stockLedgerFilters.to" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80" @click="ws.stockLedgerFilters.from = ''; ws.stockLedgerFilters.to = ''; ws.applyStockLedgerFilters()">
                                Date range <AppIcon name="circle-x" class="size-3" />
                            </button>
                        </div>

                        <!-- Skeleton loader -->
                        <WorkflowQueueSkeleton v-if="ws.stockLedgerLoading" :count="5" />

                        <!-- Empty state -->
                        <div
                            v-else-if="ws.stockMovements.length === 0"
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

                        <!-- Movement rows -->
                        <div v-else class="divide-y">
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
                    </Card>

                    <!-- Access restricted -->
                    <Card v-else class="rounded-lg border-sidebar-border/70">
                        <div class="flex items-start gap-3 border-b px-4 py-3.5">
                            <AppIcon name="activity" class="mt-0.5 size-4 text-muted-foreground" />
                            <div>
                                <p class="text-sm font-semibold">Stock Ledger</p>
                                <p class="text-xs text-muted-foreground">Stock ledger access is permission restricted.</p>
                            </div>
                        </div>
                        <div class="px-4 py-4">
                            <div class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                                <AppIcon name="alert-triangle" class="mt-0.5 size-4 shrink-0" />
                                <span>Access restricted — request <code>inventory.procurement.read</code> permission.</span>
                            </div>
                        </div>
                    </Card>
</template>
