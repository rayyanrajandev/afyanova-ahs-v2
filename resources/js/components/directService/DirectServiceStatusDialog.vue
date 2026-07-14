<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    useUpdateDirectServiceStatus,
    type DirectServiceStatusTarget,
} from '@/composables/directService/useUpdateDirectServiceStatus';
import { messageFromUnknown } from '@/lib/notify';

/**
 * One dialog for every transition, matching EmergencyStatusDialog.vue's
 * shape — Accept (in_progress) needs no field, Close (completed)/Cancel
 * (cancelled) require statusReason server-side
 * (UpdateServiceRequestStatusRequest.php's withValidator).
 */
export type DirectServiceStatusTargetRequest = {
    requestId: string;
    requestNumber: string | null;
};

const props = defineProps<{
    target: DirectServiceStatusTargetRequest | null;
    action: DirectServiceStatusTarget | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [];
}>();

const statusReason = ref('');
const submitError = ref<string | null>(null);
const update = useUpdateDirectServiceStatus();

watch(open, (isOpen) => {
    if (!isOpen) return;
    statusReason.value = '';
    submitError.value = null;
});

const meta = computed(() => {
    switch (props.action) {
        case 'in_progress':
            return { title: 'Accept direct service ticket', description: 'Move this ticket into progress for your department.' };
        case 'completed':
            return { title: 'Close direct service ticket', description: 'Mark this ticket complete and record what was done.' };
        case 'cancelled':
            return { title: 'Cancel direct service ticket', description: 'Remove this ticket from the active queue with a documented reason.' };
        default:
            return { title: 'Update ticket', description: '' };
    }
});

const needsReason = computed(() => props.action === 'completed' || props.action === 'cancelled');

const canSubmit = computed(() => {
    if (update.isPending.value) return false;
    if (needsReason.value && statusReason.value.trim() === '') return false;
    return true;
});

async function submit(): Promise<void> {
    if (!props.target || !props.action) return;
    submitError.value = null;

    try {
        await update.mutateAsync({
            requestId: props.target.requestId,
            status: props.action,
            statusReason: needsReason.value ? statusReason.value.trim() : null,
        });
        emit('updated');
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { message?: string } };
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this ticket.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>{{ meta.title }}</DialogTitle>
                <DialogDescription>
                    {{ target?.requestNumber || '' }} — {{ meta.description }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div v-if="needsReason" class="grid gap-2">
                    <Label for="direct-service-status-reason">Reason</Label>
                    <Textarea id="direct-service-status-reason" v-model="statusReason" rows="3" maxlength="500" />
                </div>

                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to update this ticket</AlertTitle>
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
