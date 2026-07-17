<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PlatformUser } from '@/composables/platformUsersIndex/usePlatformUserList';

/**
 * Overflow menu only — Edit and Status are common enough to live as inline
 * row buttons instead (see IndexV2.vue's row actions cell, mirroring
 * PatientVisitActionsMenu + inline Edit/Status buttons on the Patients
 * page). "View details" isn't repeated here either, since clicking the
 * user's name already opens the details sheet.
 */
const props = defineProps<{
    user: PlatformUser;
    canResetPassword: boolean;
    canReadApprovalCases: boolean;
    canCreateLinkedStaffProfile: boolean;
}>();

const emit = defineEmits<{
    credentialLink: [];
    approvalCases: [];
    createStaffProfile: [];
}>();

const isInviteAction = computed(() => !props.user.emailVerifiedAt);
const credentialLinkLabel = computed(() => (isInviteAction.value ? 'Send invite link' : 'Send password reset'));
const canShowMenu = computed(() => props.canResetPassword || props.canReadApprovalCases || props.canCreateLinkedStaffProfile);
</script>

<template>
    <DropdownMenu v-if="canShowMenu">
        <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="size-7">
                <AppIcon name="ellipsis-vertical" class="size-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem v-if="canReadApprovalCases" class="cursor-pointer text-sm" @select="emit('approvalCases')">
                Approval cases
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="canReadApprovalCases && (canResetPassword || canCreateLinkedStaffProfile)" />
            <DropdownMenuItem v-if="canResetPassword" class="cursor-pointer text-sm" @select="emit('credentialLink')">
                {{ credentialLinkLabel }}
            </DropdownMenuItem>
            <DropdownMenuItem v-if="canCreateLinkedStaffProfile" class="cursor-pointer text-sm" @select="emit('createStaffProfile')">
                Create staff profile
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
