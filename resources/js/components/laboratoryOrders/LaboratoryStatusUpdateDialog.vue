<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import StructuredLabResultForm from '@/components/laboratoryOrders/StructuredLabResultForm.vue';
import {
    buildResultSummaryFromTemplate,
    buildResultParametersFromTemplate,
} from '@/lib/resultTemplate';
import type {
    CatalogParameter,
    LabResultParameter,
    LaboratoryOrder,
    LaboratoryOrderStatus,
} from '@/composables/laboratoryOrders/useLaboratoryOrders';

type Intent = 'collect' | 'start_processing' | 'complete' | null;
type ResultFlag = '' | 'normal' | 'abnormal' | 'critical' | 'inconclusive';

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: LaboratoryOrder | null;
        intent: Intent;
        loading?: boolean;
        error?: string | null;
    }>(),
    {
        loading: false,
        error: null,
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    submit: [
        payload: {
            status: LaboratoryOrderStatus;
            resultSummary?: string | null;
            resultParameters?: LabResultParameter[] | null;
        },
    ];
}>();

const isPanel = computed(
    () =>
        props.order?.catalogUnit === 'panel' &&
        (props.order?.catalogParameters?.length ?? 0) > 0,
);

const hasResultTemplate = computed(
    () =>
        props.intent === 'complete' &&
        props.order?.catalogResultTemplate != null &&
        (props.order.catalogResultTemplate.sections?.length ?? 0) > 0,
);

const templateValues = ref<Record<string, string | string[]>>({});

const resultFlag = ref<ResultFlag | undefined>(undefined);
const resultValue = ref('');
const resultUnit = ref('');
const referenceRange = ref('');
const interpretation = ref('');
const recommendation = ref('');

interface ParameterRow {
    code: string;
    name: string;
    value: string;
    unit: string;
    flag: ResultFlag;
    referenceRange: string;
}

const parameterRows = ref<ParameterRow[]>([]);

function resetForm(): void {
    resultFlag.value = '';
    resultValue.value = '';
    resultUnit.value = '';
    referenceRange.value = '';
    interpretation.value = '';
    recommendation.value = '';

    const catalogParams = props.order?.catalogParameters ?? [];
    parameterRows.value = catalogParams.map((p: CatalogParameter) => ({
        code: p.code,
        name: p.name,
        value: '',
        unit: p.unit,
        flag: '' as ResultFlag,
        referenceRange: [p.referenceRangeLow, p.referenceRangeHigh]
            .filter(Boolean)
            .join('-'),
    }));
}

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) resetForm();
    },
);

watch(
    () => props.order,
    () => {
        if (props.open) resetForm();
    },
);

const resultFlagOptions: Array<{ value: ResultFlag; label: string }> = [
    { value: 'normal', label: 'Normal' },
    { value: 'abnormal', label: 'Abnormal' },
    { value: 'critical', label: 'Critical' },
    { value: 'inconclusive', label: 'Inconclusive' },
];

const config = computed(() => {
    switch (props.intent) {
        case 'collect':
            return {
                title: 'Collect specimen',
                description: 'Mark the specimen as collected.',
                buttonLabel: 'Collect specimen',
            };
        case 'start_processing':
            return {
                title: 'Start processing',
                description: 'Move this order into processing.',
                buttonLabel: 'Start processing',
            };
        default:
            return {
                title: 'Complete result',
                description: 'Record the result to complete this order.',
                buttonLabel: 'Complete result',
            };
    }
});

const resultSummaryPreview = computed(() => {
    const lines: string[] = [];

    if (resultFlag.value)
        lines.push(
            `Result Flag: ${resultFlagOptions.find((o) => o.value === resultFlag.value)?.label}`,
        );

    if (isPanel.value) {
        if (interpretation.value.trim())
            lines.push(`Interpretation: ${interpretation.value.trim()}`);
        if (recommendation.value.trim())
            lines.push(`Recommendation: ${recommendation.value.trim()}`);
        const filled = parameterRows.value.filter((r) => r.value.trim());
        if (filled.length > 0) {
            lines.push('--- Parameters ---');
            for (const row of filled) {
                const parts = [row.value.trim(), row.unit]
                    .filter(Boolean)
                    .join(' ');
                const ref = row.referenceRange
                    ? ` (Ref: ${row.referenceRange})`
                    : '';
                const flag = row.flag ? ` [${row.flag}]` : '';
                lines.push(`${row.name}: ${parts}${ref}${flag}`);
            }
        }
    } else {
        const resultLine = [resultValue.value.trim(), resultUnit.value.trim()]
            .filter(Boolean)
            .join(' ');
        if (resultLine) lines.push(`Measured Result: ${resultLine}`);
        if (referenceRange.value.trim())
            lines.push(`Reference Range: ${referenceRange.value.trim()}`);
        if (interpretation.value.trim())
            lines.push(`Interpretation: ${interpretation.value.trim()}`);
        if (recommendation.value.trim())
            lines.push(`Recommendation: ${recommendation.value.trim()}`);
    }

    return lines.join('\n');
});

function submit(): void {
    if (props.intent === 'collect') {
        emit('submit', { status: 'collected' });
        return;
    }
    if (props.intent === 'start_processing') {
        emit('submit', { status: 'in_progress' });
        return;
    }

    if (hasResultTemplate.value && props.order?.catalogResultTemplate) {
        const template = props.order.catalogResultTemplate;
        const summary = buildResultSummaryFromTemplate(
            props.order.testName || 'Laboratory result',
            template.sections,
            templateValues.value,
        );
        const params = buildResultParametersFromTemplate(
            template.sections,
            templateValues.value,
        );
        emit('submit', {
            status: 'completed',
            resultSummary: summary,
            resultParameters: params.length > 0 ? params : null,
        });
        return;
    }

    const resultParameters: LabResultParameter[] | null = isPanel.value
        ? parameterRows.value
              .filter((r) => r.value.trim())
              .map((r) => ({
                  code: r.code,
                  name: r.name,
                  value: r.value.trim() || null,
                  unit: r.unit || null,
                  flag: r.flag || null,
                  referenceRange: r.referenceRange || null,
              }))
        : null;

    emit('submit', {
        status: 'completed',
        resultSummary: resultSummaryPreview.value.trim() || null,
        resultParameters:
            resultParameters && resultParameters.length > 0
                ? resultParameters
                : null,
    });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent
            variant="action"
            :size="isPanel && intent === 'complete' ? 'xl' : 'lg'"
        >
            <DialogHeader>
                <DialogTitle>{{ config.title }}</DialogTitle>
                <DialogDescription>{{ config.description }}</DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p
                        class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                        Order
                    </p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{
                            order?.testName ||
                            order?.testCode ||
                            'Laboratory order'
                        }}
                    </p>
                    <p
                        v-if="isPanel"
                        class="mt-1 text-xs text-muted-foreground"
                    >
                        Panel test —
                        {{ order?.catalogParameters?.length }} parameters
                    </p>
                </div>

                <template v-if="intent === 'complete'">
                    <template v-if="hasResultTemplate && order?.catalogResultTemplate">
                        <StructuredLabResultForm
                            :template="order.catalogResultTemplate"
                            @update:values="(values) => (templateValues = values)"
                        />
                    </template>
                    <template v-else-if="isPanel">
                        <div class="grid gap-2">
                            <Label for="lab-status-result-flag-panel"
                                >Result flag</Label
                            >
                            <Select v-model="resultFlag">
                                <SelectTrigger
                                    id="lab-status-result-flag-panel"
                                    class="h-9"
                                >
                                    <SelectValue
                                        placeholder="Select overall result flag"
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="option in resultFlagOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div class="rounded-lg border">
                            <div
                                class="grid grid-cols-12 gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground"
                            >
                                <div class="col-span-3">Parameter</div>
                                <div class="col-span-3">Value</div>
                                <div class="col-span-2">Unit</div>
                                <div class="col-span-2">Flag</div>
                                <div class="col-span-2">Reference range</div>
                            </div>
                            <div class="divide-y">
                                <div
                                    v-for="(row, index) in parameterRows"
                                    :key="row.code"
                                    class="grid grid-cols-12 gap-2 px-3 py-2"
                                >
                                    <div
                                        class="col-span-3 flex items-center text-sm font-medium text-foreground"
                                    >
                                        {{ row.name }}
                                    </div>
                                    <div class="col-span-3">
                                        <Input
                                            v-model="row.value"
                                            placeholder="Value"
                                            class="h-8 text-xs"
                                        />
                                    </div>
                                    <div class="col-span-2">
                                        <Input
                                            v-model="row.unit"
                                            placeholder="Unit"
                                            class="h-8 text-xs"
                                        />
                                    </div>
                                    <div class="col-span-2">
                                        <Select v-model="row.flag">
                                            <SelectTrigger class="h-8 text-xs">
                                                <SelectValue placeholder="—" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value=""
                                                    >—</SelectItem
                                                >
                                                <SelectItem
                                                    v-for="option in resultFlagOptions"
                                                    :key="option.value"
                                                    :value="option.value"
                                                >
                                                    {{ option.label }}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div
                                        class="col-span-2 flex items-center text-xs text-muted-foreground"
                                    >
                                        {{ row.referenceRange }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-2">
                            <Label for="lab-status-interpretation-panel"
                                >Interpretation</Label
                            >
                            <Textarea
                                id="lab-status-interpretation-panel"
                                v-model="interpretation"
                                rows="2"
                            />
                        </div>
                        <div class="grid gap-2">
                            <Label for="lab-status-recommendation-panel"
                                >Recommendation</Label
                            >
                            <Textarea
                                id="lab-status-recommendation-panel"
                                v-model="recommendation"
                                rows="2"
                            />
                        </div>
                    </template>

                    <template v-else>
                        <div class="grid grid-cols-3 gap-3">
                            <div class="grid gap-2">
                                <Label for="lab-status-result-value"
                                    >Measured result</Label
                                >
                                <Input
                                    id="lab-status-result-value"
                                    v-model="resultValue"
                                    placeholder="e.g. Non-reactive or 6.2"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label for="lab-status-result-unit">Unit</Label>
                                <Input
                                    id="lab-status-result-unit"
                                    v-model="resultUnit"
                                    placeholder="Optional unit"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label for="lab-status-result-flag"
                                    >Result flag</Label
                                >
                                <Select v-model="resultFlag">
                                    <SelectTrigger
                                        id="lab-status-result-flag"
                                        class="h-9"
                                    >
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem
                                            v-for="option in resultFlagOptions"
                                            :key="option.value"
                                            :value="option.value"
                                        >
                                            {{ option.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div class="grid gap-2">
                            <Label for="lab-status-reference-range"
                                >Reference range</Label
                            >
                            <Input
                                id="lab-status-reference-range"
                                v-model="referenceRange"
                                placeholder="Optional reference range"
                            />
                        </div>
                        <div class="grid gap-2">
                            <Label for="lab-status-interpretation"
                                >Interpretation</Label
                            >
                            <Textarea
                                id="lab-status-interpretation"
                                v-model="interpretation"
                                rows="2"
                            />
                        </div>
                        <div class="grid gap-2">
                            <Label for="lab-status-recommendation"
                                >Recommendation</Label
                            >
                            <Textarea
                                id="lab-status-recommendation"
                                v-model="recommendation"
                                rows="2"
                            />
                        </div>
                    </template>

                    <Alert
                        v-if="resultFlag === 'critical'"
                        variant="destructive"
                    >
                        <AlertDescription
                            >A critical result will require a verification note
                            when this order is verified.</AlertDescription
                        >
                    </Alert>
                </template>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button
                    variant="outline"
                    :disabled="loading"
                    @click="emit('update:open', false)"
                    >Close</Button
                >
                <Button :disabled="loading" @click="submit">
                    {{ loading ? 'Saving...' : config.buttonLabel }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
