<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    useUpdateEmergencyTransferStatus,
    type EmergencyTransferStatusTarget,
} from '@/composables/emergency/useUpdateEmergencyTransferStatus';
import { messageFromUnknown } from '@/lib/notify';

/**
 * P0b — used ONLY for cancelled/rejected, the two transfer-status actions
 * that need a mandatory reason. accepted/in_transit/completed fire as
 * one-click chip actions directly in EmergencyCaseTransfersPanel.vue with no
 * dialog, since there's nothing meaningful to enter for a low-risk forward
 * transition — see the audit plan's design-direction note. Same shape as
 * EmergencyStatusDialog.vue.
 */
export type EmergencyTransferStatusTargetRequest = {
    caseId: string;
    transferId: string;
    transferNumber: string | null;
};

const props = defineProps<{
    target: EmergencyTransferStatusTargetRequest | null;
    action: EmergencyTransferStatusTarget | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [];
}>();

const reason = ref('');
const clinicalHandoffNotes = ref('');
const submitError = ref<string | null>(null);
const update = useUpdateEmergencyTransferStatus();

watch(open, (isOpen) => {
    if (!isOpen) return;
    reason.value = '';
    clinicalHandoffNotes.value = '';
    submitError.value = null;
});

const meta = computed(() => {
    switch (props.action) {
        case 'cancelled':
            return { title: 'Cancel transfer', description: 'Remove this transfer request with a documented reason.' };
        case 'rejected':
            return { title: 'Reject transfer', description: 'Decline this transfer request with a documented reason.' };
        default:
            return { title: 'Update transfer', description: '' };
    }
});

const canSubmit = computed(() => !update.isPending.value && reason.value.trim() !== '');

async function submit(): Promise<void> {
    if (!props.target || !props.action) return;
    submitError.value = null;

    try {
        await update.mutateAsync({
            caseId: props.target.caseId,
            transferId: props.target.transferId,
            status: props.action,
            reason: reason.value.trim(),
            clinicalHandoffNotes: clinicalHandoffNotes.value.trim() || null,
        });
        emit('updated');
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { message?: string } };
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this transfer.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>{{ meta.title }}</DialogTitle>
                <DialogDescription>
                    {{ target?.transferNumber || '' }} — {{ meta.description }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="emergency-transfer-status-reason">Reason</Label>
                    <Textarea id="emergency-transfer-status-reason" v-model="reason" rows="3" maxlength="255" />
                </div>

                <div class="grid gap-2">
                    <Label for="emergency-transfer-status-notes">Clinical handoff notes (optional)</Label>
                    <Textarea id="emergency-transfer-status-notes" v-model="clinicalHandoffNotes" rows="3" maxlength="5000" />
                </div>

                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to update this transfer</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Close</Button>
                <Button variant="destructive" :disabled="!canSubmit" @click="submit">
                    {{ update.isPending.value ? 'Saving…' : meta.title }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
