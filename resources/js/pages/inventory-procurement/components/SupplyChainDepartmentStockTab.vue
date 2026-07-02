<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
                <div v-if="ws.canRead" class="flex min-h-0 flex-1 flex-col overflow-hidden">

                    <div
                        v-if="ws.departmentStockScopedItem"
                        class="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5"
                    >
                        <div class="min-w-0">
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Item trace</p>
                            <p class="truncate text-sm font-semibold">
                                {{ ws.departmentStockScopedItem.name }}
                                <span v-if="ws.departmentStockScopedItem.code" class="font-mono text-xs text-muted-foreground">({{ ws.departmentStockScopedItem.code }})</span>
                            </p>
                        </div>
                        <Button size="sm" variant="outline" class="h-8 shrink-0 rounded-lg text-xs" :disabled="ws.departmentStockLoading" @click="ws.clearDepartmentStockItemScope">
                            Clear item
                        </Button>
                    </div>

                    <!-- Info banner -->
                    <div class="flex items-start gap-3 border-b bg-sky-50/60 px-4 py-2.5 text-xs text-sky-800 dark:bg-sky-950/20 dark:text-sky-200">
                        <AppIcon name="info" class="mt-0.5 size-3.5 shrink-0 text-sky-500" />
                        <span>Store stock and department stock are intentionally separate. This view shows where issued stock went — consumption, returns and wastage come in the next operational layer.</span>
                    </div>

                    <ScrollArea class="max-h-[min(70vh,42rem)]">
                        <RegistryListSkeleton v-if="!ws.departmentStock.length && ws.departmentStockLoading" :count="5" />

                        <div v-else-if="!ws.departmentStock.length && !ws.departmentStockLoading" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="package" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div class="space-y-1">
                                <p class="text-sm font-semibold">No department stock recorded yet</p>
                                <p class="max-w-xs text-xs text-muted-foreground">Department stock appears after a requisition is issued from the store to a department.</p>
                            </div>
                        </div>

                        <div v-show="ws.departmentStock.length > 0" class="divide-y px-4" :class="{ 'opacity-40 pointer-events-none transition-opacity duration-200': ws.departmentStockLoading }">
                            <RegistryListRow
                                v-for="row in ws.departmentStock"
                                :key="row.id"
                                status-dot-class="bg-sky-500"
                                status-title="Department stock"
                                :primary-label="row.itemName || row.itemId"
                                :secondary-label="row.itemCode || row.itemId"
                                :meta="`${row.departmentName || 'Department'} · ${ws.formatAmount(row.issuedQuantity)} ${row.unit || ''} on hand · ${row.sourceWarehouseName || row.sourceWarehouseCode || 'Store not recorded'} · ${row.movementCount} movement${row.movementCount === 1 ? '' : 's'} · Last issued ${ws.formatDateTime(row.lastIssuedAt)}`"
                                :selectable="false"
                            >
                                <template #badges>
                                    <Badge variant="secondary" class="h-5 px-1.5 text-[10px]">
                                        {{ row.departmentName }}
                                    </Badge>
                                </template>
                                <template #actions>
                                    <Button
                                        v-if="row.itemId"
                                        size="sm"
                                        variant="outline"
                                        class="h-8 rounded-lg text-xs"
                                        @click="ws.openItemDetails({ id: row.itemId, itemName: row.itemName, itemCode: row.itemCode })"
                                    >
                                        View item
                                    </Button>
                                </template>
                            </RegistryListRow>
                        </div>
                    </ScrollArea>

                    <!-- Pagination -->
                    <footer v-if="ws.departmentStockPagination" class="flex shrink-0 items-center justify-between border-t px-4 py-3">
                        <p class="text-xs text-muted-foreground">
                            Showing {{ ws.departmentStock.length }} of {{ ws.departmentStockPagination.total ?? ws.departmentStock.length }}
                            · Page {{ ws.departmentStockPagination.currentPage }} of {{ ws.departmentStockPagination.lastPage }}
                        </p>
                        <div class="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 gap-1.5 text-xs"
                                :disabled="ws.departmentStockLoading || ws.departmentStockPagination.currentPage <= 1"
                                @click="ws.goToDepartmentStockPage(ws.departmentStockPagination.currentPage - 1)"
                            >
                                <AppIcon name="chevron-left" class="size-3.5" />
                                Previous
                            </Button>
                            <template v-for="pg in ws.departmentStockPages" :key="typeof pg === 'number' ? `ds-${pg}` : `ds-e-${Math.random()}`">
                                <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                <Button
                                    v-else
                                    size="sm"
                                    :variant="pg === ws.departmentStockPagination.currentPage ? 'default' : 'outline'"
                                    class="h-8 w-8 p-0 text-xs"
                                    :disabled="ws.departmentStockLoading"
                                    @click="ws.goToDepartmentStockPage(pg as number)"
                                >{{ pg }}</Button>
                            </template>
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 gap-1.5 text-xs"
                                :disabled="ws.departmentStockLoading || ws.departmentStockPagination.currentPage >= ws.departmentStockPagination.lastPage"
                                @click="ws.goToDepartmentStockPage(ws.departmentStockPagination.currentPage + 1)"
                            >
                                Next
                                <AppIcon name="chevron-right" class="size-3.5" />
                            </Button>
                        </div>
                    </footer>
                </div>
</template>


