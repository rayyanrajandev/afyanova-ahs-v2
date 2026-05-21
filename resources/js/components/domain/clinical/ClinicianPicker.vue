<script setup lang="ts">
import { computed } from 'vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { SearchableSelectOption } from '@/lib/patientLocations';

type Props = {
    inputId: string;
    label: string;
    modelValue: string;
    options: SearchableSelectOption[];
    canReadDirectory: boolean;
    directoryAvailable: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
    helperText?: string;
    errorMessage?: string | null;
    emptyText?: string;
    disabled?: boolean;
    loading?: boolean;
    required?: boolean;
    messageClass?: string;
    requireAvailableOptions?: boolean;
    unavailableTitle?: string;
    unavailableDescription?: string;
};

const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Select clinician',
    searchPlaceholder: 'Search clinicians',
    helperText: '',
    errorMessage: null,
    emptyText: 'No active clinician matched that search.',
    disabled: false,
    loading: false,
    required: false,
    messageClass: '',
    requireAvailableOptions: true,
    unavailableTitle: 'Clinician directory unavailable',
    unavailableDescription:
        'Leave this optional field blank or request staff.clinical-directory.read access.',
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const selectedValue = computed({
    get: () => props.modelValue,
    set: (value: string) => emit('update:modelValue', value),
});

const canShowSelector = computed(
    () =>
        props.canReadDirectory &&
        (props.loading ||
            !props.requireAvailableOptions ||
            props.directoryAvailable),
);

const selectorDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
    <SearchableSelectField
        v-if="canShowSelector"
        :input-id="inputId"
        v-model="selectedValue"
        :label="label"
        :options="options"
        :placeholder="placeholder"
        :search-placeholder="searchPlaceholder"
        :helper-text="helperText"
        :error-message="errorMessage"
        :empty-text="emptyText"
        :disabled="selectorDisabled"
        :required="required"
        :message-class="messageClass"
    />

    <Alert v-else>
        <AlertTitle>{{ unavailableTitle }}</AlertTitle>
        <AlertDescription class="space-y-1">
            <p v-if="helperText">{{ helperText }}</p>
            <p>{{ unavailableDescription }}</p>
            <p v-if="errorMessage" class="text-destructive">{{ errorMessage }}</p>
        </AlertDescription>
    </Alert>
</template>
