<script setup lang="ts">
/**
 * Responsive filter/toolbar row for POS lanes.
 * Children should be PosFilterField wrappers with xl-span set for alignment.
 */
</script>

<template>
    <div
        class="grid grid-cols-1 gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-12 xl:items-end"
    >
        <slot />
    </div>
</template>
