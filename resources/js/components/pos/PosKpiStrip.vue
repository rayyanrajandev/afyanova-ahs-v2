<script setup lang="ts">
/**
 * Horizontal KPI metrics — auto-fit columns instead of forced 3-up layouts.
 */
</script>

<template>
    <div
        class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))]"
    >
        <slot />
    </div>
</template>
