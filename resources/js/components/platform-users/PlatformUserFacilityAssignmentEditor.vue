<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ensureSinglePrimaryFacilityDraft, type FacilityAssignmentDraft } from '@/composables/platformUsersIndex/usePlatformUserFacilitiesMutations';

export type AccessibleFacility = { id?: string | null; code?: string | null; name?: string | null };

/**
 * The add/remove/set-primary/toggle-active facility-draft editor, extracted
 * once so it can be shared by the details sheet's Access tab and the bulk
 * facilities dialog instead of duplicated (legacy Index.vue had this same
 * logic twice, once per usage).
 */
const props = defineProps<{
    modelValue: FacilityAssignmentDraft[];
    availableFacilities: AccessibleFacility[];
    disabled?: boolean;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: FacilityAssignmentDraft[]];
}>();

const newFacilityId = ref('');

const unassignedFacilities = computed(() => {
    const selected = new Set(props.modelValue.map((entry) => entry.facilityId));
    return props.availableFacilities.filter((facility) => {
        const id = String(facility.id ?? '');
        return id !== '' && !selected.has(id);
    });
});

function facilityLabel(facilityId: string): string {
    const facility = props.availableFacilities.find((entry) => String(entry.id ?? '') === facilityId);
    if (!facility) return facilityId;
    return `${facility.code ?? 'FAC'} - ${facility.name ?? 'Facility'}`;
}

function commit(drafts: FacilityAssignmentDraft[]): void {
    emit('update:modelValue', ensureSinglePrimaryFacilityDraft(drafts));
}

function addDraft(): void {
    const facilityId = newFacilityId.value.trim();
    if (!facilityId || props.modelValue.some((entry) => entry.facilityId === facilityId)) return;
    commit([...props.modelValue, { facilityId, role: '', isPrimary: props.modelValue.length === 0, isActive: true }]);
    newFacilityId.value = '';
}

function removeDraft(facilityId: string): void {
    commit(props.modelValue.filter((entry) => entry.facilityId !== facilityId));
}

function setPrimary(facilityId: string): void {
    commit(props.modelValue.map((entry) => ({ ...entry, isPrimary: entry.facilityId === facilityId })));
}

function updateRole(facilityId: string, role: string): void {
    emit(
        'update:modelValue',
        props.modelValue.map((entry) => (entry.facilityId === facilityId ? { ...entry, role } : entry)),
    );
}

function updateActive(facilityId: string, isActive: boolean): void {
    emit(
        'update:modelValue',
        props.modelValue.map((entry) => (entry.facilityId === facilityId ? { ...entry, isActive } : entry)),
    );
}
</script>

<template>
    <div class="space-y-3">
        <div v-if="modelValue.length === 0" class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center">
            <AppIcon name="building-2" class="size-5 text-muted-foreground/50" />
            <p class="text-sm text-muted-foreground">No facility assignments yet.</p>
        </div>

        <div v-else class="space-y-2">
            <div v-for="draft in modelValue" :key="draft.facilityId" class="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                <div class="min-w-0 flex-1 space-y-0.5">
                    <p class="truncate text-sm font-medium">{{ facilityLabel(draft.facilityId) }}</p>
                    <Input
                        :model-value="draft.role"
                        placeholder="Role at this facility (optional)"
                        class="h-7 text-xs"
                        :disabled="disabled"
                        @update:model-value="(value) => updateRole(draft.facilityId, String(value))"
                    />
                </div>
                <label class="flex shrink-0 items-center gap-1.5 text-xs">
                    <input
                        type="radio"
                        name="facility-primary"
                        :checked="draft.isPrimary"
                        :disabled="disabled"
                        @change="setPrimary(draft.facilityId)"
                    />
                    Primary
                </label>
                <label class="flex shrink-0 items-center gap-1.5 text-xs">
                    <Switch :model-value="draft.isActive" :disabled="disabled" @update:model-value="(value) => updateActive(draft.facilityId, value)" />
                    Active
                </label>
                <Button variant="ghost" size="icon" class="size-7 shrink-0" :disabled="disabled" @click="removeDraft(draft.facilityId)">
                    <AppIcon name="x" class="size-3.5" />
                </Button>
            </div>
        </div>

        <div class="flex items-center gap-2">
            <Select v-model="newFacilityId" :disabled="disabled || unassignedFacilities.length === 0">
                <SelectTrigger class="h-9 flex-1">
                    <SelectValue placeholder="Add a facility…" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem v-for="facility in unassignedFacilities" :key="String(facility.id)" :value="String(facility.id)">
                        {{ facility.code ?? 'FAC' }} - {{ facility.name ?? 'Facility' }}
                    </SelectItem>
                </SelectContent>
            </Select>
            <Button variant="outline" size="sm" :disabled="disabled || !newFacilityId" @click="addDraft">Add</Button>
        </div>
    </div>
</template>
