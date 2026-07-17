<script setup lang="ts">
import { ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { firstValidationError, requiresApprovalCaseReference } from '@/composables/platformUsersIndex/platformUserValidationErrors';
import { usePlatformUserEdit, usePlatformUserEditForm } from '@/composables/platformUsersIndex/usePlatformUserCrudMutations';
import type { PlatformUser } from '@/composables/platformUsersIndex/usePlatformUserList';
import { apiGet } from '@/lib/apiClient';
import { messageFromUnknown } from '@/lib/notify';

/** Row-level "Edit user" action, backed by PATCH /platform/admin/users/{id}. */
const props = defineProps<{
    user: PlatformUser | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [user: PlatformUser];
}>();

const form = usePlatformUserEditForm();
const edit = usePlatformUserEdit();
const requiresApprovalCase = ref(false);
const error = ref<string | null>(null);

watch(open, async (isOpen) => {
    if (!isOpen || !props.user) return;

    form.id = props.user.id;
    form.name = (props.user.name ?? '').trim();
    form.email = (props.user.email ?? '').trim();
    form.approvalCaseReference = '';
    requiresApprovalCase.value = Boolean(props.user.requiresApprovalCaseForSensitiveChanges);
    error.value = null;

    // The list endpoint may omit requiresApprovalCaseForSensitiveChanges — refresh
    // silently from the authoritative record so the field shows correctly upfront.
    if (!props.user.requiresApprovalCaseForSensitiveChanges && props.user.id !== null) {
        const userId = props.user.id;
        try {
            const response = await apiGet<{ data: PlatformUser }>(`/platform/admin/users/${userId}`);
            if (form.id === userId) {
                requiresApprovalCase.value = Boolean(response.data.requiresApprovalCaseForSensitiveChanges);
            }
        } catch {
            // Non-fatal — the approval-case field will still reveal itself on a 422.
        }
    }
});

async function submit(): Promise<void> {
    error.value = null;
    try {
        const user = await edit.mutateAsync(form);
        emit('updated', user);
        open.value = false;
    } catch (submitError) {
        if (requiresApprovalCaseReference(submitError)) {
            requiresApprovalCase.value = true;
            return;
        }
        error.value = firstValidationError(submitError, ['name', 'email']) ?? messageFromUnknown(submitError, 'Unable to update user profile.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="md">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Edit user</SheetTitle>
                <SheetDescription>{{ user?.email }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="space-y-1.5">
                    <Label for="platform-user-edit-name">Name</Label>
                    <Input id="platform-user-edit-name" v-model="form.name" />
                </div>
                <div class="space-y-1.5">
                    <Label for="platform-user-edit-email">Email</Label>
                    <Input id="platform-user-edit-email" v-model="form.email" type="email" />
                </div>
                <div v-if="requiresApprovalCase" class="space-y-1.5">
                    <Label for="platform-user-edit-approval-case">Approval case reference</Label>
                    <Input id="platform-user-edit-approval-case" v-model="form.approvalCaseReference" placeholder="e.g. APR-1029" />
                    <p class="text-xs text-muted-foreground">This account is privileged — profile changes require an approval case reference.</p>
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertTitle>Unable to save changes</AlertTitle>
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="edit.isPending.value" @click="submit">{{ edit.isPending.value ? 'Saving…' : 'Save changes' }}</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
