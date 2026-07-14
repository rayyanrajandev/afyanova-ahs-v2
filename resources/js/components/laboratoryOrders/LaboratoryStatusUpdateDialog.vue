<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LaboratoryOrder, LaboratoryOrderStatus } from '@/composables/laboratoryOrders/useLaboratoryOrders';

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
    submit: [payload: { status: LaboratoryOrderStatus; resultSummary?: string | null }];
}>();

// Structured result-entry fields, ported from the legacy page's convention
// (buildStructuredLabResultSummary() in laboratory-orders/Index.vue) — the
// same newline-delimited "Label: value" lines ClinicalCurrentCare::laboratory()
// and VerifyLaboratoryOrderResultUseCase parse for critical/abnormal detection,
// so keeping this shape is what makes those signals work at all, not just polish.
const resultFlag = ref<ResultFlag>('');
const resultValue = ref('');
const resultUnit = ref('');
const referenceRange = ref('');
const interpretation = ref('');
const recommendation = ref('');

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        resultFlag.value = '';
        resultValue.value = '';
        resultUnit.value = '';
        referenceRange.value = '';
        interpretation.value = '';
        recommendation.value = '';
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
            return { title: 'Collect specimen', description: 'Mark the specimen as collected.', buttonLabel: 'Collect specimen' };
        case 'start_processing':
            return { title: 'Start processing', description: 'Move this order into processing.', buttonLabel: 'Start processing' };
        default:
            return { title: 'Complete result', description: 'Record the result to complete this order.', buttonLabel: 'Complete result' };
    }
});

const resultSummaryPreview = computed(() => {
    const lines: string[] = [];
    const resultLine = [resultValue.value.trim(), resultUnit.value.trim()].filter(Boolean).join(' ');

    if (resultFlag.value) lines.push(`Result Flag: ${resultFlagOptions.find((option) => option.value === resultFlag.value)?.label}`);
    if (resultLine) lines.push(`Measured Result: ${resultLine}`);
    if (referenceRange.value.trim()) lines.push(`Reference Range: ${referenceRange.value.trim()}`);
    if (interpretation.value.trim()) lines.push(`Interpretation: ${interpretation.value.trim()}`);
    if (recommendation.value.trim()) lines.push(`Recommendation: ${recommendation.value.trim()}`);

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

    emit('submit', { status: 'completed', resultSummary: resultSummaryPreview.value.trim() || null });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="action" size="lg">
            <DialogHeader>
                <DialogTitle>{{ config.title }}</DialogTitle>
                <DialogDescription>{{ config.description }}</DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order</p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{ order?.testName || order?.testCode || 'Laboratory order' }}
                    </p>
                </div>

                <template v-if="intent === 'complete'">
                    <div class="grid grid-cols-3 gap-3">
                        <div class="grid gap-2">
                            <Label for="lab-status-result-value">Measured result</Label>
                            <Input id="lab-status-result-value" v-model="resultValue" placeholder="e.g. Non-reactive or 6.2" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="lab-status-result-unit">Unit</Label>
                            <Input id="lab-status-result-unit" v-model="resultUnit" placeholder="Optional unit" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="lab-status-result-flag">Result flag</Label>
                            <Select v-model="resultFlag">
                                <SelectTrigger id="lab-status-result-flag" class="h-9">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in resultFlagOptions" :key="option.value" :value="option.value">
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div class="grid gap-2">
                        <Label for="lab-status-reference-range">Reference range</Label>
                        <Input id="lab-status-reference-range" v-model="referenceRange" placeholder="Optional reference range" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="lab-status-interpretation">Interpretation</Label>
                        <Textarea id="lab-status-interpretation" v-model="interpretation" rows="2" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="lab-status-recommendation">Recommendation</Label>
                        <Textarea id="lab-status-recommendation" v-model="recommendation" rows="2" />
                    </div>
                    <Alert v-if="resultFlag === 'critical'" variant="destructive">
                        <AlertDescription>A critical result will require a verification note when this order is verified.</AlertDescription>
                    </Alert>
                </template>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">Close</Button>
                <Button :disabled="loading" @click="submit">
                    {{ loading ? 'Saving...' : config.buttonLabel }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
