<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEnumLabel } from '@/lib/labels';
import {
    amountToNumber,
    billingInvoiceClaimPostureLabel,
    billingInvoiceCoverageMetricBadges,
    billingInvoiceCoveragePosture,
    billingInvoiceFinancePostingBadges,
    billingInvoiceQueueActionLeadDetails,
    billingInvoiceQueueLaneLabel,
    billingInvoiceQueueLastActivityLabel,
    billingInvoiceQueueNextStep,
    billingInvoiceQueuePaidLabel,
    billingInvoiceSettlementMode,
    billingInvoiceStatusActionLabel,
    billingInvoiceThirdPartyPhaseLabel,
    formatDate,
    invoiceLineItemCount,
    invoiceQueueDetailsLabel,
    statusVariant,
} from '../helpers';
import type {
    BillingInvoice,
    BillingInvoiceStatusAction,
    BillingQueueThirdPartyPhaseFilter,
} from '../types';

type QueueClaimsAction = {
    href: string;
    label: string;
};

type BillingQueuePagination = {
    currentPage?: number | null;
    lastPage?: number | null;
    total?: number | null;
} | null;

type QueueStatusActionPayload = {
    invoice: BillingInvoice;
    action: BillingInvoiceStatusAction;
};

interface Props {
    pageLoading: boolean;
    listLoading: boolean;
    compactQueueRows: boolean;
    visibleInvoices: BillingInvoice[];
    invoicesCount: number;
    pagination: BillingQueuePagination;
    billingQueueThirdPartyPhaseFilter: BillingQueueThirdPartyPhaseFilter;
    canIssueBillingInvoices: boolean;
    canRecordBillingPayments: boolean;
    canUpdateDraftBillingInvoices: boolean;
    canCancelBillingInvoices: boolean;
    canVoidBillingInvoices: boolean;
    actionLoadingId: string | null;
    editDialogLoading: boolean;
    invoiceDetailsPaymentsLoading: boolean;
    invoiceDetailsInvoiceId: string | null;
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
    previewText: (value: string | null) => string | null;
    invoiceAccentClass: (status: string | null) => string;
    invoicePatientLabel: (invoice: BillingInvoice) => string;
    invoicePatientNumber: (invoice: BillingInvoice) => string | null;
    invoiceSourceLabel: (invoice: BillingInvoice) => string | null;
    invoiceSourceWorkflowHref: (invoice: BillingInvoice) => string | null;
    invoiceLastPaymentMetaLabel: (invoice: BillingInvoice) => string | null;
    invoiceLineItemPreview: (invoice: BillingInvoice) => string[];
    billingInvoiceQueueClaimsAction: (invoice: BillingInvoice) => QueueClaimsAction | null;
    billingInvoiceShouldPrioritizeClaimsAction: (invoice: BillingInvoice) => boolean;
    billingInvoiceQueueActionRailLabel: (invoice: BillingInvoice) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'status-action': [payload: QueueStatusActionPayload];
    'open-draft-workspace': [invoice: BillingInvoice];
    'open-edit-draft': [invoice: BillingInvoice];
    'open-details': [invoice: BillingInvoice];
    'prev-page': [];
    'next-page': [];
}>();

const emptyStateMessage = computed(() => {
    if (props.invoicesCount === 0) {
        return 'No billing invoices found for the current filters.';
    }

    if (props.billingQueueThirdPartyPhaseFilter !== 'all') {
        return 'No third-party invoices on this page match the selected workstream.';
    }

    return 'No billing invoices on this page match the selected lane.';
});

const currentPage = computed(() => props.pagination?.currentPage ?? 1);
const lastPage = computed(() => props.pagination?.lastPage ?? 1);
const totalResults = computed(() => props.pagination?.total ?? 0);
const canGoPrev = computed(
    () => Boolean(props.pagination) && currentPage.value > 1 && !props.listLoading,
);
const canGoNext = computed(
    () => Boolean(props.pagination) && currentPage.value < lastPage.value && !props.listLoading,
);

function claimsAction(invoice: BillingInvoice): QueueClaimsAction | null {
    return props.billingInvoiceQueueClaimsAction(invoice);
}

function requestStatusAction(invoice: BillingInvoice, action: BillingInvoiceStatusAction): void {
    emit('status-action', { invoice, action });
}
</script>

<template>
    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <ScrollArea class="min-h-0 flex-1">
            <div class="min-h-[12rem] p-4" :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                <div v-if="pageLoading || listLoading" class="space-y-2">
                    <Skeleton class="h-24 w-full" />
                    <Skeleton class="h-24 w-full" />
                    <Skeleton class="h-24 w-full" />
                </div>
                <div
                    v-else-if="visibleInvoices.length === 0"
                    class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                >
                    {{ emptyStateMessage }}
                </div>
                <div v-else :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                    <div
                        v-for="invoice in visibleInvoices"
                        :key="invoice.id"
                        class="rounded-lg border transition-colors"
                        :class="[compactQueueRows ? 'p-2.5' : 'p-3', invoiceAccentClass(invoice.status)]"
                    >
                        <div
                            :class="
                                compactQueueRows
                                    ? 'flex flex-col gap-2 md:flex-row md:items-start md:justify-between'
                                    : 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between'
                            "
                        >
                            <div :class="compactQueueRows ? 'space-y-1.5' : 'space-y-2'">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-sm font-semibold">
                                        {{ invoice.invoiceNumber || 'Billing Invoice' }}
                                    </p>
                                    <Badge :variant="statusVariant(invoice.status)">
                                        {{ formatEnumLabel(invoice.status) }}
                                    </Badge>
                                    <Badge variant="outline">
                                        {{ billingInvoiceQueueLaneLabel(invoice) }}
                                    </Badge>
                                    <Badge
                                        v-if="billingInvoiceSettlementMode(invoice) === 'third_party'"
                                        :variant="billingInvoiceCoveragePosture(invoice)?.badgeVariant ?? 'outline'"
                                    >
                                        {{ billingInvoiceClaimPostureLabel(invoice) }}
                                    </Badge>
                                    <Badge
                                        v-if="billingInvoiceThirdPartyPhaseLabel(invoice)"
                                        variant="outline"
                                    >
                                        {{ billingInvoiceThirdPartyPhaseLabel(invoice) }}
                                    </Badge>
                                    <Badge
                                        v-if="amountToNumber(invoice.balanceAmount) !== null"
                                        variant="secondary"
                                    >
                                        Balance
                                        {{ formatMoney(invoice.balanceAmount, invoice.currencyCode) }}
                                    </Badge>
                                    <Badge variant="outline">
                                        Total {{ formatMoney(invoice.totalAmount, invoice.currencyCode) }}
                                    </Badge>
                                    <Badge
                                        v-if="invoiceLineItemCount(invoice) > 0"
                                        variant="outline"
                                    >
                                        {{ invoiceLineItemCount(invoice) }}
                                        {{ invoiceLineItemCount(invoice) === 1 ? 'item' : 'items' }}
                                    </Badge>
                                </div>
                                <div
                                    class="hidden gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid lg:grid-cols-2"
                                >
                                    <p>
                                        Patient: {{ invoicePatientLabel(invoice) }}
                                        <span v-if="invoicePatientNumber(invoice)" class="ml-1">
                                            ({{ invoicePatientNumber(invoice) }})
                                        </span>
                                    </p>
                                    <p>
                                        Invoice Date: {{ formatDate(invoice.invoiceDate) }}
                                    </p>
                                    <p>
                                        Due: {{ formatDate(invoice.paymentDueAt) }}
                                    </p>
                                    <p>
                                        {{ billingInvoiceQueueLastActivityLabel(invoice) }}:
                                        {{ formatDate(invoice.lastPaymentAt) }}
                                    </p>
                                    <p v-if="invoiceLastPaymentMetaLabel(invoice)">
                                        Payment Capture:
                                        {{ invoiceLastPaymentMetaLabel(invoice) }}
                                    </p>
                                    <p>
                                        {{ billingInvoiceQueuePaidLabel(invoice) }}:
                                        {{ formatMoney(invoice.paidAmount, invoice.currencyCode) }}
                                    </p>
                                    <p v-if="invoiceSourceLabel(invoice)">
                                        <span>Source: {{ invoiceSourceLabel(invoice) }}</span>
                                        <Link
                                            v-if="invoiceSourceWorkflowHref(invoice)"
                                            :href="invoiceSourceWorkflowHref(invoice) || '#'"
                                            class="ml-1 inline-flex items-center gap-1 text-xs text-primary"
                                        >
                                            <AppIcon name="arrow-up-right" class="size-3" />
                                            Open
                                        </Link>
                                    </p>
                                </div>
                                <details class="rounded-md border border-dashed px-2 py-1.5 sm:hidden">
                                    <summary class="cursor-pointer text-xs font-medium text-muted-foreground">
                                        {{ invoiceQueueDetailsLabel() }}
                                    </summary>
                                    <div class="mt-2 grid gap-1 text-xs text-muted-foreground">
                                        <p>
                                            Patient: {{ invoicePatientLabel(invoice) }}
                                            <span v-if="invoicePatientNumber(invoice)" class="ml-1">
                                                ({{ invoicePatientNumber(invoice) }})
                                            </span>
                                        </p>
                                        <p>
                                            Invoice: {{ formatDate(invoice.invoiceDate) }}
                                        </p>
                                        <p>
                                            Due: {{ formatDate(invoice.paymentDueAt) }}
                                        </p>
                                        <p>
                                            {{ billingInvoiceQueueLastActivityLabel(invoice) }}:
                                            {{ formatDate(invoice.lastPaymentAt) }}
                                        </p>
                                        <p v-if="invoiceLastPaymentMetaLabel(invoice)">
                                            Capture:
                                            {{ invoiceLastPaymentMetaLabel(invoice) }}
                                        </p>
                                        <p>
                                            {{ billingInvoiceQueuePaidLabel(invoice) }}:
                                            {{ formatMoney(invoice.paidAmount, invoice.currencyCode) }}
                                        </p>
                                        <p v-if="invoiceSourceLabel(invoice)">
                                            <span>Source: {{ invoiceSourceLabel(invoice) }}</span>
                                            <Link
                                                v-if="invoiceSourceWorkflowHref(invoice)"
                                                :href="invoiceSourceWorkflowHref(invoice) || '#'"
                                                class="ml-1 inline-flex items-center gap-1 text-xs text-primary"
                                            >
                                                <AppIcon name="arrow-up-right" class="size-3" />
                                                Open
                                            </Link>
                                        </p>
                                    </div>
                                </details>
                                <p class="text-xs text-muted-foreground">
                                    Subtotal {{ formatMoney(invoice.subtotalAmount, invoice.currencyCode) }}
                                    | Discount {{ formatMoney(invoice.discountAmount ?? 0, invoice.currencyCode) }}
                                    | Tax {{ formatMoney(invoice.taxAmount ?? 0, invoice.currencyCode) }}
                                </p>
                                <div
                                    v-if="billingInvoiceQueueNextStep(invoice)"
                                    class="rounded-md border px-2.5 py-2 text-xs"
                                    :class="billingInvoiceQueueNextStep(invoice)?.toneClass"
                                >
                                    <p class="font-medium text-foreground">
                                        Execution state | {{ billingInvoiceQueueNextStep(invoice)?.title }}
                                    </p>
                                    <p class="mt-0.5 text-muted-foreground">
                                        {{ billingInvoiceQueueNextStep(invoice)?.helper }}
                                    </p>
                                    <div
                                        v-if="billingInvoiceSettlementMode(invoice) === 'third_party'"
                                        class="mt-2 flex flex-wrap gap-1.5"
                                    >
                                        <Badge
                                            v-if="billingInvoiceCoveragePosture(invoice)"
                                            :variant="billingInvoiceCoveragePosture(invoice)?.badgeVariant ?? 'outline'"
                                            class="text-[10px]"
                                        >
                                            {{ billingInvoiceCoveragePosture(invoice)?.label }}
                                        </Badge>
                                        <Badge
                                            v-if="billingInvoiceThirdPartyPhaseLabel(invoice)"
                                            variant="outline"
                                            class="text-[10px]"
                                        >
                                            {{ billingInvoiceThirdPartyPhaseLabel(invoice) }}
                                        </Badge>
                                        <Badge
                                            v-for="badge in billingInvoiceCoverageMetricBadges(invoice)"
                                            :key="`${invoice.id}-coverage-metric-${badge.key}`"
                                            :variant="badge.variant"
                                            class="text-[10px]"
                                        >
                                            {{ badge.label }}
                                        </Badge>
                                    </div>
                                </div>
                                <div
                                    v-if="billingInvoiceFinancePostingBadges(invoice).length > 0"
                                    class="rounded-md border border-dashed bg-muted/10 px-2.5 py-2"
                                >
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                        Finance pulse
                                    </p>
                                    <div class="mt-2 flex flex-wrap gap-1.5">
                                        <Badge
                                            v-for="badge in billingInvoiceFinancePostingBadges(invoice)"
                                            :key="`${invoice.id}-finance-pulse-${badge.key}`"
                                            :variant="badge.variant"
                                            class="text-[10px]"
                                        >
                                            {{ badge.label }}
                                        </Badge>
                                    </div>
                                </div>
                                <div
                                    v-if="invoiceLineItemCount(invoice) > 0"
                                    class="space-y-1 rounded-md border border-dashed bg-muted/10 p-2"
                                >
                                    <p class="text-xs font-medium text-muted-foreground">Top line items</p>
                                    <p
                                        v-for="(line, lineIndex) in invoiceLineItemPreview(invoice)"
                                        :key="`${invoice.id}-line-preview-${lineIndex}`"
                                        class="text-xs"
                                    >
                                        {{ line }}
                                    </p>
                                    <p
                                        v-if="invoiceLineItemCount(invoice) > 3"
                                        class="text-[11px] text-muted-foreground"
                                    >
                                        and {{ invoiceLineItemCount(invoice) - 3 }} more
                                    </p>
                                </div>
                                <p v-if="previewText(invoice.notes)" class="text-sm">
                                    {{ previewText(invoice.notes) }}
                                </p>
                                <p v-if="invoice.statusReason" class="text-xs text-muted-foreground">
                                    Status note: {{ invoice.statusReason }}
                                </p>
                            </div>

                            <div
                                :class="
                                    compactQueueRows
                                        ? 'space-y-1.5 md:w-[320px] md:max-w-[320px] md:shrink-0'
                                        : 'space-y-2 md:w-[320px] md:max-w-[320px] md:shrink-0'
                                "
                            >
                                <div class="space-y-1">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                        {{ billingInvoiceQueueActionRailLabel(invoice) }}
                                    </p>
                                    <div class="flex flex-col items-stretch gap-1.5">
                                        <Button
                                            v-if="canIssueBillingInvoices && invoice.status === 'draft'"
                                            size="sm"
                                            variant="default"
                                            class="w-full"
                                            :disabled="actionLoadingId === invoice.id"
                                            @click="requestStatusAction(invoice, 'issued')"
                                        >
                                            {{
                                                actionLoadingId === invoice.id
                                                    ? 'Updating...'
                                                    : billingInvoiceStatusActionLabel(invoice, 'issued')
                                            }}
                                        </Button>
                                        <Button
                                            v-if="
                                                claimsAction(invoice) &&
                                                billingInvoiceShouldPrioritizeClaimsAction(invoice)
                                            "
                                            size="sm"
                                            variant="default"
                                            class="w-full"
                                            as-child
                                        >
                                            <Link :href="claimsAction(invoice)?.href || '#'">
                                                {{ claimsAction(invoice)?.label }}
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="
                                                canRecordBillingPayments &&
                                                (invoice.status === 'issued' ||
                                                    invoice.status === 'partially_paid')
                                            "
                                            size="sm"
                                            :variant="
                                                billingInvoiceShouldPrioritizeClaimsAction(invoice)
                                                    ? 'secondary'
                                                    : 'default'
                                            "
                                            class="w-full"
                                            :disabled="actionLoadingId === invoice.id"
                                            @click="requestStatusAction(invoice, 'record_payment')"
                                        >
                                            {{
                                                actionLoadingId === invoice.id
                                                    ? 'Updating...'
                                                    : billingInvoiceStatusActionLabel(invoice, 'record_payment')
                                            }}
                                        </Button>
                                    </div>
                                    <div
                                        v-if="billingInvoiceQueueActionLeadDetails(invoice).length > 0"
                                        class="grid gap-2 sm:grid-cols-2"
                                    >
                                        <div
                                            v-for="row in billingInvoiceQueueActionLeadDetails(invoice)"
                                            :key="`${invoice.id}-action-cue-${row.label}`"
                                            class="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2"
                                        >
                                            <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                                {{ row.label }}
                                            </p>
                                            <p class="mt-1 text-[11px] font-medium leading-4 text-foreground">
                                                {{ row.value }}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex flex-col items-stretch gap-1.5 md:flex-row md:flex-wrap md:justify-end">
                                    <Button
                                        v-if="
                                            claimsAction(invoice) &&
                                            !billingInvoiceShouldPrioritizeClaimsAction(invoice)
                                        "
                                        size="sm"
                                        variant="outline"
                                        class="w-full sm:w-auto"
                                        as-child
                                    >
                                        <Link :href="claimsAction(invoice)?.href || '#'">
                                            {{ claimsAction(invoice)?.label }}
                                        </Link>
                                    </Button>
                                    <Button
                                        v-if="canUpdateDraftBillingInvoices && invoice.status === 'draft'"
                                        size="sm"
                                        variant="outline"
                                        class="w-full sm:w-auto"
                                        :disabled="actionLoadingId === invoice.id"
                                        @click="emit('open-draft-workspace', invoice)"
                                    >
                                        Charge Workspace
                                    </Button>
                                    <Button
                                        v-if="canUpdateDraftBillingInvoices && invoice.status === 'draft'"
                                        size="sm"
                                        variant="secondary"
                                        class="w-full sm:w-auto"
                                        :disabled="actionLoadingId === invoice.id || editDialogLoading"
                                        @click="emit('open-edit-draft', invoice)"
                                    >
                                        Quick Edit Draft
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        class="w-full sm:w-auto"
                                        :disabled="
                                            actionLoadingId === invoice.id ||
                                            (invoiceDetailsPaymentsLoading &&
                                                invoiceDetailsInvoiceId === invoice.id)
                                        "
                                        @click="emit('open-details', invoice)"
                                    >
                                        {{ invoiceQueueDetailsLabel() }}
                                    </Button>
                                    <DropdownMenu
                                        v-if="
                                            (canCancelBillingInvoices &&
                                                invoice.status !== 'paid' &&
                                                invoice.status !== 'cancelled' &&
                                                invoice.status !== 'voided') ||
                                            (canVoidBillingInvoices &&
                                                invoice.status !== 'paid' &&
                                                invoice.status !== 'voided')
                                        "
                                    >
                                        <DropdownMenuTrigger :as-child="true">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="w-full sm:w-auto"
                                                :disabled="actionLoadingId === invoice.id"
                                            >
                                                Exceptions
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" class="w-48">
                                            <DropdownMenuItem
                                                v-if="
                                                    canCancelBillingInvoices &&
                                                    invoice.status !== 'paid' &&
                                                    invoice.status !== 'cancelled' &&
                                                    invoice.status !== 'voided'
                                                "
                                                class="text-destructive focus:text-destructive"
                                                :disabled="actionLoadingId === invoice.id"
                                                @select.prevent="requestStatusAction(invoice, 'cancelled')"
                                            >
                                                Cancel Invoice
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                v-if="
                                                    canVoidBillingInvoices &&
                                                    invoice.status !== 'paid' &&
                                                    invoice.status !== 'voided'
                                                "
                                                :disabled="actionLoadingId === invoice.id"
                                                @select.prevent="requestStatusAction(invoice, 'voided')"
                                            >
                                                Void Invoice
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>
        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2">
            <p class="text-xs text-muted-foreground">
                Showing {{ visibleInvoices.length }} visible of {{ invoicesCount }} on this page |
                {{ totalResults }} total results | Page {{ currentPage }} of {{ lastPage }}
            </p>
            <div class="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-1.5"
                    :disabled="!canGoPrev"
                    @click="emit('prev-page')"
                >
                    <AppIcon name="chevron-left" class="size-3.5" />
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-1.5"
                    :disabled="!canGoNext"
                    @click="emit('next-page')"
                >
                    <AppIcon name="chevron-right" class="size-3.5" />
                    Next
                </Button>
            </div>
        </footer>
    </CardContent>
</template>
