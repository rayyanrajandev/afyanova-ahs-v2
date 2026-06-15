<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
<!-- KPI stat strip -->
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="package" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Holdings</p>
                            <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.departmentStockSummary.totalRows ?? '—' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="building-2" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Depts with stock</p>
                            <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.departmentStockSummary.departments ?? '—' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Issued items</p>
                            <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.departmentStockSummary.items ?? '—' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="calendar-clock" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Last issue</p>
                            <p class="text-sm font-bold leading-tight">{{ ws.departmentStockSummary.lastIssuedAt ? ws.formatDateTime(ws.departmentStockSummary.lastIssuedAt) : '—' }}</p>
                        </div>
                    </div>
                </div>

                <Card v-if="ws.canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                    <!-- Header -->
                    <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="package" class="size-4 text-muted-foreground" />
                                Department Stock
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">Stock issued out of the store and held by departments for local use.</p>
                        </div>
                        <Button size="sm" variant="outline" class="h-9 shrink-0 gap-1.5 text-xs" :disabled="ws.departmentStockLoading" @click="ws.departmentStockFiltersOpen = !ws.departmentStockFiltersOpen">
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            {{ ws.departmentStockFiltersOpen ? 'Hide filters' : 'Filters' }}
                        </Button>
                    </div>

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

                    <!-- Collapsible filter panel -->
                    <div v-if="ws.departmentStockFiltersOpen" class="grid gap-3 border-b px-4 py-3 sm:grid-cols-4">
                        <div class="sm:col-span-2">
                            <Label for="department-stock-q" class="sr-only">Search</Label>
                            <SearchInput id="department-stock-q" v-model="ws.departmentStockFilters.q" placeholder="Department, item, category, warehouse…" class="w-full" />
                        </div>
                        <div>
                            <Label for="department-stock-department" class="sr-only">Department</Label>
                            <Select :model-value="ws.toSelectValue(ws.departmentStockFilters.departmentId)" @update:model-value="ws.departmentStockFilters.departmentId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="h-9 w-full text-xs">
                                    <SelectValue placeholder="All departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ws.EMPTY_SELECT_VALUE">All departments</SelectItem>
                                    <SelectItem v-for="department in ws.requisitionDepartmentOptions" :key="`department-stock-${department.id}`" :value="department.id" :text-value="ws.lookupOptionText(department)">
                                        {{ department.name }}<span v-if="department.code" class="text-muted-foreground"> ({{ department.code }})</span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="flex items-center gap-2">
                            <Button size="sm" class="h-9 flex-1 gap-1.5 text-xs" :disabled="ws.departmentStockLoading" @click="ws.applyDepartmentStockFilters">
                                <AppIcon name="search" class="size-3.5" />
                                {{ ws.departmentStockLoading ? 'Applying…' : 'Apply' }}
                            </Button>
                            <Button size="sm" variant="outline" class="h-9 gap-1.5 text-xs" :disabled="ws.departmentStockLoading" @click="ws.resetDepartmentStockFilters">
                                <AppIcon name="x" class="size-3.5" />
                                Reset
                            </Button>
                        </div>
                    </div>

                    <!-- Info banner -->
                    <div class="flex items-start gap-3 border-b bg-sky-50/60 px-4 py-2.5 text-xs text-sky-800 dark:bg-sky-950/20 dark:text-sky-200">
                        <AppIcon name="info" class="mt-0.5 size-3.5 shrink-0 text-sky-500" />
                        <span>Store stock and department stock are intentionally separate. This view shows where issued stock went — consumption, returns and wastage come in the next operational layer.</span>
                    </div>

                    <CardContent class="flex-1 overflow-auto p-0">

                        <!-- Skeleton -->
                        <RegistryListSkeleton v-if="ws.departmentStockLoading" :count="5" />

                        <!-- Empty -->
                        <div v-else-if="ws.departmentStock.length === 0" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="package" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div class="space-y-1">
                                <p class="text-sm font-semibold">No department stock recorded yet</p>
                                <p class="max-w-xs text-xs text-muted-foreground">Department stock appears after a requisition is issued from the store to a department.</p>
                            </div>
                        </div>

                        <!-- Stock rows -->
                        <div v-else class="divide-y px-4">
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
                    </CardContent>

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
                </Card>

                <Card v-else class="rounded-lg border-sidebar-border/70 shadow-sm">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="package" class="size-5 text-muted-foreground" />
                            Department Stock
                        </CardTitle>
                        <CardDescription>Department stock access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div class="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                            <AppIcon name="lock" class="mt-0.5 size-4 shrink-0 text-destructive" />
                            <div>
                                <p class="text-sm font-semibold text-destructive">Access restricted</p>
                                <p class="mt-0.5 text-xs text-destructive/80">Request <code class="rounded bg-destructive/10 px-1">inventory.procurement.read</code> permission.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
</template>
