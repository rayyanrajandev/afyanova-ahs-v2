<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        /** Column span on xl breakpoint (12-column grid). */
        xlSpan?: 3 | 4 | 5 | 6 | 8 | 12;
    }>(),
    { xlSpan: 3 },
);

const spanClass: Record<number, string> = {
    12: 'xl:col-span-12',
    8: 'xl:col-span-8',
    6: 'xl:col-span-6',
    5: 'xl:col-span-5',
    4: 'xl:col-span-4',
    3: 'xl:col-span-3',
};
</script>

<template>
    <div class="grid gap-2" :class="spanClass[props.xlSpan]">
        <slot />
    </div>
</template>
