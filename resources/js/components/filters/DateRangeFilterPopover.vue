<script setup lang="ts">
import { parseDate } from '@internationalized/date';
import { CalendarDays } from 'lucide-vue-next';
import type { DateRange } from 'reka-ui';
import { computed, ref } from 'vue';
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
    inputBaseId: string;
    title?: string;
    helperText?: string;
    fromLabel?: string;
    toLabel?: string;
    from: string;
    to: string;
    /** When true, render calendar + inputs inline (no popover). Use inside another popover/drawer to avoid nesting. */
    inline?: boolean;
    /** When true, hide the top label. Useful when embedding in an inline filter bar. */
    hideLabel?: boolean;
    /** Number of calendar months side by side. Default 1; override with 2 only when a wider layout is intentional. */
    numberOfMonths?: number;
    /** When false, hide native browser date inputs and rely on shadcn-vue calendar + presets only. */
    showManualInputs?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
    title: 'Date Range',
    helperText: '',
    fromLabel: 'From',
    toLabel: 'To',
    inline: false,
    hideLabel: false,
    numberOfMonths: undefined,
    showManualInputs: true,
});

const numberOfMonthsComputed = computed(() => props.numberOfMonths ?? 1);

const emit = defineEmits<{
    'update:from': [value: string];
    'update:to': [value: string];
}>();

const open = ref(false);

const calendarRange = computed<DateRange>({
    get() {
        return {
            start: parseIsoDate(props.from),
            end: parseIsoDate(props.to),
        };
    },
    set(value) {
        emit('update:from', toIsoDateString(value?.start));
        emit('update:to', toIsoDateString(value?.end));
    },
});

const hasRange = computed(() => Boolean(props.from.trim() || props.to.trim()));

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

const summaryText = computed(() => {
    const from = formatSummaryDate(props.from);
    const to = formatSummaryDate(props.to);

    if (from && to) return `${from} - ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Until ${to}`;
    return 'Select date range';
});

function updateFrom(value: string) {
    emit('update:from', value);
}

function updateTo(value: string) {
    emit('update:to', value);
}

function parseIsoDate(value: string) {
    const normalized = value.trim();
    if (!normalized) return undefined;

    try {
        return parseDate(normalized);
    } catch {
        return undefined;
    }
}

function formatSummaryDate(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '';

    const parsed = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return normalized;

    return dateFormatter.format(parsed);
}

function toIsoDateString(value: { toString(): string } | undefined): string {
    return value ? value.toString() : '';
}

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);

    return nextDate;
}

function applyToday() {
    const today = new Date();
    const iso = formatDate(today);
    emit('update:from', iso);
    emit('update:to', '');
}

function applyNext7Days() {
    const start = new Date();
    const end = addDays(start, 6);
    emit('update:from', formatDate(start));
    emit('update:to', formatDate(end));
}

function applyPrevious7Days() {
    const end = new Date();
    const start = addDays(end, -6);
    emit('update:from', formatDate(start));
    emit('update:to', formatDate(end));
}

function applyPrevious30Days() {
    const end = new Date();
    const start = addDays(end, -29);
    emit('update:from', formatDate(start));
    emit('update:to', formatDate(end));
}

function clearEndDate() {
    emit('update:to', '');
}

function clearAll() {
    emit('update:from', '');
    emit('update:to', '');
}
</script>

<template>
    <div class="grid gap-2">
        <Label v-if="!inline && !hideLabel" :for="`${inputBaseId}-from`">{{ title }}</Label>
        <Popover v-if="!inline" v-model:open="open">
            <PopoverTrigger as-child>
                <Button
                    type="button"
                    variant="outline"
                    class="h-9 w-full justify-between rounded-lg px-3 text-left font-normal"
                >
                    <span class="flex min-w-0 items-center gap-2">
                        <CalendarDays class="size-3.5 shrink-0 text-muted-foreground" />
                        <span
                            class="truncate"
                            :class="hasRange ? 'text-foreground' : 'text-muted-foreground'"
                        >
                            {{ summaryText }}
                        </span>
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-[18.5rem] max-w-[calc(100vw-1rem)] space-y-3 p-3">
                <div class="space-y-1">
                    <p class="text-sm font-medium">{{ title }}</p>
                    <p v-if="helperText" class="text-xs text-muted-foreground">
                        {{ helperText }}
                    </p>
                </div>
                <div class="overflow-hidden rounded-lg border">
                    <RangeCalendar
                        v-model="calendarRange"
                        :number-of-months="numberOfMonthsComputed"
                        class="w-full p-2 [&_[data-slot=range-calendar-header]]:pt-0 [&_[data-slot=range-calendar-grid]]:w-full [&_[data-slot=range-calendar-grid-row]]:justify-between [&_[data-slot=range-calendar-grid-row]]:mt-1 [&_[data-slot=range-calendar-head-cell]]:h-7 [&_[data-slot=range-calendar-head-cell]]:w-7 [&_[data-slot=range-calendar-head-cell]]:text-[11px] [&_[data-slot=range-calendar-trigger]]:h-7 [&_[data-slot=range-calendar-trigger]]:w-7 [&_[data-slot=range-calendar-trigger]]:text-xs"
                    />
                </div>
                <div v-if="showManualInputs" class="grid gap-2.5">
                    <div class="grid gap-2">
                        <Label :for="`${inputBaseId}-from`">{{ fromLabel }}</Label>
                        <Input
                            :id="`${inputBaseId}-from`"
                            :model-value="props.from"
                            type="date"
                            @update:model-value="(value) => updateFrom(String(value ?? ''))"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label :for="`${inputBaseId}-to`">{{ toLabel }}</Label>
                        <Input
                            :id="`${inputBaseId}-to`"
                            :model-value="props.to"
                            type="date"
                            @update:model-value="(value) => updateTo(String(value ?? ''))"
                        />
                    </div>
                </div>
                <div
                    class="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,8.75rem),1fr))]"
                >
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        class="w-full justify-center whitespace-nowrap px-2"
                        @click="applyToday"
                    >
                        Today onward
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        class="w-full justify-center whitespace-nowrap px-2"
                        @click="applyNext7Days"
                    >
                        Next 7 days
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        class="w-full justify-center whitespace-nowrap px-2"
                        @click="applyPrevious7Days"
                    >
                        Previous 7 days
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        class="w-full justify-center whitespace-nowrap px-2"
                        @click="applyPrevious30Days"
                    >
                        Previous 30 days
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        class="w-full justify-center whitespace-nowrap px-2"
                        :disabled="!props.to"
                        @click="clearEndDate"
                    >
                        Clear end
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="w-full justify-center whitespace-nowrap px-2"
                        :disabled="!props.from && !props.to"
                        @click="clearAll"
                    >
                        Clear all
                    </Button>
                </div>
                <div class="flex justify-end">
                    <Button type="button" size="sm" @click="open = false">
                        Done
                    </Button>
                </div>
            </PopoverContent>
        </Popover>

        <template v-else>
            <div class="space-y-1">
                <p class="text-sm font-medium">{{ title }}</p>
                <p v-if="helperText" class="text-xs text-muted-foreground">
                    {{ helperText }}
                </p>
            </div>
            <div class="rounded-lg border">
                <RangeCalendar
                    v-model="calendarRange"
                    :number-of-months="numberOfMonthsComputed"
                    class="w-full [&_[data-slot=range-calendar-grid-row]]:w-full [&_[data-slot=range-calendar-grid-row]]:justify-between"
                />
            </div>
            <div v-if="showManualInputs" class="grid gap-3 sm:grid-cols-2">
                <div class="grid gap-2">
                    <Label :for="`${inputBaseId}-from`">{{ fromLabel }}</Label>
                    <Input
                        :id="`${inputBaseId}-from`"
                        :model-value="props.from"
                        type="date"
                        @update:model-value="(value) => updateFrom(String(value ?? ''))"
                    />
                </div>
                <div class="grid gap-2">
                    <Label :for="`${inputBaseId}-to`">{{ toLabel }}</Label>
                    <Input
                        :id="`${inputBaseId}-to`"
                        :model-value="props.to"
                        type="date"
                        @update:model-value="(value) => updateTo(String(value ?? ''))"
                    />
                </div>
            </div>
            <div
                class="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,8.75rem),1fr))]"
            >
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="w-full justify-center whitespace-nowrap px-2"
                    @click="applyToday"
                >
                    Today onward
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="w-full justify-center whitespace-nowrap px-2"
                    @click="applyNext7Days"
                >
                    Next 7 days
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="w-full justify-center whitespace-nowrap px-2"
                    @click="applyPrevious7Days"
                >
                    Previous 7 days
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="w-full justify-center whitespace-nowrap px-2"
                    @click="applyPrevious30Days"
                >
                    Previous 30 days
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="w-full justify-center whitespace-nowrap px-2"
                    :disabled="!props.to"
                    @click="clearEndDate"
                >
                    Clear end
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    class="w-full justify-center whitespace-nowrap px-2"
                    :disabled="!props.from && !props.to"
                    @click="clearAll"
                >
                    Clear all
                </Button>
            </div>
        </template>
    </div>
</template>
