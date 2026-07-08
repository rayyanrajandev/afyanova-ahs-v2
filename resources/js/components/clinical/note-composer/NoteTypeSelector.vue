<script setup lang="ts">
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import {
    NativeSelect,
    NativeSelectOption,
} from '@/components/ui/native-select';
import {
    MEDICAL_RECORD_NOTE_TYPE_OPTIONS,
    medicalRecordNoteTypeHelperText,
} from '@/pages/medical-records/noteTypes';

const props = defineProps<{
    modelValue: string;
    /** Once a draft exists its type is fixed — the backend keys duplicate-draft
     *  and referral/procedure eligibility to the chosen type at creation. */
    disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const helperText = computed(() => medicalRecordNoteTypeHelperText(props.modelValue));
</script>

<template>
    <div class="space-y-1.5">
        <Label for="note-type" class="text-sm font-medium">Note type</Label>
        <NativeSelect
            id="note-type"
            :model-value="modelValue"
            :disabled="disabled"
            @update:model-value="emit('update:modelValue', String($event ?? ''))"
        >
            <NativeSelectOption
                v-for="option in MEDICAL_RECORD_NOTE_TYPE_OPTIONS"
                :key="option.value"
                :value="option.value"
            >
                {{ option.label }}
            </NativeSelectOption>
        </NativeSelect>
        <p class="text-xs text-muted-foreground">{{ helperText }}</p>
    </div>
</template>
