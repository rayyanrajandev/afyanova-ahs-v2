<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import CatalogLinkBadge from '@/components/shared/CatalogLinkBadge.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ChargeableItem, ChargeableItemPrice } from '@/composables/chargeableItems/useChargeableItems';
import { formatEnumLabel } from '@/lib/labels';
import ChargeableItemEditPriceSheet from './ChargeableItemEditPriceSheet.vue';

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
    item: ChargeableItem | null;
}>();

const emit = defineEmits<{
    edit: [item: ChargeableItem];
    priceUpdated: [item: ChargeableItem];
}>();

const editingPrice = ref<ChargeableItemPrice | null>(null);
const editPriceOpen = ref(false);

function statusVariant(status: string | null | undefined): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

const sortedPrices = computed<ChargeableItemPrice[]>(() => {
    if (!props.item) return [];
    return [...props.item.prices].sort((a, b) => {
        const left = a.effectiveFrom ?? '';
        const right = b.effectiveFrom ?? '';
        return right.localeCompare(left);
    });
});

function formatPrice(price: ChargeableItemPrice): string {
    return `${price.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${price.currencyCode}`;
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function openEditPrice(price: ChargeableItemPrice): void {
    editingPrice.value = price;
    editPriceOpen.value = true;
}

function onPriceUpdated(updated: ChargeableItem): void {
    emit('priceUpdated', updated);
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="workspace" size="3xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>{{ item?.name ?? 'Chargeable item details' }}</SheetTitle>
                <SheetDescription>{{ item?.code }}</SheetDescription>
                <div v-if="item" class="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{{ formatEnumLabel(item.catalogType) }}</Badge>
                    <Badge :variant="statusVariant(item.status)">{{ formatEnumLabel(item.status) }}</Badge>
                    <CatalogLinkBadge
                        :source="item.clinicalCatalogItemId ? 'clinical_catalog' : 'standalone'"
                        :catalog-type="item.catalogType"
                        :catalog-name="item.name"
                        :catalog-code="item.code"
                    />
                </div>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1">
                <div v-if="item" class="space-y-4 p-5">
                    <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Identity</p>
                        <div class="mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
                            <span class="text-muted-foreground">Charge model</span>
                            <span class="text-right font-medium">{{ formatEnumLabel(item.chargeModel) }}</span>
                            <span class="text-muted-foreground">Category</span>
                            <span class="text-right font-medium">{{ item.category ?? '—' }}</span>
                            <span class="text-muted-foreground">Default unit</span>
                            <span class="text-right font-medium">{{ item.defaultUnit ?? '—' }}</span>
                            <span class="text-muted-foreground">Linkage</span>
                            <span class="text-right font-medium">
                                {{ item.clinicalCatalogItemId ? 'Linked to clinical catalog (name/code follow it live)' : 'Standalone billing item' }}
                            </span>
                        </div>
                    </div>

                    <div>
                        <p class="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Price book entries ({{ sortedPrices.length }})
                        </p>
                        <div v-if="sortedPrices.length === 0" class="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                            No prices have been added yet.
                        </div>
                        <ul v-else class="divide-y overflow-hidden rounded-lg border">
                            <li v-for="price in sortedPrices" :key="price.id" class="flex items-center justify-between gap-3 px-3 py-2.5">
                                <div class="min-w-0">
                                    <p class="text-sm font-semibold tabular-nums">{{ formatPrice(price) }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        From {{ formatDate(price.effectiveFrom) }} <span v-if="price.effectiveTo">to {{ formatDate(price.effectiveTo) }}</span>
                                        <span v-if="price.isTaxable && price.taxRatePercent"> · {{ price.taxRatePercent }}% tax</span>
                                    </p>
                                </div>
                                <div class="flex shrink-0 items-center gap-2">
                                    <Badge :variant="statusVariant(price.status)">{{ formatEnumLabel(price.status) }}</Badge>
                                    <Button variant="ghost" size="icon-sm" @click="openEditPrice(price)">
                                        <AppIcon name="pencil" class="size-3.5" />
                                    </Button>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <p class="px-1 text-xs text-muted-foreground">
                        Last updated {{ formatDate(item.updatedAt) }} · Created {{ formatDate(item.createdAt) }}
                    </p>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 flex-row items-center justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Close</Button>
                <Button v-if="item" @click="emit('edit', item)">
                    <AppIcon name="pencil" class="size-3.5" />
                    Edit item
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <ChargeableItemEditPriceSheet
        v-if="item && editingPrice"
        v-model:open="editPriceOpen"
        :item="item"
        :price="editingPrice"
        @updated="onPriceUpdated"
    />
</template>
