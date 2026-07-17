<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LaboratoryOrder, LabResultParameter } from '@/composables/laboratoryOrders/useLaboratoryOrders';

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: LaboratoryOrder | null;
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
    submit: [payload: { verificationNote?: string | null }];
}>();

const verificationNote = ref('');

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) verificationNote.value = '';
    },
);

// Matches VerifyLaboratoryOrderResultUseCase's own critical-result check
// (isCriticalResultSummary: `str_contains(strtolower($resultSummary), 'result flag: critical')`)
// so the UI surfaces the requirement before the server rejects the submission.
const isCritical = computed(() => props.order?.currentCare?.hasCriticalResult ?? false);
const noteMissing = computed(() => isCritical.value && verificationNote.value.trim() === '');

const parameters = computed<LabResultParameter[]>(() => props.order?.resultParameters ?? []);
const hasParameters = computed(() => parameters.value.length > 0);

function paramFlagBadgeClass(flag: string | null): string {
    switch (flag) {
        case 'critical':
            return 'border-destructive bg-destructive/10 text-destructive';
        case 'abnormal':
            return 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
        case 'normal':
            return 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
        default:
            return 'border-input text-muted-foreground';
    }
}

function submit(): void {
    emit('submit', { verificationNote: verificationNote.value.trim() || null });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="action" size="xl">
            <DialogHeader>
                <DialogTitle>Verify result</DialogTitle>
                <DialogDescription>Confirm the laboratory result was reviewed and release it.</DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="rounded-lg border bg-muted/20 px-3 py-2">
                    <p class="text-xs font-medium text-muted-foreground">
                        <span class="font-semibold uppercase tracking-wide">Order</span>
                        &mdash;
                        {{ order?.testName || order?.testCode || 'Laboratory order' }}
                    </p>
                </div>

                <div v-if="hasParameters" class="max-h-72 overflow-y-auto rounded-lg border">
                    <div class="grid grid-cols-3 gap-2 p-3">
                        <div
                            v-for="param in parameters"
                            :key="param.code"
                            class="rounded border bg-background p-2"
                        >
                            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {{ param.name }}
                            </p>
                            <p class="mt-0.5 text-sm font-medium text-foreground">
                                {{ param.value ?? '—' }}
                                <span v-if="param.unit" class="text-xs font-normal text-muted-foreground">
                                    {{ param.unit }}
                                </span>
                            </p>
                            <Badge v-if="param.flag" variant="outline" :class="['mt-1 text-[10px]', paramFlagBadgeClass(param.flag)]">
                                {{ param.flag === 'critical' ? 'Critical' : param.flag === 'abnormal' ? 'Abnormal' : 'Normal' }}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div v-else-if="order?.resultSummary" class="max-h-72 overflow-y-auto rounded-lg border bg-muted/20 p-3">
                    <p class="whitespace-pre-line text-xs text-muted-foreground">
                        {{ order.resultSummary }}
                    </p>
                </div>

                <div v-else class="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                    No result recorded.
                </div>

                <div class="grid gap-2">
                    <Label for="lab-verify-note">
                        Verification note<span v-if="isCritical"> (required for critical results)</span><span v-else> (optional)</span>
                    </Label>
                    <Textarea id="lab-verify-note" v-model="verificationNote" rows="4" />
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">Close</Button>
                <Button :disabled="loading || noteMissing" @click="submit">{{ loading ? 'Saving...' : 'Verify' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
