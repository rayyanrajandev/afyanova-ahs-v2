<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatEnumLabel } from '@/lib/labels';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
            <!-- Mobile procurement filters drawer -->
            <Drawer v-if="ws.canRead" :open="ws.mobileProcurementDrawerOpen" @update:open="ws.mobileProcurementDrawerOpen = $event">
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                            Procurement Filters
                        </DrawerTitle>
                        <DrawerDescription>Filter procurement requests on mobile.</DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="inv-proc-q-mobile">Search</Label>
                                    <Input
                                        id="inv-proc-q-mobile"
                                        v-model="ws.procurementSearch.q"
                                        placeholder="Request number, supplier..."
                                        @keyup.enter="ws.submitProcurementSearchFromMobileDrawer"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-proc-status-mobile">Status</Label>
                                    <Select :model-value="ws.toSelectValue(ws.procurementSearch.status)" @update:model-value="ws.procurementSearch.status = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">All</SelectItem>
                                        <SelectItem v-for="opt in ws.procurementStatusOptions" :key="opt" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-proc-sort-mobile">Sort by</Label>
                                    <Select :model-value="ws.toSelectValue(ws.procurementSearch.sortBy)" @update:model-value="ws.procurementSearch.sortBy = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="createdAt">Created</SelectItem>
                                        <SelectItem value="neededBy">Needed By</SelectItem>
                                        <SelectItem value="requestedQuantity">Quantity</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                        <SelectItem value="supplierName">Supplier</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-proc-sort-dir-mobile">Sort direction</Label>
                                    <Select :model-value="ws.toSelectValue(ws.procurementSearch.sortDir)" @update:model-value="ws.procurementSearch.sortDir = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="asc">Ascending</SelectItem>
                                        <SelectItem value="desc">Descending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-proc-per-page-mobile">Results per page</Label>
                                    <Select :model-value="String(ws.procurementSearch.perPage)" @update:model-value="ws.procurementSearch.perPage = Number($event)">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                        <SelectItem value="150">150</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="ws.loading" class="gap-1.5" @click="ws.submitProcurementSearchFromMobileDrawer">
                            <AppIcon name="search" class="size-3.5" />
                            Search
                        </Button>
                        <Button variant="outline" :disabled="ws.loading && !ws.hasAnyProcurementFilters" @click="ws.resetProcurementFiltersFromMobileDrawer">
                            Reset Filters
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <!-- Mobile stock ledger filters drawer -->
            <Drawer v-if="ws.canRead" :open="ws.mobileLedgerDrawerOpen" @update:open="ws.mobileLedgerDrawerOpen = $event">
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            Stock Ledger Filters
                        </DrawerTitle>
                        <DrawerDescription>Filter stock movements on mobile.</DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-q-mobile">Search</Label>
                                    <Input id="inv-ledger-q-mobile" v-model="ws.stockLedgerFilters.q" placeholder="Reason, notes, item..." />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-item-mobile">Item UUID</Label>
                                    <Input id="inv-ledger-item-mobile" v-model="ws.stockLedgerFilters.itemId" placeholder="Item UUID" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-type-mobile">Movement Type</Label>
                                    <Select :model-value="ws.toSelectValue(ws.stockLedgerFilters.movementType)" @update:model-value="ws.stockLedgerFilters.movementType = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">All movement types</SelectItem>
                                        <SelectItem v-for="opt in ws.movementTypeOptions" :key="`ledger-m-${opt}`" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-source-mobile">Source</Label>
                                    <Select :model-value="ws.toSelectValue(ws.stockLedgerFilters.sourceKey)" @update:model-value="ws.stockLedgerFilters.sourceKey = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem v-for="option in ws.stockLedgerSourceOptions" :key="`ledger-source-mobile-${option.value || 'all'}`" :value="ws.toSelectValue(option.value)">{{ option.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-from-mobile">From</Label>
                                    <Input id="inv-ledger-from-mobile" v-model="ws.stockLedgerFilters.from" type="datetime-local" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-to-mobile">To</Label>
                                    <Input id="inv-ledger-to-mobile" v-model="ws.stockLedgerFilters.to" type="datetime-local" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-per-page-mobile">Results per page</Label>
                                    <Select :model-value="String(ws.stockLedgerFilters.perPage)" @update:model-value="ws.stockLedgerFilters.perPage = Number($event)">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                        <SelectItem value="150">150</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="ws.stockLedgerLoading" class="gap-1.5" @click="ws.submitLedgerSearchFromMobileDrawer">
                            <AppIcon name="search" class="size-3.5" />
                            Apply
                        </Button>
                        <Button variant="outline" :disabled="ws.stockLedgerLoading" @click="ws.resetLedgerFiltersFromMobileDrawer">
                            Reset Filters
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
</template>


