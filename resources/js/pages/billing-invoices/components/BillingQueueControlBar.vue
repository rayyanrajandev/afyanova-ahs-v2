<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const props = defineProps({
    state: { type: Object, required: true },
    view: { type: Object, required: true },
    actions: { type: Object, required: true },
    helpers: { type: Object, required: true },
});

const state = props.state as Record<string, any>;
const view = props.view as Record<string, any>;
const actions = props.actions as Record<string, any>;
const helpers = props.helpers as Record<string, any>;

const canReadBillingInvoices = view.canReadBillingInvoices;
const billingWorkspaceView = view.billingWorkspaceView;
const billingQueueStateLabel = view.billingQueueStateLabel;
const billingOperationalPresetState = view.billingOperationalPresetState;
const billingOperationalQueueCounts = view.billingOperationalQueueCounts;
const billingQueuePresetState = view.billingQueuePresetState;
const summaryQueueCounts = view.summaryQueueCounts;
const billingQueueLaneCounts = view.billingQueueLaneCounts;
const billingQueueThirdPartyPhaseCounts =
    view.billingQueueThirdPartyPhaseCounts;

const applyBillingQueueOperationalPreset =
    actions.applyBillingQueueOperationalPreset;
const applyBillingQueuePreset = actions.applyBillingQueuePreset;
const applyBillingSummaryStatusSetFilter =
    actions.applyBillingSummaryStatusSetFilter;
const applyBillingSummaryFilter = actions.applyBillingSummaryFilter;
const setBillingQueueLaneFilter = actions.setBillingQueueLaneFilter;
const setBillingQueueThirdPartyPhaseFilter =
    actions.setBillingQueueThirdPartyPhaseFilter;

const isBillingSummaryFilterActive =
    helpers.isBillingSummaryFilterActive;
const isBillingSummaryStatusSetFilterActive =
    helpers.isBillingSummaryStatusSetFilterActive;
</script>

<template>
    <div
        v-if="canReadBillingInvoices && billingWorkspaceView === 'queue'"
        class="space-y-3 rounded-lg border bg-muted/20 p-3"
    >
        <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div class="space-y-1">
                <p class="text-sm font-medium">Billing queue</p>
                <p class="text-xs text-muted-foreground">
                    Choose the workboard first, then tighten the queue by status and
                    work filters.
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Select v-model="state.statusSelectValue">
                    <SelectTrigger
                        class="h-8 w-40 shrink-0 bg-background/80"
                        size="sm"
                    >
                        <SelectValue placeholder="Queue status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="issued">Issued</SelectItem>
                        <SelectItem value="partially_paid">
                            Partially Paid
                        </SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="voided">Voided</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div class="rounded-lg border bg-background/70 p-3">
            <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div class="space-y-1">
                    <p
                        class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
                    >
                        Billing board
                    </p>
                    <p class="text-xs text-muted-foreground">
                        Move between operational workboards, queue views, and live status
                        counts without losing queue context.
                    </p>
                </div>
                <Badge variant="outline">
                    {{ billingQueueStateLabel }}
                </Badge>
            </div>

            <div
                class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(0,0.95fr)]"
            >
                <div class="rounded-lg border bg-background/80 p-3">
                    <div class="space-y-1">
                        <p
                            class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
                        >
                            Workboards
                        </p>
                        <p class="text-[11px] text-muted-foreground">
                            Operational entry points
                        </p>
                    </div>
                    <div class="mt-3 grid gap-2 sm:grid-cols-2">
                        <Button
                            size="sm"
                            class="h-9 w-full justify-between gap-1.5 px-3 text-left"
                            :variant="
                                billingOperationalPresetState.cashierDaybook
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingQueueOperationalPreset(
                                    'cashier_daybook',
                                    { focusSearch: true },
                                )
                            "
                        >
                            <span class="font-medium">
                                {{ billingOperationalQueueCounts.cashierDaybook }}
                            </span>
                            Cashier Daybook
                        </Button>
                        <Button
                            size="sm"
                            class="h-9 w-full justify-between gap-1.5 px-3 text-left"
                            :variant="
                                billingOperationalPresetState.claimPrep
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingQueueOperationalPreset('claim_prep', {
                                    focusSearch: true,
                                })
                            "
                        >
                            <span class="font-medium">
                                {{ billingOperationalQueueCounts.claimPrep }}
                            </span>
                            Claim Prep
                        </Button>
                        <Button
                            size="sm"
                            class="h-9 w-full justify-between gap-1.5 px-3 text-left sm:col-span-2"
                            :variant="
                                billingOperationalPresetState.reconciliation
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingQueueOperationalPreset(
                                    'reconciliation',
                                    { focusSearch: true },
                                )
                            "
                        >
                            <span class="font-medium">
                                {{ billingOperationalQueueCounts.reconciliation }}
                            </span>
                            Reconciliation
                        </Button>
                    </div>
                </div>

                <div class="rounded-lg border bg-background/80 p-3">
                    <div class="space-y-1">
                        <p
                            class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
                        >
                            Queue views
                        </p>
                        <p class="text-[11px] text-muted-foreground">
                            Fast billing slices
                        </p>
                    </div>
                    <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        <Button
                            size="sm"
                            class="h-9 w-full justify-center px-3 text-center"
                            :variant="
                                billingQueuePresetState.outstanding &&
                                !billingOperationalPresetState.claimPrep &&
                                !billingOperationalPresetState.reconciliation
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingQueuePreset('outstanding', {
                                    focusSearch: true,
                                })
                            "
                        >
                            Outstanding
                        </Button>
                        <Button
                            size="sm"
                            class="h-9 w-full justify-center px-3 text-center"
                            :variant="
                                billingQueuePresetState.draft
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingQueuePreset('draft', {
                                    focusSearch: true,
                                })
                            "
                        >
                            Draft
                        </Button>
                        <Button
                            size="sm"
                            class="h-9 w-full justify-center px-3 text-center"
                            :variant="
                                billingQueuePresetState.issued
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingQueuePreset('issued', {
                                    focusSearch: true,
                                })
                            "
                        >
                            Issued
                        </Button>
                        <Button
                            size="sm"
                            class="h-9 w-full justify-center px-3 text-center"
                            :variant="
                                billingQueuePresetState.partiallyPaid
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingQueuePreset('partially_paid', {
                                    focusSearch: true,
                                })
                            "
                        >
                            Partially Paid
                        </Button>
                        <Button
                            size="sm"
                            class="h-9 w-full justify-center px-3 text-center"
                            :variant="
                                billingQueuePresetState.paid
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingQueuePreset('paid', {
                                    focusSearch: true,
                                })
                            "
                        >
                            Paid
                        </Button>
                        <Button
                            size="sm"
                            class="h-9 w-full justify-center px-3 text-center"
                            :variant="
                                isBillingSummaryStatusSetFilterActive([
                                    'cancelled',
                                    'voided',
                                ])
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingSummaryStatusSetFilter([
                                    'cancelled',
                                    'voided',
                                ])
                            "
                        >
                            Exceptions
                        </Button>
                    </div>
                </div>

                <div class="rounded-lg border bg-background/80 p-3">
                    <div class="flex items-center justify-between gap-2">
                        <p
                            class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
                        >
                            Status pulse
                        </p>
                        <p class="text-[11px] text-muted-foreground">
                            Current page counts
                        </p>
                    </div>
                    <div class="mt-2 grid gap-2 sm:grid-cols-2">
                        <Button
                            size="sm"
                            class="h-auto items-start justify-between gap-3 px-3 py-2 text-left"
                            :variant="
                                isBillingSummaryFilterActive('draft')
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="applyBillingSummaryFilter('draft')"
                        >
                            <span class="text-xs">Draft</span>
                            <span class="text-base font-semibold leading-none">
                                {{ summaryQueueCounts.draft }}
                            </span>
                        </Button>
                        <Button
                            size="sm"
                            class="h-auto items-start justify-between gap-3 px-3 py-2 text-left"
                            :variant="
                                isBillingSummaryFilterActive('issued')
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="applyBillingSummaryFilter('issued')"
                        >
                            <span class="text-xs">Issued</span>
                            <span class="text-base font-semibold leading-none">
                                {{ summaryQueueCounts.issued }}
                            </span>
                        </Button>
                        <Button
                            size="sm"
                            class="h-auto items-start justify-between gap-3 px-3 py-2 text-left"
                            :variant="
                                isBillingSummaryFilterActive('partially_paid')
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="applyBillingSummaryFilter('partially_paid')"
                        >
                            <span class="text-xs">Partially Paid</span>
                            <span class="text-base font-semibold leading-none">
                                {{ summaryQueueCounts.partiallyPaid }}
                            </span>
                        </Button>
                        <Button
                            size="sm"
                            class="h-auto items-start justify-between gap-3 px-3 py-2 text-left"
                            :variant="
                                isBillingSummaryFilterActive('paid')
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="applyBillingSummaryFilter('paid')"
                        >
                            <span class="text-xs">Paid</span>
                            <span class="text-base font-semibold leading-none">
                                {{ summaryQueueCounts.paid }}
                            </span>
                        </Button>
                        <Button
                            size="sm"
                            class="h-auto items-start justify-between gap-3 px-3 py-2 text-left sm:col-span-2"
                            :variant="
                                isBillingSummaryStatusSetFilterActive([
                                    'cancelled',
                                    'voided',
                                ])
                                    ? 'default'
                                    : 'outline'
                            "
                            @click="
                                applyBillingSummaryStatusSetFilter([
                                    'cancelled',
                                    'voided',
                                ])
                            "
                        >
                            <span class="text-xs">Exceptions</span>
                            <span class="text-base font-semibold leading-none">
                                {{ summaryQueueCounts.exceptions }}
                            </span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <div class="rounded-lg border bg-background/70 p-2.5">
            <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div class="space-y-1">
                    <p
                        class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
                    >
                        Lanes
                    </p>
                    <p class="text-xs text-muted-foreground">
                        Keep cashier work separate from third-party settlement and claim
                        follow-up.
                    </p>
                </div>
                <div class="flex flex-col gap-2 lg:items-end">
                    <div
                        class="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/20 p-1"
                    >
                        <Button
                            size="sm"
                            class="h-7 gap-1.5 rounded-md px-2.5"
                            :variant="
                                state.billingQueueLaneFilter === 'all'
                                    ? 'default'
                                    : 'ghost'
                            "
                            @click="setBillingQueueLaneFilter('all')"
                        >
                            <span class="font-medium">
                                {{ billingQueueLaneCounts.all }}
                            </span>
                            All lanes
                        </Button>
                        <Button
                            size="sm"
                            class="h-7 gap-1.5 rounded-md px-2.5"
                            :variant="
                                state.billingQueueLaneFilter === 'cashier_collection'
                                    ? 'default'
                                    : 'ghost'
                            "
                            @click="setBillingQueueLaneFilter('cashier_collection')"
                        >
                            <span class="font-medium">
                                {{ billingQueueLaneCounts.cashierCollection }}
                            </span>
                            Cashier
                        </Button>
                        <Button
                            size="sm"
                            class="h-7 gap-1.5 rounded-md px-2.5"
                            :variant="
                                state.billingQueueLaneFilter ===
                                'third_party_settlement'
                                    ? 'default'
                                    : 'ghost'
                            "
                            @click="
                                setBillingQueueLaneFilter(
                                    'third_party_settlement',
                                )
                            "
                        >
                            <span class="font-medium">
                                {{ billingQueueLaneCounts.thirdPartySettlement }}
                            </span>
                            Third-party
                        </Button>
                    </div>
                    <div
                        v-if="
                            state.billingQueueLaneFilter === 'third_party_settlement'
                        "
                        class="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/20 p-1"
                    >
                        <Button
                            size="sm"
                            class="h-7 gap-1.5 rounded-md px-2.5"
                            :variant="
                                state.billingQueueThirdPartyPhaseFilter === 'all'
                                    ? 'default'
                                    : 'ghost'
                            "
                            @click="setBillingQueueThirdPartyPhaseFilter('all')"
                        >
                            <span class="font-medium">
                                {{ billingQueueThirdPartyPhaseCounts.all }}
                            </span>
                            All third-party
                        </Button>
                        <Button
                            size="sm"
                            class="h-7 gap-1.5 rounded-md px-2.5"
                            :variant="
                                state.billingQueueThirdPartyPhaseFilter ===
                                'claim_submission'
                                    ? 'default'
                                    : 'ghost'
                            "
                            @click="
                                setBillingQueueThirdPartyPhaseFilter(
                                    'claim_submission',
                                )
                            "
                        >
                            <span class="font-medium">
                                {{
                                    billingQueueThirdPartyPhaseCounts
                                        .claimSubmission
                                }}
                            </span>
                            Claim prep
                        </Button>
                        <Button
                            size="sm"
                            class="h-7 gap-1.5 rounded-md px-2.5"
                            :variant="
                                state.billingQueueThirdPartyPhaseFilter ===
                                'remittance_reconciliation'
                                    ? 'default'
                                    : 'ghost'
                            "
                            @click="
                                setBillingQueueThirdPartyPhaseFilter(
                                    'remittance_reconciliation',
                                )
                            "
                        >
                            <span class="font-medium">
                                {{
                                    billingQueueThirdPartyPhaseCounts
                                        .remittanceReconciliation
                                }}
                            </span>
                            Reconciliation
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
