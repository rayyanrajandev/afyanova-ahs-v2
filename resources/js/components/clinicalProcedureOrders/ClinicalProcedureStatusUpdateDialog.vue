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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ClinicalProcedureOrder, ClinicalProcedureOrderStatus } from '@/composables/clinicalProcedureOrders/useClinicalProcedureOrders';

type Intent = 'schedule' | 'start_procedure' | 'complete' | null;

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: ClinicalProcedureOrder | null;
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
    submit: [payload: { status: ClinicalProcedureOrderStatus; reportSummary?: string | null }];
}>();

const reportSummary = ref('');

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) reportSummary.value = '';
    },
);

const config = computed(() => {
    switch (props.intent) {
        case 'schedule':
            return { title: 'Schedule procedure', description: 'Mark this procedure as scheduled.', buttonLabel: 'Schedule procedure' };
        case 'start_procedure':
            return { title: 'Start procedure', description: 'Move this procedure in progress.', buttonLabel: 'Start procedure' };
        default:
            return { title: 'Complete procedure', description: 'Record the report to complete this procedure.', buttonLabel: 'Complete procedure' };
    }
});

function submit(): void {
    if (props.intent === 'schedule') {
        emit('submit', { status: 'scheduled' });
        return;
    }
    if (props.intent === 'start_procedure') {
        emit('submit', { status: 'in_progress' });
        return;
    }

    emit('submit', { status: 'completed', reportSummary: reportSummary.value.trim() || null });
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
                        {{ order?.procedureDescription || order?.procedureCode || 'Clinical procedure order' }}
                    </p>
                </div>

                <template v-if="intent === 'complete'">
                    <div class="grid gap-2">
                        <Label for="clinical-procedure-status-report">Report</Label>
                        <Textarea id="clinical-procedure-status-report" v-model="reportSummary" rows="6" placeholder="Findings, impression, and recommendation." />
                    </div>
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
