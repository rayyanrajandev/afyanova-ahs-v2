<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchInput } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="package" class="size-4 text-muted-foreground" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Items</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.itemCounts.total }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                                <AppIcon name="alert-triangle" class="size-4 text-destructive" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-destructive/80">Store Out</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-destructive">{{ ws.itemCounts.outOfStock }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-amber-200/70 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                                <AppIcon name="activity" class="size-4 text-amber-600 dark:text-amber-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">Store Low</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-amber-700 dark:text-amber-300">{{ ws.itemCounts.lowStock }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-green-200/70 bg-green-50/50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                                <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Store Healthy</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-green-700 dark:text-green-300">{{ ws.itemCounts.healthy }}</p>
                            </div>
                        </div>
                    </div>
                <!-- Inventory Items card -->
                <Card
                    v-if="ws.canRead"
                    class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm"
                >
                    <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="layout-list" class="size-4 text-muted-foreground" />
                                Inventory Items
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">Physical stock master with category, reorder policy, opening stock, and warehouse operations.</p>
                        </div>
                        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <Select v-model="ws.inventoryAutoRefreshInterval">
                                <SelectTrigger
                                    class="h-8 w-[8rem] rounded-lg text-xs data-[size=default]:h-8"
                                    :title="ws.inventoryAutoRefreshInterval !== 'off' ? `Auto-refresh every ${ws.inventoryAutoRefreshInterval}` : 'Auto-refresh off'"
                                >
                                    <SelectValue placeholder="Auto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="key in (['off', '30s', '1m', '5m'] as const)"
                                        :key="key"
                                        :value="key"
                                    >
                                        {{ ws.INVENTORY_AUTO_REFRESH_LABEL[key] }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 gap-1.5 rounded-lg text-xs"
                                :disabled="ws.loading"
                                @click="ws.refreshInventoryItems"
                            >
                                <AppIcon name="refresh-cw" class="size-3.5" :class="{ 'animate-spin': ws.loading }" />
                                Refresh
                            </Button>
                              <Button
                                  v-if="ws.canManageItems"
                                  size="sm"
                                  variant="outline"
                                  class="h-8 gap-1.5 rounded-lg text-xs"
                                  :disabled="!ws.canLaunchCreateItem"
                                  @click="ws.openCatalogSyncDialog"
                              >
                                  <AppIcon name="book-open" class="size-3.5" />
                                  Sync from Catalog
                              </Button>
                              <Button
                                  v-if="ws.canManageItems"
                                  size="sm"
                                  variant="outline"
                                  class="h-8 gap-1.5 rounded-lg text-xs"
                                  :disabled="!ws.canLaunchCreateItem"
                                  @click="ws.openImportItemsCsvDialog"
                              >
                                  <AppIcon name="upload" class="size-3.5" />
                                  Import CSV
                              </Button>
                             <Button
                                 v-if="ws.canManageItems"
                                 size="sm"
                                 class="h-8 gap-1.5 rounded-lg text-xs"
                                 :disabled="!ws.canLaunchCreateItem"
                                 @click="ws.openCreateItemDialog"
                             >
                                 <AppIcon name="plus" class="size-3.5" />
                                 Create Item
                             </Button>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 border-b px-4 py-2">
                        <SearchInput
                            id="inv-items-q"
                            v-model="ws.itemSearch.q"
                            placeholder="Item code, name, category..."
                            class="min-w-0 flex-1 text-xs"
                            @keyup.enter="ws.flushInventorySearch()"
                        />
                        <Select :model-value="ws.toSelectValue(ws.itemSearch.category)" @update:model-value="ws.itemSearch.category = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE)); ws.itemSearch.page = 1; ws.refreshInventoryItems()">
                            <SelectTrigger class="h-8 w-40 text-xs">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">All Categories</SelectItem>
                                <SelectItem v-for="cat in ws.itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="ws.toSelectValue(ws.itemSearch.stockState)" @update:model-value="ws.itemSearch.stockState = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE)); ws.itemSearch.page = 1; ws.refreshInventoryItems()">
                            <SelectTrigger class="h-8 w-36 text-xs">
                                <SelectValue placeholder="Stock state" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">All stock states</SelectItem>
                                <SelectItem v-for="opt in ws.stockStateOptions" :key="opt" :value="opt">{{ ws.stockStateLabel(opt) }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="ws.toSelectValue(ws.itemSearch.sortBy)" @update:model-value="ws.itemSearch.sortBy = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE)); ws.itemSearch.page = 1; ws.refreshInventoryItems()">
                            <SelectTrigger class="h-8 w-32 text-xs">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="itemName">Name</SelectItem>
                                <SelectItem value="itemCode">Code</SelectItem>
                                <SelectItem value="currentStock">Store Stock</SelectItem>
                                <SelectItem value="category">Category</SelectItem>
                                <SelectItem value="createdAt">Created</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="String(ws.itemSearch.perPage)" @update:model-value="ws.itemSearch.perPage = Number($event); ws.itemSearch.page = 1; ws.refreshInventoryItems()">
                            <SelectTrigger class="h-8 w-20 text-xs">
                                <SelectValue placeholder="Per page" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button v-if="ws.hasAnyItemFilters" variant="ghost" size="sm" class="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground" @click="ws.resetItemFilters()">
                            <AppIcon name="x" class="size-3" />
                            Clear
                        </Button>
                    </div>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <RegistryListSkeleton v-if="ws.loading" />
                            <div v-else-if="ws.items.length === 0" class="p-4">
                                <InventoryEmptyState
                                    icon="package"
                                    title="No inventory items found"
                                    :description="!ws.hasAnyItemFilters ? (ws.inventoryItemSetupBlockedReason || 'Register the first physical stock item here after warehouses and suppliers are ready. Medicines should already exist in Clinical Care Catalog before you link them to inventory.') : 'No inventory items match the current filters.'"
                                    :chips="ws.itemFilterChips"
                                >
                                    <template #actions>
                                        <Button v-if="ws.hasAnyItemFilters" variant="outline" size="sm" @click="ws.resetItemFilters()">
                                            <AppIcon name="x" class="mr-1.5 size-3.5" />
                                            Clear filters
                                        </Button>
                                        <Button v-if="ws.canManageItems" size="sm" :disabled="!ws.canLaunchCreateItem" @click="ws.openCreateItemDialog">
                                            <AppIcon name="plus" class="mr-1.5 size-3.5" />
                                            Create first item
                                        </Button>
                                    </template>
                                </InventoryEmptyState>
                            </div>
                            <div v-else class="divide-y px-4">
                                <RegistryListRow
                                    v-for="item in ws.items"
                                    :key="item.id"
                                    :status-dot-class="ws.stockStateDotClass(item.stockState)"
                                    :status-title="ws.stockStateLabel(item.stockState)"
                                    :flash="ws.flashedItemId === item.id"
                                    @select="ws.openItemDetails(item)"
                                >
                                    <template #title>
                                        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span class="truncate text-sm font-medium transition-colors hover:text-primary">{{ item.itemName }}</span>
                                            <span class="shrink-0 text-xs text-muted-foreground">{{ item.itemCode || 'No code' }}</span>
                                            <Badge v-if="item.dosageForm" variant="secondary" class="h-4.5 px-1.5 text-[10px] font-normal leading-none">{{ item.dosageForm }}</Badge>
                                            <Badge v-if="item.strength" variant="outline" class="h-4.5 px-1.5 text-[10px] font-normal leading-none">{{ item.strength }}</Badge>
                                        </div>
                                    </template>
                                    <template #meta>
                                        <p class="truncate text-xs text-muted-foreground">{{ ws.inventoryItemListMeta(item) }}</p>
                                    </template>
                                    <template #badges>
                                        <Badge v-if="ws.inventoryItemNeedsOpeningStock(item)" variant="outline" class="h-5 px-1.5 text-[10px]">
                                            Opening stock
                                        </Badge>
                                        <Badge :class="ws.stockAlertBadgeClass(item.stockState)" class="h-5 px-1.5 text-[10px]">
                                            {{ ws.stockStateLabel(item.stockState) }}
                                        </Badge>
                                    </template>
                                    <template #actions>
                                        <Button
                                            v-if="ws.canCreateMovement"
                                            size="sm"
                                            variant="outline"
                                            class="hidden h-8 gap-1.5 rounded-lg text-xs lg:inline-flex"
                                            :disabled="!ws.canLaunchStockMovement"
                                            @click="ws.openStockMovementDialog(item)"
                                        >
                                            <AppIcon name="activity" class="size-3.5" />
                                            {{ ws.inventoryItemStockActionLabel(item) }}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="h-8 rounded-lg text-xs"
                                            @click="ws.openItemDetails(item)"
                                        >
                                            View details
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger as-child>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    class="h-8 w-8 rounded-lg p-0"
                                                    aria-label="More item actions"
                                                >
                                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" class="w-44">
                                                <DropdownMenuItem v-if="ws.canCreateMovement" class="lg:hidden" @click="ws.openStockMovementDialog(item)">
                                                    <AppIcon name="activity" class="mr-2 size-3.5" />
                                                    {{ ws.inventoryItemStockActionLabel(item) }}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem @click="ws.openDepartmentStockForItem(item)">
                                                    <AppIcon name="building-2" class="mr-2 size-3.5" />
                                                    Where issued
                                                </DropdownMenuItem>
                                                <DropdownMenuItem v-if="ws.canManageItems" @click="ws.openItemDetails(item, 'maintenance')">
                                                    <AppIcon name="pencil" class="mr-2 size-3.5" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem v-if="ws.canManageItems" @click="ws.openItemDetails(item, 'status')">
                                                    <AppIcon name="shield-check" class="mr-2 size-3.5" />
                                                    Status
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </template>
                                </RegistryListRow>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                            <p class="text-xs text-muted-foreground">
                                Showing {{ ws.items.length }} of {{ ws.itemPagination?.total ?? ws.items.length }} results &middot; Page {{ ws.itemPagination?.currentPage ?? 1 }} of {{ ws.itemPagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="!ws.itemPagination || ws.itemPagination.currentPage <= 1 || ws.loading"
                                    @click="ws.itemSearch.page -= 1; ws.refreshInventoryItems()"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <template v-for="pg in ws.itemPages" :key="typeof pg === 'number' ? `ip-${pg}` : `ip-e-${Math.random()}`">
                                    <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                    <Button
                                        v-else
                                        size="sm"
                                    :variant="pg === (ws.itemPagination?.currentPage ?? 1) ? 'default' : 'outline'"
                                    class="h-8 w-8 p-0"
                                    :disabled="ws.loading"
                                    @click="ws.goToItemPage(pg)"
                                    >
                                        {{ pg }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="!ws.itemPagination || ws.itemPagination.currentPage >= ws.itemPagination.lastPage || ws.loading"
                                    @click="ws.itemSearch.page += 1; ws.refreshInventoryItems()"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
</template>
