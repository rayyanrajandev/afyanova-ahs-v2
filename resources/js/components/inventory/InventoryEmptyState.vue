<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import type { AppIconName } from '@/lib/icons';

withDefaults(defineProps<{
    icon?: AppIconName;
    title: string;
    description?: string;
    chips?: string[];
    compact?: boolean;
}>(), {
    icon: 'package',
    description: '',
    chips: () => [],
    compact: false,
});
</script>

<template>
    <div
        class="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 text-center"
        :class="compact ? 'gap-2 px-4 py-5' : 'gap-3 px-6 py-8'"
    >
        <div class="flex items-center justify-center rounded-lg bg-background p-2 text-muted-foreground shadow-sm">
            <AppIcon :name="icon" :class="compact ? 'size-4' : 'size-5'" />
        </div>
        <div class="max-w-xl space-y-1">
            <p class="text-sm font-medium text-foreground">{{ title }}</p>
            <p v-if="description" class="text-xs leading-5 text-muted-foreground">{{ description }}</p>
        </div>
        <div v-if="chips.length" class="flex flex-wrap justify-center gap-1.5">
            <Badge v-for="chip in chips" :key="chip" variant="secondary" class="text-xs">
                {{ chip }}
            </Badge>
        </div>
        <div v-if="$slots.actions" class="flex flex-wrap justify-center gap-2">
            <slot name="actions" />
        </div>
    </div>
</template>
