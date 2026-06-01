<script setup lang="ts">
defineProps<{
    title: string;
    description?: string;
}>();
</script>

<template>
    <section class="rounded-lg border bg-muted/20">
        <header class="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
            <div class="min-w-0">
                <p class="text-sm font-semibold">{{ title }}</p>
                <p v-if="description" class="mt-0.5 text-xs text-muted-foreground">{{ description }}</p>
            </div>
            <slot name="actions" />
        </header>
        <div class="space-y-4 p-4">
            <slot />
        </div>
    </section>
</template>
