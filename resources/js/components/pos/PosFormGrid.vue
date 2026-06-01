<script setup lang="ts">
withDefaults(
    defineProps<{
        columns?: 1 | 2 | 4;
    }>(),
    { columns: 2 },
);

const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
} as const;
</script>

<template>
    <div class="grid gap-4" :class="gridClass[columns]">
        <slot />
    </div>
</template>
