<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppointmentStatusAction, type AppointmentClosureStatus } from '@/composables/appointmentsIndex/useAppointmentStatusAction';
import { type AppointmentListItem } from '@/composables/appointmentsIndex/useAppointmentList';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Phase 2 — cancel / no-show, the two closure-only transitions this
 * scheduling-only page owns (see useAppointmentStatusAction.ts's docblock
 * for why every other status transition is deliberately excluded).
 * Both require a reason server-side
 * (UpdateAppointmentStatusRequest.php:23) — enforced here too, not just
 * left to the 422 round-trip.
 *
 * `appointment` is typed to the minimal shape this dialog actually reads
 * (id + appointmentNumber for display), not the full AppointmentListItem —
 * deliberately, so triage/Queue.vue can reuse this same dialog for
 * cancelling a waiting_triage visit (WAITING_TRIAGE -> CANCELLED is a real,
 * allowed transition per AppointmentStatus::allowedForwardTransitions())
 * from a ReceptionQueueEntry, which has no compatible shape with
 * AppointmentListItem otherwise. AppointmentListItem still satisfies this
 * type structurally, so appointments/IndexV2.vue's existing usage is
 * unaffected.
 */
export type AppointmentClosureTarget = {
    id: string;
    appointmentNumber: string | null;
};

const props = defineProps<{
    appointment: AppointmentClosureTarget | null;
    status: AppointmentClosureStatus;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    closed: [appointment: AppointmentListItem];
}>();

const reason = ref('');
const submitError = ref<string | null>(null);
const action = useAppointmentStatusAction();

watch(open, (isOpen) => {
    if (!isOpen) return;
    reason.value = '';
    submitError.value = null;
});

const title = computed(() => (props.status === 'cancelled' ? 'Cancel appointment' : 'Record no-show'));
const description = computed(() =>
    props.status === 'cancelled'
        ? 'This visit will no longer be scheduled. A reason is required.'
        : 'The patient did not arrive for this scheduled visit. A reason is required.',
);
const canSubmit = computed(() => reason.value.trim() !== '' && !action.isPending.value);

async function submit(): Promise<void> {
    if (!props.appointment) return;
    submitError.value = null;

    try {
        const appointment = await action.mutateAsync({
            appointmentId: props.appointment.id,
            status: props.status,
            reason: reason.value.trim(),
        });
        emit('closed', appointment);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { message?: string } };
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this appointment.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription>
                    {{ appointment?.appointmentNumber || '' }} — {{ description }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="appointment-closure-reason">Reason</Label>
                    <Textarea id="appointment-closure-reason" v-model="reason" rows="3" maxlength="255" />
                </div>

                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to update this appointment</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Close</Button>
                <Button variant="destructive" :disabled="!canSubmit" @click="submit">
                    {{ action.isPending.value ? 'Saving…' : title }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
