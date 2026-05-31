<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

const billingOperationalPresetState = view.billingOperationalPresetState;
const billingOperationalQueueCounts = view.billingOperationalQueueCounts;
const billingQueuePresetState = view.billingQueuePresetState;
const summaryQueueCounts = view.summaryQueueCounts;
const billingQueueLaneCounts = view.billingQueueLaneCounts;
const billingQueueThirdPartyPhaseCounts = view.billingQueueThirdPartyPhaseCounts;
const billingQueueStateLabel = view.billingQueueStateLabel;

const applyBillingQueueOperationalPreset = actions.applyBillingQueueOperationalPreset;
const applyBillingQueuePreset = actions.applyBillingQueuePreset;
const applyBillingSummaryStatusSetFilter = actions.applyBillingSummaryStatusSetFilter;
const applyBillingSummaryFilter = actions.applyBillingSummaryFilter;
const setBillingQueueLaneFilter = actions.setBillingQueueLaneFilter;
const setBillingQueueThirdPartyPhaseFilter = actions.setBillingQueueThirdPartyPhaseFilter;

const isBillingSummaryFilterActive = helpers.isBillingSummaryFilterActive;
const isBillingSummaryStatusSetFilterActive = helpers.isBillingSummaryStatusSetFilterActive;
</script>

<template>
    <details class="group border-b bg-muted/10 px-4 py-2 open:pb-3">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span class="inline-flex items-center gap-2">
                <AppIcon name="layout-grid" class="size-4 text-muted-foreground" />
                Workboards &amp; lanes
            </span>
            <span class="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                <Badge variant="outline" class="font-normal">{{ billingQueueStateLabel }}</Badge>
                <span class="group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
            </span>
        </summary>

        <div class="mt-3 space-y-3">
            <div class="flex flex-wrap gap-1.5">
                <span class="w-full text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Operations</span>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': billingOperationalPresetState.cashierDaybook }"
                    @click="applyBillingQueueOperationalPreset('cashier_daybook', { focusSearch: true })"
                >
                    <span class="font-medium tabular-nums">{{ billingOperationalQueueCounts.cashierDaybook }}</span>
                    <span class="text-muted-foreground">Cashier daybook</span>
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': billingOperationalPresetState.claimPrep }"
                    @click="applyBillingQueueOperationalPreset('claim_prep', { focusSearch: true })"
                >
                    <span class="font-medium tabular-nums">{{ billingOperationalQueueCounts.claimPrep }}</span>
                    <span class="text-muted-foreground">Claim prep</span>
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': billingOperationalPresetState.reconciliation }"
                    @click="applyBillingQueueOperationalPreset('reconciliation', { focusSearch: true })"
                >
                    <span class="font-medium tabular-nums">{{ billingOperationalQueueCounts.reconciliation }}</span>
                    <span class="text-muted-foreground">Reconciliation</span>
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{
                        'border-primary bg-primary/5':
                            billingQueuePresetState.outstanding
                            && !billingOperationalPresetState.claimPrep
                            && !billingOperationalPresetState.reconciliation,
                    }"
                    @click="applyBillingQueuePreset('outstanding', { focusSearch: true })"
                >
                    <span class="text-muted-foreground">Outstanding</span>
                </button>
            </div>

            <div class="flex flex-wrap gap-1.5">
                <span class="w-full text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status on this page</span>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': isBillingSummaryFilterActive('draft') }"
                    @click="applyBillingSummaryFilter('draft')"
                >
                    <span class="font-medium tabular-nums">{{ summaryQueueCounts.draft }}</span>
                    <span class="text-muted-foreground">Draft</span>
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': isBillingSummaryFilterActive('issued') }"
                    @click="applyBillingSummaryFilter('issued')"
                >
                    <span class="font-medium tabular-nums">{{ summaryQueueCounts.issued }}</span>
                    <span class="text-muted-foreground">Issued</span>
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': isBillingSummaryFilterActive('partially_paid') }"
                    @click="applyBillingSummaryFilter('partially_paid')"
                >
                    <span class="font-medium tabular-nums">{{ summaryQueueCounts.partiallyPaid }}</span>
                    <span class="text-muted-foreground">Partial</span>
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': isBillingSummaryFilterActive('paid') }"
                    @click="applyBillingSummaryFilter('paid')"
                >
                    <span class="font-medium tabular-nums">{{ summaryQueueCounts.paid }}</span>
                    <span class="text-muted-foreground">Paid</span>
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    :class="{
                        'border-primary bg-primary/5': isBillingSummaryStatusSetFilterActive(['cancelled', 'voided']),
                    }"
                    @click="applyBillingSummaryStatusSetFilter(['cancelled', 'voided'])"
                >
                    <span class="font-medium tabular-nums">{{ summaryQueueCounts.exceptions }}</span>
                    <span class="text-muted-foreground">Exceptions</span>
                </button>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
                <span class="w-full text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lane</span>
                <Button
                    size="sm"
                    class="h-7 gap-1.5 rounded-md px-2.5"
                    :variant="state.billingQueueLaneFilter === 'all' ? 'default' : 'outline'"
                    @click="setBillingQueueLaneFilter('all')"
                >
                    <span class="font-medium tabular-nums">{{ billingQueueLaneCounts.all }}</span>
                    All
                </Button>
                <Button
                    size="sm"
                    class="h-7 gap-1.5 rounded-md px-2.5"
                    :variant="state.billingQueueLaneFilter === 'cashier_collection' ? 'default' : 'outline'"
                    @click="setBillingQueueLaneFilter('cashier_collection')"
                >
                    <span class="font-medium tabular-nums">{{ billingQueueLaneCounts.cashierCollection }}</span>
                    Cashier
                </Button>
                <Button
                    size="sm"
                    class="h-7 gap-1.5 rounded-md px-2.5"
                    :variant="state.billingQueueLaneFilter === 'third_party_settlement' ? 'default' : 'outline'"
                    @click="setBillingQueueLaneFilter('third_party_settlement')"
                >
                    <span class="font-medium tabular-nums">{{ billingQueueLaneCounts.thirdPartySettlement }}</span>
                    Third-party
                </Button>
                <template v-if="state.billingQueueLaneFilter === 'third_party_settlement'">
                    <Button
                        size="sm"
                        class="h-7 gap-1.5 rounded-md px-2.5"
                        :variant="state.billingQueueThirdPartyPhaseFilter === 'all' ? 'default' : 'outline'"
                        @click="setBillingQueueThirdPartyPhaseFilter('all')"
                    >
                        <span class="font-medium tabular-nums">{{ billingQueueThirdPartyPhaseCounts.all }}</span>
                        All phases
                    </Button>
                    <Button
                        size="sm"
                        class="h-7 gap-1.5 rounded-md px-2.5"
                        :variant="state.billingQueueThirdPartyPhaseFilter === 'claim_submission' ? 'default' : 'outline'"
                        @click="setBillingQueueThirdPartyPhaseFilter('claim_submission')"
                    >
                        <span class="font-medium tabular-nums">{{ billingQueueThirdPartyPhaseCounts.claimSubmission }}</span>
                        Claim prep
                    </Button>
                    <Button
                        size="sm"
                        class="h-7 gap-1.5 rounded-md px-2.5"
                        :variant="
                            state.billingQueueThirdPartyPhaseFilter === 'remittance_reconciliation'
                                ? 'default'
                                : 'outline'
                        "
                        @click="setBillingQueueThirdPartyPhaseFilter('remittance_reconciliation')"
                    >
                        <span class="font-medium tabular-nums">
                            {{ billingQueueThirdPartyPhaseCounts.remittanceReconciliation }}
                        </span>
                        Reconciliation
                    </Button>
                </template>
            </div>
        </div>
    </details>
</template>
