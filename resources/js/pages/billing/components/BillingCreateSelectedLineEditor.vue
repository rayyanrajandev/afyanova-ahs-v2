<script setup lang="ts">
import { computed } from 'vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
    activeCreateLineItemDraft: BillingInvoiceLineItemDraft;
    activeCreateLineItemIndex: number | null;
    canReadBillingServiceCatalog: boolean;
    billingServiceCatalogOptions: SearchableSelectOption[];
    billingServiceCatalogLoading: boolean;
    currencyCode: string | null;
    defaultCurrencyCode: string;
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
    createLineItemDraftDisplayLabel: (
        item: BillingInvoiceLineItemDraft,
        fallbackIndex?: number,
    ) => string;
    billingServiceCatalogItemById: (
        catalogItemId: string,
    ) => BillingServiceCatalogItem | null | undefined;
    createLineItemExceptionReasonMissing: (
        item: BillingInvoiceLineItemDraft,
    ) => boolean;
    createLineItemTotalDraft: (item: BillingInvoiceLineItemDraft) => number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
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

const selectedCatalogItem = computed(() =>
    props.billingServiceCatalogItemById(
        props.activeCreateLineItemDraft.catalogItemId,
    ),
);
</script>

<template>
    <div class="space-y-4 rounded-lg border p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div class="space-y-1">
                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Selected charge
                </p>
                <p class="text-sm font-medium text-foreground">
                    {{
                        createLineItemDraftDisplayLabel(
                            activeCreateLineItemDraft,
                            activeCreateLineItemIndex ?? undefined,
                        )
                    }}
                </p>
                <p class="text-sm text-muted-foreground">
                    Switch items from the left basket whenever you need another
                    charge. Update tariff source, quantity, and notes here.
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <div class="flex items-center gap-1 rounded-md border p-1">
                    <Button
                        type="button"
                        size="sm"
                        class="h-7"
                        :variant="
                            activeCreateLineItemDraft.entryMode === 'catalog'
                                ? 'default'
                                : 'ghost'
                        "
                        :disabled="!canReadBillingServiceCatalog"
                        @click="emit('set-entry-mode', activeCreateLineItemDraft, 'catalog')"
                    >
                        Catalog
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        class="h-7"
                        :variant="
                            activeCreateLineItemDraft.entryMode === 'manual'
                                ? 'default'
                                : 'ghost'
                        "
                        @click="emit('set-entry-mode', activeCreateLineItemDraft, 'manual')"
                    >
                        Exception
                    </Button>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    class="h-8 px-2 text-destructive"
                    @click="emit('remove-line-item', activeCreateLineItemDraft.key)"
                >
                    Remove
                </Button>
            </div>
        </div>

        <Alert
            v-if="activeCreateLineItemDraft.entryMode === 'manual'"
            :variant="
                createLineItemExceptionReasonMissing(activeCreateLineItemDraft)
                    ? 'destructive'
                    : 'outline'
            "
            class="py-2"
        >
            <AlertTitle>Exception charge governance</AlertTitle>
            <AlertDescription>
                Use exception charges only for late, missing-tariff, or genuinely non-standard billable work. Record the justification below before saving the draft invoice.
            </AlertDescription>
        </Alert>

        <div class="grid gap-3">
            <template
                v-if="
                    activeCreateLineItemDraft.entryMode === 'catalog' &&
                    canReadBillingServiceCatalog
                "
            >
                <SearchableSelectField
                    :input-id="`bil-create-line-${activeCreateLineItemDraft.key}-catalog-focused`"
                    label="Billable service"
                    :model-value="activeCreateLineItemDraft.catalogItemId"
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
                        emit(
                            'select-catalog-item',
                            activeCreateLineItemDraft,
                            $event,
                        )
                    "
                />

                <div class="grid gap-3 sm:grid-cols-3">
                    <div class="rounded-md border bg-muted/20 p-3">
                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Service code
                        </p>
                        <p class="mt-1 text-sm font-medium text-foreground">
                            {{ selectedCatalogItem?.serviceCode || 'Not selected' }}
                        </p>
                    </div>
                    <div class="rounded-md border bg-muted/20 p-3">
                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Unit
                        </p>
                        <p class="mt-1 text-sm font-medium text-foreground">
                            {{ selectedCatalogItem?.unit || 'Service' }}
                        </p>
                    </div>
                    <div class="rounded-md border bg-muted/20 p-3">
                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Central tariff
                        </p>
                        <p class="mt-1 text-sm font-medium text-foreground">
                            {{
                                selectedCatalogItem
                                    ? formatMoney(
                                        selectedCatalogItem.basePrice,
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
                            v-model="activeCreateLineItemDraft.quantity"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="1"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>Line Notes</Label>
                        <Input
                            v-model="activeCreateLineItemDraft.notes"
                            placeholder="Optional line-item note"
                        />
                    </div>
                </div>
            </template>

            <template v-else>
                <div class="grid gap-2">
                    <Label>Exception charge description</Label>
                    <Input
                        v-model="activeCreateLineItemDraft.description"
                        placeholder="Consultation fee, CBC test, Medication..."
                    />
                </div>

                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div class="grid gap-2">
                        <Label>Service Code</Label>
                        <Input
                            v-model="activeCreateLineItemDraft.serviceCode"
                            placeholder="Optional code"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>Unit</Label>
                        <Input
                            v-model="activeCreateLineItemDraft.unit"
                            placeholder="service, test, unit"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>Quantity</Label>
                        <Input
                            v-model="activeCreateLineItemDraft.quantity"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="1"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>Unit Price</Label>
                        <Input
                            v-model="activeCreateLineItemDraft.unitPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div class="grid gap-2">
                    <Label>Exception justification</Label>
                    <Input
                        v-model="activeCreateLineItemDraft.notes"
                        placeholder="Why is this charge outside standard workflow or tariff capture?"
                    />
                </div>
            </template>

            <p class="text-xs text-muted-foreground">
                Line total:
                <span class="font-medium text-foreground">
                    {{
                        formatMoney(
                            createLineItemTotalDraft(activeCreateLineItemDraft),
                            currencyCode || defaultCurrencyCode,
                        )
                    }}
                </span>
            </p>
            <p
                v-if="activeCreateLineItemDraft.sourceWorkflowId.trim()"
                class="text-xs text-muted-foreground"
            >
                Linked source:
                {{
                    [
                        formatEnumLabel(activeCreateLineItemDraft.sourceWorkflowKind || 'service'),
                        activeCreateLineItemDraft.sourceWorkflowLabel || null,
                        activeCreateLineItemDraft.sourcePerformedAt
                            ? formatDateTime(activeCreateLineItemDraft.sourcePerformedAt)
                            : null,
                    ]
                        .filter((value): value is string => Boolean(value))
                        .join(' | ')
                }}
            </p>
        </div>
    </div>
</template>
