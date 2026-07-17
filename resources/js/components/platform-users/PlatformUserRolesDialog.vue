<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PlatformRoleAssignmentPicker from '@/components/platform/PlatformRoleAssignmentPicker.vue';
import { firstValidationError, requiresApprovalCaseReference } from '@/composables/platformUsersIndex/platformUserValidationErrors';
import type { PlatformRole } from '@/composables/platformUsersIndex/usePlatformUserList';
import { usePlatformUserBulkRolesSync, usePlatformUserRolesSync } from '@/composables/platformUsersIndex/usePlatformUserRolesMutations';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Role assignment — used for both the details sheet's Access tab
 * (targetUserIds.length === 1) and the bulk toolbar action
 * (targetUserIds.length > 1), matching legacy Index.vue's two usages of
 * PlatformRoleAssignmentPicker but as one dialog component.
 */
const props = defineProps<{
    targetUserIds: number[];
    targetLabel: string;
    initialRoleIds: string[];
    roles: PlatformRole[];
    roleAssignmentPolicy: 'full' | 'hospital_operational';
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    changed: [payload: { userId: number | null; roleIds: string[]; roles: PlatformRole[] }[]];
}>();

const draftRoleIds = ref<string[]>([]);
const approvalCaseReference = ref('');
const error = ref<string | null>(null);

const single = usePlatformUserRolesSync();
const bulk = usePlatformUserBulkRolesSync();
const isPending = computed(() => single.isPending.value || bulk.isPending.value);

watch(open, (isOpen) => {
    if (!isOpen) return;
    draftRoleIds.value = [...props.initialRoleIds];
    approvalCaseReference.value = '';
    error.value = null;
});

async function submit(): Promise<void> {
    if (props.targetUserIds.length === 0) return;
    error.value = null;

    try {
        if (props.targetUserIds.length === 1) {
            const result = await single.mutateAsync({
                userId: props.targetUserIds[0],
                roleIds: draftRoleIds.value,
                approvalCaseReference: approvalCaseReference.value,
            });
            emit('changed', [{ userId: props.targetUserIds[0], roleIds: result.roleIds, roles: result.roles }]);
        } else {
            const result = await bulk.mutateAsync({
                userIds: props.targetUserIds,
                roleIds: draftRoleIds.value,
                approvalCaseReference: approvalCaseReference.value,
            });
            emit('changed', result.updates ?? []);
        }
        open.value = false;
    } catch (submitError) {
        if (requiresApprovalCaseReference(submitError)) {
            error.value = 'This change affects a privileged account and requires an approval case reference.';
            return;
        }
        error.value = firstValidationError(submitError, ['roleIds']) ?? messageFromUnknown(submitError, 'Unable to save roles.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="lg">
            <DialogHeader>
                <DialogTitle>Assign roles — {{ targetUserIds.length > 1 ? `${targetUserIds.length} users` : targetLabel }}</DialogTitle>
                <DialogDescription>Choose which roles apply. Shared roles are preselected when editing multiple users.</DialogDescription>
            </DialogHeader>

            <div class="max-h-[60vh] space-y-4 overflow-y-auto py-2">
                <PlatformRoleAssignmentPicker v-model="draftRoleIds" :roles="roles" :policy="roleAssignmentPolicy" id-prefix="roles-dialog" />

                <div class="grid gap-2">
                    <Label for="platform-user-roles-approval-case">Approval case reference (if required)</Label>
                    <Input id="platform-user-roles-approval-case" v-model="approvalCaseReference" placeholder="e.g. APR-1029" />
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertTitle>Unable to save roles</AlertTitle>
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="isPending" @click="submit">{{ isPending ? 'Saving…' : 'Save roles' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
