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
import type { RadiologyOrder, RadiologyOrderStatus } from '@/composables/radiologyOrders/useRadiologyOrders';

type Intent = 'schedule' | 'start_imaging' | 'complete' | null;

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: RadiologyOrder | null;
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
    submit: [payload: { status: RadiologyOrderStatus; reportSummary?: string | null }];
}>();

// Radiology has no structured result convention like lab's (no separate
// verify step either — completing the order with a report IS the release
// step, per UpdateRadiologyOrderStatusUseCase). Plain free text, matching
// the legacy page's own Textarea-only report field.
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
            return { title: 'Schedule imaging', description: 'Mark this order as scheduled.', buttonLabel: 'Schedule imaging' };
        case 'start_imaging':
            return { title: 'Start imaging', description: 'Move this order into imaging.', buttonLabel: 'Start imaging' };
        default:
            return { title: 'Complete report', description: 'Record the report to complete this order.', buttonLabel: 'Complete report' };
    }
});

function submit(): void {
    if (props.intent === 'schedule') {
        emit('submit', { status: 'scheduled' });
        return;
    }
    if (props.intent === 'start_imaging') {
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
                        {{ order?.studyDescription || order?.procedureCode || 'Radiology order' }}
                    </p>
                </div>

                <template v-if="intent === 'complete'">
                    <div class="grid gap-2">
                        <Label for="radiology-status-report">Report</Label>
                        <Textarea id="radiology-status-report" v-model="reportSummary" rows="6" placeholder="Findings, impression, and recommendation." />
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
