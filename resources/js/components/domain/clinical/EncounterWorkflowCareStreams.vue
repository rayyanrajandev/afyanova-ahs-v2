<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import EncounterOrderProgress from '@/components/domain/clinical/EncounterOrderProgress.vue';
import LabResultSummaryPopover from '@/components/laboratoryOrders/LabResultSummaryPopover.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
    EncounterInlineOrderLinkageContext,
    EncounterInlineOrderType,
} from '@/lib/encounterInlineOrders';
import {
    encounterCareState,
    encounterCareStateLabel,
    encounterCareStateVariant,
    laboratoryOrderStatusVariant,
    laboratoryOrderSummaryText,
    pharmacyOrderQuantityLabel,
    pharmacyOrderStatusVariant,
    pharmacyOrderSummaryText,
    radiologyOrderStatusVariant,
    radiologyOrderSummaryText,
    theatreProcedureStatusVariant,
    theatreProcedureSummaryText,
    type CreateEncounterCareSummary,
    type EncounterCareLaboratoryOrder,
    type EncounterCarePharmacyOrder,
    type EncounterCareRadiologyOrder,
    type EncounterCareTheatreProcedure,
} from '@/lib/encounterWorkspaceCare';
import {
    canApplyLaboratoryEncounterLifecycleAction,
    canApplyPharmacyEncounterLifecycleAction,
    canApplyRadiologyEncounterLifecycleAction,
    canApplyTheatreEncounterLifecycleAction,
    type EncounterLifecycleAction,
    type EncounterLifecycleTargetKind,
} from '@/lib/encounterWorkspaceLifecycle';
import { formatEnumLabel } from '@/lib/labels';

const careTab = defineModel<string>({ required: true });

const props = defineProps<{
    visibleSummaries: CreateEncounterCareSummary[];
    laboratoryOrders: EncounterCareLaboratoryOrder[];
    pharmacyOrders: EncounterCarePharmacyOrder[];
    radiologyOrders: EncounterCareRadiologyOrder[];
    theatreProcedures: EncounterCareTheatreProcedure[];
    laboratoryLoading: boolean;
    pharmacyLoading: boolean;
    radiologyLoading: boolean;
    theatreLoading: boolean;
    laboratoryError: string | null;
    pharmacyError: string | null;
    radiologyError: string | null;
    theatreError: string | null;
    canOpenLaboratoryWorkflow: boolean;
    canOpenPharmacyWorkflow: boolean;
    canOpenRadiologyWorkflow: boolean;
    canOpenTheatreWorkflow: boolean;
    canCreateLaboratoryOrders: boolean;
    canCreatePharmacyOrders: boolean;
    canCreateRadiologyOrders: boolean;
    canCreateTheatreProcedures: boolean;
    canUseInlineOrders: boolean;
    contextCreateHref: (path: string, options?: Record<string, unknown>) => string;
    formatDateTime: (value: string | null | undefined) => string;
    compact?: boolean;
}>();

const emit = defineEmits<{
    lifecycle: [
        payload: {
            kind: EncounterLifecycleTargetKind;
            id: string;
            action: EncounterLifecycleAction;
            defaultReason?: string | null;
        },
    ];
    openInlineOrder: [
        payload: {
            type: EncounterInlineOrderType;
            linkage: EncounterInlineOrderLinkageContext;
        },
    ];
    viewLabResult: [orderId: string];
}>();

function emitLifecycle(
    kind: EncounterLifecycleTargetKind,
    id: string,
    action: EncounterLifecycleAction,
    defaultReason?: string | null,
): void {
    emit('lifecycle', { kind, id, action, defaultReason });
}

function orderActionLabel(...parts: Array<string | null | undefined>): string {
    return parts
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(' · ');
}

function emitInlineOrder(
    type: EncounterInlineOrderType,
    mode: EncounterInlineOrderLinkageContext['mode'],
    sourceOrderId: string,
    sourceLabel: string,
): void {
    emit('openInlineOrder', {
        type,
        linkage: {
            mode,
            sourceOrderId,
            sourceLabel: sourceLabel.trim() || sourceOrderId,
        },
    });
}

function summaryIncludes(id: CreateEncounterCareSummary['id']): boolean {
    return props.visibleSummaries.some((summary) => summary.id === id);
}
</script>

<template>
    <Tabs
        v-model="careTab"
        class="space-y-4"
    >
        <TabsList
            :class="[
                '!h-auto min-h-9 w-full gap-1 rounded-lg border bg-muted/20 p-1',
                compact
                    ? '!grid grid-cols-2'
                    : '!inline-flex flex-wrap justify-start',
            ]"
        >
            <TabsTrigger
                v-for="summary in visibleSummaries"
                :key="`mr-create-encounter-tab-${summary.id}`"
                :value="summary.id"
                :class="[
                    '!h-8 gap-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm',
                    compact ? 'min-w-0 justify-center' : 'shrink-0',
                ]"
            >
                <span class="truncate">{{ summary.label }}</span>
                <Badge variant="secondary" class="text-[10px]">
                    {{ summary.count }}
                </Badge>
            </TabsTrigger>
        </TabsList>

        <TabsContent
            v-if="summaryIncludes('laboratory-orders')"
            value="laboratory-orders"
            class="mt-0"
        >
            <div class="space-y-3">
                <div
                    v-if="laboratoryLoading"
                    class="space-y-2"
                >
                    <Skeleton class="h-14 w-full rounded-lg" />
                    <Skeleton class="h-14 w-full rounded-lg" />
                </div>
                <p
                    v-else-if="laboratoryError"
                    class="text-sm text-destructive"
                >
                    {{ laboratoryError }}
                </p>
                <p
                    v-else-if="laboratoryOrders.length === 0"
                    class="text-sm text-muted-foreground"
                >
                    No lab orders.
                </p>
                <div
                    v-else
                    :class="[
                        'space-y-2',
                        laboratoryOrders.length > 5
                            ? 'max-h-[30rem] overflow-y-auto'
                            : 'overflow-visible',
                    ]"
                >
                    <div
                        v-for="order in laboratoryOrders"
                        :key="`mr-create-lab-order-${order.id}`"
                        :class="[
                            'space-y-2 rounded-lg border bg-background shadow-sm',
                            compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
                        ]"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium text-foreground">
                                    {{ order.testName || 'Laboratory order' }}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ order.orderNumber || 'Order number pending' }}
                                    |
                                    Ordered {{ formatDateTime(order.orderedAt) }}
                                </p>
                            </div>
                            <Badge :variant="laboratoryOrderStatusVariant(order.status)">
                                {{ formatEnumLabel(order.status || 'ordered') }}
                            </Badge>
                        </div>
                        <div
                            v-if="(order.resultSummary ?? '').trim() !== ''"
                            class="mt-1 flex flex-wrap items-center gap-2"
                        >
                            <LabResultSummaryPopover
                                :result-summary="order.resultSummary"
                                show-view-full
                                @view-full-result="emit('viewLabResult', order.id)"
                            />
                            <span v-if="order.resultedAt" class="text-[11px] text-muted-foreground">
                                Resulted {{ formatDateTime(order.resultedAt) }}
                            </span>
                        </div>
                        <p v-else class="mt-1 text-xs text-muted-foreground">
                            {{ laboratoryOrderSummaryText(order, formatDateTime) }}
                        </p>
                        <EncounterOrderProgress
                            v-if="!compact"
                            class="mt-2"
                            order-type="laboratory"
                            :order="order"
                            :format-date-time="formatDateTime"
                        />
                        <div
                            v-if="canOpenLaboratoryWorkflow"
                            class="mt-2 flex justify-end"
                        >
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2 text-[11px]">
                                        Actions
                                        <AppIcon name="chevron-down" class="size-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" class="w-48">
                                    <DropdownMenuItem @select="emit('viewLabResult', order.id)">
                                        <AppIcon name="file-text" class="size-4" />
                                        View details
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        v-if="canUseInlineOrders"
                                        @select="emitInlineOrder('laboratory', 'reorder', order.id, orderActionLabel(order.orderNumber, order.testName))"
                                    >
                                        <AppIcon name="repeat-2" class="size-4" />
                                        Reorder inline
                                    </DropdownMenuItem>
                                    <DropdownMenuItem v-else as-child>
                                        <Link :href="contextCreateHref('/laboratory-orders/legacy', { includeTabNew: true, reorderOfId: order.id })">
                                            <AppIcon name="repeat-2" class="size-4" />
                                            Reorder
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="canUseInlineOrders"
                                        @select="emitInlineOrder('laboratory', 'add_on', order.id, orderActionLabel(order.orderNumber, order.testName))"
                                    >
                                        <AppIcon name="git-branch-plus" class="size-4" />
                                        Add linked test
                                    </DropdownMenuItem>
                                    <DropdownMenuItem v-else as-child>
                                        <Link :href="contextCreateHref('/laboratory-orders/legacy', { includeTabNew: true, addOnToOrderId: order.id })">
                                            <AppIcon name="git-branch-plus" class="size-4" />
                                            Add linked test
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator
                                        v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'cancel', canCreateLaboratoryOrders) || canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error', canCreateLaboratoryOrders)"
                                    />
                                    <DropdownMenuItem
                                        v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'cancel', canCreateLaboratoryOrders)"
                                        variant="destructive"
                                        @select="emitLifecycle('laboratory', order.id, 'cancel', order.statusReason)"
                                    >
                                        <AppIcon name="circle-x" class="size-4" />
                                        Cancel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error', canCreateLaboratoryOrders)"
                                        variant="destructive"
                                        @select="emitLifecycle('laboratory', order.id, 'entered_in_error')"
                                    >
                                        <AppIcon name="file-x" class="size-4" />
                                        Entered in error
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>
        </TabsContent>

        <TabsContent
            v-if="summaryIncludes('pharmacy-orders')"
            value="pharmacy-orders"
            class="mt-0"
        >
            <div class="space-y-3">
                <div
                    v-if="pharmacyLoading"
                    class="space-y-2"
                >
                    <Skeleton class="h-14 w-full rounded-lg" />
                    <Skeleton class="h-14 w-full rounded-lg" />
                </div>
                <p
                    v-else-if="pharmacyError"
                    class="text-sm text-destructive"
                >
                    {{ pharmacyError }}
                </p>
                <p
                    v-else-if="pharmacyOrders.length === 0"
                    class="text-sm text-muted-foreground"
                >
                    No pharmacy orders.
                </p>
                <div
                    v-else
                    :class="[
                        'space-y-2',
                        pharmacyOrders.length > 5
                            ? 'max-h-[30rem] overflow-y-auto'
                            : 'overflow-visible',
                    ]"
                >
                    <div
                        v-for="order in pharmacyOrders"
                        :key="`mr-create-pharmacy-order-${order.id}`"
                        :class="[
                            'space-y-2 rounded-lg border bg-background shadow-sm',
                            compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
                        ]"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium text-foreground">
                                    {{ order.medicationName || 'Pharmacy order' }}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ order.orderNumber || 'Order number pending' }}
                                    <span
                                        v-if="pharmacyOrderQuantityLabel(order.quantityPrescribed)"
                                    >
                                        |
                                        {{ pharmacyOrderQuantityLabel(order.quantityPrescribed) }}
                                    </span>
                                    |
                                    Ordered {{ formatDateTime(order.orderedAt) }}
                                </p>
                            </div>
                            <Badge :variant="pharmacyOrderStatusVariant(order.status)">
                                {{ formatEnumLabel(order.status || 'pending') }}
                            </Badge>
                        </div>
                        <p class="mt-1 text-xs text-muted-foreground">
                            {{ pharmacyOrderSummaryText(order, formatDateTime) }}
                        </p>
                        <EncounterOrderProgress
                            v-if="!compact"
                            class="mt-2"
                            order-type="pharmacy"
                            :order="order"
                            :format-date-time="formatDateTime"
                        />
                        <div
                            v-if="canOpenPharmacyWorkflow"
                            class="mt-2 flex justify-end"
                        >
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2 text-[11px]">
                                        Actions
                                        <AppIcon name="chevron-down" class="size-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" class="w-52">
                                    <DropdownMenuItem
                                        v-if="canUseInlineOrders"
                                        @select="emitInlineOrder('pharmacy', 'reorder', order.id, orderActionLabel(order.orderNumber, order.medicationName))"
                                    >
                                        <AppIcon name="repeat-2" class="size-4" />
                                        Reorder inline
                                    </DropdownMenuItem>
                                    <DropdownMenuItem v-else as-child>
                                        <Link :href="contextCreateHref('/pharmacy-orders/legacy', { includeTabNew: true, reorderOfId: order.id })">
                                            <AppIcon name="repeat-2" class="size-4" />
                                            Reorder
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="canUseInlineOrders"
                                        @select="emitInlineOrder('pharmacy', 'add_on', order.id, orderActionLabel(order.orderNumber, order.medicationName))"
                                    >
                                        <AppIcon name="git-branch-plus" class="size-4" />
                                        Add linked medication
                                    </DropdownMenuItem>
                                    <DropdownMenuItem v-else as-child>
                                        <Link :href="contextCreateHref('/pharmacy-orders/legacy', { includeTabNew: true, addOnToOrderId: order.id })">
                                            <AppIcon name="git-branch-plus" class="size-4" />
                                            Add linked medication
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator
                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'cancel', canCreatePharmacyOrders) || canApplyPharmacyEncounterLifecycleAction(order, 'discontinue', canCreatePharmacyOrders) || canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error', canCreatePharmacyOrders)"
                                    />
                                    <DropdownMenuItem
                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'cancel', canCreatePharmacyOrders)"
                                        variant="destructive"
                                        @select="emitLifecycle('pharmacy', order.id, 'cancel', order.statusReason)"
                                    >
                                        <AppIcon name="circle-x" class="size-4" />
                                        Cancel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'discontinue', canCreatePharmacyOrders)"
                                        variant="destructive"
                                        @select="emitLifecycle('pharmacy', order.id, 'discontinue')"
                                    >
                                        <AppIcon name="ban" class="size-4" />
                                        Discontinue
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error', canCreatePharmacyOrders)"
                                        variant="destructive"
                                        @select="emitLifecycle('pharmacy', order.id, 'entered_in_error')"
                                    >
                                        <AppIcon name="file-x" class="size-4" />
                                        Entered in error
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>
        </TabsContent>

        <TabsContent
            v-if="summaryIncludes('radiology-orders')"
            value="radiology-orders"
            class="mt-0"
        >
            <div class="space-y-3">
                <div
                    v-if="radiologyLoading"
                    class="space-y-2"
                >
                    <Skeleton class="h-14 w-full rounded-lg" />
                    <Skeleton class="h-14 w-full rounded-lg" />
                </div>
                <p
                    v-else-if="radiologyError"
                    class="text-sm text-destructive"
                >
                    {{ radiologyError }}
                </p>
                <p
                    v-else-if="radiologyOrders.length === 0"
                    class="text-sm text-muted-foreground"
                >
                    No imaging orders.
                </p>
                <div
                    v-else
                    :class="[
                        'space-y-2',
                        radiologyOrders.length > 5
                            ? 'max-h-[30rem] overflow-y-auto'
                            : 'overflow-visible',
                    ]"
                >
                    <div
                        v-for="order in radiologyOrders"
                        :key="`mr-create-radiology-order-${order.id}`"
                        :class="[
                            'space-y-2 rounded-lg border bg-background shadow-sm',
                            compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
                        ]"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium text-foreground">
                                    {{ order.studyDescription || 'Imaging order' }}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ order.orderNumber || 'Order number pending' }}
                                    |
                                    Ordered {{ formatDateTime(order.orderedAt) }}
                                </p>
                            </div>
                            <Badge :variant="radiologyOrderStatusVariant(order.status)">
                                {{ formatEnumLabel(order.status || 'ordered') }}
                            </Badge>
                        </div>
                        <p class="mt-1 text-xs text-muted-foreground">
                            {{ radiologyOrderSummaryText(order, formatDateTime) }}
                        </p>
                        <EncounterOrderProgress
                            v-if="!compact"
                            class="mt-2"
                            order-type="radiology"
                            :order="order"
                            :format-date-time="formatDateTime"
                        />
                        <div
                            v-if="canOpenRadiologyWorkflow"
                            class="mt-2 flex justify-end"
                        >
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2 text-[11px]">
                                        Actions
                                        <AppIcon name="chevron-down" class="size-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" class="w-48">
                                    <DropdownMenuItem
                                        v-if="canUseInlineOrders"
                                        @select="emitInlineOrder('radiology', 'reorder', order.id, orderActionLabel(order.orderNumber, order.studyDescription))"
                                    >
                                        <AppIcon name="repeat-2" class="size-4" />
                                        Reorder inline
                                    </DropdownMenuItem>
                                    <DropdownMenuItem v-else as-child>
                                        <Link :href="contextCreateHref('/radiology-orders/legacy', { includeTabNew: true, reorderOfId: order.id })">
                                            <AppIcon name="repeat-2" class="size-4" />
                                            Reorder
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="canUseInlineOrders"
                                        @select="emitInlineOrder('radiology', 'add_on', order.id, orderActionLabel(order.orderNumber, order.studyDescription))"
                                    >
                                        <AppIcon name="git-branch-plus" class="size-4" />
                                        Add linked study
                                    </DropdownMenuItem>
                                    <DropdownMenuItem v-else as-child>
                                        <Link :href="contextCreateHref('/radiology-orders/legacy', { includeTabNew: true, addOnToOrderId: order.id })">
                                            <AppIcon name="git-branch-plus" class="size-4" />
                                            Add linked study
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator
                                        v-if="canApplyRadiologyEncounterLifecycleAction(order, 'cancel', canCreateRadiologyOrders) || canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error', canCreateRadiologyOrders)"
                                    />
                                    <DropdownMenuItem
                                        v-if="canApplyRadiologyEncounterLifecycleAction(order, 'cancel', canCreateRadiologyOrders)"
                                        variant="destructive"
                                        @select="emitLifecycle('radiology', order.id, 'cancel', order.statusReason)"
                                    >
                                        <AppIcon name="circle-x" class="size-4" />
                                        Cancel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error', canCreateRadiologyOrders)"
                                        variant="destructive"
                                        @select="emitLifecycle('radiology', order.id, 'entered_in_error')"
                                    >
                                        <AppIcon name="file-x" class="size-4" />
                                        Entered in error
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>
        </TabsContent>

        <TabsContent
            v-if="summaryIncludes('theatre-procedures')"
            value="theatre-procedures"
            class="mt-0"
        >
            <div class="space-y-3">
                <div
                    v-if="theatreLoading"
                    class="space-y-2"
                >
                    <Skeleton class="h-14 w-full rounded-lg" />
                    <Skeleton class="h-14 w-full rounded-lg" />
                </div>
                <p
                    v-else-if="theatreError"
                    class="text-sm text-destructive"
                >
                    {{ theatreError }}
                </p>
                <p
                    v-else-if="theatreProcedures.length === 0"
                    class="text-sm text-muted-foreground"
                >
                    No theatre procedures.
                </p>
                <div
                    v-else
                    :class="[
                        'space-y-2',
                        theatreProcedures.length > 5
                            ? 'max-h-[30rem] overflow-y-auto'
                            : 'overflow-visible',
                    ]"
                >
                    <div
                        v-for="procedure in theatreProcedures"
                        :key="`mr-create-theatre-procedure-${procedure.id}`"
                        :class="[
                            'space-y-2 rounded-lg border bg-background shadow-sm',
                            compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
                        ]"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium text-foreground">
                                    {{ procedure.procedureName || procedure.procedureType || 'Theatre procedure' }}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ procedure.procedureNumber || 'Procedure number pending' }}
                                    |
                                    Scheduled {{ formatDateTime(procedure.scheduledAt) }}
                                </p>
                            </div>
                            <Badge :variant="theatreProcedureStatusVariant(procedure.status)">
                                {{ formatEnumLabel(procedure.status || 'planned') }}
                            </Badge>
                        </div>
                        <p class="mt-1 text-xs text-muted-foreground">
                            {{ theatreProcedureSummaryText(procedure, formatDateTime) }}
                        </p>
                        <EncounterOrderProgress
                            v-if="!compact"
                            class="mt-2"
                            order-type="theatre"
                            :order="procedure"
                            :format-date-time="formatDateTime"
                        />
                        <div
                            v-if="canOpenTheatreWorkflow"
                            class="mt-2 flex justify-end"
                        >
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2 text-[11px]">
                                        Actions
                                        <AppIcon name="chevron-down" class="size-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" class="w-52">
                                    <DropdownMenuItem as-child>
                                        <Link :href="contextCreateHref('/theatre-procedures/legacy', { includeTabNew: true, reorderOfId: procedure.id })">
                                            <AppIcon name="repeat-2" class="size-4" />
                                            Reorder in theatre
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem as-child>
                                        <Link :href="contextCreateHref('/theatre-procedures/legacy', { includeTabNew: true, addOnToOrderId: procedure.id })">
                                            <AppIcon name="git-branch-plus" class="size-4" />
                                            Add linked procedure
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator
                                        v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'cancel', canCreateTheatreProcedures) || canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error', canCreateTheatreProcedures)"
                                    />
                                    <DropdownMenuItem
                                        v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'cancel', canCreateTheatreProcedures)"
                                        variant="destructive"
                                        @select="emitLifecycle('theatre', procedure.id, 'cancel', procedure.statusReason)"
                                    >
                                        <AppIcon name="circle-x" class="size-4" />
                                        Cancel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error', canCreateTheatreProcedures)"
                                        variant="destructive"
                                        @select="emitLifecycle('theatre', procedure.id, 'entered_in_error')"
                                    >
                                        <AppIcon name="file-x" class="size-4" />
                                        Entered in error
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>
        </TabsContent>
    </Tabs>
</template>
