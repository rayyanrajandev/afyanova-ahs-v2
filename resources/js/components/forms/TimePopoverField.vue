<script setup lang="ts">
import { Clock3 } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

type Props = {
    inputId: string;
    label: string;
    modelValue: string;
    helperText?: string;
    placeholder?: string;
    errorMessage?: string | null;
    disabled?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
    helperText: '',
    placeholder: 'Select time',
    errorMessage: null,
    disabled: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const open = ref(false);

const quickTimes = [
    { label: '00:00', value: '00:00' },
    { label: '08:00', value: '08:00' },
    { label: '12:00', value: '12:00' },
    { label: '17:00', value: '17:00' },
    { label: '23:59', value: '23:59' },
];

const summaryText = computed(() => props.modelValue.trim() || props.placeholder);

function updateValue(value: string) {
    emit('update:modelValue', value.trim());
}

function clearValue() {
    emit('update:modelValue', '');
}
</script>

<template>
    <FormFieldShell
        :input-id="inputId"
        :label="label"
        :helper-text="helperText"
        :error-message="errorMessage"
    >
        <Popover v-model:open="open">
            <PopoverTrigger as-child>
                <Button
                    :id="inputId"
                    type="button"
                    variant="outline"
                    class="h-9 w-full justify-between px-3 font-normal"
                    :class="{
                        'border-destructive': Boolean(errorMessage),
                    }"
                    :disabled="disabled"
                >
                    <span
                        class="truncate text-left"
                        :class="{ 'text-muted-foreground': !modelValue.trim() }"
                    >
                        {{ summaryText }}
                    </span>
                    <Clock3 class="size-4 shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>

            <PopoverContent align="start" class="w-[22rem] space-y-4 p-4">
                <div class="space-y-1">
                    <p class="text-sm font-medium">{{ label }}</p>
                    <p class="text-xs text-muted-foreground">Choose a common time or enter a specific time manually.</p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button
                        v-for="option in quickTimes"
                        :key="option.value"
                        type="button"
                        size="sm"
                        :variant="modelValue === option.value ? 'default' : 'outline'"
                        @click="updateValue(option.value)"
                    >
                        {{ option.label }}
                    </Button>
                </div>

                <div class="grid gap-2">
                    <Label :for="`${inputId}-manual`">Manual time entry</Label>
                    <Input
                        :id="`${inputId}-manual`"
                        :model-value="modelValue"
                        type="time"
                        @update:model-value="(value) => updateValue(String(value ?? ''))"
                    />
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        :disabled="!modelValue.trim()"
                        @click="clearValue"
                    >
                        Clear
                    </Button>
                    <div class="ml-auto">
                        <Button type="button" size="sm" @click="open = false">Done</Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    </FormFieldShell>
</template>
