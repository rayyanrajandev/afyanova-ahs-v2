<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useStartConsultation } from '@/composables/clinician/useStartConsultation';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Resolves a 409 CONSULTATION_OWNER_CONFLICT by calling start-consultation
 * again with forceTakeover=true. takeoverReason is required server-side
 * when forceTakeover is set (StartAppointmentConsultationRequest.php:
 * required_if:forceTakeover,true) — enforced here too. The previous owner
 * is notified server-side (AppointmentConsultationTakenOverNotification),
 * not something this dialog needs to handle.
 */
export type TakeoverTarget = {
    id: string;
    appointmentNumber: string | null;
    claimedByName: string | null;
};

const props = defineProps<{
    appointment: TakeoverTarget | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    takenOver: [];
}>();

const reason = ref('');
const submitError = ref<string | null>(null);
const startConsultation = useStartConsultation();

watch(open, (isOpen) => {
    if (!isOpen) return;
    reason.value = '';
    submitError.value = null;
});

const canSubmit = computed(() => reason.value.trim() !== '' && !startConsultation.isPending.value);

async function submit(): Promise<void> {
    if (!props.appointment) return;
    submitError.value = null;

    try {
        await startConsultation.mutateAsync({
            appointmentId: props.appointment.id,
            forceTakeover: true,
            takeoverReason: reason.value.trim(),
        });
        emit('takenOver');
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { message?: string } };
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to take over this consultation.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>Take over consultation</DialogTitle>
                <DialogDescription>
                    {{ appointment?.appointmentNumber || '' }} — Currently claimed by
                    {{ appointment?.claimedByName ?? 'another clinician' }}. They will be notified of the takeover. A reason is required.
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="takeover-reason">Reason</Label>
                    <Textarea id="takeover-reason" v-model="reason" rows="3" maxlength="255" />
                </div>

                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to take over this consultation</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Close</Button>
                <Button variant="destructive" :disabled="!canSubmit" @click="submit">
                    {{ startConsultation.isPending.value ? 'Taking over…' : 'Take over' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
