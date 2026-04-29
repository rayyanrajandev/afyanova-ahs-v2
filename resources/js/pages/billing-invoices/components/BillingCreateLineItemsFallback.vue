<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatEnumLabel } from '@/lib/labels';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { formatDateTime } from '../helpers';
import type {
    BillingInvoiceLineItemDraft,
    BillingServiceCatalogItem,
} from '../types';

interface Props {
    canReadBillingServiceCatalog: boolean;
    lineItems: BillingInvoiceLineItemDraft[];
    billingServiceCatalogOptions: SearchableSelectOption[];
    billingServiceCatalogLoading: boolean;
    currencyCode: string | null;
    defaultCurrencyCode: string;
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
    billingServiceCatalogItemById: (
        catalogItemId: string,
    ) => BillingServiceCatalogItem | null | undefined;
    createLineItemTotalDraft: (item: BillingInvoiceLineItemDraft) => number;
}

defineProps<Props>();

const emit = defineEmits<{
    'add-catalog-line': [];
    'add-exception-line': [];
    'set-entry-mode': [
        draft: BillingInvoiceLineItemDraft,
        mode: 'catalog' | 'manual',
    ];
    'remove-line-item': [key: string];
    'select-catalog-item': [
        draft: BillingInvoiceLineItemDraft,
        catalogItemId: string,
    ];
}>();
</script>

<template>
    <div class="hidden">
        <div class="flex flex-col gap-3 rounded-lg border bg-muted/10 p-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="space-y-1">
                <p class="text-sm font-medium text-foreground">
                    Review and edit invoice lines
                </p>
                <p class="text-sm text-muted-foreground">
                    Finalize imported services here and add catalog or exception charges only when needed.
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Button
                    v-if="canReadBillingServiceCatalog"
                    type="button"
                    size="sm"
                    variant="outline"
                    class="gap-1.5"
                    @click="emit('add-catalog-line')"
                >
                    <AppIcon name="plus" class="size-3.5" />
                    Add catalog line
                </Button>
                <Button
                    type="button"
                    size="sm"
                    class="gap-1.5"
                    @click="emit('add-exception-line')"
                >
                    <AppIcon name="plus" class="size-3.5" />
                    Add exception charge
                </Button>
            </div>
        </div>

        <div class="space-y-3">
            <div
                v-for="(item, index) in lineItems"
                :key="item.key"
                class="rounded-md border p-3"
            >
                <div
                    class="mb-2 flex flex-wrap items-center justify-between gap-2"
                >
                    <p class="text-xs font-medium text-muted-foreground">
                        Item {{ index + 1 }}
                    </p>
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="flex items-center gap-1 rounded-md border p-1">
                            <Button
                                type="button"
                                size="sm"
                                class="h-7"
                                :variant="
                                    item.entryMode === 'catalog'
                                        ? 'default'
                                        : 'ghost'
                                "
                                :disabled="!canReadBillingServiceCatalog"
                                @click="emit('set-entry-mode', item, 'catalog')"
                            >
                                Catalog Service
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                class="h-7"
                                :variant="
                                    item.entryMode === 'manual'
                                        ? 'default'
                                        : 'ghost'
                                "
                                @click="emit('set-entry-mode', item, 'manual')"
                            >
                                Exception Charge
                            </Button>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            class="h-8 px-2 text-destructive"
                            @click="emit('remove-line-item', item.key)"
                        >
                            Remove
                        </Button>
                    </div>
                </div>

                <div class="grid gap-3">
                    <template
                        v-if="
                            item.entryMode === 'catalog' &&
                            canReadBillingServiceCatalog
                        "
                    >
                        <SearchableSelectField
                            :input-id="`bil-create-line-${item.key}-catalog`"
                            label="Billable service"
                            :model-value="item.catalogItemId"
                            :options="billingServiceCatalogOptions"
                            placeholder="Select billable service"
                            search-placeholder="Search service code, name, department"
                            :helper-text="
                                billingServiceCatalogLoading
                                    ? 'Loading central service catalog...'
                                    : 'Tariff is pulled from the central billing service catalog.'
                            "
                            empty-text="No matching billable service found."
                            :disabled="billingServiceCatalogLoading"
                            @update:model-value="
                                emit('select-catalog-item', item, $event)
                            "
                        />

                        <p
                            v-if="billingServiceCatalogItemById(item.catalogItemId)?.description"
                            class="text-xs text-muted-foreground"
                        >
                            {{ billingServiceCatalogItemById(item.catalogItemId)?.description }}
                        </p>

                        <div class="grid gap-3 sm:grid-cols-3">
                            <div class="rounded-md border bg-muted/20 p-3">
                                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Service Code
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{ billingServiceCatalogItemById(item.catalogItemId)?.serviceCode || 'Not selected' }}
                                </p>
                            </div>
                            <div class="rounded-md border bg-muted/20 p-3">
                                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Unit
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{ billingServiceCatalogItemById(item.catalogItemId)?.unit || 'Service' }}
                                </p>
                            </div>
                            <div class="rounded-md border bg-muted/20 p-3">
                                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Central Tariff
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{
                                        billingServiceCatalogItemById(item.catalogItemId)
                                            ? formatMoney(
                                                billingServiceCatalogItemById(item.catalogItemId)?.basePrice,
                                                currencyCode || defaultCurrencyCode,
                                            )
                                            : 'Select a service'
                                    }}
                                </p>
                            </div>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="grid gap-2">
                                <Label>Quantity</Label>
                                <Input
                                    v-model="item.quantity"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="1"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label>Line Notes</Label>
                                <Input
                                    v-model="item.notes"
                                    placeholder="Optional line-item note"
                                />
                            </div>
                        </div>
                    </template>

                    <template v-else>
                        <div class="grid gap-2">
                            <Label>Item Description</Label>
                            <Input
                                v-model="item.description"
                                placeholder="Consultation fee, CBC test, Medication..."
                            />
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div class="grid gap-2">
                                <Label>Service Code</Label>
                                <Input
                                    v-model="item.serviceCode"
                                    placeholder="Optional code"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label>Unit</Label>
                                <Input
                                    v-model="item.unit"
                                    placeholder="service, test, unit"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label>Quantity</Label>
                                <Input
                                    v-model="item.quantity"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="1"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label>Unit Price</Label>
                                <Input
                                    v-model="item.unitPrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div class="grid gap-2">
                            <Label>Line Notes</Label>
                            <Input
                                v-model="item.notes"
                                placeholder="Optional line-item note"
                            />
                        </div>
                    </template>

                    <p class="text-xs text-muted-foreground">
                        Line total:
                        <span class="font-medium text-foreground">
                            {{
                                formatMoney(
                                    createLineItemTotalDraft(item),
                                    currencyCode || defaultCurrencyCode,
                                )
                            }}
                        </span>
                    </p>
                    <p
                        v-if="item.sourceWorkflowId.trim()"
                        class="text-xs text-muted-foreground"
                    >
                        Linked source:
                        {{
                            [
                                formatEnumLabel(item.sourceWorkflowKind || 'service'),
                                item.sourceWorkflowLabel || null,
                                item.sourcePerformedAt ? formatDateTime(item.sourcePerformedAt) : null,
                            ]
                                .filter((value): value is string => Boolean(value))
                                .join(' | ')
                        }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
