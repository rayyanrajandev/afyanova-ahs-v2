<script setup lang="ts">
import { computed, ref } from 'vue';
import { Badge } from '@/components/ui/badge';
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
import { type MedicalRecordStatus } from '@/types/medicalRecord';

const props = defineProps<{
    status: MedicalRecordStatus | string;
    canFinalize: boolean;
    canAmend: boolean;
    canArchive: boolean;
    isPending: boolean;
}>();

const emit = defineEmits<{
    finalize: [];
    amend: [reason: string];
    archive: [reason: string];
}>();

const isDraft = computed(() => props.status === 'draft');
const isFinalized = computed(() => props.status === 'finalized' || props.status === 'amended');

// Amend and archive both require a reason (backend required_if rule), so both
// route through a small reason dialog rather than firing immediately.
type ReasonAction = 'amended' | 'archived';
const reasonDialogOpen = ref(false);
const reasonAction = ref<ReasonAction | null>(null);
const reason = ref('');
const reasonError = ref<string | null>(null);

const dialogTitle = computed(() =>
    reasonAction.value === 'amended' ? 'Amend note' : 'Archive note',
);

function openReasonDialog(action: ReasonAction): void {
    reasonAction.value = action;
    reason.value = '';
    reasonError.value = null;
    reasonDialogOpen.value = true;
}

function submitReason(): void {
    const trimmed = reason.value.trim();
    if (trimmed === '') {
        reasonError.value = 'A reason is required.';
        return;
    }
    if (reasonAction.value === 'amended') {
        emit('amend', trimmed);
    } else if (reasonAction.value === 'archived') {
        emit('archive', trimmed);
    }
    reasonDialogOpen.value = false;
}
</script>

<template>
    <div class="flex flex-wrap items-center gap-2">
        <Badge variant="outline" class="capitalize">{{ status }}</Badge>

        <Button
            v-if="isDraft && canFinalize"
            size="sm"
            :disabled="isPending"
            @click="emit('finalize')"
        >
            Finalize
        </Button>

        <Button
            v-if="isFinalized && canAmend"
            variant="outline"
            size="sm"
            :disabled="isPending"
            @click="openReasonDialog('amended')"
        >
            Amend
        </Button>

        <Button
            v-if="canArchive && status !== 'archived'"
            variant="outline"
            size="sm"
            :disabled="isPending"
            @click="openReasonDialog('archived')"
        >
            Archive
        </Button>

        <Dialog :open="reasonDialogOpen" @update:open="reasonDialogOpen = $event">
            <DialogContent class="max-w-md">
                <DialogHeader>
                    <DialogTitle>{{ dialogTitle }}</DialogTitle>
                    <DialogDescription>
                        Document why you are performing this action. This is recorded
                        in the note's audit history.
                    </DialogDescription>
                </DialogHeader>

                <div class="space-y-1.5">
                    <Label for="lifecycle-reason">Reason</Label>
                    <Textarea
                        id="lifecycle-reason"
                        :model-value="reason"
                        rows="3"
                        @update:model-value="reason = String($event ?? '')"
                    />
                    <p v-if="reasonError" class="text-sm text-destructive">
                        {{ reasonError }}
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        :disabled="isPending"
                        @click="reasonDialogOpen = false"
                    >
                        Cancel
                    </Button>
                    <Button :disabled="isPending" @click="submitReason">
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>
