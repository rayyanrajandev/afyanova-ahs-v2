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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PharmacyOrder } from '@/composables/pharmacyOrders/usePharmacyOrders';

type ReconciliationStatus = 'pending' | 'completed' | 'exception';
type ReconciliationDecision =
    | 'add_to_current_list'
    | 'continue_on_current_list'
    | 'short_course_only'
    | 'stop_from_current_list'
    | 'review_later';

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: PharmacyOrder | null;
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
            reconciliationStatus: ReconciliationStatus;
            reconciliationDecision?: ReconciliationDecision | null;
            reconciliationNote?: string | null;
        },
    ];
}>();

const statusOptions: Array<{ value: ReconciliationStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'exception', label: 'Exception' },
];

const decisionOptions: Array<{ value: ReconciliationDecision; label: string }> = [
    { value: 'add_to_current_list', label: 'Add to current medication list' },
    { value: 'continue_on_current_list', label: 'Continue on current list' },
    { value: 'short_course_only', label: 'Short course only (not on-going list)' },
    { value: 'stop_from_current_list', label: 'Stop from current list' },
    { value: 'review_later', label: 'Review later' },
];

const reconciliationStatus = ref<ReconciliationStatus>('completed');
const reconciliationDecision = ref<ReconciliationDecision | ''>('');
const reconciliationNote = ref('');

const noteRequired = computed(() => reconciliationStatus.value === 'exception');

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        const order = props.order;
        reconciliationStatus.value = (order?.reconciliationStatus as ReconciliationStatus) || 'completed';
        reconciliationDecision.value = (order?.reconciliationDecision as ReconciliationDecision) || '';
        reconciliationNote.value = order?.reconciliationNote || '';
    },
);

function submit(): void {
    emit('submit', {
        reconciliationStatus: reconciliationStatus.value,
        reconciliationDecision: reconciliationDecision.value || null,
        reconciliationNote: reconciliationNote.value.trim() || null,
    });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="action" size="lg">
            <DialogHeader>
                <DialogTitle>Medication reconciliation</DialogTitle>
                <DialogDescription>Reconcile this dispensed order against the patient's current medication list.</DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order</p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{ order?.medicationName || order?.medicationCode || 'Pharmacy order' }}
                    </p>
                </div>

                <div class="grid gap-2">
                    <Label for="pharmacy-reconciliation-status">Reconciliation status</Label>
                    <Select v-model="reconciliationStatus">
                        <SelectTrigger id="pharmacy-reconciliation-status" class="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div class="grid gap-2">
                    <Label for="pharmacy-reconciliation-decision">Decision (optional)</Label>
                    <Select v-model="reconciliationDecision">
                        <SelectTrigger id="pharmacy-reconciliation-decision" class="h-9">
                            <SelectValue placeholder="No decision recorded" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in decisionOptions" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div class="grid gap-2">
                    <Label for="pharmacy-reconciliation-note">Note{{ noteRequired ? '' : ' (optional)' }}</Label>
                    <Textarea
                        id="pharmacy-reconciliation-note"
                        v-model="reconciliationNote"
                        rows="3"
                        :placeholder="noteRequired ? 'Required when status is exception.' : ''"
                    />
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">Close</Button>
                <Button :disabled="loading" @click="submit">{{ loading ? 'Saving...' : 'Save reconciliation' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
