<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import PlatformRoleAssignmentPicker from '@/components/platform/PlatformRoleAssignmentPicker.vue';
import { firstValidationError } from '@/composables/platformUsersIndex/platformUserValidationErrors';
import { usePlatformUserCreate, usePlatformUserCreateForm } from '@/composables/platformUsersIndex/usePlatformUserCrudMutations';
import { usePlatformUserCredentialLink } from '@/composables/platformUsersIndex/usePlatformUserCredentialLinkMutations';
import type { PlatformRole, PlatformUser } from '@/composables/platformUsersIndex/usePlatformUserList';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';

/**
 * "Create user" — POST /platform/admin/users, followed by an optional
 * invite-link dispatch (POST /platform/admin/users/{id}/invite-link) when
 * "send invite" is checked, matching legacy Index.vue's createUser().
 */
const props = defineProps<{
    roles: PlatformRole[];
    roleAssignmentPolicy: 'full' | 'hospital_operational';
    canSendInvite: boolean;
    mailDeliversExternally: boolean;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [user: PlatformUser];
}>();

const form = usePlatformUserCreateForm();
const create = usePlatformUserCreate();
const credentialLink = usePlatformUserCredentialLink();
const error = ref<string | null>(null);

const isPending = computed(() => create.isPending.value || credentialLink.isPending.value);

watch(open, (isOpen) => {
    if (!isOpen) return;
    form.name = '';
    form.email = '';
    form.roleIds = [];
    form.sendInvite = true;
    error.value = null;
});

async function submit(): Promise<void> {
    error.value = null;

    try {
        const user = await create.mutateAsync(form);

        if (props.canSendInvite && form.sendInvite && user.id !== null) {
            try {
                const link = await credentialLink.mutateAsync({ userId: user.id, isInvite: true });
                notifySuccess(
                    props.mailDeliversExternally
                        ? `User ${user.email ?? form.email} created and invite link sent.`
                        : link.previewUrl
                          ? `User ${user.email ?? form.email} created and invite link generated for local preview.`
                          : `User ${user.email ?? form.email} created and invite link generated, but email delivery is not external.`,
                );
            } catch {
                notifySuccess(`User ${user.email ?? form.email} created. Invite dispatch failed; retry from the row actions menu.`);
            }
        } else {
            notifySuccess(`User ${user.email ?? form.email} created successfully.`);
        }

        emit('created', user);
        open.value = false;
    } catch (submitError) {
        error.value = firstValidationError(submitError, ['name', 'email', 'roleIds']) ?? messageFromUnknown(submitError, 'Unable to create user.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="lg">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Create user</SheetTitle>
                <SheetDescription>Add a new account and assign its initial roles.</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="space-y-1.5">
                    <Label for="platform-user-create-name">Name</Label>
                    <Input id="platform-user-create-name" v-model="form.name" />
                </div>
                <div class="space-y-1.5">
                    <Label for="platform-user-create-email">Email</Label>
                    <Input id="platform-user-create-email" v-model="form.email" type="email" />
                </div>

                <PlatformRoleAssignmentPicker v-model="form.roleIds" :roles="roles" :policy="roleAssignmentPolicy" id-prefix="create-user" />

                <label v-if="canSendInvite" class="flex items-center gap-2 text-sm">
                    <Checkbox :model-value="form.sendInvite" @update:model-value="(value) => (form.sendInvite = value === true)" />
                    Send invite link now
                </label>

                <Alert v-if="error" variant="destructive">
                    <AlertTitle>Unable to create user</AlertTitle>
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="isPending || !form.name.trim() || !form.email.trim()" @click="submit">
                    {{ isPending ? 'Creating…' : 'Create user' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
