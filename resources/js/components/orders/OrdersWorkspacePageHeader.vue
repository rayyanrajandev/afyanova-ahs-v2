<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import type { AppIconName } from '@/lib/icons';

const props = withDefaults(
    defineProps<{
        title: string;
        intro: string;
        icon: AppIconName;
        listLoading?: boolean;
        workspaceView?: 'queue' | 'new' | 'create';
        canCreate?: boolean;
        queueActionLabel?: string;
        createActionLabel?: string;
    }>(),
    {
        listLoading: false,
        workspaceView: 'queue',
        canCreate: false,
        queueActionLabel: 'Queue',
        createActionLabel: 'Create order',
    },
);

const emit = defineEmits<{
    refresh: [];
    toggleWorkspace: [];
}>();

defineSlots<{
    actions?: () => unknown;
}>();

const isCreateView = computed(
    () => props.workspaceView === 'new' || props.workspaceView === 'create',
);
</script>

<template>
    <section class="rounded-lg border border-border bg-card shadow-sm">
        <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
            <div class="flex min-w-0 items-center gap-3">
                <div
                    class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                    aria-hidden="true"
                >
                    <AppIcon :name="props.icon" class="size-5" />
                </div>
                <div class="min-w-0 space-y-0.5">
                    <h1 class="text-base font-semibold tracking-tight md:text-lg">
                        {{ props.title }}
                    </h1>
                    <p class="truncate text-xs text-muted-foreground">
                        {{ props.intro }}
                    </p>
                </div>
            </div>
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <slot name="actions" />
                <Button
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5"
                    :disabled="props.listLoading"
                    @click="emit('refresh')"
                >
                    <AppIcon name="refresh-cw" class="size-3.5" />
                    {{ props.listLoading ? 'Refreshing...' : 'Refresh' }}
                </Button>
                <Button
                    v-if="isCreateView || props.canCreate"
                    class="h-8 gap-1.5"
                    :variant="isCreateView ? 'outline' : 'default'"
                    @click="emit('toggleWorkspace')"
                >
                    <AppIcon :name="isCreateView ? 'layout-list' : 'plus'" class="size-3.5" />
                    {{ isCreateView ? props.queueActionLabel : props.createActionLabel }}
                </Button>
            </div>
        </div>
    </section>
</template>
