<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { usePlatformAccess } from '@/composables/usePlatformAccess';

const props = withDefaults(
    defineProps<{
        title: string;
        description: string;
        icon?: string;
        showScope?: boolean;
        backHref?: string | null;
        backLabel?: string;
    }>(),
    {
        icon: 'package',
        showScope: true,
        backHref: null,
        backLabel: 'Back',
    },
);

defineSlots<{
    badges?: () => unknown;
    actions?: () => unknown;
}>();

const { scope } = usePlatformAccess();
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
                    <div class="flex flex-wrap items-center gap-2">
                        <h1 class="text-base font-semibold tracking-tight md:text-lg">
                            {{ props.title }}
                        </h1>
                        <slot name="badges" />
                    </div>
                    <p class="truncate text-xs text-muted-foreground">
                        {{ props.description }}
                    </p>
                    <div
                        v-if="props.showScope"
                        class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground"
                    >
                        <span class="inline-flex items-center gap-1">
                            <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                            <span class="font-medium text-foreground">
                                {{ scope?.facility?.name || 'No facility' }}
                            </span>
                        </span>
                        <span class="select-none text-border" aria-hidden="true">·</span>
                        <span>{{ scope?.tenant?.name || 'No tenant' }}</span>
                    </div>
                </div>
            </div>
            <div
                v-if="$slots.actions || props.backHref"
                class="flex shrink-0 flex-wrap items-center justify-end gap-2"
            >
                <slot name="actions" />
                <Button
                    v-if="props.backHref"
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5"
                    as-child
                >
                    <Link :href="props.backHref">
                        {{ props.backLabel }}
                        <AppIcon name="chevron-right" class="size-3.5" />
                    </Link>
                </Button>
            </div>
        </div>
    </section>
</template>
