<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PlatformUserFacilityAssignmentEditor, { type AccessibleFacility } from '@/components/platform-users/PlatformUserFacilityAssignmentEditor.vue';
import { firstValidationError, requiresApprovalCaseReference } from '@/composables/platformUsersIndex/platformUserValidationErrors';
import {
    ensureSinglePrimaryFacilityDraft,
    usePlatformUserBulkFacilitiesSync,
    usePlatformUserFacilitiesSync,
    type FacilityAssignmentDraft,
} from '@/composables/platformUsersIndex/usePlatformUserFacilitiesMutations';
import type { PlatformUser } from '@/composables/platformUsersIndex/usePlatformUserList';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Facility assignment — used for both the details sheet's Access tab
 * (targetUserIds.length === 1) and the bulk toolbar action
 * (targetUserIds.length > 1), sharing PlatformUserFacilityAssignmentEditor
 * instead of legacy Index.vue's two duplicated draft editors.
 */
const props = defineProps<{
    targetUserIds: number[];
    targetLabel: string;
    initialAssignments: FacilityAssignmentDraft[];
    availableFacilities: AccessibleFacility[];
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    changed: [users: PlatformUser[]];
}>();

const drafts = ref<FacilityAssignmentDraft[]>([]);
const approvalCaseReference = ref('');
const error = ref<string | null>(null);

const single = usePlatformUserFacilitiesSync();
const bulk = usePlatformUserBulkFacilitiesSync();
const isPending = computed(() => single.isPending.value || bulk.isPending.value);

watch(open, (isOpen) => {
    if (!isOpen) return;
    drafts.value = ensureSinglePrimaryFacilityDraft([...props.initialAssignments]);
    approvalCaseReference.value = '';
    error.value = null;
});

async function submit(): Promise<void> {
    if (props.targetUserIds.length === 0) return;
    error.value = null;
    drafts.value = ensureSinglePrimaryFacilityDraft(drafts.value);

    try {
        if (props.targetUserIds.length === 1) {
            const user = await single.mutateAsync({
                userId: props.targetUserIds[0],
                facilityAssignments: drafts.value,
                approvalCaseReference: approvalCaseReference.value,
            });
            emit('changed', [user]);
        } else {
            const result = await bulk.mutateAsync({
                userIds: props.targetUserIds,
                facilityAssignments: drafts.value,
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
            firstValidationError(submitError, ['facilityAssignments']) ?? messageFromUnknown(submitError, 'Unable to save facility assignments.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="lg">
            <DialogHeader>
                <DialogTitle>Assign facilities — {{ targetUserIds.length > 1 ? `${targetUserIds.length} users` : targetLabel }}</DialogTitle>
                <DialogDescription>Set which facilities this account can access, and mark one as primary.</DialogDescription>
            </DialogHeader>

            <div class="max-h-[60vh] space-y-4 overflow-y-auto py-2">
                <PlatformUserFacilityAssignmentEditor v-model="drafts" :available-facilities="availableFacilities" />

                <div class="grid gap-2">
                    <Label for="platform-user-facilities-approval-case">Approval case reference (if required)</Label>
                    <Input id="platform-user-facilities-approval-case" v-model="approvalCaseReference" placeholder="e.g. APR-1029" />
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertTitle>Unable to save facilities</AlertTitle>
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="isPending" @click="submit">{{ isPending ? 'Saving…' : 'Save facilities' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
