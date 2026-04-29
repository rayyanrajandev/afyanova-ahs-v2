<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsContent } from '@/components/ui/tabs';
import { formatEnumLabel } from '@/lib/labels';
import {
    billingPaymentMethodOptions,
    billingPaymentPayerTypeOptions,
} from '../constants';
import {
    billingPaymentIsReversal,
    billingPaymentMetaLabel,
    billingPaymentOperationalProofText,
    billingPaymentOperatorLabel,
    billingPaymentRecordedAt,
    formatDateTime,
} from '../helpers';
import type {
    BillingInvoice,
    BillingInvoiceCoveragePosture,
    BillingInvoicePayment,
    BillingInvoicePaymentListResponse,
    InvoiceDetailsOperationalCard,
    InvoiceDetailsOperationalPanel,
    InvoiceDetailsPaymentsFilterForm,
    InvoiceWorkflowLink,
} from '../types';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

type ExecutionChecklist = {
    title: string;
    description: string;
    badgeLabel: string;
    items: string[];
};

type PaymentQuickFilter = {
    key: string;
    label: string;
    payerType: string;
    paymentMethod: string;
};

type LedgerActiveFilter = {
    key: string;
    label: string;
};

interface Props {
    invoice: BillingInvoice;
    operationalPanel: InvoiceDetailsOperationalPanel | null;
    coveragePosture: BillingInvoiceCoveragePosture | null;
    workflowStepCards: InvoiceDetailsOperationalCard[];
    executionControlCards: InvoiceDetailsOperationalCard[];
    executionChecklist: ExecutionChecklist | null;
    ledgerTitle: string;
    ledgerDescription: string;
    ledgerRestrictedTitle: string;
    ledgerRestrictedDescription: string;
    ledgerQuickFilters: PaymentQuickFilter[];
    ledgerDateTitle: string;
    ledgerDateHelper: string;
    ledgerSearchPlaceholder: string;
    ledgerSnapshotCards: InvoiceDetailsOperationalCard[];
    ledgerActiveFilters: LedgerActiveFilter[];
    ledgerEmptyStateLabel: string;
    ledgerEntryLabel: string;
    canViewBillingPaymentHistory: boolean;
    paymentsMeta: BillingInvoicePaymentListResponse['meta'] | null;
    paymentsLoading: boolean;
    paymentsError: string | null;
    payments: BillingInvoicePayment[];
    paymentsFilters: InvoiceDetailsPaymentsFilterForm;
    paymentsFiltersOpen: boolean;
    paymentReversalSubmitting: boolean;
    workflowLinks: InvoiceWorkflowLink[];
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
    previewText: (value: string | null) => string | null;
    shortId: (value: string | null) => string;
    billingPaymentCanBeReversed: (payment: BillingInvoicePayment) => boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'refresh-payments': [];
    'toggle-payments-filters': [];
    'submit-payments-filters': [];
    'reset-payments-filters': [];
    'apply-quick-filter': [filter: PaymentQuickFilter];
    'open-payment-reversal': [payment: BillingInvoicePayment];
}>();

function isQuickFilterActive(filter: PaymentQuickFilter): boolean {
    return (
        props.paymentsFilters.payerType === filter.payerType &&
        props.paymentsFilters.paymentMethod === filter.paymentMethod
    );
}

function updatePaymentsPayerType(value: string | number | undefined): void {
    props.paymentsFilters.payerType =
        value === 'all' ? '' : String(value ?? '');
}

function updatePaymentsMethod(value: string | number | undefined): void {
    props.paymentsFilters.paymentMethod =
        value === 'all' ? '' : String(value ?? '');
}

function updatePaymentsPerPage(value: string | number | undefined): void {
    props.paymentsFilters.perPage = Number(value ?? 20);
}
</script>

<template>
    <TabsContent value="workflows" class="mt-0 space-y-4">
        <div class="rounded-lg border p-4">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="text-sm font-medium">Execution path</p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        Track the active billing owner, next action, and what happens immediately after that step.
                    </p>
                </div>
                <Badge
                    v-if="operationalPanel"
                    :variant="coveragePosture?.badgeVariant ?? 'outline'"
                >
                    {{ operationalPanel.title }}
                </Badge>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-3">
                <div
                    v-for="card in workflowStepCards"
                    :key="`bil-workflow-step-${card.id}`"
                    class="rounded-lg bg-muted/30 p-3"
                >
                    <div class="space-y-1.5">
                        <p class="text-sm font-medium text-foreground">
                            {{ card.title }}
                        </p>
                        <p class="text-sm font-semibold leading-tight text-foreground">
                            {{ card.value }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            {{ card.helper }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div class="rounded-lg border p-4">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="text-sm font-medium">Execution controls</p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        Keep the active invoice lane moving with the exact operational cues for cashier, claims, exceptions, or reconciliation.
                    </p>
                </div>
                <Badge
                    v-if="operationalPanel"
                    :variant="coveragePosture?.badgeVariant ?? 'outline'"
                >
                    {{ operationalPanel.title }}
                </Badge>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div
                    v-for="card in executionControlCards"
                    :key="`bil-execution-control-${card.id}`"
                    class="rounded-lg bg-muted/30 p-3"
                >
                    <div class="space-y-1.5">
                        <p class="text-sm font-medium text-foreground">
                            {{ card.title }}
                        </p>
                        <p class="text-sm font-semibold leading-tight text-foreground">
                            {{ card.value }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            {{ card.helper }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div
            v-if="executionChecklist"
            class="rounded-lg border p-4"
        >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="text-sm font-medium">
                        {{ executionChecklist.title }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ executionChecklist.description }}
                    </p>
                </div>
                <Badge variant="outline">
                    {{ executionChecklist.badgeLabel }}
                </Badge>
            </div>
            <div class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div
                    v-for="item in executionChecklist.items"
                    :key="`invoice-details-execution-check-${item}`"
                    class="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground"
                >
                    <AppIcon
                        name="check"
                        class="mt-0.5 size-3.5 shrink-0 text-primary"
                    />
                    <span>{{ item }}</span>
                </div>
            </div>
        </div>

        <div class="rounded-lg border p-4">
            <div
                class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
                <div>
                    <p class="text-sm font-medium">{{ ledgerTitle }}</p>
                    <p class="text-xs text-muted-foreground">
                        {{ ledgerDescription }}
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <Badge
                        v-if="canViewBillingPaymentHistory"
                        variant="outline"
                    >
                        {{ paymentsMeta?.total ?? 0 }} entries
                    </Badge>
                    <Badge v-else variant="secondary">History Restricted</Badge>
                    <Button
                        v-if="canViewBillingPaymentHistory"
                        type="button"
                        size="sm"
                        variant="outline"
                        :disabled="paymentsLoading"
                        @click="emit('refresh-payments')"
                    >
                        {{
                            paymentsLoading
                                ? 'Refreshing...'
                                : 'Refresh History'
                        }}
                    </Button>
                </div>
            </div>

            <Alert
                v-if="!canViewBillingPaymentHistory"
                class="mt-3"
            >
                <AlertTitle>{{ ledgerRestrictedTitle }}</AlertTitle>
                <AlertDescription>
                    {{ ledgerRestrictedDescription }}
                </AlertDescription>
            </Alert>

            <div
                v-else
                class="mt-3 space-y-3"
            >
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        v-for="filter in ledgerQuickFilters"
                        :key="`invoice-details-ledger-filter-${filter.key}`"
                        type="button"
                        size="sm"
                        :variant="isQuickFilterActive(filter) ? 'default' : 'outline'"
                        class="h-7 px-2.5 text-xs"
                        :disabled="paymentsLoading"
                        @click="emit('apply-quick-filter', filter)"
                    >
                        {{ filter.label }}
                    </Button>
                    <Separator orientation="vertical" class="!h-4" />
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                        @click="emit('toggle-payments-filters')"
                    >
                        <AppIcon :name="paymentsFiltersOpen ? 'chevron-up' : 'sliders-horizontal'" class="size-3" />
                        {{ paymentsFiltersOpen ? 'Hide filters' : 'More filters' }}
                    </Button>
                </div>

                <div class="relative">
                    <Input
                        id="bil-details-payments-q"
                        v-model="paymentsFilters.q"
                        :placeholder="ledgerSearchPlaceholder"
                        class="pr-20"
                        @keyup.enter="emit('submit-payments-filters')"
                    />
                    <Button
                        v-if="paymentsFilters.q"
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
                        :disabled="paymentsLoading"
                        @click="emit('submit-payments-filters')"
                    >
                        Search
                    </Button>
                </div>

                <div v-if="paymentsFiltersOpen" class="space-y-3 rounded-lg border p-3">
                    <div class="grid gap-3 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="bil-details-payments-payer-type">
                                Payer Type
                            </Label>
                            <Select
                                :model-value="paymentsFilters.payerType"
                                @update:model-value="updatePaymentsPayerType"
                            >
                                <SelectTrigger id="bil-details-payments-payer-type" class="w-full">
                                    <SelectValue placeholder="All payer types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All payer types</SelectItem>
                                    <SelectItem
                                        v-for="option in billingPaymentPayerTypeOptions"
                                        :key="`details-payer-${option.value}`"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label for="bil-details-payments-method">
                                Payment Method
                            </Label>
                            <Select
                                :model-value="paymentsFilters.paymentMethod"
                                @update:model-value="updatePaymentsMethod"
                            >
                                <SelectTrigger id="bil-details-payments-method" class="w-full">
                                    <SelectValue placeholder="All payment methods" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All payment methods</SelectItem>
                                    <SelectItem
                                        v-for="option in billingPaymentMethodOptions"
                                        :key="`details-method-${option.value}`"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2 sm:col-span-2">
                            <DateRangeFilterPopover
                                input-base-id="bil-details-payments-date-range"
                                :title="ledgerDateTitle"
                                :helper-text="ledgerDateHelper"
                                from-label="Paid From"
                                to-label="Paid To"
                                v-model:from="paymentsFilters.from"
                                v-model:to="paymentsFilters.to"
                            />
                        </div>
                        <div class="grid gap-2">
                            <Label for="bil-details-payments-per-page">
                                Results per page
                            </Label>
                            <Select
                                :model-value="String(paymentsFilters.perPage)"
                                @update:model-value="updatePaymentsPerPage"
                            >
                                <SelectTrigger id="bil-details-payments-per-page" class="w-full">
                                    <SelectValue placeholder="20" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            :disabled="paymentsLoading"
                            @click="emit('submit-payments-filters')"
                        >
                            Apply
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            :disabled="paymentsLoading"
                            @click="emit('reset-payments-filters')"
                        >
                            Reset
                        </Button>
                    </div>
                </div>
            </div>

            <div
                v-if="canViewBillingPaymentHistory"
                class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
                <div
                    v-for="card in ledgerSnapshotCards"
                    :key="`invoice-details-ledger-snapshot-${card.id}`"
                    class="rounded-lg bg-muted/30 p-3"
                >
                    <div>
                        <p class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            {{ card.title }}
                        </p>
                        <p class="mt-2 text-sm font-semibold text-foreground">
                            {{ card.value }}
                        </p>
                        <p class="mt-1 text-xs text-muted-foreground">
                            {{ card.helper }}
                        </p>
                    </div>
                </div>
            </div>

            <div
                v-if="canViewBillingPaymentHistory && ledgerActiveFilters.length"
                class="mt-3 flex flex-wrap gap-2"
            >
                <Badge
                    v-for="filter in ledgerActiveFilters"
                    :key="`invoice-details-ledger-active-filter-${filter.key}`"
                    variant="outline"
                >
                    {{ filter.label }}
                </Badge>
            </div>

            <Alert
                v-if="canViewBillingPaymentHistory && paymentsError"
                variant="destructive"
                class="mt-3"
            >
                <AlertTitle>{{ ledgerTitle }} unavailable</AlertTitle>
                <AlertDescription>{{ paymentsError }}</AlertDescription>
            </Alert>

            <div
                v-else-if="canViewBillingPaymentHistory && paymentsLoading"
                class="mt-3 space-y-2"
            >
                <Skeleton class="h-16 w-full" />
                <Skeleton class="h-16 w-full" />
            </div>
            <div
                v-else-if="canViewBillingPaymentHistory && payments.length === 0"
                class="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground"
            >
                {{ ledgerEmptyStateLabel }}
            </div>
            <div v-else-if="canViewBillingPaymentHistory" class="mt-3 space-y-2">
                <div
                    v-for="payment in payments"
                    :key="payment.id"
                    class="rounded-lg bg-muted/30 p-3"
                >
                    <div
                        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                        <div class="min-w-0 flex-1 space-y-2">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="text-base font-semibold leading-none">
                                    {{
                                        formatMoney(
                                            payment.amount,
                                            invoice.currencyCode,
                                        )
                                    }}
                                </p>
                                <Badge
                                    :variant="
                                        billingPaymentIsReversal(payment)
                                            ? 'destructive'
                                            : 'outline'
                                    "
                                >
                                    {{
                                        billingPaymentIsReversal(payment)
                                            ? 'Reversal'
                                            : ledgerEntryLabel
                                    }}
                                </Badge>
                                <span class="text-xs text-muted-foreground">
                                    ({{ formatEnumLabel(payment.sourceAction) }})
                                </span>
                            </div>
                            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <div class="rounded-md bg-muted/30 px-2.5 py-2">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        Route
                                    </p>
                                    <p class="mt-1 text-xs font-medium text-foreground">
                                        {{
                                            billingPaymentMetaLabel(payment) ||
                                            'No payer/method metadata'
                                        }}
                                    </p>
                                </div>
                                <div class="rounded-md bg-muted/30 px-2.5 py-2">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        Proof
                                    </p>
                                    <p class="mt-1 text-xs font-medium text-foreground break-words">
                                        {{
                                            payment.paymentReference ||
                                            payment.approvalCaseReference ||
                                            'No reference captured'
                                        }}
                                    </p>
                                </div>
                                <div class="rounded-md bg-muted/30 px-2.5 py-2">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        Cumulative after post
                                    </p>
                                    <p class="mt-1 text-xs font-medium text-foreground">
                                        {{
                                            formatMoney(
                                                payment.cumulativePaidAmount,
                                                invoice.currencyCode,
                                            )
                                        }}
                                    </p>
                                </div>
                                <div class="rounded-md bg-muted/30 px-2.5 py-2">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        Recorded by
                                    </p>
                                    <p class="mt-1 text-xs font-medium text-foreground">
                                        {{ billingPaymentOperatorLabel(payment) }}
                                    </p>
                                </div>
                            </div>
                            <div class="space-y-1 text-xs text-muted-foreground">
                                <p
                                    v-if="
                                        billingPaymentIsReversal(payment) &&
                                        payment.reversalOfPaymentId
                                    "
                                >
                                    Reversal of {{ shortId(payment.reversalOfPaymentId) }}
                                </p>
                                <p v-if="payment.reversalReason">
                                    Reason: {{ payment.reversalReason }}
                                </p>
                                <p v-if="payment.approvalCaseReference">
                                    Approval ref: {{ payment.approvalCaseReference }}
                                </p>
                                <p v-if="previewText(payment.note)">
                                    {{ previewText(payment.note) }}
                                </p>
                            </div>
                        </div>
                        <div class="space-y-2 text-xs sm:min-w-[12rem] sm:text-right">
                            <p class="font-medium text-foreground">
                                {{
                                    billingPaymentRecordedAt(payment)
                                        ? formatDateTime(billingPaymentRecordedAt(payment))
                                        : 'No posting time'
                                }}
                            </p>
                            <p class="text-muted-foreground">
                                {{
                                    billingPaymentOperationalProofText(
                                        payment.payerType,
                                        payment.paymentMethod,
                                    )
                                }}
                            </p>
                            <div
                                v-if="billingPaymentCanBeReversed(payment)"
                                class="pt-1 sm:flex sm:justify-end"
                            >
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    class="w-full sm:w-auto"
                                    :disabled="paymentReversalSubmitting"
                                    @click="emit('open-payment-reversal', payment)"
                                >
                                    Reverse
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="rounded-lg border p-4">
            <div>
                <p class="text-sm font-medium">Related workflows</p>
                <p class="mt-1 text-xs text-muted-foreground">
                    Open only the modules that are available in your current access scope.
                </p>
            </div>

            <div
                v-if="workflowLinks.length === 0"
                class="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground"
            >
                No related workflow links are available for this invoice in your current access scope.
            </div>
            <div v-else class="mt-4 space-y-2">
                <Link
                    v-for="link in workflowLinks"
                    :key="`bil-workflow-link-${link.key}`"
                    :href="link.href"
                    class="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                    <div class="flex min-w-0 items-start gap-3">
                        <span class="mt-0.5 rounded-md border bg-muted/40 p-1.5 text-muted-foreground">
                            <AppIcon :name="link.icon" class="size-4" />
                        </span>
                        <div class="min-w-0">
                            <p class="text-sm font-medium text-foreground">
                                {{ link.label }}
                            </p>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{ link.helper }}
                            </p>
                        </div>
                    </div>
                    <AppIcon name="arrow-up-right" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </Link>
            </div>
        </div>
    </TabsContent>
</template>
