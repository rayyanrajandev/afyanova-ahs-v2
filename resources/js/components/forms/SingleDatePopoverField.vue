<script setup lang="ts">
import { parseDate } from '@internationalized/date';
import { CalendarDays } from 'lucide-vue-next';
import type { DateRange } from 'reka-ui';
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
import { RangeCalendar } from '@/components/ui/range-calendar';

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
    placeholder: 'Select date',
    errorMessage: null,
    disabled: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const open = ref(false);

const calendarRange = computed<DateRange>({
    get() {
        const selected = parseIsoDate(props.modelValue);
        return {
            start: selected,
            end: selected,
        };
    },
    set(value) {
        const selected = value?.end ?? value?.start;
        emit('update:modelValue', toIsoDateString(selected));
    },
});

const summaryText = computed(() => {
    const value = props.modelValue.trim();
    return value || props.placeholder;
});

function parseIsoDate(value: string) {
    const normalized = value.trim();
    if (!normalized) return undefined;

    try {
        return parseDate(normalized);
    } catch {
        return undefined;
    }
}

function toIsoDateString(value: { toString(): string } | undefined): string {
    return value ? value.toString() : '';
}

function updateValue(value: string) {
    emit('update:modelValue', value);
}

function applyToday() {
    const today = new Date();
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
    emit('update:modelValue', local.toISOString().slice(0, 10));
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
                <button
                    type="button"
                    class="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                    :class="{
                        'border-destructive': Boolean(errorMessage),
                    }"
                    :disabled="disabled"
                >
                    <span
                        class="truncate"
                        :class="{ 'text-muted-foreground': !modelValue.trim() }"
                    >
                        {{ summaryText }}
                    </span>
                    <CalendarDays class="size-4 shrink-0 text-muted-foreground" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-[22rem] space-y-4 p-4">
                <div class="space-y-1">
                    <p class="text-sm font-medium">{{ label }}</p>
                </div>

                <div class="rounded-lg border">
                    <RangeCalendar
                        v-model="calendarRange"
                        :number-of-months="1"
                        class="w-full"
                    />
                </div>

                <div class="grid gap-2">
                    <Label :for="`${inputId}-manual`">Manual Date Entry</Label>
                    <Input
                        :id="`${inputId}-manual`"
                        :model-value="modelValue"
                        type="text"
                        inputmode="numeric"
                        placeholder="YYYY-MM-DD"
                        :disabled="disabled"
                        @update:model-value="(value) => updateValue(String(value ?? ''))"
                    />
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" :disabled="disabled" @click="applyToday">
                        Today
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        :disabled="disabled || !modelValue.trim()"
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
