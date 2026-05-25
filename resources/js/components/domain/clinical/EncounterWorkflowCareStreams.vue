<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import EncounterOrderProgress from '@/components/domain/clinical/EncounterOrderProgress.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
}>();

function emitLifecycle(
    kind: EncounterLifecycleTargetKind,
    id: string,
    action: EncounterLifecycleAction,
    defaultReason?: string | null,
): void {
    emit('lifecycle', { kind, id, action, defaultReason });
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
                            compact ? 'px-2.5 py-2.5' : 'px-3 py-3',
                        ]"
                    >
                        <div
                            :class="[
                                'flex gap-3',
                                compact
                                    ? 'flex-col items-start'
                                    : 'items-start justify-between',
                            ]"
                        >
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
                        <p class="mt-1 text-xs text-muted-foreground">
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
                            class="mt-2 flex flex-wrap gap-1.5"
                        >
                            <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                <Link
                                    :href="contextCreateHref('/laboratory-orders', {
                                        includeTabNew: true,
                                        reorderOfId: order.id,
                                    })"
                                >
                                    Reorder
                                </Link>
                            </Button>
                            <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                <Link
                                    :href="contextCreateHref('/laboratory-orders', {
                                        includeTabNew: true,
                                        addOnToOrderId: order.id,
                                    })"
                                >
                                    Add Linked Test
                                </Link>
                            </Button>
                            <Button
                                v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'cancel', canCreateLaboratoryOrders)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('laboratory', order.id, 'cancel', order.statusReason)"
                            >
                                Cancel
                            </Button>
                            <Button
                                v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error', canCreateLaboratoryOrders)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('laboratory', order.id, 'entered_in_error')"
                            >
                                Entered in error
                            </Button>
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
                            compact ? 'px-2.5 py-2.5' : 'px-3 py-3',
                        ]"
                    >
                        <div
                            :class="[
                                'flex gap-3',
                                compact
                                    ? 'flex-col items-start'
                                    : 'items-start justify-between',
                            ]"
                        >
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
                            class="mt-2 flex flex-wrap gap-1.5"
                        >
                            <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                <Link
                                    :href="contextCreateHref('/pharmacy-orders', {
                                        includeTabNew: true,
                                        reorderOfId: order.id,
                                    })"
                                >
                                    Reorder
                                </Link>
                            </Button>
                            <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                <Link
                                    :href="contextCreateHref('/pharmacy-orders', {
                                        includeTabNew: true,
                                        addOnToOrderId: order.id,
                                    })"
                                >
                                    Add Linked Medication
                                </Link>
                            </Button>
                            <Button
                                v-if="canApplyPharmacyEncounterLifecycleAction(order, 'cancel', canCreatePharmacyOrders)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('pharmacy', order.id, 'cancel', order.statusReason)"
                            >
                                Cancel
                            </Button>
                            <Button
                                v-if="canApplyPharmacyEncounterLifecycleAction(order, 'discontinue', canCreatePharmacyOrders)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('pharmacy', order.id, 'discontinue')"
                            >
                                Discontinue
                            </Button>
                            <Button
                                v-if="canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error', canCreatePharmacyOrders)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('pharmacy', order.id, 'entered_in_error')"
                            >
                                Entered in error
                            </Button>
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
                            compact ? 'px-2.5 py-2.5' : 'px-3 py-3',
                        ]"
                    >
                        <div
                            :class="[
                                'flex gap-3',
                                compact
                                    ? 'flex-col items-start'
                                    : 'items-start justify-between',
                            ]"
                        >
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
                            class="mt-2 flex flex-wrap gap-1.5"
                        >
                            <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                <Link
                                    :href="contextCreateHref('/radiology-orders', {
                                        includeTabNew: true,
                                        reorderOfId: order.id,
                                    })"
                                >
                                    Reorder
                                </Link>
                            </Button>
                            <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                <Link
                                    :href="contextCreateHref('/radiology-orders', {
                                        includeTabNew: true,
                                        addOnToOrderId: order.id,
                                    })"
                                >
                                    Add Linked Study
                                </Link>
                            </Button>
                            <Button
                                v-if="canApplyRadiologyEncounterLifecycleAction(order, 'cancel', canCreateRadiologyOrders)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('radiology', order.id, 'cancel', order.statusReason)"
                            >
                                Cancel
                            </Button>
                            <Button
                                v-if="canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error', canCreateRadiologyOrders)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('radiology', order.id, 'entered_in_error')"
                            >
                                Entered in error
                            </Button>
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
                            compact ? 'px-2.5 py-2.5' : 'px-3 py-3',
                        ]"
                    >
                        <div
                            :class="[
                                'flex gap-3',
                                compact
                                    ? 'flex-col items-start'
                                    : 'items-start justify-between',
                            ]"
                        >
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
                            class="mt-2 flex flex-wrap gap-1.5"
                        >
                            <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                <Link
                                    :href="contextCreateHref('/theatre-procedures', {
                                        includeTabNew: true,
                                        reorderOfId: procedure.id,
                                    })"
                                >
                                    Reorder
                                </Link>
                            </Button>
                            <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                <Link
                                    :href="contextCreateHref('/theatre-procedures', {
                                        includeTabNew: true,
                                        addOnToOrderId: procedure.id,
                                    })"
                                >
                                    Add Linked Procedure
                                </Link>
                            </Button>
                            <Button
                                v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'cancel', canCreateTheatreProcedures)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('theatre', procedure.id, 'cancel', procedure.statusReason)"
                            >
                                Cancel
                            </Button>
                            <Button
                                v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error', canCreateTheatreProcedures)"
                                size="sm"
                                variant="outline"
                                class="h-6 gap-1 px-2 text-[10px]"
                                @click="emitLifecycle('theatre', procedure.id, 'entered_in_error')"
                            >
                                Entered in error
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </TabsContent>
    </Tabs>
</template>
