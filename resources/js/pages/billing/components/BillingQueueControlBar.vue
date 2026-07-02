<script setup lang="ts">
import { Badge } from '@/components/ui/badge';

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

const applyBillingQueueOperationalPreset = actions.applyBillingQueueOperationalPreset;
const applyBillingQueuePreset = actions.applyBillingQueuePreset;
const applyBillingSummaryStatusSetFilter = actions.applyBillingSummaryStatusSetFilter;
const applyBillingSummaryFilter = actions.applyBillingSummaryFilter;
const setBillingQueueLaneFilter = actions.setBillingQueueLaneFilter;

const isBillingSummaryFilterActive = helpers.isBillingSummaryFilterActive;
const isBillingSummaryStatusSetFilterActive = helpers.isBillingSummaryStatusSetFilterActive;

function chipClass(active: boolean): string {
    const base = 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors cursor-pointer border';
    return `${base} ${active ? 'border-primary/40 bg-primary/10 text-primary font-medium' : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`;
}
</script>

<template>
    <div v-if="billingQueueLaneCounts" class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-muted/10 px-4 py-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lane</span>
        <button type="button" :class="chipClass(state.billingQueueLaneFilter === 'all')" @click="setBillingQueueLaneFilter('all')">
            All <span class="tabular-nums text-[10px] opacity-60">{{ billingQueueLaneCounts.all }}</span>
        </button>
        <button type="button" :class="chipClass(state.billingQueueLaneFilter === 'cashier_collection')" @click="setBillingQueueLaneFilter('cashier_collection')">
            Cashier <span class="tabular-nums text-[10px] opacity-60">{{ billingQueueLaneCounts.cashierCollection }}</span>
        </button>
        <button type="button" :class="chipClass(state.billingQueueLaneFilter === 'third_party_settlement')" @click="setBillingQueueLaneFilter('third_party_settlement')">
            Third-party <span class="tabular-nums text-[10px] opacity-60">{{ billingQueueLaneCounts.thirdPartySettlement }}</span>
        </button>

        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ops</span>
        <button type="button" :class="chipClass(billingOperationalPresetState.cashierDaybook)" @click="applyBillingQueueOperationalPreset('cashier_daybook', { focusSearch: true })">
            Daybook <span class="tabular-nums text-[10px] opacity-60">{{ billingOperationalQueueCounts.cashierDaybook }}</span>
        </button>
        <button type="button" :class="chipClass(billingOperationalPresetState.claimPrep)" @click="applyBillingQueueOperationalPreset('claim_prep', { focusSearch: true })">
            Claims <span class="tabular-nums text-[10px] opacity-60">{{ billingOperationalQueueCounts.claimPrep }}</span>
        </button>
        <button type="button" :class="chipClass(billingOperationalPresetState.reconciliation)" @click="applyBillingQueueOperationalPreset('reconciliation', { focusSearch: true })">
            Recon <span class="tabular-nums text-[10px] opacity-60">{{ billingOperationalQueueCounts.reconciliation }}</span>
        </button>
        <button
            type="button"
            :class="chipClass(billingQueuePresetState.outstanding && !billingOperationalPresetState.claimPrep && !billingOperationalPresetState.reconciliation)"
            @click="applyBillingQueuePreset('outstanding', { focusSearch: true })"
        >
            Outstanding
        </button>

        <span v-if="summaryQueueCounts" class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <template v-if="summaryQueueCounts">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <button type="button" :class="chipClass(isBillingSummaryFilterActive('draft'))" @click="applyBillingSummaryFilter('draft')">
                Draft <span class="tabular-nums text-[10px] opacity-60">{{ summaryQueueCounts.draft }}</span>
            </button>
            <button type="button" :class="chipClass(isBillingSummaryFilterActive('issued'))" @click="applyBillingSummaryFilter('issued')">
                Issued <span class="tabular-nums text-[10px] opacity-60">{{ summaryQueueCounts.issued }}</span>
            </button>
            <button type="button" :class="chipClass(isBillingSummaryFilterActive('partially_paid'))" @click="applyBillingSummaryFilter('partially_paid')">
                Partial <span class="tabular-nums text-[10px] opacity-60">{{ summaryQueueCounts.partiallyPaid }}</span>
            </button>
            <button type="button" :class="chipClass(isBillingSummaryFilterActive('paid'))" @click="applyBillingSummaryFilter('paid')">
                Paid <span class="tabular-nums text-[10px] opacity-60">{{ summaryQueueCounts.paid }}</span>
            </button>
            <button type="button" :class="chipClass(isBillingSummaryStatusSetFilterActive(['cancelled', 'voided']))" @click="applyBillingSummaryStatusSetFilter(['cancelled', 'voided'])">
                Exceptions <span class="tabular-nums text-[10px] opacity-60">{{ summaryQueueCounts.exceptions }}</span>
            </button>
        </template>
    </div>
</template>
