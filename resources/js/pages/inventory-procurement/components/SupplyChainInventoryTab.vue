<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
                <div
                    v-if="ws.canRead"
                    class="flex min-h-0 flex-1 flex-col"
                >
                    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <ScrollArea class="min-h-0 flex-1">
                            <RegistryListSkeleton v-if="!ws.items.length && ws.loading" />
                            <div v-else-if="!ws.items.length && !ws.loading" class="p-4">
                                <InventoryEmptyState
                                    icon="package"
                                    title="No inventory items found"
                                    :description="!ws.hasAnyItemFilters ? (ws.inventoryItemSetupBlockedReason || 'Register the first physical stock item here after warehouses and suppliers are ready. Medicines should already exist in Clinical Catalog before you link them to inventory.') : 'No inventory items match the current filters.'"
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
                            <div v-show="ws.items.length > 0" class="divide-y px-4" :class="{ 'opacity-40 pointer-events-none transition-opacity duration-200': ws.loading }">
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
                                            v-if="ws.inventoryItemNeedsOpeningStock(item) ? ws.canSetOpeningStock : ws.canCreateMovement"
                                            size="sm"
                                            variant="outline"
                                            class="hidden h-8 gap-1.5 rounded-lg text-xs lg:inline-flex"
                                            :disabled="ws.inventoryItemNeedsOpeningStock(item) ? !ws.canLaunchOpeningStock : !ws.canLaunchStockMovement"
                                            @click="ws.openStockMovementDialog(item)"
                                        >
                                            <AppIcon name="activity" class="size-3.5" />
                                            {{ ws.inventoryItemStockActionLabel(item) }}
                                        </Button>
                                        <Button
                                            v-if="ws.inventoryItemHasOpeningStock(item) && ws.canSetOpeningStock"
                                            size="sm"
                                            variant="outline"
                                            class="hidden h-8 gap-1.5 rounded-lg text-xs lg:inline-flex"
                                            @click="ws.openStockMovementCorrection(item)"
                                        >
                                            <AppIcon name="pencil" class="size-3.5" />
                                            Correct
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
                                                <DropdownMenuItem v-if="ws.inventoryItemNeedsOpeningStock(item) ? ws.canSetOpeningStock : ws.canCreateMovement" class="lg:hidden" @click="ws.openStockMovementDialog(item)">
                                                    <AppIcon name="activity" class="mr-2 size-3.5" />
                                                    {{ ws.inventoryItemStockActionLabel(item) }}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem v-if="ws.inventoryItemHasOpeningStock(item) && ws.canSetOpeningStock" @click="ws.openStockMovementCorrection(item)">
                                                    <AppIcon name="pencil" class="mr-2 size-3.5" />
                                                    Correct Opening Stock
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
                    </div>
                </div>
</template>


