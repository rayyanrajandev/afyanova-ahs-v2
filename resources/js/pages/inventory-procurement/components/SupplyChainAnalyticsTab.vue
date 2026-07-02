<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppIconName } from '@/lib/icons';
import { formatEnumLabel } from '@/lib/labels';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();

const analyticsRefreshIcon = computed<AppIconName>(() => (ws.analyticsLoading ? 'loader-circle' : 'refresh-cw'));
const maxConsumptionIssued = computed(() =>
    Math.max(
        ...ws.consumptionTrends.map((row: any) => Number(row.totalIssued ?? 0)),
        1,
    ),
);

const consumptionOpen = ref(false);
const classificationOpen = ref(false);
const expiryOpen = ref(false);
const turnoverOpen = ref(false);
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Collapsible v-model:open="consumptionOpen" class="rounded-lg border bg-card">
            <CollapsibleTrigger as-child>
                <button class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/50">
                    <div class="min-w-0">
                        <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                            <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            Consumption Trends
                        </h3>
                        <p class="mt-1 text-xs text-muted-foreground">Issue movements aggregated over time.</p>
                    </div>
                    <AppIcon :name="consumptionOpen ? 'chevron-down' : 'chevron-right'" class="size-4 shrink-0 text-muted-foreground" />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent class="border-t px-4 pb-4 pt-3">
                <div class="mb-3 flex flex-wrap items-center gap-2">
                    <Select :model-value="ws.toSelectValue(ws.consumptionGranularity)" @update:model-value="ws.consumptionGranularity = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="h-9 w-36 rounded-lg text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select :model-value="String(ws.consumptionDays)" @update:model-value="ws.consumptionDays = Number($event)">
                        <SelectTrigger class="h-9 w-32 rounded-lg text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" class="h-9 rounded-lg text-xs" @click="ws.loadConsumptionTrends()">Apply</Button>
                </div>
                <div v-if="!ws.consumptionTrends.length" class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                    <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                        <AppIcon name="activity" class="size-5 text-muted-foreground/40" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-semibold">No consumption data available</p>
                        <p class="max-w-xs text-xs text-muted-foreground">Click Refresh or post stock issue movements to populate consumption trends.</p>
                    </div>
                </div>
                <div v-else class="overflow-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b text-left text-xs text-muted-foreground">
                                <th class="pb-2 pr-4 font-medium">Period</th>
                                <th class="pb-2 pr-4 font-medium text-right">Total Issued</th>
                                <th class="pb-2 pr-4 font-medium text-right">Movements</th>
                                <th class="pb-2 font-medium">Bar</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in ws.consumptionTrends" :key="row.period" class="border-b last:border-0">
                                <td class="py-1.5 pr-4 text-xs font-medium">{{ row.period }}</td>
                                <td class="py-1.5 pr-4 text-right text-xs">{{ Number(row.totalIssued).toLocaleString() }}</td>
                                <td class="py-1.5 pr-4 text-right text-xs">{{ row.movementCount }}</td>
                                <td class="py-1.5">
                                    <div class="h-3 rounded bg-blue-200 dark:bg-blue-800" :style="{ width: Math.min(100, (Number(row.totalIssued ?? 0) / maxConsumptionIssued) * 100) + '%' }"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CollapsibleContent>
        </Collapsible>

        <Collapsible v-model:open="classificationOpen" class="rounded-lg border bg-card">
            <CollapsibleTrigger as-child>
                <button class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/50">
                    <div class="min-w-0">
                        <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                            <AppIcon name="layout-grid" class="size-4 text-muted-foreground" />
                            ABC/VEN Matrix
                        </h3>
                        <p class="mt-1 text-xs text-muted-foreground">Items classified by value (ABC) and essentiality (VEN).</p>
                    </div>
                    <AppIcon :name="classificationOpen ? 'chevron-down' : 'chevron-right'" class="size-4 shrink-0 text-muted-foreground" />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent class="border-t px-4 pb-4 pt-3">
                <div v-if="!ws.abcVenMatrix.length" class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                    <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                        <AppIcon name="layout-grid" class="size-5 text-muted-foreground/40" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-semibold">No classification data available</p>
                        <p class="max-w-xs text-xs text-muted-foreground">Click Refresh after inventory items have stock, movement, and essentiality metadata.</p>
                    </div>
                </div>
                <div v-else class="overflow-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b text-left text-xs text-muted-foreground">
                                <th class="pb-2 pr-4 font-medium">ABC</th>
                                <th class="pb-2 pr-4 font-medium">VEN</th>
                                <th class="pb-2 pr-4 font-medium text-right">Items</th>
                                <th class="pb-2 pr-4 font-medium text-right">Total Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(cell, i) in ws.abcVenMatrix" :key="i" class="border-b last:border-0">
                                <td class="py-1.5 pr-4"><Badge variant="outline">{{ cell.abc }}</Badge></td>
                                <td class="py-1.5 pr-4"><Badge variant="outline">{{ cell.ven }}</Badge></td>
                                <td class="py-1.5 pr-4 text-right text-xs font-medium">{{ cell.itemCount }}</td>
                                <td class="py-1.5 pr-4 text-right text-xs">{{ Number(cell.totalStock).toLocaleString() }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CollapsibleContent>
        </Collapsible>

        <Collapsible v-model:open="expiryOpen" class="rounded-lg border bg-card">
            <CollapsibleTrigger as-child>
                <button class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/50">
                    <div class="min-w-0">
                        <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                            <AppIcon name="alert-triangle" class="size-4 text-muted-foreground" />
                            Expiry Wastage Tracking
                        </h3>
                        <p class="mt-1 text-xs text-muted-foreground">Batches that are expired, near-expiry, or approaching expiry.</p>
                    </div>
                    <AppIcon :name="expiryOpen ? 'chevron-down' : 'chevron-right'" class="size-4 shrink-0 text-muted-foreground" />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent class="border-t px-4 pb-4 pt-3">
                <div v-if="!ws.expiryWastage" class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                    <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                        <AppIcon name="alert-triangle" class="size-5 text-muted-foreground/40" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-semibold">No expiry data available</p>
                        <p class="max-w-xs text-xs text-muted-foreground">Click Refresh after batch, lot, and expiry dates have been captured.</p>
                    </div>
                </div>
                <template v-else>
                    <div class="mb-4 grid gap-3 sm:grid-cols-3">
                        <div class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                            <p class="text-2xl font-bold text-destructive">{{ ws.expiryWastage.summary.expiredCount }}</p>
                            <p class="text-xs text-muted-foreground">Expired Batches</p>
                            <p v-if="ws.expiryWastage.summary.expiredTotalValue" class="mt-1 text-xs font-medium text-destructive">TZS {{ Number(ws.expiryWastage.summary.expiredTotalValue).toLocaleString() }}</p>
                        </div>
                        <div class="rounded-lg border border-orange-400/30 bg-orange-50 p-3 text-center dark:bg-orange-950/20">
                            <p class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ ws.expiryWastage.summary.criticalCount }}</p>
                            <p class="text-xs text-muted-foreground">Critical (<=30 days)</p>
                            <p v-if="ws.expiryWastage.summary.criticalTotalValue" class="mt-1 text-xs font-medium text-orange-600 dark:text-orange-400">TZS {{ Number(ws.expiryWastage.summary.criticalTotalValue).toLocaleString() }}</p>
                        </div>
                        <div class="rounded-lg border border-yellow-400/30 bg-yellow-50 p-3 text-center dark:bg-yellow-950/20">
                            <p class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{{ ws.expiryWastage.summary.warningCount }}</p>
                            <p class="text-xs text-muted-foreground">Warning (<=90 days)</p>
                            <p v-if="ws.expiryWastage.summary.warningTotalValue" class="mt-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">TZS {{ Number(ws.expiryWastage.summary.warningTotalValue).toLocaleString() }}</p>
                        </div>
                    </div>
                    <div v-if="ws.expiryWastage.expired.length" class="mb-3">
                        <h4 class="mb-2 text-sm font-medium text-destructive">Expired Batches</h4>
                        <div class="overflow-auto">
                            <table class="w-full text-xs">
                                <thead><tr class="border-b text-left text-muted-foreground"><th class="pb-1 pr-3 font-medium">Batch</th><th class="pb-1 pr-3 font-medium">Expiry</th><th class="pb-1 pr-3 font-medium text-right">Qty</th><th class="pb-1 pr-3 font-medium text-right">Waste Value</th></tr></thead>
                                <tbody>
                                    <tr v-for="b in ws.expiryWastage.expired.slice(0, 20)" :key="b.id" class="border-b last:border-0">
                                        <td class="py-1 pr-3">{{ b.batchNumber }}</td>
                                        <td class="py-1 pr-3 text-destructive">{{ b.expiryDate }}</td>
                                        <td class="py-1 pr-3 text-right">{{ b.quantity }}</td>
                                        <td class="py-1 pr-3 text-right">{{ b.estimatedWasteValue != null ? Number(b.estimatedWasteValue).toLocaleString() : '—' }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template>
            </CollapsibleContent>
        </Collapsible>

        <Collapsible v-model:open="turnoverOpen" class="rounded-lg border bg-card">
            <CollapsibleTrigger as-child>
                <button class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/50">
                    <div class="min-w-0">
                        <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                            <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            Stock Turnover
                        </h3>
                        <p class="mt-1 text-xs text-muted-foreground">Consumption rate vs. current stock levels over 90 days.</p>
                    </div>
                    <AppIcon :name="turnoverOpen ? 'chevron-down' : 'chevron-right'" class="size-4 shrink-0 text-muted-foreground" />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent class="border-t px-4 pb-4 pt-3">
                <div v-if="!ws.stockTurnover.length" class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                    <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                        <AppIcon name="activity" class="size-5 text-muted-foreground/40" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-semibold">No turnover data available</p>
                        <p class="max-w-xs text-xs text-muted-foreground">Click Refresh after stock issues are recorded against inventory items.</p>
                    </div>
                </div>
                <div v-else class="overflow-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b text-left text-xs text-muted-foreground">
                                <th class="pb-2 pr-4 font-medium">Item</th>
                                <th class="pb-2 pr-4 font-medium">Category</th>
                                <th class="pb-2 pr-4 font-medium text-right">Stock</th>
                                <th class="pb-2 pr-4 font-medium text-right">Issued (90d)</th>
                                <th class="pb-2 pr-4 font-medium text-right">Turnover</th>
                                <th class="pb-2 pr-4 font-medium text-right">Days of Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in ws.stockTurnover.slice(0, 50)" :key="item.itemId" class="border-b last:border-0">
                                <td class="py-1.5 pr-4">
                                    <div class="text-xs font-medium">{{ item.itemName }}</div>
                                    <div class="text-[10px] text-muted-foreground">{{ item.itemCode }}</div>
                                </td>
                                <td class="py-1.5 pr-4 text-xs">{{ item.category ? formatEnumLabel(item.category) : '—' }}</td>
                                <td class="py-1.5 pr-4 text-right text-xs">{{ Number(item.currentStock).toLocaleString() }}</td>
                                <td class="py-1.5 pr-4 text-right text-xs">{{ Number(item.totalIssued).toLocaleString() }}</td>
                                <td class="py-1.5 pr-4 text-right text-xs font-medium">{{ item.turnoverRate }}×</td>
                                <td class="py-1.5 pr-4 text-right text-xs">{{ item.daysOfStock != null ? item.daysOfStock + 'd' : 'N/A' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CollapsibleContent>
        </Collapsible>
    </div>
</template>
