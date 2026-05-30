<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';

withDefaults(
    defineProps<{
        title: string;
        contextLine?: string | null;
        description?: string | null;
        badgeLabel?: string | null;
        badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
        syncLabel?: string | null;
        syncDetail?: string | null;
        syncTone?: 'info' | 'success' | 'warning' | 'destructive';
        syncBusy?: boolean;
    }>(),
    {
        contextLine: null,
        description: null,
        badgeLabel: null,
        badgeVariant: 'secondary',
        syncLabel: null,
        syncDetail: null,
        syncTone: 'info',
        syncBusy: false,
    },
);
</script>

<template>
    <div
        class="shrink-0 border-b border-border/40 bg-muted/10 py-3"
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
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Badge
                    v-if="badgeLabel"
                    :variant="badgeVariant"
                    class="h-5 shrink-0 px-1.5 text-[10px] tabular-nums"
                >
                    {{ badgeLabel }}
                </Badge>
                <div
                    v-if="syncLabel"
                    class="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    :class="{
                        'border-primary/20 bg-primary/5 text-primary': syncTone === 'info',
                        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300': syncTone === 'success',
                        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300': syncTone === 'warning',
                        'border-destructive/25 bg-destructive/10 text-destructive': syncTone === 'destructive',
                    }"
                    role="status"
                    :title="syncDetail || syncLabel"
                    data-test="encounter-workspace-pane-sync-status"
                >
                    <AppIcon
                        :name="syncBusy ? 'refresh-cw' : syncTone === 'destructive' ? 'alert-triangle' : syncTone === 'success' ? 'check-circle' : 'refresh-cw'"
                        class="size-3.5 shrink-0"
                        :class="{ 'animate-spin': syncBusy }"
                    />
                    <span class="truncate">{{ syncLabel }}</span>
                    <span
                        v-if="syncDetail"
                        class="hidden max-w-56 truncate font-normal opacity-80 xl:inline"
                    >
                        · {{ syncDetail }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
