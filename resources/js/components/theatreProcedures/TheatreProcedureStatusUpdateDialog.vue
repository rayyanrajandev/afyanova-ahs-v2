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
import type { TheatreProcedure, TheatreProcedureStatus } from '@/composables/theatreProcedures/useTheatreProcedures';

type Intent = 'move_to_preop' | 'start_procedure' | 'complete' | null;

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: TheatreProcedure | null;
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
    submit: [payload: { status: TheatreProcedureStatus; completedAt?: string | null }];
}>();

// Theatre has no report/note field on this endpoint at all (unlike lab's
// structured result or radiology's free-text report) — the only extra
// input needed is completedAt, required by UpdateTheatreProcedureStatusRequest
// when transitioning to 'completed' (startedAt is nullable and the server
// defaults it to now() when entering in_progress, so no input needed there).
const completedAt = ref('');

function currentLocalDatetime(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) completedAt.value = currentLocalDatetime();
    },
);

const config = computed(() => {
    switch (props.intent) {
        case 'move_to_preop':
            return { title: 'Move to pre-op', description: 'Move this procedure into pre-operative preparation.', buttonLabel: 'Move to pre-op' };
        case 'start_procedure':
            return { title: 'Start procedure', description: 'Mark this procedure as in progress.', buttonLabel: 'Start procedure' };
        default:
            return { title: 'Complete procedure', description: 'Record the completion time to close out this procedure.', buttonLabel: 'Complete procedure' };
    }
});

function submit(): void {
    if (props.intent === 'move_to_preop') {
        emit('submit', { status: 'in_preop' });
        return;
    }
    if (props.intent === 'start_procedure') {
        emit('submit', { status: 'in_progress' });
        return;
    }

    const parsed = completedAt.value ? new Date(completedAt.value) : null;
    emit('submit', {
        status: 'completed',
        completedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
    });
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
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procedure</p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{ order?.procedureName || order?.procedureType || 'Theatre procedure' }}
                    </p>
                </div>

                <template v-if="intent === 'complete'">
                    <div class="grid gap-2">
                        <Label for="theatre-status-completed-at">Completed at</Label>
                        <Input id="theatre-status-completed-at" v-model="completedAt" type="datetime-local" />
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
