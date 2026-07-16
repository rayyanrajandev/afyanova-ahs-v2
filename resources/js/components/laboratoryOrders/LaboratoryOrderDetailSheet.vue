<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import type {
    LabResultParameter,
    LaboratoryOrder,
} from '@/composables/laboratoryOrders/useLaboratoryOrders';
import { formatEnumLabel } from '@/lib/labels';

const props = defineProps<{
    order: LaboratoryOrder | null;
    canCreate?: boolean;
}>();

const emit = defineEmits<{
    reorder: [order: LaboratoryOrder];
    addOn: [order: LaboratoryOrder];
}>();

const open = defineModel<boolean>('open', { required: true });

function requestReorder(): void {
    if (props.order) emit('reorder', props.order);
}

function requestAddOn(): void {
    if (props.order) emit('addOn', props.order);
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

/**
 * Groups by ResultTemplate section (Macroscopic Examination, Occult Blood,
 * ...) in first-seen order when the result came from a structured template.
 * Non-templated results (CBC, U&E, ...) have no section on any parameter,
 * so this returns null and the caller falls back to one flat table.
 */
const groupedResultParameters = computed((): Array<{
    section: string | null;
    params: LabResultParameter[];
}> | null => {
    const params = props.order?.resultParameters ?? [];
    if (params.length === 0 || !params.some((p) => p.section)) return null;

    const groups: Array<{ section: string | null; params: LabResultParameter[] }> = [];
    for (const param of params) {
        let group = groups.find((g) => g.section === param.section);
        if (!group) {
            group = { section: param.section, params: [] };
            groups.push(group);
        }
        group.params.push(param);
    }
    return groups;
});
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent v-if="order" side="right" variant="form" size="lg">
            <SheetHeader
                class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
                <SheetTitle>{{
                    order.testName || order.testCode || 'Laboratory order'
                }}</SheetTitle>
                <SheetDescription>{{
                    order.orderNumber || order.id
                }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{{
                        formatEnumLabel(order.status)
                    }}</Badge>
                    <Badge v-if="order.priority" variant="secondary">{{
                        formatEnumLabel(order.priority)
                    }}</Badge>
                    <Badge v-if="order.entryState" variant="secondary">{{
                        formatEnumLabel(order.entryState)
                    }}</Badge>
                    <Badge
                        v-if="order.currentCare?.hasCriticalResult"
                        variant="destructive"
                        >Critical result</Badge
                    >
                    <Badge
                        v-else-if="order.currentCare?.hasAbnormalResult"
                        class="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    >
                        Abnormal result
                    </Badge>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p
                        class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                        Test
                    </p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Test code
                            </dt>
                            <dd>{{ order.testCode || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Specimen type
                            </dt>
                            <dd>{{ order.specimenType || '—' }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="text-xs text-muted-foreground">
                                Clinical notes
                            </dt>
                            <dd>{{ order.clinicalNotes || '—' }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p
                        class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                        Result
                    </p>

                    <template
                        v-if="
                            order.resultParameters &&
                            order.resultParameters.length > 0
                        "
                    >
                        <template v-if="groupedResultParameters">
                            <div
                                v-for="group in groupedResultParameters"
                                :key="group.section ?? '__ungrouped'"
                                class="mt-2"
                            >
                                <p
                                    v-if="group.section"
                                    class="mb-1 text-xs font-semibold text-foreground"
                                >
                                    {{ group.section }}
                                </p>
                                <div class="divide-y rounded-md border">
                                    <div
                                        class="grid grid-cols-12 gap-2 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground"
                                    >
                                        <div class="col-span-3">Parameter</div>
                                        <div class="col-span-3">Value</div>
                                        <div class="col-span-2">Flag</div>
                                        <div class="col-span-4">Reference range</div>
                                    </div>
                                    <div
                                        v-for="param in group.params"
                                        :key="param.code"
                                        class="grid grid-cols-12 gap-2 px-3 py-2 text-sm"
                                    >
                                        <div
                                            class="col-span-3 font-medium text-foreground"
                                        >
                                            {{ param.name }}
                                        </div>
                                        <div class="col-span-3">
                                            {{ param.value }}
                                            <span
                                                v-if="param.unit"
                                                class="text-xs text-muted-foreground"
                                                >{{ param.unit }}</span
                                            >
                                        </div>
                                        <div class="col-span-2">
                                            <Badge
                                                v-if="param.flag === 'critical'"
                                                variant="destructive"
                                                class="text-[10px]"
                                            >
                                                Critical
                                            </Badge>
                                            <Badge
                                                v-else-if="param.flag === 'abnormal'"
                                                class="bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                            >
                                                Abnormal
                                            </Badge>
                                            <span
                                                v-else-if="param.flag === 'normal'"
                                                class="text-xs text-green-600 dark:text-green-400"
                                                >Normal</span
                                            >
                                            <span
                                                v-else
                                                class="text-xs text-muted-foreground"
                                                >—</span
                                            >
                                        </div>
                                        <div
                                            class="col-span-4 text-xs text-muted-foreground"
                                        >
                                            {{ param.referenceRange || '—' }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>

                        <div v-else class="mt-2 divide-y rounded-md border">
                            <div
                                class="grid grid-cols-12 gap-2 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground"
                            >
                                <div class="col-span-3">Parameter</div>
                                <div class="col-span-3">Value</div>
                                <div class="col-span-2">Flag</div>
                                <div class="col-span-4">Reference range</div>
                            </div>
                            <div
                                v-for="param in order.resultParameters"
                                :key="param.code"
                                class="grid grid-cols-12 gap-2 px-3 py-2 text-sm"
                            >
                                <div
                                    class="col-span-3 font-medium text-foreground"
                                >
                                    {{ param.name }}
                                </div>
                                <div class="col-span-3">
                                    {{ param.value }}
                                    <span
                                        v-if="param.unit"
                                        class="text-xs text-muted-foreground"
                                        >{{ param.unit }}</span
                                    >
                                </div>
                                <div class="col-span-2">
                                    <Badge
                                        v-if="param.flag === 'critical'"
                                        variant="destructive"
                                        class="text-[10px]"
                                    >
                                        Critical
                                    </Badge>
                                    <Badge
                                        v-else-if="param.flag === 'abnormal'"
                                        class="bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                    >
                                        Abnormal
                                    </Badge>
                                    <span
                                        v-else-if="param.flag === 'normal'"
                                        class="text-xs text-green-600 dark:text-green-400"
                                        >Normal</span
                                    >
                                    <span
                                        v-else
                                        class="text-xs text-muted-foreground"
                                        >—</span
                                    >
                                </div>
                                <div
                                    class="col-span-4 text-xs text-muted-foreground"
                                >
                                    {{ param.referenceRange || '—' }}
                                </div>
                            </div>
                        </div>
                    </template>

                    <dl
                        v-if="order.resultSummary"
                        class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm"
                    >
                        <div
                            v-if="!order.resultParameters?.length"
                            class="col-span-2"
                        >
                            <dt class="text-xs text-muted-foreground">
                                Result summary
                            </dt>
                            <dd class="whitespace-pre-line">
                                {{ order.resultSummary }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Resulted at
                            </dt>
                            <dd>{{ formatDateTime(order.resultedAt) }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Verified at
                            </dt>
                            <dd>{{ formatDateTime(order.verifiedAt) }}</dd>
                        </div>
                        <div v-if="order.verificationNote" class="col-span-2">
                            <dt class="text-xs text-muted-foreground">
                                Verification note
                            </dt>
                            <dd>{{ order.verificationNote }}</dd>
                        </div>
                    </dl>

                    <dl
                        v-else
                        class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm"
                    >
                        <div class="col-span-2">
                            <dt class="text-xs text-muted-foreground">
                                Result summary
                            </dt>
                            <dd class="whitespace-pre-line">—</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Resulted at
                            </dt>
                            <dd>{{ formatDateTime(order.resultedAt) }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Verified at
                            </dt>
                            <dd>{{ formatDateTime(order.verifiedAt) }}</dd>
                        </div>
                        <div v-if="order.verificationNote" class="col-span-2">
                            <dt class="text-xs text-muted-foreground">
                                Verification note
                            </dt>
                            <dd>{{ order.verificationNote }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p
                        class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                        Order
                    </p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Ordered by
                            </dt>
                            <dd>{{ order.orderedBy?.name || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Ordered at
                            </dt>
                            <dd>{{ formatDateTime(order.orderedAt) }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Patient
                            </dt>
                            <dd>
                                {{
                                    [
                                        order.patient?.firstName,
                                        order.patient?.lastName,
                                    ]
                                        .filter(Boolean)
                                        .join(' ') ||
                                    order.patient?.patientNumber ||
                                    '—'
                                }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">
                                Status reason
                            </dt>
                            <dd>{{ order.statusReason || '—' }}</dd>
                        </div>
                    </dl>
                </div>
            </div>

            <SheetFooter v-if="canCreate" class="shrink-0 flex-row justify-end gap-2 border-t px-6 py-3">
                <Button variant="outline" size="sm" @click="requestAddOn">Add linked test</Button>
                <Button variant="outline" size="sm" @click="requestReorder">Reorder</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
