<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

import {
    amountToNumber,
    billingInvoiceSettlementMode,
    billingInvoiceThirdPartyPhase,
    billingPaymentIsReversal,
    billingPaymentMethodLabel,
    billingPaymentOperationalProofText,
    billingPaymentPayerTypeLabel,
    defaultLocalDateTime,
    formatDate,
    formatDateTime,
    localDateTimeDatePart,
    localDateTimeTimePart,
    mergeLocalDateAndTimeParts,
} from '../helpers';
import type {
    BillingDialogPreviewCard,
    BillingInvoice,
    BillingInvoicePayment,
} from '../types';

const props = defineProps<{
    open: boolean;
    invoice: BillingInvoice | null;
    payment: BillingInvoicePayment | null;
    payments: BillingInvoicePayment[];
    error?: string | null;
    submitting?: boolean;
    defaultCurrencyCode: string;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'clear-error'): void;
    (
        e: 'submit',
        payload: {
            amount: number;
            reason: string;
            approvalCaseReference: string | null;
            note: string | null;
            reversalAt: string | null;
        },
    ): void;
}>();

const amount = ref('');
const reason = ref('');
const approvalCaseReference = ref('');
const note = ref('');
const reversalAt = ref('');
const localError = ref<string | null>(null);

const reversalAtDate = computed({
    get: () => localDateTimeDatePart(reversalAt.value),
    set: (value: string) => {
        reversalAt.value = mergeLocalDateAndTimeParts(
            String(value ?? ''),
            localDateTimeTimePart(reversalAt.value),
            reversalAt.value,
        );
    },
});

const reversalAtTime = computed({
    get: () => localDateTimeTimePart(reversalAt.value),
    set: (value: string) => {
        reversalAt.value = mergeLocalDateAndTimeParts(
            localDateTimeDatePart(reversalAt.value),
            String(value ?? ''),
            reversalAt.value,
        );
    },
});

const currentCurrencyCode = computed(
    () =>
        props.invoice?.currencyCode?.trim()?.toUpperCase() ||
        props.defaultCurrencyCode.trim().toUpperCase(),
);

const paymentReversalTargetsPaidInvoice = computed(() => {
    const status = (props.invoice?.status ?? '').toLowerCase();
    return status === 'paid';
});

const paymentReversalDialogParsedAmount = computed<number | null>(() => {
    const trimmedAmount = amount.value.trim();
    if (!trimmedAmount) return null;
    const parsed = Number(trimmedAmount);
    return Number.isFinite(parsed) ? parsed : null;
});

const paymentReversalProjectedPaidAmount = computed<number | null>(() => {
    const invoice = props.invoice;
    const reversalAmount = paymentReversalDialogParsedAmount.value;
    if (!invoice || reversalAmount === null) return null;

    const currentPaid = amountToNumber(invoice.paidAmount ?? null) ?? 0;
    return Math.max(currentPaid - reversalAmount, 0);
});

const paymentReversalProjectedBalance = computed<number | null>(() => {
    const invoice = props.invoice;
    const projectedPaid = paymentReversalProjectedPaidAmount.value;
    if (!invoice || projectedPaid === null) return null;

    const total = amountToNumber(invoice.totalAmount ?? null);
    if (total === null) return null;
    return Math.max(total - projectedPaid, 0);
});

const errorMessage = computed(() => localError.value ?? props.error ?? null);

function shortId(value: string | null): string {
    if (!value) return 'N/A';
    return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

function formatMoney(value: string | number | null, currencyCode: string | null): string {
    const amountValue = amountToNumber(value);
    if (amountValue === null) return 'N/A';

    const currency =
        (currencyCode?.trim() || props.defaultCurrencyCode).toUpperCase();

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(amountValue);
    } catch {
        return `${currency} ${amountValue.toFixed(2)}`;
    }
}

function billingPaymentReversedAmountFor(paymentId: string): number {
    return (
        Math.round(
            props.payments
                .filter(
                    (entry) =>
                        billingPaymentIsReversal(entry) &&
                        entry.reversalOfPaymentId === paymentId,
                )
                .reduce(
                    (sum, entry) =>
                        sum + Math.abs(amountToNumber(entry.amount) ?? 0),
                    0,
                ) * 100,
        ) / 100
    );
}

function billingPaymentRemainingReversibleAmount(
    payment: BillingInvoicePayment,
): number {
    const originalAmount = Math.abs(amountToNumber(payment.amount) ?? 0);
    const reversedAmount = billingPaymentReversedAmountFor(payment.id);
    return Math.round(Math.max(originalAmount - reversedAmount, 0) * 100) / 100;
}

const paymentReversalPreviewCards = computed<BillingDialogPreviewCard[]>(() => {
    const invoice = props.invoice;
    const payment = props.payment;
    if (!invoice || !payment) return [];

    const remainingReversible =
        billingPaymentRemainingReversibleAmount(payment);

    return [
        {
            title: 'Target payment',
            value: formatMoney(payment.amount, invoice.currencyCode),
            helper: `Originally posted ${formatDateTime(payment.paymentAt ?? null)}.`,
        },
        {
            title: 'Remaining reversible',
            value: formatMoney(remainingReversible, invoice.currencyCode),
            helper: 'Upper limit available for this compensating reversal.',
        },
        {
            title: 'Projected paid',
            value: formatMoney(
                paymentReversalProjectedPaidAmount.value,
                invoice.currencyCode,
            ),
            helper: 'Invoice paid amount after the reversal ledger entry posts.',
        },
        {
            title: 'Projected balance',
            value: formatMoney(
                paymentReversalProjectedBalance.value,
                invoice.currencyCode,
            ),
            helper: paymentReversalTargetsPaidInvoice.value
                ? 'This is the balance that returns once the paid invoice is reopened.'
                : 'This is the balance after the reversal entry posts.',
            valueClass:
                paymentReversalProjectedBalance.value !== null &&
                paymentReversalProjectedBalance.value > 0
                    ? 'text-amber-600 dark:text-amber-300'
                    : undefined,
        },
    ];
});

const paymentReversalSnapshotCards = computed<BillingDialogPreviewCard[]>(() => {
    const payment = props.payment;
    if (!payment) return [];

    const originalReference = (payment.paymentReference ?? '').trim();
    const approvalReference =
        approvalCaseReference.value.trim() ||
        (payment.approvalCaseReference ?? '').trim();
    const reversalTimestamp = reversalAt.value.trim();

    return [
        {
            title: 'Original route',
            value: [
                billingPaymentPayerTypeLabel(payment.payerType),
                billingPaymentMethodLabel(payment.paymentMethod),
            ]
                .filter(Boolean)
                .join(' / '),
            helper: 'Keep the compensating reversal on the same financial route as the original entry.',
        },
        {
            title: 'Original reference',
            value: originalReference || 'No reference captured',
            helper: originalReference
                ? 'Use this to trace the original posting during cashier or finance review.'
                : 'Original entry did not store a control reference.',
        },
        {
            title: 'Reversal time',
            value: reversalTimestamp
                ? formatDateTime(reversalTimestamp)
                : 'Not set',
            helper: reversalTimestamp
                ? 'Business date and time that will be recorded for the correcting entry.'
                : 'Set the business date and time before posting the reversal.',
        },
        {
            title: 'Approval trail',
            value: approvalReference || 'Add if policy requires',
            helper: paymentReversalTargetsPaidInvoice.value
                ? 'Paid-invoice corrections may need a supervisor or case reference.'
                : 'Use when local reversal policy requires approval evidence.',
            valueClass:
                !approvalReference && paymentReversalTargetsPaidInvoice.value
                    ? 'text-amber-600 dark:text-amber-300'
                    : undefined,
        },
    ];
});

const paymentReversalExecutionCards = computed<BillingDialogPreviewCard[]>(() => {
    const invoice = props.invoice;
    const payment = props.payment;
    if (!invoice || !payment) return [];

    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);
    const projectedBalance = paymentReversalProjectedBalance.value ?? 0;
    const payerLabel =
        (invoice.payerSummary?.payerName ?? '').trim() ||
        billingPaymentPayerTypeLabel(
            invoice.payerSummary?.payerType ?? payment.payerType,
        );
    const methodLabel = billingPaymentMethodLabel(payment.paymentMethod);

    let queueValue =
        projectedBalance > 0 ? 'Cashier balance follow-up' : 'Cashier review only';
    let queueHelper =
        projectedBalance > 0
            ? 'This reversal reopens cashier follow-up because patient balance returns after the compensating entry posts.'
            : 'The invoice stays closed after the reversal, but the audit trail still needs review.';
    let proofValue = methodLabel;
    let proofHelper = billingPaymentOperationalProofText(
        payment.payerType,
        payment.paymentMethod,
    );
    let timingValue = 'Same correction shift';
    let timingHelper =
        'Record the correction on the business date when the cashier or finance team confirmed the posting issue.';
    let disciplineHelper =
        'The original entry stays immutable. Corrections happen only through compensating reversals and clear operator reasoning.';

    if (usesThirdPartySettlement) {
        if (thirdPartyPhase === 'remittance_reconciliation') {
            queueValue =
                projectedBalance > 0
                    ? 'Remittance & reconciliation'
                    : 'Reconciliation review only';
            queueHelper =
                projectedBalance > 0
                    ? 'The reversal reopens reconciliation so payer remittance and patient-share balance can be matched again.'
                    : 'The invoice stays financially closed, but reconciliation review remains the follow-up after this correction.';
            proofValue = 'Remittance control trail';
            proofHelper =
                'Keep the remittance advice, bank slip, cheque details, or payer control number aligned to this exact reversal.';
            timingValue = invoice.payerSummary?.settlementCycleDays
                ? `${invoice.payerSummary.settlementCycleDays} day cycle`
                : 'Current remittance cycle';
            timingHelper =
                'Reverse inside the current reconciliation cycle so payer and patient-share follow-up do not drift apart.';
            disciplineHelper =
                'Keep payer remittance and patient-share correction separate. Never overwrite a settled ledger trail directly.';
        } else {
            queueValue =
                projectedBalance > 0
                    ? 'Claim prep & settlement follow-up'
                    : 'Claim review only';
            queueHelper =
                projectedBalance > 0
                    ? 'The reversal reopens payer follow-up, so claim context and outstanding settlement need to move together again.'
                    : 'The invoice stays closed, but claim-side review should still understand the corrected payment trail.';
            proofValue = 'Claim or payer control trail';
            proofHelper = `Keep the ${payerLabel} claim, guarantee, or control reference matched to the reversed settlement entry.`;
            timingValue = invoice.payerSummary?.claimSubmissionDueAt
                ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
                : 'Current payer follow-up window';
            timingHelper =
                'Correct the posting quickly so claim routing and payer balance control remain trustworthy.';
            disciplineHelper =
                'Use governed reversal only and keep claim references synchronized with the corrected settlement history.';
        }
    }

    return [
        {
            title: 'Reopens lane',
            value: queueValue,
            helper: queueHelper,
        },
        {
            title: 'Proof to retain',
            value: proofValue,
            helper: proofHelper,
        },
        {
            title: 'Timing target',
            value: timingValue,
            helper: timingHelper,
        },
        {
            title: 'Correction discipline',
            value: 'Immutable reversal trail',
            helper: disciplineHelper,
        },
    ];
});

const paymentReversalChecklistItems = computed(() => {
    const invoice = props.invoice;
    const payment = props.payment;
    if (!invoice || !payment) return [];

    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const items = [
        'Confirm the reversal amount matches the exact posting mistake before submitting.',
        'Keep the reversal reason precise enough for cashier, finance, and audit review later.',
    ];

    if (payment.approvalCaseReference) {
        items.push(
            'Retain the existing approval or case reference so the correction chain stays visible.',
        );
    } else if (paymentReversalTargetsPaidInvoice.value) {
        items.push(
            'Attach the supervisor or case reference if policy requires approval for reopening a paid invoice.',
        );
    }

    if (usesThirdPartySettlement) {
        items.push(
            'Keep payer remittance and patient-share correction separate so reconciliation remains clean.',
        );
        items.push(
            'Carry the payer control, remittance advice, or bank/cheque support that explains why this settlement is being reversed.',
        );
    } else if ((payment.paymentMethod ?? '').trim().toLowerCase() === 'mobile_money') {
        items.push(
            'Keep the mobile money transaction ID and telecom trace aligned to the reversal note.',
        );
    } else if ((payment.paymentMethod ?? '').trim().toLowerCase() === 'cash') {
        items.push(
            'Keep the receipt/daybook trail aligned so cashier totals reconcile after the compensating entry posts.',
        );
    } else {
        items.push(
            'Retain the original transaction proof so the compensating reversal is easy to trace later.',
        );
    }

    return items;
});

const paymentReversalFooterGuidance = computed(() => {
    const card = paymentReversalExecutionCards.value[0];
    return card
        ? `${card.value} becomes the follow-up context after this reversal posts.`
        : 'Use governed reversal only when the original payment entry was posted against the wrong financial state.';
});

const paymentReversalReasonQuickActions = computed(() => {
    if (paymentReversalTargetsPaidInvoice.value) {
        return [
            'Duplicate payment posted',
            'Wrong amount posted',
            'Wrong payer route posted',
            'Paid invoice correction after reconciliation review',
        ];
    }

    return [
        'Duplicate payment posted',
        'Wrong amount posted',
        'Wrong payment method recorded',
        'Patient transfer or cashier correction',
    ];
});

function initializeForm() {
    const payment = props.payment;
    if (!payment) return;

    amount.value = String(billingPaymentRemainingReversibleAmount(payment));
    reason.value = '';
    approvalCaseReference.value = '';
    note.value = '';
    reversalAt.value = defaultLocalDateTime();
    localError.value = null;
}

function resetForm() {
    amount.value = '';
    reason.value = '';
    approvalCaseReference.value = '';
    note.value = '';
    reversalAt.value = '';
    localError.value = null;
}

function handleOpenChange(open: boolean) {
    if (open) {
        emit('update:open', true);
        return;
    }

    if (props.submitting) return;
    emit('update:open', false);
}

function applyPaymentReversalReasonQuickAction(nextReason: string) {
    reason.value = nextReason;
}

function submitForm() {
    const payment = props.payment;
    if (!props.invoice || !payment) return;

    const parsedAmount = Number(amount.value.trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        localError.value =
            'Reversal amount must be a valid number greater than zero.';
        return;
    }

    const remainingReversible = billingPaymentRemainingReversibleAmount(payment);
    if (parsedAmount > remainingReversible) {
        localError.value =
            'Reversal amount cannot exceed the remaining reversible amount for this payment.';
        return;
    }

    const trimmedReason = reason.value.trim();
    if (!trimmedReason) {
        localError.value = 'Reversal reason is required.';
        return;
    }

    localError.value = null;
    emit('submit', {
        amount: parsedAmount,
        reason: trimmedReason,
        approvalCaseReference: approvalCaseReference.value.trim() || null,
        note: note.value.trim() || null,
        reversalAt: reversalAt.value.trim() || null,
    });
}

watch(
    () => [props.open, props.invoice?.id ?? null, props.payment?.id ?? null] as const,
    ([open, invoiceId, paymentId]) => {
        if (open && invoiceId && paymentId) {
            initializeForm();
            return;
        }

        if (!open) {
            resetForm();
        }
    },
    { immediate: true },
);

watch([amount, reason, approvalCaseReference, note, reversalAt], () => {
    if (!localError.value && !props.error) return;
    localError.value = null;
    emit('clear-error');
});
</script>

<template>
    <Sheet :open="open" @update:open="handleOpenChange">
        <SheetContent
            side="right"
            variant="form"
            size="2xl"
        >
            <SheetHeader
                class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4 text-left"
            >
                <SheetTitle>Reverse Payment Entry</SheetTitle>
                <SheetDescription>
                    Create a compensating reversal ledger entry. The original payment row remains immutable.
                </SheetDescription>
            </SheetHeader>

            <div class="flex-1 overflow-y-auto px-6 py-4">
                <div v-if="invoice && payment" class="space-y-4">
                    <div class="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 sm:items-start">
                        <div class="space-y-1 text-sm">
                            <p class="font-medium">
                                {{ invoice.invoiceNumber || shortId(invoice.id) }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                Current Paid:
                                {{ formatMoney(invoice.paidAmount, currentCurrencyCode) }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                Balance:
                                {{ formatMoney(invoice.balanceAmount, currentCurrencyCode) }}
                            </p>
                        </div>
                        <div class="space-y-1 text-sm">
                            <p class="font-medium">
                                Target Payment
                                {{ formatMoney(payment.amount, currentCurrencyCode) }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                Paid At:
                                {{ formatDateTime(payment.paymentAt) }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                Remaining Reversible:
                                {{
                                    formatMoney(
                                        billingPaymentRemainingReversibleAmount(payment),
                                        currentCurrencyCode,
                                    )
                                }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="paymentReversalPreviewCards.length"
                        class="grid gap-2 md:grid-cols-2 md:items-start xl:grid-cols-4"
                    >
                        <div
                            v-for="card in paymentReversalPreviewCards"
                            :key="`payment-reversal-preview-${card.title}`"
                            class="rounded-lg bg-background/80 p-3"
                        >
                            <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                {{ card.title }}
                            </p>
                            <p
                                class="mt-2 text-sm font-semibold"
                                :class="card.valueClass ?? 'text-foreground'"
                            >
                                {{ card.value }}
                            </p>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{ card.helper }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="paymentReversalSnapshotCards.length"
                        class="grid gap-2 md:grid-cols-2 md:items-start xl:grid-cols-4"
                    >
                        <div
                            v-for="card in paymentReversalSnapshotCards"
                            :key="`payment-reversal-snapshot-${card.title}`"
                            class="rounded-lg bg-background/80 p-3"
                        >
                            <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                {{ card.title }}
                            </p>
                            <p
                                class="mt-2 text-sm font-semibold"
                                :class="card.valueClass ?? 'text-foreground'"
                            >
                                {{ card.value }}
                            </p>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{ card.helper }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="paymentReversalExecutionCards.length"
                        class="grid gap-2 md:grid-cols-2 md:items-start xl:grid-cols-4"
                    >
                        <div
                            v-for="card in paymentReversalExecutionCards"
                            :key="`payment-reversal-execution-${card.title}`"
                            class="rounded-lg bg-background/80 p-3"
                        >
                            <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                {{ card.title }}
                            </p>
                            <p
                                class="mt-2 text-sm font-semibold"
                                :class="card.valueClass ?? 'text-foreground'"
                            >
                                {{ card.value }}
                            </p>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{ card.helper }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="paymentReversalChecklistItems.length"
                        class="rounded-lg bg-muted/30 p-3"
                    >
                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Reversal checklist
                        </p>
                        <div class="mt-2 space-y-2">
                            <div
                                v-for="item in paymentReversalChecklistItems"
                                :key="`payment-reversal-check-${item}`"
                                class="flex items-start gap-2 text-xs text-muted-foreground"
                            >
                                <AppIcon
                                    name="check"
                                    class="mt-0.5 size-3.5 shrink-0 text-primary"
                                />
                                <span>{{ item }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2 rounded-lg bg-muted/30 p-3">
                        <div class="space-y-1">
                            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                Common correction reasons
                            </p>
                            <p class="text-xs text-muted-foreground">
                                Use the closest governed reason first, then add extra detail only when the correction needs it.
                            </p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                v-for="quickReason in paymentReversalReasonQuickActions"
                                :key="`payment-reversal-reason-${quickReason}`"
                                type="button"
                                variant="outline"
                                size="sm"
                                class="h-8"
                                @click="applyPaymentReversalReasonQuickAction(quickReason)"
                            >
                                {{ quickReason }}
                            </Button>
                        </div>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="billing-reversal-amount">Reversal Amount</Label>
                            <Input
                                id="billing-reversal-amount"
                                v-model="amount"
                                type="number"
                                min="0"
                                step="0.01"
                                inputmode="decimal"
                                placeholder="0.00"
                            />
                            <p class="text-xs text-muted-foreground">
                                Partial reversals are allowed up to the remaining reversible amount.
                            </p>
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                            <SingleDatePopoverField
                                input-id="billing-reversal-date"
                                v-model="reversalAtDate"
                                label="Reversal date"
                                helper-text="Use the business date for the correction entry."
                            />
                            <TimePopoverField
                                input-id="billing-reversal-time"
                                v-model="reversalAtTime"
                                label="Reversal time"
                                helper-text="Defaults to the current local time and supports back-entry."
                            />
                        </div>
                        <div class="grid gap-2 sm:col-span-2">
                            <Label for="billing-reversal-reason">Reversal Reason</Label>
                            <Textarea
                                id="billing-reversal-reason"
                                v-model="reason"
                                class="min-h-24"
                                placeholder="Required reason for audit and reconciliation"
                            />
                        </div>
                        <div class="grid gap-2">
                            <Label for="billing-reversal-approval-ref">
                                Approval Case Reference
                            </Label>
                            <Input
                                id="billing-reversal-approval-ref"
                                v-model="approvalCaseReference"
                                placeholder="Policy-dependent supervisor/ticket reference"
                            />
                            <p class="text-xs text-muted-foreground">
                                May be required by reversal policy for larger amounts.
                            </p>
                            <p
                                v-if="paymentReversalTargetsPaidInvoice"
                                class="text-xs text-amber-700 dark:text-amber-300"
                            >
                                Paid invoice reversal: approval reference may be required by policy.
                            </p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="billing-reversal-note">Reversal Note</Label>
                            <Input
                                id="billing-reversal-note"
                                v-model="note"
                                placeholder="Optional operator note"
                            />
                        </div>
                    </div>

                    <Alert v-if="errorMessage" variant="destructive">
                        <AlertTitle>Reversal validation</AlertTitle>
                        <AlertDescription>{{ errorMessage }}</AlertDescription>
                    </Alert>
                </div>
            </div>

            <SheetFooter class="mt-auto shrink-0 gap-2 border-t bg-background px-6 py-4">
                <p class="mr-auto text-xs text-muted-foreground">
                    {{ paymentReversalFooterGuidance }}
                </p>
                <Button
                    variant="outline"
                    :disabled="submitting"
                    @click="handleOpenChange(false)"
                >
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    :disabled="submitting"
                    @click="submitForm"
                >
                    {{ submitting ? 'Reversing...' : 'Reverse Payment' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
