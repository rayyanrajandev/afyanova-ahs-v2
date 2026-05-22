<script setup lang="ts">
import { Badge } from '@/components/ui/badge';

withDefaults(
    defineProps<{
        title: string;
        contextLine?: string | null;
        description?: string | null;
        badgeLabel?: string | null;
        badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
    }>(),
    {
        contextLine: null,
        description: null,
        badgeLabel: null,
        badgeVariant: 'secondary',
    },
);
</script>

<template>
    <div
        class="shrink-0 border-b border-border/40 bg-muted/10 px-4 py-3 md:px-6"
        data-test="encounter-workspace-pane-header"
    >
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
                <h2 class="text-sm font-semibold text-foreground">
                    {{ title }}
                </h2>
                <p
                    v-if="contextLine"
                    class="truncate text-xs text-muted-foreground"
                >
                    {{ contextLine }}
                </p>
                <p
                    v-if="description"
                    class="text-xs leading-5 text-muted-foreground"
                >
                    {{ description }}
                </p>
            </div>
            <Badge
                v-if="badgeLabel"
                :variant="badgeVariant"
                class="h-5 shrink-0 px-1.5 text-[10px] tabular-nums"
            >
                {{ badgeLabel }}
            </Badge>
        </div>
    </div>
</template>
