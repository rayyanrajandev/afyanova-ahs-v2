<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProviderWorkflow } from '@/composables/clinician/useProviderWorkflow';
import { messageFromUnknown } from '@/lib/notify';

/**
 * in_consultation -> waiting_triage, the "send all the way back" provider
 * workflow action (vs. "hold" which returns to waiting_provider). Reason is
 * required server-side (UpdateAppointmentProviderWorkflowRequest.php:
 * required_if:status,waiting_triage) — enforced here too, not just left to
 * the 422 round-trip, matching AppointmentClosureDialog.vue's convention.
 */
export type SendToTriageTarget = {
    id: string;
    appointmentNumber: string | null;
};

const props = defineProps<{
    appointment: SendToTriageTarget | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    sent: [];
}>();

const reason = ref('');
const submitError = ref<string | null>(null);
const workflow = useProviderWorkflow();

watch(open, (isOpen) => {
    if (!isOpen) return;
    reason.value = '';
    submitError.value = null;
});

const canSubmit = computed(() => reason.value.trim() !== '' && !workflow.isPending.value);

async function submit(): Promise<void> {
    if (!props.appointment) return;
    submitError.value = null;

    try {
        await workflow.mutateAsync({
            appointmentId: props.appointment.id,
            status: 'waiting_triage',
            reason: reason.value.trim(),
        });
        emit('sent');
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { message?: string } };
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to send this visit back to triage.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>Send back to triage</DialogTitle>
                <DialogDescription>
                    {{ appointment?.appointmentNumber || '' }} — This visit will leave the consultation queue entirely and return to the
                    nurse triage queue. A reason is required.
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="send-to-triage-reason">Reason</Label>
                    <Textarea id="send-to-triage-reason" v-model="reason" rows="3" maxlength="255" />
                </div>

                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to send this visit back to triage</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Close</Button>
                <Button variant="destructive" :disabled="!canSubmit" @click="submit">
                    {{ workflow.isPending.value ? 'Sending…' : 'Send to triage' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
