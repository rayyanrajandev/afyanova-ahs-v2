<script setup lang="ts">
withDefaults(
    defineProps<{
        /** Catalog column width on large screens (12-col grid). */
        catalogSpan?: 7 | 8;
    }>(),
    { catalogSpan: 7 },
);

const catalogClass = { 7: 'lg:col-span-7', 8: 'lg:col-span-8' } as const;
const checkoutClass = { 7: 'lg:col-span-5', 8: 'lg:col-span-4' } as const;
</script>

<template>
    <div class="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div class="min-w-0 space-y-4" :class="catalogClass[catalogSpan]">
            <slot name="catalog" />
        </div>
        <div
            class="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start"
            :class="checkoutClass[catalogSpan]"
        >
            <slot name="checkout" />
        </div>
    </div>
</template>
