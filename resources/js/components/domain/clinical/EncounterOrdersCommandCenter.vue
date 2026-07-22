<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
    EncounterInlineOrderLinkageContext,
    EncounterInlineOrderType,
} from '@/lib/encounterInlineOrders';
import {
    encounterCareStateVariant,
    type CreateEncounterCareSectionId,
    type CreateEncounterCareSummary,
} from '@/lib/encounterWorkspaceCare';

const props = defineProps<{
    patientId: string;
    hasWorkflowActions: boolean;
    canShowCare: boolean;
    hasCareContext: boolean;
    careCountLabel: string;
    activeStreamCount: number;
    summaries: CreateEncounterCareSummary[];
    canUseInlineOrders: boolean;
    canOpenLaboratoryWorkflow: boolean;
    canOpenPharmacyWorkflow: boolean;
    canOpenRadiologyWorkflow: boolean;
    canOpenTheatreWorkflow: boolean;
    canOpenBillingWorkflow: boolean;
    contextCreateHref: (
        path: string,
        options?: { includeTabNew?: boolean },
    ) => string;
    compact?: boolean;
    /**
     * Opt-in, additive-only: when true, the Theatre button triggers an
     * inline booking flow (like lab/pharmacy/radiology) instead of linking
     * out to /theatre-procedures. Defaults to undefined/falsy so the
     * existing encounters/{id} Workspace.vue page (which doesn't pass this)
     * keeps its current Link-only behavior unchanged.
     */
    canOpenTheatreInline?: boolean;
    /** Whether an external theatre-inline form is currently open — hides this button grid the same way inlineOrderType does for lab/pharmacy/radiology. */
    theatreInlineOpen?: boolean;
    /**
     * Opt-in, additive-only: when true, the Billing button triggers an
     * inline charge-capture flow (like lab/pharmacy/radiology/theatre)
     * instead of linking out to /billing. Defaults to
     * undefined/falsy so the existing encounters/{id} Workspace.vue page
     * (which doesn't pass this) keeps its current Link-only behavior.
     */
    canOpenBillingInline?: boolean;
    /** Whether an external billing-inline panel is currently open — hides this button grid the same way theatreInlineOpen does. */
    billingInlineOpen?: boolean;
    /**
     * Opt-in, additive-only: hides the Billing button from this grid.
     * Billing isn't clinical ordering — WorkspaceV2 renders its own billing
     * link elsewhere, grouped with other "go to a different page" actions
     * instead of alongside lab/pharmacy/radiology/theatre. Defaults to
     * undefined/falsy so the existing encounters/{id} Workspace.vue page
     * (which doesn't pass this) keeps Billing in the grid unchanged.
     */
    hideBillingLink?: boolean;
}>();

const emit = defineEmits<{
    openInlineOrder: [
        type: EncounterInlineOrderType,
        linkage?: EncounterInlineOrderLinkageContext | null,
    ];
    openTheatreInline: [];
    openBillingInline: [];
}>();

const summariesById = computed(
    () =>
        new Map<CreateEncounterCareSectionId, CreateEncounterCareSummary>(
            props.summaries.map((summary) => [summary.id, summary]),
        ),
);

function careSummary(
    id: CreateEncounterCareSectionId,
): CreateEncounterCareSummary | null {
    return summariesById.value.get(id) ?? null;
}

function careSummaryCountLabel(id: CreateEncounterCareSectionId): string {
    const summary = careSummary(id);

    if (!summary) return '0';
    if (summary.state === 'loading') return '…';

    return String(summary.count);
}

function careSummaryBadgeVariant(id: CreateEncounterCareSectionId) {
    const summary = careSummary(id);

    return summary ? encounterCareStateVariant(summary.state) : 'outline';
}
</script>

<template>
    <section
        v-if="patientId && (hasWorkflowActions || canShowCare)"
        :class="[
            'rounded-lg border bg-card shadow-sm',
            compact ? 'space-y-3 p-3' : 'space-y-4 p-4',
        ]"
    >
        <div
            :class="[
                'flex flex-col gap-3',
                compact ? '' : 'lg:flex-row lg:items-start lg:justify-between',
            ]"
        >
            <div class="min-w-0 space-y-1">
                <p
                    class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                    Order command center
                </p>
                <h3
                    v-if="!compact"
                    class="text-sm font-semibold text-foreground"
                >
                    Place, track, and act on orders in this visit
                </h3>
                <p
                    v-if="!compact"
                    class="text-xs leading-5 text-muted-foreground"
                >
                    {{
                        hasCareContext
                            ? 'Order actions stay in the encounter context so note, results, and billing remain connected.'
                            : 'Link an appointment or admission to activate encounter-linked order tracking.'
                    }}
                </p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant="secondary" class="h-6 px-2 text-[11px]">
                    {{ careCountLabel }}
                </Badge>
                <Badge variant="outline" class="h-6 px-2 text-[11px]">
                    {{ activeStreamCount }} active streams
                </Badge>
            </div>
        </div>

        <div
            v-if="!theatreInlineOpen && !billingInlineOpen && hasWorkflowActions"
            :class="[
                'grid gap-2',
                compact
                    ? 'grid-cols-2'
                    : 'sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]',
            ]"
        >
            <Button
                v-if="canOpenLaboratoryWorkflow && canUseInlineOrders"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                data-test="encounter-workspace-new-order"
                @click="emit('openInlineOrder', 'laboratory')"
            >
                <span
                    :class="[
                        'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                        compact ? 'size-7' : 'size-8',
                    ]"
                >
                    <AppIcon name="flask-conical" class="size-4" />
                </span>
                <span class="min-w-0">
                    <span class="block text-sm font-medium">Lab order</span>
                    <span
                        v-if="!compact"
                        class="block text-[11px] font-normal text-muted-foreground"
                    >
                        Tests and specimens
                    </span>
                </span>
                <Badge
                    v-if="canShowCare"
                    :variant="careSummaryBadgeVariant('laboratory-orders')"
                    class="ml-auto shrink-0 text-[10px]"
                >
                    {{ careSummaryCountLabel('laboratory-orders') }}
                </Badge>
            </Button>
            <Button
                v-else-if="canOpenLaboratoryWorkflow"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                as-child
            >
                <Link
                    :href="
                        contextCreateHref('/laboratory-orders/legacy', {
                            includeTabNew: true,
                        })
                    "
                >
                    <span
                        :class="[
                            'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                            compact ? 'size-7' : 'size-8',
                        ]"
                    >
                        <AppIcon name="flask-conical" class="size-4" />
                    </span>
                    <span class="min-w-0">
                        <span class="block text-sm font-medium">Lab order</span>
                        <span
                            v-if="!compact"
                            class="block text-[11px] font-normal text-muted-foreground"
                        >
                            Tests and specimens
                        </span>
                    </span>
                    <Badge
                        v-if="canShowCare"
                        :variant="careSummaryBadgeVariant('laboratory-orders')"
                        class="ml-auto shrink-0 text-[10px]"
                    >
                        {{ careSummaryCountLabel('laboratory-orders') }}
                    </Badge>
                </Link>
            </Button>

            <Button
                v-if="canOpenPharmacyWorkflow && canUseInlineOrders"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                @click="emit('openInlineOrder', 'pharmacy')"
            >
                <span
                    :class="[
                        'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                        compact ? 'size-7' : 'size-8',
                    ]"
                >
                    <AppIcon name="pill" class="size-4" />
                </span>
                <span class="min-w-0">
                    <span class="block text-sm font-medium">Pharmacy</span>
                    <span
                        v-if="!compact"
                        class="block text-[11px] font-normal text-muted-foreground"
                    >
                        Meds and safety
                    </span>
                </span>
                <Badge
                    v-if="canShowCare"
                    :variant="careSummaryBadgeVariant('pharmacy-orders')"
                    class="ml-auto shrink-0 text-[10px]"
                >
                    {{ careSummaryCountLabel('pharmacy-orders') }}
                </Badge>
            </Button>
            <Button
                v-else-if="canOpenPharmacyWorkflow"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                as-child
            >
                <Link
                    :href="
                        contextCreateHref('/pharmacy-orders/legacy', {
                            includeTabNew: true,
                        })
                    "
                >
                    <span
                        :class="[
                            'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                            compact ? 'size-7' : 'size-8',
                        ]"
                    >
                        <AppIcon name="pill" class="size-4" />
                    </span>
                    <span class="min-w-0">
                        <span class="block text-sm font-medium">Pharmacy</span>
                        <span
                            v-if="!compact"
                            class="block text-[11px] font-normal text-muted-foreground"
                        >
                            Meds and safety
                        </span>
                    </span>
                    <Badge
                        v-if="canShowCare"
                        :variant="careSummaryBadgeVariant('pharmacy-orders')"
                        class="ml-auto shrink-0 text-[10px]"
                    >
                        {{ careSummaryCountLabel('pharmacy-orders') }}
                    </Badge>
                </Link>
            </Button>

            <Button
                v-if="canOpenRadiologyWorkflow && canUseInlineOrders"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                @click="emit('openInlineOrder', 'radiology')"
            >
                <span
                    :class="[
                        'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                        compact ? 'size-7' : 'size-8',
                    ]"
                >
                    <AppIcon name="activity" class="size-4" />
                </span>
                <span class="min-w-0">
                    <span class="block text-sm font-medium">Imaging</span>
                    <span
                        v-if="!compact"
                        class="block text-[11px] font-normal text-muted-foreground"
                    >
                        Studies and reports
                    </span>
                </span>
                <Badge
                    v-if="canShowCare"
                    :variant="careSummaryBadgeVariant('radiology-orders')"
                    class="ml-auto shrink-0 text-[10px]"
                >
                    {{ careSummaryCountLabel('radiology-orders') }}
                </Badge>
            </Button>
            <Button
                v-else-if="canOpenRadiologyWorkflow"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                as-child
            >
                <Link
                    :href="
                        contextCreateHref('/radiology-orders/legacy', {
                            includeTabNew: true,
                        })
                    "
                >
                    <span
                        :class="[
                            'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                            compact ? 'size-7' : 'size-8',
                        ]"
                    >
                        <AppIcon name="activity" class="size-4" />
                    </span>
                    <span class="min-w-0">
                        <span class="block text-sm font-medium">Imaging</span>
                        <span
                            v-if="!compact"
                            class="block text-[11px] font-normal text-muted-foreground"
                        >
                            Studies and reports
                        </span>
                    </span>
                    <Badge
                        v-if="canShowCare"
                        :variant="careSummaryBadgeVariant('radiology-orders')"
                        class="ml-auto shrink-0 text-[10px]"
                    >
                        {{ careSummaryCountLabel('radiology-orders') }}
                    </Badge>
                </Link>
            </Button>

            <Button
                v-if="canOpenTheatreWorkflow && canOpenTheatreInline"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                @click="emit('openTheatreInline')"
            >
                <span
                    :class="[
                        'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                        compact ? 'size-7' : 'size-8',
                    ]"
                >
                    <AppIcon name="scissors" class="size-4" />
                </span>
                <span class="min-w-0">
                    <span class="block text-sm font-medium">Theatre</span>
                    <span
                        v-if="!compact"
                        class="block text-[11px] font-normal text-muted-foreground"
                    >
                        Procedures
                    </span>
                </span>
                <Badge
                    v-if="canShowCare"
                    :variant="careSummaryBadgeVariant('theatre-procedures')"
                    class="ml-auto shrink-0 text-[10px]"
                >
                    {{ careSummaryCountLabel('theatre-procedures') }}
                </Badge>
            </Button>
            <Button
                v-else-if="canOpenTheatreWorkflow"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                as-child
            >
                <Link
                    :href="
                        contextCreateHref('/theatre-procedures/legacy', {
                            includeTabNew: true,
                        })
                    "
                >
                    <span
                        :class="[
                            'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                            compact ? 'size-7' : 'size-8',
                        ]"
                    >
                        <AppIcon name="scissors" class="size-4" />
                    </span>
                    <span class="min-w-0">
                        <span class="block text-sm font-medium">Theatre</span>
                        <span
                            v-if="!compact"
                            class="block text-[11px] font-normal text-muted-foreground"
                        >
                            Procedures
                        </span>
                    </span>
                    <Badge
                        v-if="canShowCare"
                        :variant="careSummaryBadgeVariant('theatre-procedures')"
                        class="ml-auto shrink-0 text-[10px]"
                    >
                        {{ careSummaryCountLabel('theatre-procedures') }}
                    </Badge>
                </Link>
            </Button>

            <Button
                v-if="canOpenBillingWorkflow && canOpenBillingInline && !hideBillingLink"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                @click="emit('openBillingInline')"
            >
                <span
                    :class="[
                        'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                        compact ? 'size-7' : 'size-8',
                    ]"
                >
                    <AppIcon name="receipt" class="size-4" />
                </span>
                <span class="min-w-0">
                    <span class="block text-sm font-medium">Billing</span>
                    <span
                        v-if="!compact"
                        class="block text-[11px] font-normal text-muted-foreground"
                    >
                        Charges
                    </span>
                </span>
            </Button>
            <Button
                v-else-if="canOpenBillingWorkflow && !hideBillingLink"
                variant="outline"
                :class="[
                    'h-auto justify-start text-left',
                    compact
                        ? 'min-h-11 gap-2 px-2 py-2'
                        : 'min-h-14 gap-3 px-3 py-3',
                ]"
                as-child
            >
                <Link
                    :href="
                        contextCreateHref('/billing', {
                            includeTabNew: true,
                        })
                    "
                >
                    <span
                        :class="[
                            'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                            compact ? 'size-7' : 'size-8',
                        ]"
                    >
                        <AppIcon name="receipt" class="size-4" />
                    </span>
                    <span class="min-w-0">
                        <span class="block text-sm font-medium">Billing</span>
                        <span
                            v-if="!compact"
                            class="block text-[11px] font-normal text-muted-foreground"
                        >
                            Charges
                        </span>
                    </span>
                </Link>
            </Button>
        </div>

        <p
            v-if="canUseInlineOrders && !compact"
            class="text-[11px] leading-5 text-muted-foreground"
        >
            Lab, pharmacy, and imaging open inline. Duplicate checks and
            medication safety run before placement.
        </p>
    </section>
</template>
