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

function chipClass(active: boolean): string {
    return `inline-flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`;
}
</script>

<template>
    <aside class="flex w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-muted/10 p-3" aria-label="Queue filters">
        <div class="space-y-1.5">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lane</p>
            <button
                type="button"
                :class="chipClass(state.billingQueueLaneFilter === 'all')"
                @click="setBillingQueueLaneFilter('all')"
            >
                All
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingQueueLaneCounts.all }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(state.billingQueueLaneFilter === 'cashier_collection')"
                @click="setBillingQueueLaneFilter('cashier_collection')"
            >
                Cashier
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingQueueLaneCounts.cashierCollection }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(state.billingQueueLaneFilter === 'third_party_settlement')"
                @click="setBillingQueueLaneFilter('third_party_settlement')"
            >
                Third-party
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingQueueLaneCounts.thirdPartySettlement }}</span>
            </button>
        </div>

        <template v-if="state.billingQueueLaneFilter === 'third_party_settlement'">
            <div class="space-y-1.5">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">TP phase</p>
                <button
                    type="button"
                    :class="chipClass(state.billingQueueThirdPartyPhaseFilter === 'all')"
                    @click="setBillingQueueThirdPartyPhaseFilter('all')"
                >
                    All phases
                    <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingQueueThirdPartyPhaseCounts.all }}</span>
                </button>
                <button
                    type="button"
                    :class="chipClass(state.billingQueueThirdPartyPhaseFilter === 'claim_submission')"
                    @click="setBillingQueueThirdPartyPhaseFilter('claim_submission')"
                >
                    Claim prep
                    <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingQueueThirdPartyPhaseCounts.claimSubmission }}</span>
                </button>
                <button
                    type="button"
                    :class="chipClass(state.billingQueueThirdPartyPhaseFilter === 'remittance_reconciliation')"
                    @click="setBillingQueueThirdPartyPhaseFilter('remittance_reconciliation')"
                >
                    Reconciliation
                    <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingQueueThirdPartyPhaseCounts.remittanceReconciliation }}</span>
                </button>
            </div>
        </template>

        <div class="space-y-1.5">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operations</p>
            <button
                type="button"
                :class="chipClass(billingOperationalPresetState.cashierDaybook)"
                @click="applyBillingQueueOperationalPreset('cashier_daybook', { focusSearch: true })"
            >
                Cashier daybook
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingOperationalQueueCounts.cashierDaybook }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(billingOperationalPresetState.claimPrep)"
                @click="applyBillingQueueOperationalPreset('claim_prep', { focusSearch: true })"
            >
                Claim prep
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingOperationalQueueCounts.claimPrep }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(billingOperationalPresetState.reconciliation)"
                @click="applyBillingQueueOperationalPreset('reconciliation', { focusSearch: true })"
            >
                Reconciliation
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ billingOperationalQueueCounts.reconciliation }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(billingQueuePresetState.outstanding && !billingOperationalPresetState.claimPrep && !billingOperationalPresetState.reconciliation)"
                @click="applyBillingQueuePreset('outstanding', { focusSearch: true })"
            >
                Outstanding
            </button>
        </div>

        <div class="space-y-1.5">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
            <button
                type="button"
                :class="chipClass(isBillingSummaryFilterActive('draft'))"
                @click="applyBillingSummaryFilter('draft')"
            >
                Draft
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ summaryQueueCounts.draft }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(isBillingSummaryFilterActive('issued'))"
                @click="applyBillingSummaryFilter('issued')"
            >
                Issued
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ summaryQueueCounts.issued }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(isBillingSummaryFilterActive('partially_paid'))"
                @click="applyBillingSummaryFilter('partially_paid')"
            >
                Partial
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ summaryQueueCounts.partiallyPaid }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(isBillingSummaryFilterActive('paid'))"
                @click="applyBillingSummaryFilter('paid')"
            >
                Paid
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ summaryQueueCounts.paid }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(isBillingSummaryStatusSetFilterActive(['cancelled', 'voided']))"
                @click="applyBillingSummaryStatusSetFilter(['cancelled', 'voided'])"
            >
                Exceptions
                <span class="tabular-nums text-[11px] text-muted-foreground">{{ summaryQueueCounts.exceptions }}</span>
            </button>
        </div>

        <div class="mt-auto border-t pt-2">
            <Badge variant="outline" class="w-full justify-center font-normal text-[11px]">
                {{ billingQueueStateLabel }}
            </Badge>
        </div>
    </aside>
</template>
