<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import WardBedPicker from '@/components/admissions/WardBedPicker.vue';
import { useUpdateEmergencyCaseStatus, type EmergencyCaseStatusTarget } from '@/composables/emergency/useUpdateEmergencyCaseStatus';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Extracted from the legacy emergency-triage/Index.vue's statusDialogMeta
 * (Index.vue:1533-1593) and its single status dialog (Index.vue:2577-2618,
 * 4665+) — one dialog for every transition, not five separate ones, with
 * reason/dispositionNotes shown conditionally by target status. Copy is
 * verbatim from the legacy dialog, not rewritten.
 *
 * dispositionNotes required server-side for admitted/discharged, reason
 * required for cancelled (UpdateEmergencyTriageCaseStatusRequest.php) —
 * enforced here too, not left to the 422 round-trip.
 */
export type EmergencyStatusTarget = {
    caseId: string;
    caseNumber: string | null;
};

const props = defineProps<{
    target: EmergencyStatusTarget | null;
    action: EmergencyCaseStatusTarget | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [];
}>();

const reason = ref('');
const dispositionNotes = ref('');
const bedResourceId = ref('');
const submitError = ref<string | null>(null);
const update = useUpdateEmergencyCaseStatus();

watch(open, (isOpen) => {
    if (!isOpen) return;
    reason.value = '';
    dispositionNotes.value = '';
    bedResourceId.value = '';
    submitError.value = null;
});

const meta = computed(() => {
    switch (props.action) {
        case 'triaged':
            return {
                title: 'Mark triage complete',
                description: 'Record the initial acuity handoff and move this case into the triaged emergency queue.',
            };
        case 'in_treatment':
            return {
                title: 'Start treatment',
                description: 'Move this case into active emergency treatment so definitive care can begin.',
            };
        case 'admitted':
            return {
                title: 'Admit from emergency',
                description: 'Document the admission handoff and move the case out of the emergency treatment queue.',
            };
        case 'discharged':
            return {
                title: 'Discharge from emergency',
                description: 'Close the emergency episode with a discharge handoff and summary note.',
            };
        case 'cancelled':
            return {
                title: 'Cancel emergency case',
                description: 'Remove this case from the active emergency workflow with a documented cancellation reason.',
            };
        default:
            return { title: 'Update case', description: '' };
    }
});

const needsReason = computed(() => props.action === 'cancelled');
const needsDispositionNotes = computed(() => props.action === 'admitted' || props.action === 'discharged');
const needsBedSelection = computed(() => props.action === 'admitted');

const canSubmit = computed(() => {
    if (update.isPending.value) return false;
    if (needsReason.value && reason.value.trim() === '') return false;
    if (needsDispositionNotes.value && dispositionNotes.value.trim() === '') return false;
    if (needsBedSelection.value && bedResourceId.value.trim() === '') return false;
    return true;
});

async function submit(): Promise<void> {
    if (!props.target || !props.action) return;
    submitError.value = null;

    try {
        await update.mutateAsync({
            caseId: props.target.caseId,
            status: props.action,
            reason: needsReason.value ? reason.value.trim() : null,
            dispositionNotes: needsDispositionNotes.value ? dispositionNotes.value.trim() : null,
            bedResourceId: needsBedSelection.value ? bedResourceId.value : null,
        });
        emit('updated');
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { message?: string } };
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this case.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>{{ meta.title }}</DialogTitle>
                <DialogDescription>
                    {{ target?.caseNumber || '' }} — {{ meta.description }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <WardBedPicker
                    v-if="needsBedSelection"
                    v-model="bedResourceId"
                    id-prefix="emergency-status"
                    ward-label="Ward"
                    bed-label="Bed"
                />

                <div v-if="needsDispositionNotes" class="grid gap-2">
                    <Label for="emergency-status-disposition-notes">Disposition notes</Label>
                    <Textarea id="emergency-status-disposition-notes" v-model="dispositionNotes" rows="4" maxlength="5000" />
                </div>

                <div v-if="needsReason" class="grid gap-2">
                    <Label for="emergency-status-reason">Reason</Label>
                    <Textarea id="emergency-status-reason" v-model="reason" rows="3" maxlength="255" />
                </div>

                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to update this case</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Close</Button>
                <Button :variant="action === 'cancelled' ? 'destructive' : 'default'" :disabled="!canSubmit" @click="submit">
                    {{ update.isPending.value ? 'Saving…' : meta.title }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
