<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { firstValidationError, requiresApprovalCaseReference } from '@/composables/platformUsersIndex/platformUserValidationErrors';
import type { PlatformUser } from '@/composables/platformUsersIndex/usePlatformUserList';
import { usePlatformUserBulkStatusChange, usePlatformUserStatusChange } from '@/composables/platformUsersIndex/usePlatformUserStatusMutations';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Activate/deactivate — used for both the row action (targetUserIds.length === 1)
 * and the bulk toolbar action (targetUserIds.length > 1), matching legacy
 * Index.vue's two near-duplicate dialogs but as one component.
 */
const props = defineProps<{
    targetUserIds: number[];
    targetStatus: 'active' | 'inactive';
    targetLabel: string;
    initialReason?: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    changed: [users: PlatformUser[]];
}>();

const reason = ref('');
const approvalCaseReference = ref('');
const error = ref<string | null>(null);

const single = usePlatformUserStatusChange();
const bulk = usePlatformUserBulkStatusChange();
const isPending = computed(() => single.isPending.value || bulk.isPending.value);

watch(open, (isOpen) => {
    if (!isOpen) return;
    reason.value = props.targetStatus === 'inactive' ? (props.initialReason ?? '') : '';
    approvalCaseReference.value = '';
    error.value = null;
});

const title = computed(() => (props.targetStatus === 'inactive' ? 'Deactivate' : 'Activate'));
const description = computed(() =>
    props.targetStatus === 'inactive'
        ? 'Deactivation reason is required for audit traceability.'
        : `Confirm re-activation for ${props.targetLabel}.`,
);
const canSubmit = computed(
    () => (props.targetStatus !== 'inactive' || reason.value.trim() !== '') && !isPending.value,
);

async function submit(): Promise<void> {
    if (props.targetUserIds.length === 0) return;
    error.value = null;

    try {
        if (props.targetUserIds.length === 1) {
            const user = await single.mutateAsync({
                userId: props.targetUserIds[0],
                status: props.targetStatus,
                reason: reason.value,
                approvalCaseReference: approvalCaseReference.value,
            });
            emit('changed', [user]);
        } else {
            const result = await bulk.mutateAsync({
                userIds: props.targetUserIds,
                status: props.targetStatus,
                reason: reason.value,
                approvalCaseReference: approvalCaseReference.value,
            });
            emit('changed', result.users ?? []);
        }
        open.value = false;
    } catch (submitError) {
        if (requiresApprovalCaseReference(submitError)) {
            error.value = 'This change affects a privileged account and requires an approval case reference.';
            return;
        }
        error.value =
            firstValidationError(submitError, ['reason', 'status']) ?? messageFromUnknown(submitError, 'Unable to update status.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>{{ title }} {{ targetUserIds.length > 1 ? `${targetUserIds.length} users` : targetLabel }}</DialogTitle>
                <DialogDescription>{{ description }}</DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="platform-user-status-reason">
                        Reason
                        <span v-if="targetStatus === 'inactive'">(required)</span>
                        <span v-else>(optional)</span>
                    </Label>
                    <Textarea id="platform-user-status-reason" v-model="reason" rows="3" placeholder="Why is this status changing?" />
                </div>
                <div class="grid gap-2">
                    <Label for="platform-user-status-approval-case">Approval case reference (if required)</Label>
                    <Input id="platform-user-status-approval-case" v-model="approvalCaseReference" placeholder="e.g. APR-1029" />
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertTitle>Unable to change status</AlertTitle>
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">{{ isPending ? 'Saving…' : 'Save' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
