<script setup lang="ts">
import { computed, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAvailableBeds } from '@/composables/admissions/useAvailableBeds';
import { useWardBedCascade } from '@/composables/admissions/useWardBedCascade';

/**
 * P3 of the Reception/Emergency/Admission/Bed-Management audit
 * follow-through — the single canonical ward-then-bed picker, extracted
 * from the identical wiring previously copy-pasted across
 * CreateAdmissionSheet.vue, AdmissionStatusDialog.vue, and
 * EmergencyStatusDialog.vue. Those three now consume this component
 * instead of each owning their own useAvailableBeds()/useWardBedCascade()
 * call. The legacy `admissions/Index.vue` (which had its own free-text
 * ward/bed pickers) was deliberately never refactored to use this — per the
 * standing "no further patches to legacy files, ever" directive, it instead
 * reached full V2 parity and was deleted outright (AdmF of the Admission V2
 * full-parity plan), the same way emergency-triage/Index.vue was.
 *
 * `initialWard` is watched (not just read once) so a parent dialog that
 * stays mounted across opens (AdmissionStatusDialog.vue's pattern) can
 * re-seed the selected ward each time it opens for a different admission,
 * without this component needing to know anything about "open" itself.
 */
const props = defineProps<{
    modelValue: string;
    initialWard?: string | null;
    wardLabel?: string;
    bedLabel?: string;
    idPrefix: string;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const availableBeds = useAvailableBeds();
const { selectedWard, wardOptions, bedOptions } = useWardBedCascade(computed(() => availableBeds.data.value?.data ?? []));

watch(
    () => props.initialWard,
    (value) => {
        selectedWard.value = value ?? '';
    },
    { immediate: true },
);

watch(selectedWard, () => {
    emit('update:modelValue', '');
});
</script>

<template>
    <div class="space-y-3">
        <Alert v-if="availableBeds.isError.value" variant="destructive">
            <AlertTitle>Unable to load wards and beds</AlertTitle>
            <AlertDescription>{{ (availableBeds.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
        </Alert>

        <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
                <Label :for="`${idPrefix}-ward`">{{ wardLabel ?? 'Ward' }}</Label>
                <Select v-model="selectedWard" :disabled="wardOptions.length === 0">
                    <SelectTrigger :id="`${idPrefix}-ward`" class="w-full">
                        <SelectValue placeholder="Select a ward" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="ward in wardOptions" :key="ward" :value="ward">{{ ward }}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div class="grid gap-2">
                <Label :for="`${idPrefix}-bed`">{{ bedLabel ?? 'Bed' }}</Label>
                <Select :model-value="modelValue" @update:model-value="(value) => emit('update:modelValue', String(value ?? ''))" :disabled="!selectedWard || bedOptions.length === 0">
                    <SelectTrigger :id="`${idPrefix}-bed`" class="w-full">
                        <SelectValue :placeholder="selectedWard ? 'Select a bed' : 'Select a ward first'" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            v-for="bed in bedOptions"
                            :key="bed.id"
                            :value="bed.id"
                            :disabled="bed.isOccupied"
                        >
                            {{ bed.bedNumber }}
                            <span v-if="bed.isOccupied" class="text-muted-foreground">(occupied)</span>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    </div>
</template>
