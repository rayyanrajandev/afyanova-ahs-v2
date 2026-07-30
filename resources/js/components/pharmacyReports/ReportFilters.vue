<script setup lang="ts">
import { Input } from '@/components/ui/input';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';

defineProps<{
    from: string;
    to: string;
    q: string;
    showDateRange?: boolean;
    showSearch?: boolean;
    dateLabel?: string;
}>();

const emit = defineEmits<{
    'update:from': [value: string];
    'update:to': [value: string];
    'update:q': [value: string];
}>();

function onDateRangeChange(range: { from: string; to: string }) {
    emit('update:from', range.from);
    emit('update:to', range.to);
}
</script>

<template>
    <div class="flex flex-wrap items-end gap-3">
        <div v-if="showSearch !== false" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Search</label>
            <Input
                :model-value="q"
                placeholder="Search medications..."
                class="h-9 w-64"
                @update:model-value="emit('update:q', $event)"
            />
        </div>

        <div v-if="showDateRange !== false" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">{{ dateLabel ?? 'Date range' }}</label>
            <DateRangeFilterPopover
                :from="from"
                :to="to"
                @update:from="onDateRangeChange"
                @update:to="onDateRangeChange"
            />
        </div>

        <slot name="extra" />
    </div>
</template>
