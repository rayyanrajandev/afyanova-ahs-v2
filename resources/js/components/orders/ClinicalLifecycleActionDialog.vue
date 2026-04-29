<script setup lang="ts">
import { computed } from 'vue';
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

type LifecycleAction = 'cancel' | 'discontinue' | 'entered_in_error' | null;

const props = withDefaults(
    defineProps<{
        open: boolean;
        action: LifecycleAction;
        orderLabel: string;
        subjectLabel?: string;
        reason: string;
        loading?: boolean;
        error?: string | null;
    }>(),
    {
        action: null,
        subjectLabel: 'order',
        loading: false,
        error: null,
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    'update:reason': [value: string];
    submit: [];
}>();

const config = computed(() => {
    switch (props.action) {
        case 'cancel':
            return {
                title: `Cancel ${props.subjectLabel}`,
                description: `Cancel ${props.orderLabel} and remove it from active clinical work. A reason is required for audit and downstream teams.`,
                buttonLabel: 'Cancel order',
                buttonVariant: 'destructive' as const,
            };
        case 'discontinue':
            return {
                title: `Discontinue ${props.subjectLabel}`,
                description: `Discontinue ${props.orderLabel} while keeping the record intact. Use this when the order should stop but must remain part of the chart history.`,
                buttonLabel: 'Discontinue order',
                buttonVariant: 'destructive' as const,
            };
        case 'entered_in_error':
            return {
                title: `Mark ${props.subjectLabel} entered in error`,
                description: `Use this only when ${props.orderLabel} was created in error and should be removed from active care views while remaining audit-visible.`,
                buttonLabel: 'Mark entered in error',
                buttonVariant: 'destructive' as const,
            };
        default:
            return {
                title: 'Clinical lifecycle action',
                description: 'Provide a reason for this lifecycle change.',
                buttonLabel: 'Save',
                buttonVariant: 'default' as const,
            };
    }
});
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
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Target
                    </p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{ orderLabel }}
                    </p>
                </div>

                <div class="grid gap-2">
                    <Label for="clinical-lifecycle-reason">Clinical reason</Label>
                    <Textarea
                        id="clinical-lifecycle-reason"
                        :model-value="reason"
                        rows="4"
                        placeholder="Required. Explain the clinical reason for this lifecycle change."
                        @update:model-value="emit('update:reason', String($event ?? ''))"
                    />
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">
                    Close
                </Button>
                <Button :variant="config.buttonVariant" :disabled="loading" @click="emit('submit')">
                    {{ loading ? 'Saving...' : config.buttonLabel }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
