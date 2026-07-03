<script setup lang="ts">
import { computed } from 'vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel } from '@/lib/labels';
import type {
    BillingInvoiceLineItemDraft,
    BillingInvoicePayerPreview,
    CreateForm,
} from '../types';

interface Props {
    createBasketCountLabel: string;
    createLineItemsSubtotal: number;
    defaultCurrencyCode: string;
    createCoverageExpectedPayerDisplay: string;
    createCoverageSettlementPathDisplay: string;
    createCoverageExpectedPatientDisplay: string;
    selectedCreateBillingPayerPreview: BillingInvoicePayerPreview;
    createCoverageClaimPostureDisplay: string;
    createExceptionChargeLineItemsCount: number;
    createExceptionChargeLinesMissingReasonCount: number;
    createLineItemsCount: number;
    createReviewLineItems: BillingInvoiceLineItemDraft[];
    createDraftSaveGuidanceTitle: string;
    createDraftSaveGuidanceDescription: string;
    createForm: CreateForm;
    createFieldError: (field: string) => string | null;
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
    createLineItemTotalDraft: (item: BillingInvoiceLineItemDraft) => number;
    createLineItemDraftDisplayLabel: (
        item: BillingInvoiceLineItemDraft,
        fallbackIndex?: number,
    ) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'back-to-charges': [];
}>();

const exceptionChargeReviewMessage = computed(() => {
    if (props.createExceptionChargeLinesMissingReasonCount > 0) {
        return 'At least one exception charge is missing justification. Go back to Charges and complete the exception note before saving the draft invoice.';
    }

    return `${props.createExceptionChargeLineItemsCount} exception charge${props.createExceptionChargeLineItemsCount === 1 ? '' : 's'} will be created under governed exception handling.`;
});

function parseLineItemNumber(value: string, fallback = 0): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function reviewLineMetaLabel(item: BillingInvoiceLineItemDraft): string {
    return [
        item.serviceCode.trim() ? `Code ${item.serviceCode.trim()}` : null,
        item.unit.trim() ? `Unit ${item.unit.trim()}` : null,
        item.sourceWorkflowId.trim()
            ? `Source ${formatEnumLabel(item.sourceWorkflowKind || 'service')}`
            : null,
    ]
        .filter((value): value is string => Boolean(value))
        .join(' | ');
}

function reviewLineQuantityLabel(item: BillingInvoiceLineItemDraft): string {
    return `${props.formatMoney(
        parseLineItemNumber(item.unitPrice, 0),
        props.createForm.currencyCode || props.defaultCurrencyCode,
    )} each | Qty ${parseLineItemNumber(item.quantity, 0) || 1}`;
}
</script>

<template>
    <div class="space-y-4">
        <div class="space-y-4 rounded-lg border p-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div class="space-y-1">
                    <p class="text-sm font-medium">Review and save draft</p>
                    <p class="text-xs text-muted-foreground">
                        Confirm the reviewed draft lines, posting details, and governed
                        adjustments before saving this invoice as a draft.
                    </p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="gap-1.5 lg:self-start"
                    @click="emit('back-to-charges')"
                >
                    Back to charges
                </Button>
            </div>

            <div class="grid grid-cols-3 gap-3">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Draft contents
                    </p>
                    <p class="mt-1 text-sm font-medium text-foreground">
                        {{ createBasketCountLabel }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        Calculated subtotal:
                        {{ formatMoney(createLineItemsSubtotal, createForm.currencyCode || defaultCurrencyCode) }}
                    </p>
                </div>
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Billing responsibility
                    </p>
                    <p class="mt-1 text-sm font-medium text-foreground">
                        {{ createCoverageExpectedPayerDisplay }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ createCoverageSettlementPathDisplay }} | Patient share:
                        {{ createCoverageExpectedPatientDisplay }}
                    </p>
                </div>
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Draft outcome
                    </p>
                    <p class="mt-1 text-sm font-medium text-foreground">
                        {{
                            formatMoney(
                                selectedCreateBillingPayerPreview.totalAmount,
                                selectedCreateBillingPayerPreview.currencyCode,
                            )
                        }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ createCoverageClaimPostureDisplay }}
                    </p>
                </div>
            </div>

            <Alert
                v-if="createExceptionChargeLineItemsCount > 0"
                :variant="
                    createExceptionChargeLinesMissingReasonCount > 0
                        ? 'destructive'
                        : 'outline'
                "
                class="py-2"
            >
                <AlertTitle>Exception charge review</AlertTitle>
                <AlertDescription>
                    {{ exceptionChargeReviewMessage }}
                </AlertDescription>
            </Alert>

            <div class="overflow-hidden rounded-lg border">
                <div class="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/10 px-4 py-3">
                    <div class="space-y-0.5">
                        <p class="text-sm font-medium text-foreground">
                            Draft lines to review
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Review the final basket snapshot before saving this draft invoice.
                        </p>
                    </div>
                    <Badge variant="outline">
                        {{ createLineItemsCount > 0 ? 'Ready to save' : 'Missing lines' }}
                    </Badge>
                </div>

                <div
                    v-if="createReviewLineItems.length === 0"
                    class="px-4 py-5"
                >
                    <p class="text-sm font-medium text-foreground">
                        No invoice lines ready yet
                    </p>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Go back to Charges and import priced services or add an exception charge first.
                    </p>
                </div>

                <template v-else>
                    <ScrollArea class="max-h-80">
                        <div class="divide-y">
                            <div
                                v-for="(item, index) in createReviewLineItems"
                                :key="item.key"
                                class="px-4 py-3"
                            >
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0 space-y-1.5">
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
                                        </div>
                                        <p class="text-xs text-muted-foreground">
                                            {{ reviewLineMetaLabel(item) }}
                                        </p>
                                        <p
                                            v-if="item.notes.trim()"
                                            class="text-xs text-muted-foreground"
                                        >
                                            {{ item.notes.trim() }}
                                        </p>
                                    </div>
                                    <div class="space-y-1 lg:text-right">
                                        <p class="text-sm font-medium text-foreground">
                                            {{
                                                formatMoney(
                                                    createLineItemTotalDraft(item),
                                                    createForm.currencyCode || defaultCurrencyCode,
                                                )
                                            }}
                                        </p>
                                        <p class="text-xs text-muted-foreground">
                                            {{ reviewLineQuantityLabel(item) }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <div class="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/10 px-4 py-3 text-sm">
                        <p class="font-medium text-foreground">
                            {{ createBasketCountLabel }}
                        </p>
                        <p class="font-medium text-foreground">
                            {{ formatMoney(createLineItemsSubtotal, createForm.currencyCode || defaultCurrencyCode) }} subtotal
                        </p>
                    </div>
                </template>
            </div>

            <Alert variant="outline" class="py-2">
                <AlertTitle>{{ createDraftSaveGuidanceTitle }}</AlertTitle>
                <AlertDescription>
                    {{ createDraftSaveGuidanceDescription }}
                </AlertDescription>
            </Alert>

            <div class="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div class="space-y-4 rounded-lg border p-4">
                    <div class="space-y-1">
                        <p class="text-sm font-medium text-foreground">Posting details</p>
                        <p class="text-xs text-muted-foreground">
                            Set the invoice date, optional due date, and billing currency used
                            for this draft.
                        </p>
                    </div>
                    <div class="grid gap-3 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <SingleDatePopoverField
                                input-id="bil-create-invoice-date"
                                label="Invoice Date"
                                v-model="createForm.invoiceDate"
                                helper-text="Invoice posting date used for issue and settlement tracking."
                                placeholder="Select invoice date"
                                :error-message="createFieldError('invoiceDate')"
                            />
                        </div>
                        <div class="grid gap-2">
                            <SingleDatePopoverField
                                input-id="bil-create-payment-due-at"
                                label="Payment Due Date"
                                v-model="createForm.paymentDueAt"
                                helper-text="Optional due date for payment follow-up and cashier workflow."
                                placeholder="Select due date"
                                :error-message="createFieldError('paymentDueAt')"
                            />
                        </div>
                        <div class="grid gap-2 sm:col-span-2">
                            <Label for="bil-create-currency-code">Currency Code</Label>
                            <Input
                                id="bil-create-currency-code"
                                v-model="createForm.currencyCode"
                                maxlength="3"
                                :placeholder="defaultCurrencyCode"
                            />
                            <p
                                v-if="createFieldError('currencyCode')"
                                class="text-xs text-destructive"
                            >
                                {{ createFieldError('currencyCode') }}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 rounded-lg border p-4">
                    <div class="space-y-1">
                        <p class="text-sm font-medium text-foreground">Adjustments and notes</p>
                        <p class="text-xs text-muted-foreground">
                            Subtotal comes from the reviewed draft lines. Add only governed
                            adjustments and billing notes here.
                        </p>
                    </div>
                    <div class="grid gap-3 sm:grid-cols-3">
                        <div class="rounded-lg border bg-muted/20 p-3 sm:col-span-3">
                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Calculated Subtotal
                            </p>
                            <p class="mt-1 text-sm font-medium text-foreground">
                                {{ formatMoney(createLineItemsSubtotal, createForm.currencyCode || defaultCurrencyCode) }}
                            </p>
                            <p class="mt-1 text-xs text-muted-foreground">
                                Derived from the current draft lines.
                            </p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="bil-create-discount-amount">Discount Amount</Label>
                            <Input
                                id="bil-create-discount-amount"
                                v-model="createForm.discountAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                            <p
                                v-if="createFieldError('discountAmount')"
                                class="text-xs text-destructive"
                            >
                                {{ createFieldError('discountAmount') }}
                            </p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="bil-create-tax-amount">Tax Amount</Label>
                            <Input
                                id="bil-create-tax-amount"
                                v-model="createForm.taxAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                            <p
                                v-if="createFieldError('taxAmount')"
                                class="text-xs text-destructive"
                            >
                                {{ createFieldError('taxAmount') }}
                            </p>
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="bil-create-notes">Notes</Label>
                        <Textarea
                            id="bil-create-notes"
                            v-model="createForm.notes"
                            placeholder="Invoice notes, payment instructions, payer comments..."
                            class="min-h-24"
                        />
                        <p
                            v-if="createFieldError('notes')"
                            class="text-xs text-destructive"
                        >
                            {{ createFieldError('notes') }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
