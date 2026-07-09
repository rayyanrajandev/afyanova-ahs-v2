<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePatientStatusChange } from '@/composables/patientsIndex/usePatientStatusChange';
import { type PatientListItem } from '@/composables/patientsIndex/usePatientList';

/** Phase 4 — row-level "Change status" action, backed by PATCH /patients/{id}/status. */
const props = defineProps<{
    patient: PatientListItem | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    changed: [patient: PatientListItem];
}>();

const status = ref<'active' | 'inactive'>('active');
const reason = ref('');
const statusChange = usePatientStatusChange();

watch(open, (isOpen) => {
    if (!isOpen) return;
    status.value = (props.patient?.status as 'active' | 'inactive') || 'active';
    reason.value = '';
});

const canSubmit = computed(
    () => (status.value !== 'inactive' || reason.value.trim() !== '') && !statusChange.isPending.value,
);

async function submit(): Promise<void> {
    if (!props.patient) return;
    const patient = await statusChange.mutateAsync({
        patientId: props.patient.id,
        status: status.value,
        reason: reason.value,
    });
    emit('changed', patient);
    open.value = false;
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>Change patient status</DialogTitle>
                <DialogDescription>{{ patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() : '' }}</DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="status-dialog-status">Status</Label>
                    <Select v-model="status">
                        <SelectTrigger id="status-dialog-status" class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="grid gap-2">
                    <Label for="status-dialog-reason">
                        Reason
                        <span v-if="status === 'inactive'">(required)</span>
                        <span v-else>(optional)</span>
                    </Label>
                    <Textarea id="status-dialog-reason" v-model="reason" rows="3" placeholder="Why is this patient's status changing?" />
                </div>

                <Alert v-if="statusChange.error.value" variant="destructive">
                    <AlertTitle>Unable to change status</AlertTitle>
                    <AlertDescription>{{ statusChange.error.value.message }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ statusChange.isPending.value ? 'Saving…' : 'Save' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
