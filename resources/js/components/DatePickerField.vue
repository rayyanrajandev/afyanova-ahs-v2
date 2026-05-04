<script setup lang="ts">
/**
 * DatePickerField — single-date picker using ShadCN Calendar + Popover.
 * Model value is an ISO date string "YYYY-MM-DD" (or empty string).
 */
import { computed } from 'vue';
import { CalendarDate, getLocalTimeZone, parseDate, today } from '@internationalized/date';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AppIcon from '@/components/AppIcon.vue';
import { cn } from '@/lib/utils';

const props = withDefaults(
    defineProps<{
        modelValue: string;
        placeholder?: string;
        disabled?: boolean;
        /** Restrict to dates on or after this ISO string */
        minValue?: string;
        /** Restrict to dates on or before this ISO string */
        maxValue?: string;
        class?: string;
    }>(),
    {
        placeholder: 'Pick a date',
        disabled: false,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

// Convert ISO string → CalendarDate (or undefined)
const calendarValue = computed<CalendarDate | undefined>(() => {
    if (!props.modelValue) return undefined;
    try {
        return parseDate(props.modelValue);
    } catch {
        return undefined;
    }
});

const minCalendarValue = computed<CalendarDate | undefined>(() => {
    if (!props.minValue) return undefined;
    try {
        return parseDate(props.minValue);
    } catch {
        return undefined;
    }
});

const maxCalendarValue = computed<CalendarDate | undefined>(() => {
    if (!props.maxValue) return undefined;
    try {
        return parseDate(props.maxValue);
    } catch {
        return undefined;
    }
});

function onCalendarSelect(value: CalendarDate | undefined) {
    emit('update:modelValue', value ? value.toString() : '');
}

const displayLabel = computed(() => {
    if (!props.modelValue) return props.placeholder;
    try {
        const d = parseDate(props.modelValue);
        return d.toDate(getLocalTimeZone()).toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return props.modelValue;
    }
});

const todayDate = today(getLocalTimeZone());
</script>

<template>
    <Popover>
        <PopoverTrigger as-child>
            <Button
                variant="outline"
                :disabled="disabled"
                :class="cn(
                    'w-full justify-start gap-2 text-left font-normal',
                    !modelValue && 'text-muted-foreground',
                    props.class,
                )"
            >
                <AppIcon name="calendar-clock" class="size-4 shrink-0 opacity-60" />
                {{ displayLabel }}
            </Button>
        </PopoverTrigger>
        <PopoverContent class="z-[100] w-auto rounded-lg p-0" align="start">
            <Calendar
                :model-value="calendarValue"
                :min-value="minCalendarValue"
                :max-value="maxCalendarValue ?? todayDate"
                initial-focus
                @update:model-value="onCalendarSelect"
            />
        </PopoverContent>
    </Popover>
</template>
