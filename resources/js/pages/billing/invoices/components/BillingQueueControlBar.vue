<script setup lang="ts">
import { ref } from 'vue';

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

const applyBillingQueueOperationalPreset = actions.applyBillingQueueOperationalPreset;
const applyBillingQueuePreset = actions.applyBillingQueuePreset;
const applyBillingSummaryStatusSetFilter = actions.applyBillingSummaryStatusSetFilter;
const applyBillingSummaryFilter = actions.applyBillingSummaryFilter;
const setBillingQueueLaneFilter = actions.setBillingQueueLaneFilter;
const setBillingQueueThirdPartyPhaseFilter = actions.setBillingQueueThirdPartyPhaseFilter;

const isBillingSummaryFilterActive = helpers.isBillingSummaryFilterActive;
const isBillingSummaryStatusSetFilterActive = helpers.isBillingSummaryStatusSetFilterActive;

const laneTablistRef = ref<HTMLDivElement | null>(null);
const phaseTablistRef = ref<HTMLDivElement | null>(null);

const laneOptions = [
    { value: 'all', label: 'All' },
    { value: 'cashier_collection', label: 'Cashier' },
    { value: 'third_party_settlement', label: 'Third-party' },
] as const;

const phaseOptions = [
    { value: 'all', label: 'All phases' },
    { value: 'claim_submission', label: 'Claim prep' },
    { value: 'remittance_reconciliation', label: 'Recon' },
] as const;

function chipClass(active: boolean): string {
    const base =
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';
    return `${base} ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`;
}

function laneCount(value: string): number {
    if (!billingQueueLaneCounts) return 0;
    if (value === 'all') return billingQueueLaneCounts.all;
    if (value === 'cashier_collection') return billingQueueLaneCounts.cashierCollection;
    if (value === 'third_party_settlement') return billingQueueLaneCounts.thirdPartySettlement;
    return 0;
}

function phaseCount(value: string): number {
    if (!billingQueueThirdPartyPhaseCounts) return 0;
    if (value === 'all') return billingQueueThirdPartyPhaseCounts.all;
    if (value === 'claim_submission') return billingQueueThirdPartyPhaseCounts.claimSubmission;
    if (value === 'remittance_reconciliation') return billingQueueThirdPartyPhaseCounts.remittanceReconciliation;
    return 0;
}

function handleLaneKeydown(event: KeyboardEvent) {
    const currentIndex = laneOptions.findIndex((o) => o.value === state.billingQueueLaneFilter);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        nextIndex = (currentIndex + 1) % laneOptions.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        nextIndex = (currentIndex - 1 + laneOptions.length) % laneOptions.length;
    } else if (event.key === 'Home') {
        event.preventDefault();
        nextIndex = 0;
    } else if (event.key === 'End') {
        event.preventDefault();
        nextIndex = laneOptions.length - 1;
    } else {
        return;
    }

    setBillingQueueLaneFilter(laneOptions[nextIndex].value);
    requestAnimationFrame(() => {
        const buttons = laneTablistRef.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
    });
}

function handlePhaseKeydown(event: KeyboardEvent) {
    const currentIndex = phaseOptions.findIndex(
        (o) => o.value === state.billingQueueThirdPartyPhaseFilter,
    );
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        nextIndex = (currentIndex + 1) % phaseOptions.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        nextIndex = (currentIndex - 1 + phaseOptions.length) % phaseOptions.length;
    } else if (event.key === 'Home') {
        event.preventDefault();
        nextIndex = 0;
    } else if (event.key === 'End') {
        event.preventDefault();
        nextIndex = phaseOptions.length - 1;
    } else {
        return;
    }

    setBillingQueueThirdPartyPhaseFilter(phaseOptions[nextIndex].value);
    requestAnimationFrame(() => {
        const buttons = phaseTablistRef.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
    });
}
</script>

<template>
    <div
        v-if="billingQueueLaneCounts"
        class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2"
    >
        <div
            ref="laneTablistRef"
            role="tablist"
            aria-label="Billing queue lane"
            class="flex items-center gap-1"
            @keydown="handleLaneKeydown"
        >
            <span class="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lane</span>
            <button
                v-for="option in laneOptions"
                :key="option.value"
                type="button"
                role="tab"
                :aria-selected="state.billingQueueLaneFilter === option.value"
                :tabindex="state.billingQueueLaneFilter === option.value ? 0 : -1"
                :class="chipClass(state.billingQueueLaneFilter === option.value)"
                @click="setBillingQueueLaneFilter(option.value)"
            >
                {{ option.label }}
                <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ laneCount(option.value) }}</span>
            </button>
        </div>

        <span class="h-4 w-px bg-border" aria-hidden="true" />

        <div class="flex items-center gap-1">
            <span class="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ops</span>
            <button
                type="button"
                :class="chipClass(billingOperationalPresetState.cashierDaybook)"
                @click="applyBillingQueueOperationalPreset('cashier_daybook', { focusSearch: true })"
            >
                Daybook
                <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ billingOperationalQueueCounts.cashierDaybook }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(billingOperationalPresetState.claimPrep)"
                @click="applyBillingQueueOperationalPreset('claim_prep', { focusSearch: true })"
            >
                Claims
                <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ billingOperationalQueueCounts.claimPrep }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(billingOperationalPresetState.reconciliation)"
                @click="applyBillingQueueOperationalPreset('reconciliation', { focusSearch: true })"
            >
                Recon
                <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ billingOperationalQueueCounts.reconciliation }}</span>
            </button>
            <button
                type="button"
                :class="chipClass(billingQueuePresetState.outstanding && !billingOperationalPresetState.claimPrep && !billingOperationalPresetState.reconciliation)"
                @click="applyBillingQueuePreset('outstanding', { focusSearch: true })"
            >
                Outstanding
            </button>
        </div>

        <template v-if="summaryQueueCounts">
            <span class="h-4 w-px bg-border" aria-hidden="true" />

            <div class="flex items-center gap-1">
                <span class="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                <button
                    type="button"
                    :class="chipClass(isBillingSummaryFilterActive('draft'))"
                    @click="applyBillingSummaryFilter('draft')"
                >
                    Draft
                    <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ summaryQueueCounts.draft }}</span>
                </button>
                <button
                    type="button"
                    :class="chipClass(isBillingSummaryFilterActive('issued'))"
                    @click="applyBillingSummaryFilter('issued')"
                >
                    Issued
                    <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ summaryQueueCounts.issued }}</span>
                </button>
                <button
                    type="button"
                    :class="chipClass(isBillingSummaryFilterActive('partially_paid'))"
                    @click="applyBillingSummaryFilter('partially_paid')"
                >
                    Partial
                    <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ summaryQueueCounts.partiallyPaid }}</span>
                </button>
                <button
                    type="button"
                    :class="chipClass(isBillingSummaryFilterActive('paid'))"
                    @click="applyBillingSummaryFilter('paid')"
                >
                    Paid
                    <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ summaryQueueCounts.paid }}</span>
                </button>
                <button
                    type="button"
                    :class="chipClass(isBillingSummaryStatusSetFilterActive(['cancelled', 'voided']))"
                    @click="applyBillingSummaryStatusSetFilter(['cancelled', 'voided'])"
                >
                    Exceptions
                    <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ summaryQueueCounts.exceptions }}</span>
                </button>
            </div>
        </template>

        <div
            v-if="state.billingQueueLaneFilter === 'third_party_settlement' && billingQueueThirdPartyPhaseCounts"
            class="flex items-center gap-2"
        >
            <div
                ref="phaseTablistRef"
                role="tablist"
                aria-label="Third-party settlement phase"
                class="flex items-center gap-1"
                @keydown="handlePhaseKeydown"
            >
                <span class="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Phase</span>
                <button
                    v-for="option in phaseOptions"
                    :key="option.value"
                    type="button"
                    role="tab"
                    :aria-selected="state.billingQueueThirdPartyPhaseFilter === option.value"
                    :tabindex="state.billingQueueThirdPartyPhaseFilter === option.value ? 0 : -1"
                    :class="chipClass(state.billingQueueThirdPartyPhaseFilter === option.value)"
                    @click="setBillingQueueThirdPartyPhaseFilter(option.value)"
                >
                    {{ option.label }}
                    <span class="tabular-nums text-[10px] opacity-60" aria-hidden="true">{{ phaseCount(option.value) }}</span>
                </button>
            </div>
        </div>
    </div>
</template>
