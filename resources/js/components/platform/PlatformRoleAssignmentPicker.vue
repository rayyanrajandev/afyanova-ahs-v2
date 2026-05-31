<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    groupPlatformRolesForAssignment,
    isElevatedPlatformRole,
    selectedElevatedPlatformRoles,
    type PlatformRoleAssignmentOption,
    type PlatformRoleAssignmentPolicy,
} from '@/lib/platformRoleAssignment';

const props = withDefaults(
    defineProps<{
        roles: PlatformRoleAssignmentOption[];
        modelValue: string[];
        policy?: PlatformRoleAssignmentPolicy;
        disabled?: boolean;
        idPrefix?: string;
        showPolicyNotice?: boolean;
    }>(),
    {
        policy: 'full',
        disabled: false,
        idPrefix: 'role',
        showPolicyNotice: true,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string[]];
}>();

const roleGroups = computed(() => groupPlatformRolesForAssignment(props.roles));

const elevatedSelections = computed(() => selectedElevatedPlatformRoles(props.roles, props.modelValue));

function isChecked(roleId: string | null): boolean {
    return roleId !== null && props.modelValue.includes(String(roleId));
}

function toggleRole(roleId: string | null, checked: boolean | 'indeterminate') {
    if (roleId === null || props.disabled) {
        return;
    }

    const id = String(roleId);
    const next = new Set(props.modelValue.map((value) => String(value)));

    if (checked === true) {
        next.add(id);
    } else {
        next.delete(id);
    }

    emit('update:modelValue', Array.from(next));
}
</script>

<template>
    <div class="space-y-3">
        <Alert
            v-if="showPolicyNotice && policy === 'hospital_operational'"
            class="rounded-lg border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100"
        >
            <AlertTitle class="flex items-center gap-1.5 text-sm">
                <AppIcon name="shield-check" class="size-3.5" />
                Facility-scoped assignment
            </AlertTitle>
            <AlertDescription class="text-xs">
                You can assign hospital operational roles only. Platform, system, and facility-administrator roles require
                tenant or platform IAM privileges.
            </AlertDescription>
        </Alert>

        <Alert
            v-if="policy === 'full' && elevatedSelections.length > 0"
            class="rounded-lg border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
        >
            <AlertTitle class="flex items-center gap-1.5 text-sm">
                <AppIcon name="alert-triangle" class="size-3.5" />
                Elevated roles selected
            </AlertTitle>
            <AlertDescription class="space-y-1 text-xs">
                <p>
                    These roles grant platform, system, or facility-administrator capabilities. Confirm the user is authorized
                    and record an approval case when your governance workflow requires it.
                </p>
                <p class="font-medium">
                    {{
                        elevatedSelections
                            .map((role) => role.code || role.name || role.id)
                            .filter(Boolean)
                            .join(', ')
                    }}
                </p>
            </AlertDescription>
        </Alert>

        <div v-if="roles.length === 0" class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center">
            <AppIcon name="shield-check" class="size-5 text-muted-foreground/50" />
            <p class="text-sm text-muted-foreground">No assignable roles in your current scope.</p>
        </div>

        <div v-else class="space-y-4">
            <section v-for="group in roleGroups" :key="group.key" class="space-y-2">
                <div class="space-y-0.5">
                    <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{{ group.label }}</p>
                    <p class="text-[11px] text-muted-foreground">{{ group.description }}</p>
                </div>
                <div class="grid gap-2 sm:grid-cols-2">
                    <label
                        v-for="role in group.roles"
                        :key="`${idPrefix}-${String(role.id)}`"
                        class="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-muted/30"
                        :class="
                            isChecked(role.id) && isElevatedPlatformRole(role.code, role.isElevated)
                                ? 'border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20'
                                : isChecked(role.id)
                                  ? 'border-primary/40 bg-primary/5'
                                  : 'border-border/70'
                        "
                    >
                        <Checkbox
                            :id="`${idPrefix}-${String(role.id)}`"
                            :model-value="isChecked(role.id)"
                            :disabled="disabled || role.id === null"
                            class="mt-0.5"
                            @update:model-value="toggleRole(role.id, $event)"
                        />
                        <span class="min-w-0 flex-1 space-y-0.5">
                            <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span class="font-medium">{{ role.name || role.code || `Role #${role.id}` }}</span>
                                <Badge
                                    v-if="isElevatedPlatformRole(role.code, role.isElevated)"
                                    variant="outline"
                                    class="h-5 border-amber-500/40 px-1.5 text-[10px] text-amber-800 dark:text-amber-200"
                                >
                                    Elevated
                                </Badge>
                            </span>
                            <span v-if="role.code" class="block text-xs text-muted-foreground">{{ role.code }}</span>
                        </span>
                    </label>
                </div>
            </section>
        </div>
    </div>
</template>
