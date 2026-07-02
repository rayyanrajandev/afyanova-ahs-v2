<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CatalogLinkBadge from '@/components/shared/CatalogLinkBadge.vue';
import { formatEnumLabel } from '@/lib/labels';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

function formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

const ws = useSupplyChainPageApi();
</script>

<template>
    <Sheet :open="ws.itemDetailsOpen" @update:open="ws.itemDetailsOpen = $event">
        <SheetContent side="right" variant="workspace" size="3xl">
            <SheetHeader class="shrink-0 border-b px-6 py-3 text-left pr-12">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 space-y-1">
                        <SheetTitle class="flex min-w-0 items-center gap-2 text-base">
                            <AppIcon name="package" class="size-4 shrink-0 text-muted-foreground" />
                            <span class="min-w-0 truncate">{{ ws.itemDetails?.itemName || 'Inventory item details' }}</span>
                        </SheetTitle>
                        <SheetDescription class="flex items-center gap-1.5 text-xs">
                            <span>{{ ws.itemDetails?.itemCode || 'No code' }}</span>
                            <span>·</span>
                            <span>{{ ws.itemDetails?.category ? formatEnumLabel(ws.itemDetails.category) : 'No category' }}</span>
                            <span>·</span>
                            <span>{{ ws.itemDetails?.unit || 'No unit' }}</span>
                        </SheetDescription>
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                        <Badge v-if="ws.itemDetailsLoading" variant="secondary" class="gap-1.5">
                            <AppIcon name="loader-circle" class="size-3 animate-spin" />
                        </Badge>
                        <Badge v-if="ws.itemDetails?.clinicalCatalogItemId" variant="default" class="gap-1">
                            <AppIcon name="check-circle" class="size-3" />
                            Catalog
                        </Badge>
                        <Badge v-else variant="outline">Manual</Badge>
                        <Badge v-if="ws.itemDetails?.stockState" variant="secondary" class="capitalize">
                            {{ ws.stockStateLabel(ws.itemDetails.stockState) }}
                        </Badge>
                    </div>
                </div>
            </SheetHeader>
            <template v-if="ws.itemDetailsLoading">
                <div class="space-y-4 p-6">
                    <div class="grid gap-3 sm:grid-cols-3">
                        <div v-for="i in 3" :key="i" class="rounded-lg border bg-background/70 px-4 py-3">
                            <Skeleton class="h-3 w-24" />
                            <Skeleton class="mt-2 h-5 w-32" />
                            <Skeleton class="mt-1.5 h-3 w-20" />
                        </div>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div v-for="i in 6" :key="i" class="rounded-lg border bg-background/70 px-3 py-2.5">
                            <Skeleton class="h-3 w-20" />
                            <Skeleton class="mt-1 h-4 w-40" />
                            <Skeleton class="mt-1 h-3 w-28" />
                        </div>
                    </div>
                </div>
            </template>
            <Alert v-else-if="ws.itemDetailsError" variant="destructive" class="m-4">
                <AlertTitle>Item load failed</AlertTitle>
                <AlertDescription>{{ ws.itemDetailsError }}</AlertDescription>
            </Alert>
            <ScrollArea v-else-if="ws.itemDetails" class="min-h-0 flex-1" viewport-class="pb-6">
                <div class="space-y-5 p-5">
                    <!-- Stock health hero -->
                    <div
                        class="relative overflow-hidden rounded-lg border p-5"
                        :class="{
                            'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/50': ws.itemDetails.stockState === 'in_stock',
                            'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50': ws.itemDetails.stockState === 'low_stock',
                            'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50': ws.itemDetails.stockState === 'out_of_stock',
                            'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50': !ws.itemDetails.stockState || ws.itemDetails.stockState === 'pending',
                        }"
                    >
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0 space-y-1">
                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Stock Status</p>
                                <p class="text-2xl font-bold tracking-tight text-foreground">
                                    {{ ws.itemDetails.stockState ? ws.stockStateLabel(ws.itemDetails.stockState) : 'Pending' }}
                                </p>
                                <p class="text-sm text-muted-foreground">{{ ws.itemDetails.itemCode }} · {{ ws.itemDetails.unit || 'No unit' }}</p>
                            </div>
                            <div class="shrink-0">
                                <Badge
                                    :variant="ws.itemDetails.clinicalCatalogItemId ? 'default' : 'outline'"
                                    class="gap-1"
                                >
                                    <AppIcon :name="ws.itemDetails.clinicalCatalogItemId ? 'check-circle' : 'package'" class="size-3" />
                                    {{ ws.itemDetails.clinicalCatalogItemId ? 'Catalog synced' : 'Manual entry' }}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <!-- Details grid -->
                    <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Item Name</p>
                            <p class="text-sm font-semibold text-foreground break-words">{{ ws.itemDetails.itemName || 'Not recorded' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Category</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.category ? formatEnumLabel(ws.itemDetails.category) : 'Unclassified' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Subcategory</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.subcategory ? formatEnumLabel(ws.itemDetails.subcategory) : 'Not assigned' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Stock Unit</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.unit || 'Not set' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Manufacturer</p>
                            <p class="text-sm font-semibold text-foreground break-words">{{ ws.itemDetails.manufacturer || 'Not recorded' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Bin Location</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.binLocation || 'Not assigned' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Storage Conditions</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.storageConditions ? formatEnumLabel(ws.itemDetails.storageConditions) : 'Standard' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Cold Chain</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.requiresColdChain ? 'Required' : 'Not required' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Controlled Substance</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.isControlledSubstance ? (ws.itemDetails.controlledSubstanceSchedule || 'Yes') : 'No' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Clinical Link</p>
                            <p class="text-sm font-semibold text-foreground truncate">
                                {{ ws.itemDetails.clinicalCatalogItemId ? ws.clinicalCatalogLabel(ws.itemDetails.clinicalCatalogItemId) : 'Standalone' }}
                            </p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">VEN Classification</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.venClassification ? formatEnumLabel(ws.itemDetails.venClassification) : 'Not set' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">ABC Classification</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.itemDetails.abcClassification || 'Not set' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">MSD Code</p>
                            <p class="text-sm font-semibold text-foreground break-words">{{ ws.itemDetails.msdCode || 'Not recorded' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">NHIF Code</p>
                            <p class="text-sm font-semibold text-foreground break-words">{{ ws.itemDetails.nhifCode || 'Not recorded' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Barcode</p>
                            <p class="text-sm font-semibold text-foreground font-mono">{{ ws.itemDetails.barcode || 'Not recorded' }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.formatDateTime(ws.itemDetails.createdAt) }}</p>
                        </div>
                        <div class="space-y-1.5 sm:col-span-2">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Last Updated</p>
                            <p class="text-sm font-semibold text-foreground">{{ ws.formatDateTime(ws.itemDetails.updatedAt) }}</p>
                        </div>
                    </div>
                </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 gap-2 border-t px-4 py-3 sm:px-6">
                <Button v-if="ws.itemDetails" as-child class="gap-1.5">
                    <Link :href="`/inventory-procurement/items/${ws.itemDetails.id}`">
                        <AppIcon name="arrow-up-right" class="size-3.5" />
                        View Full Details
                    </Link>
                </Button>
                <Button variant="outline" @click="ws.itemDetailsOpen = false">Close</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>


