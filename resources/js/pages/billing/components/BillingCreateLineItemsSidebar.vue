<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatEnumLabel } from '@/lib/labels';
import type { BillingInvoiceLineItemDraft } from '../types';

type CreateLineItemWorkspaceTab = 'capture' | 'compose';

interface Props {
    createLineItemsCount: number;
    createLineItemWorkspaceTab: CreateLineItemWorkspaceTab;
    canReadBillingServiceCatalog: boolean;
    createBasketCountLabel: string;
    createLineItemsSubtotal: number;
    currencyCode: string | null;
    defaultCurrencyCode: string;
    hasActiveCreateLineItem: boolean;
    createReviewLineItems: BillingInvoiceLineItemDraft[];
    activeCreateLineItemKey: string | null;
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
    createLineItemDraftDisplayLabel: (
        item: BillingInvoiceLineItemDraft,
        fallbackIndex?: number,
    ) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'open-capture-workspace': [];
    'add-catalog-line': [];
    'add-exception-line': [];
    'set-active-line-item': [key: string];
    'remove-line-item': [key: string];
}>();

function parseLineItemNumber(value: string, fallback = 0): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function lineItemIsEffectivelyEmpty(item: BillingInvoiceLineItemDraft): boolean {
    return (
        !item.description.trim() &&
        !item.serviceCode.trim() &&
        !item.unit.trim() &&
        !item.unitPrice.trim() &&
        !item.notes.trim() &&
        Math.max(parseLineItemNumber(item.quantity, 0), 0) <= 1
    );
}

function createLineItemTotalDraft(item: BillingInvoiceLineItemDraft): number {
    const quantity = Math.max(parseLineItemNumber(item.quantity, 0), 0);
    const unitPrice = Math.max(parseLineItemNumber(item.unitPrice, 0), 0);

    return Math.round(quantity * unitPrice * 100) / 100;
}

function lineItemMetaLabel(item: BillingInvoiceLineItemDraft): string {
    return [
        item.serviceCode.trim() ? `Code ${item.serviceCode.trim()}` : null,
        item.unit.trim() ? `Unit ${item.unit.trim()}` : null,
        `Qty ${parseLineItemNumber(item.quantity, 0) || 1}`,
        item.sourceWorkflowId.trim()
            ? `Source ${formatEnumLabel(item.sourceWorkflowKind || 'service')}`
            : null,
    ]
        .filter((value): value is string => Boolean(value))
        .join(' | ');
}
</script>

<template>
    <div class="xl:sticky xl:top-4">
        <div class="overflow-hidden rounded-lg border">
            <div class="space-y-3 border-b bg-muted/10 px-4 py-3">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div class="space-y-0.5">
                        <p class="text-sm font-medium text-foreground">
                            Charges
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Build the invoice on the left, then edit one selected
                            line on the right.
                        </p>
                    </div>
                    <Badge variant="outline">
                        {{ createLineItemsCount > 0 ? 'Ready for review' : 'Waiting for charges' }}
                    </Badge>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        class="gap-1.5"
                        :variant="createLineItemWorkspaceTab === 'capture' ? 'default' : 'outline'"
                        @click="emit('open-capture-workspace')"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        Import clinical services
                    </Button>
                    <Button
                        v-if="canReadBillingServiceCatalog"
                        type="button"
                        size="sm"
                        variant="outline"
                        class="gap-1.5"
                        @click="emit('add-catalog-line')"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        Add catalog charge
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        class="gap-1.5"
                        @click="emit('add-exception-line')"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        Add exception charge
                    </Button>
                </div>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{{ createBasketCountLabel }}</span>
                    <span>{{ formatMoney(createLineItemsSubtotal, currencyCode || defaultCurrencyCode) }}</span>
                    <span>
                        {{
                            hasActiveCreateLineItem
                                ? 'Selected line ready to edit'
                                : 'Select a line to edit'
                        }}
                    </span>
                </div>
            </div>

            <div v-if="createReviewLineItems.length === 0" class="px-4 py-5">
                <p class="text-sm font-medium text-foreground">
                    No invoice lines yet
                </p>
                <p class="mt-1 text-sm text-muted-foreground">
                    Import priced services or add an exception charge to start
                    building this invoice.
                </p>
            </div>

            <ScrollArea v-else class="max-h-[58vh]">
                <div class="divide-y">
                    <button
                        v-for="(item, index) in createReviewLineItems"
                        :key="item.key"
                        type="button"
                        class="flex w-full flex-col gap-3 px-4 py-3 text-left transition hover:bg-muted/10"
                        :class="activeCreateLineItemKey === item.key ? 'bg-muted/20' : ''"
                        @click="emit('set-active-line-item', item.key)"
                    >
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div class="min-w-0 space-y-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-sm font-medium text-foreground">
                                        {{ createLineItemDraftDisplayLabel(item, index) }}
                                    </p>
                                    <Badge variant="outline">
                                        {{ item.entryMode === 'catalog' ? 'Catalog' : 'Exception' }}
                                    </Badge>
                                    <Badge
                                        v-if="item.sourceWorkflowId.trim()"
                                        variant="secondary"
                                    >
                                        Imported
                                    </Badge>
                                    <Badge
                                        v-else-if="lineItemIsEffectivelyEmpty(item)"
                                        variant="outline"
                                    >
                                        Draft
                                    </Badge>
                                    <Badge
                                        v-if="activeCreateLineItemKey === item.key"
                                        variant="secondary"
                                    >
                                        Editing
                                    </Badge>
                                </div>
                                <p class="text-xs text-muted-foreground">
                                    {{ lineItemMetaLabel(item) }}
                                </p>
                            </div>
                            <div class="flex items-center gap-2 sm:flex-col sm:items-end">
                                <p class="text-sm font-medium text-foreground">
                                    {{ formatMoney(createLineItemTotalDraft(item), currencyCode || defaultCurrencyCode) }}
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    class="h-8 px-2 text-destructive"
                                    @click.stop="emit('remove-line-item', item.key)"
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    </button>
                </div>
            </ScrollArea>
        </div>
    </div>
</template>
