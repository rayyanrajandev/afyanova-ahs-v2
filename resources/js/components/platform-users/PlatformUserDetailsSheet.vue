<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PlatformRoleAssignmentPicker from '@/components/platform/PlatformRoleAssignmentPicker.vue';
import PlatformUserAuditLogPanel from '@/components/platform-users/PlatformUserAuditLogPanel.vue';
import PlatformUserFacilityAssignmentEditor, { type AccessibleFacility } from '@/components/platform-users/PlatformUserFacilityAssignmentEditor.vue';
import { firstValidationError, requiresApprovalCaseReference } from '@/composables/platformUsersIndex/platformUserValidationErrors';
import {
    ensureSinglePrimaryFacilityDraft,
    toFacilityDrafts,
    usePlatformUserFacilitiesSync,
    type FacilityAssignmentDraft,
} from '@/composables/platformUsersIndex/usePlatformUserFacilitiesMutations';
import { usePlatformUserRolesSync } from '@/composables/platformUsersIndex/usePlatformUserRolesMutations';
import { usePlatformUserCredentialLink } from '@/composables/platformUsersIndex/usePlatformUserCredentialLinkMutations';
import { usePlatformUserDetails } from '@/composables/platformUsersIndex/usePlatformUserDetails';
import type { PlatformRole } from '@/composables/platformUsersIndex/usePlatformUserList';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

const props = defineProps<{
    userId: number | null;
    roles: PlatformRole[];
    roleAssignmentPolicy: 'full' | 'hospital_operational';
    availableFacilities: AccessibleFacility[];
    canManageRoles: boolean;
    canManageFacilities: boolean;
    canViewAudit: boolean;
    canResetPassword: boolean;
    canCreateLinkedStaffProfile: boolean;
    mailDeliversExternally: boolean;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    createStaffProfile: [];
}>();

const tab = ref('overview');
const userIdRef = computed(() => props.userId);
const details = usePlatformUserDetails(userIdRef);
const user = computed(() => details.data.value ?? null);
const queryClient = useQueryClient();

watch(open, (isOpen) => {
    if (isOpen) tab.value = 'overview';
});

function applyUpdate(updated: typeof user.value): void {
    if (props.userId === null || !updated) return;
    queryClient.setQueryData(['platform-users-details', props.userId], updated);
    void queryClient.invalidateQueries({ queryKey: ['platform-users-index'] });
}

// --- Access: roles ---
const roleDraftIds = ref<string[]>([]);
const rolesApprovalCaseReference = ref('');
const rolesError = ref<string | null>(null);
const rolesSync = usePlatformUserRolesSync();

watch(user, (value) => {
    if (!value) return;
    roleDraftIds.value = Array.from(new Set((value.roleIds ?? []).filter(Boolean)));
    rolesApprovalCaseReference.value = '';
    rolesError.value = null;
});

async function saveRoles(): Promise<void> {
    if (props.userId === null) return;
    rolesError.value = null;
    try {
        const result = await rolesSync.mutateAsync({
            userId: props.userId,
            roleIds: roleDraftIds.value,
            approvalCaseReference: rolesApprovalCaseReference.value,
        });
        if (user.value) {
            applyUpdate({ ...user.value, roleIds: result.roleIds, roles: result.roles });
        }
        notifySuccess('Role assignments updated.');
    } catch (error) {
        rolesError.value = requiresApprovalCaseReference(error)
            ? 'This account is privileged — role changes require an approval case reference.'
            : (firstValidationError(error, ['roleIds']) ?? messageFromUnknown(error, 'Unable to save roles.'));
    }
}

// --- Access: facilities ---
const facilityDrafts = ref<FacilityAssignmentDraft[]>([]);
const facilitiesApprovalCaseReference = ref('');
const facilitiesError = ref<string | null>(null);
const facilitiesSync = usePlatformUserFacilitiesSync();

watch(user, (value) => {
    if (!value) return;
    facilityDrafts.value = ensureSinglePrimaryFacilityDraft(toFacilityDrafts(value.facilityAssignments));
    facilitiesApprovalCaseReference.value = '';
    facilitiesError.value = null;
});

async function saveFacilities(): Promise<void> {
    if (props.userId === null) return;
    facilitiesError.value = null;
    facilityDrafts.value = ensureSinglePrimaryFacilityDraft(facilityDrafts.value);
    try {
        const updated = await facilitiesSync.mutateAsync({
            userId: props.userId,
            facilityAssignments: facilityDrafts.value,
            approvalCaseReference: facilitiesApprovalCaseReference.value,
        });
        applyUpdate(updated);
        facilityDrafts.value = ensureSinglePrimaryFacilityDraft(toFacilityDrafts(updated.facilityAssignments));
        notifySuccess('Facility assignments updated.');
    } catch (error) {
        facilitiesError.value = requiresApprovalCaseReference(error)
            ? 'This account is privileged — facility changes require an approval case reference.'
            : (firstValidationError(error, ['facilityAssignments']) ?? messageFromUnknown(error, 'Unable to save facilities.'));
    }
}

// --- Overview: credential link ---
const credentialLink = usePlatformUserCredentialLink();
const isInviteAction = computed(() => !user.value?.emailVerifiedAt);

async function sendCredentialLink(): Promise<void> {
    if (props.userId === null) return;
    try {
        const result = await credentialLink.mutateAsync({ userId: props.userId, isInvite: isInviteAction.value });
        const label = isInviteAction.value ? 'Invite' : 'Password reset';
        notifySuccess(
            props.mailDeliversExternally
                ? `${label} link sent for ${user.value?.email ?? `User #${props.userId}`}.`
                : `${label} link generated for ${user.value?.email ?? `User #${props.userId}`}, but email delivery is currently set to log only.`,
        );
    } catch (error) {
        notifyError(messageFromUnknown(error, `Unable to send ${isInviteAction.value ? 'invitation' : 'reset'} link.`));
    }
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>{{ user?.name || 'User details' }}</SheetTitle>
                <SheetDescription>{{ user?.email }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <Skeleton v-if="details.isPending.value" class="h-64 w-full" />

                <Alert v-else-if="details.isError.value" variant="destructive">
                    <AlertTitle>Unable to load user</AlertTitle>
                    <AlertDescription>{{ details.error.value?.message }}</AlertDescription>
                </Alert>

                <Tabs v-else v-model="tab">
                    <TabsList class="grid grid-cols-3">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="access">Access</TabsTrigger>
                        <TabsTrigger v-if="canViewAudit" value="audit">Audit</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" class="space-y-4 pt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle class="flex items-center gap-2 text-base">
                                    Account profile
                                    <Badge :variant="statusVariant(user?.status ?? null)">{{ user?.status ?? 'unknown' }}</Badge>
                                </CardTitle>
                                <CardDescription>{{ user?.name }} — {{ user?.email }}</CardDescription>
                            </CardHeader>
                            <CardContent class="space-y-2 text-sm">
                                <Alert v-if="user?.requiresApprovalCaseForSensitiveChanges">
                                    <AlertTitle class="flex items-center gap-1.5">
                                        <AppIcon name="alert-triangle" class="size-3.5" />Privileged account
                                    </AlertTitle>
                                    <AlertDescription>Sensitive changes to this account require an approval case reference.</AlertDescription>
                                </Alert>
                                <p v-if="user?.statusReason"><span class="font-medium">Status reason:</span> {{ user.statusReason }}</p>
                                <p>
                                    <span class="font-medium">Roles:</span>
                                    {{ (user?.roles ?? []).map((role) => role.name || role.code).filter(Boolean).join(', ') || 'No roles assigned' }}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle class="text-base">Credential delivery</CardTitle>
                                <CardDescription>
                                    {{ user?.emailVerifiedAt ? `Verified ${formatDateTime(user.emailVerifiedAt)}` : 'Email not yet verified.' }}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button v-if="canResetPassword" size="sm" :disabled="credentialLink.isPending.value" @click="sendCredentialLink">
                                    {{ isInviteAction ? 'Send invite link' : 'Send password reset' }}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle class="text-base">Account timeline</CardTitle>
                            </CardHeader>
                            <CardContent class="space-y-1 text-sm text-muted-foreground">
                                <p>Created: {{ formatDateTime(user?.createdAt) }}</p>
                                <p>Updated: {{ formatDateTime(user?.updatedAt) }}</p>
                                <p>User ID: {{ user?.id }}</p>
                                <Button v-if="canCreateLinkedStaffProfile" variant="outline" size="sm" class="mt-2" @click="emit('createStaffProfile')">
                                    Create staff profile
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="access" class="space-y-6 pt-4">
                        <section class="space-y-3">
                            <h3 class="text-sm font-semibold">Roles</h3>
                            <PlatformRoleAssignmentPicker
                                v-model="roleDraftIds"
                                :roles="roles"
                                :policy="roleAssignmentPolicy"
                                :disabled="!canManageRoles"
                                id-prefix="details-roles"
                            />
                            <div v-if="canManageRoles" class="space-y-2">
                                <Label for="details-roles-approval-case">Approval case reference (if required)</Label>
                                <Input id="details-roles-approval-case" v-model="rolesApprovalCaseReference" placeholder="e.g. APR-1029" />
                                <Alert v-if="rolesError" variant="destructive"><AlertDescription>{{ rolesError }}</AlertDescription></Alert>
                                <Button size="sm" :disabled="rolesSync.isPending.value" @click="saveRoles">
                                    {{ rolesSync.isPending.value ? 'Saving…' : 'Save roles' }}
                                </Button>
                            </div>
                        </section>

                        <section class="space-y-3">
                            <h3 class="text-sm font-semibold">Facility assignments</h3>
                            <PlatformUserFacilityAssignmentEditor
                                v-model="facilityDrafts"
                                :available-facilities="availableFacilities"
                                :disabled="!canManageFacilities"
                            />
                            <div v-if="canManageFacilities" class="space-y-2">
                                <Label for="details-facilities-approval-case">Approval case reference (if required)</Label>
                                <Input id="details-facilities-approval-case" v-model="facilitiesApprovalCaseReference" placeholder="e.g. APR-1029" />
                                <Alert v-if="facilitiesError" variant="destructive"><AlertDescription>{{ facilitiesError }}</AlertDescription></Alert>
                                <Button size="sm" :disabled="facilitiesSync.isPending.value" @click="saveFacilities">
                                    {{ facilitiesSync.isPending.value ? 'Saving…' : 'Save facilities' }}
                                </Button>
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent v-if="canViewAudit" value="audit" class="pt-4">
                        <PlatformUserAuditLogPanel :user-id="userId" />
                    </TabsContent>
                </Tabs>
            </div>
        </SheetContent>
    </Sheet>
</template>
