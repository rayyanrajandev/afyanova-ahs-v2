<script setup lang="ts">
import { computed } from 'vue';
import { useUserRole } from '@/composables/useUserRole';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS } from '@/lib/roles';

/**
 * Role switcher dropdown - allows users to switch between multiple roles
 * Only shown when user has multiple approved roles
 */

const { primaryRole } = useUserRole();

// In a full implementation, this would fetch available roles from the backend
// based on user permissions and facility assignments
const availableRoles = computed(() => {
    if (!primaryRole.value) return [];
    // Placeholder - would be fetched from props or API
    return [primaryRole.value];
});

function handleRoleChange(newRole: string) {
    // In production, this would:
    // 1. Store the selected role in session/localStorage
    // 2. Redirect to the appropriate dashboard
    // 3. Trigger a page reload or redirect via router
    const roleRoute = `/dashboard/${newRole}`;
    window.location.href = roleRoute;
}
</script>

<template>
    <div v-if="availableRoles.length > 1">
        <Select :modelValue="primaryRole || ''">
            <SelectTrigger class="w-[180px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem v-for="role in availableRoles" :key="role" :value="role">
                    {{ ROLE_LABELS[role] }}
                </SelectItem>
            </SelectContent>
        </Select>
    </div>
</template>
