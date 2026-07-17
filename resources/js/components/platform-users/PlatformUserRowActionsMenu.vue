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

const props = defineProps<{
    user: PlatformUser;
    canUpdate: boolean;
    canUpdateStatus: boolean;
    canResetPassword: boolean;
    canReadApprovalCases: boolean;
    canCreateLinkedStaffProfile: boolean;
}>();

const emit = defineEmits<{
    viewDetails: [];
    edit: [];
    statusChange: [status: 'active' | 'inactive'];
    credentialLink: [];
    approvalCases: [];
    createStaffProfile: [];
}>();

const isActive = computed(() => (props.user.status ?? '').toLowerCase() === 'active');
const isInviteAction = computed(() => !props.user.emailVerifiedAt);
const credentialLinkLabel = computed(() => (isInviteAction.value ? 'Send invite link' : 'Send password reset'));
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="size-7">
                <AppIcon name="ellipsis-vertical" class="size-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem class="cursor-pointer text-sm" @select="emit('viewDetails')">View details</DropdownMenuItem>
            <DropdownMenuItem v-if="canUpdate" class="cursor-pointer text-sm" @select="emit('edit')">Edit user</DropdownMenuItem>
            <DropdownMenuItem v-if="canReadApprovalCases" class="cursor-pointer text-sm" @select="emit('approvalCases')">
                Approval cases
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="canResetPassword || canUpdateStatus || canCreateLinkedStaffProfile" />
            <DropdownMenuItem v-if="canResetPassword" class="cursor-pointer text-sm" @select="emit('credentialLink')">
                {{ credentialLinkLabel }}
            </DropdownMenuItem>
            <DropdownMenuItem v-if="canUpdateStatus && isActive" class="cursor-pointer text-sm text-destructive" @select="emit('statusChange', 'inactive')">
                Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem v-if="canUpdateStatus && !isActive" class="cursor-pointer text-sm" @select="emit('statusChange', 'active')">
                Activate
            </DropdownMenuItem>
            <DropdownMenuItem v-if="canCreateLinkedStaffProfile" class="cursor-pointer text-sm" @select="emit('createStaffProfile')">
                Create staff profile
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
