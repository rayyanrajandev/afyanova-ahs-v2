<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const props = withDefaults(
    defineProps<{
        title: string;
        description: string;
        compact?: boolean;
        class?: HTMLAttributes['class'];
    }>(),
    {
        compact: false,
        class: '',
    },
);
</script>

<template>
    <div
        data-slot="processing-state"
        role="status"
        aria-live="polite"
        :class="
            cn(
                props.compact
                    ? 'flex min-w-0 items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-left'
                    : 'flex min-w-0 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 p-5 text-center text-balance',
                props.class,
            )
        "
    >
        <div
            :class="
                cn(
                    'flex shrink-0 items-center justify-center rounded-lg',
                    props.compact
                        ? 'size-8 bg-primary/10 text-primary'
                        : 'mb-1 size-9 bg-muted text-foreground',
                )
            "
        >
            <Spinner class="size-4" />
        </div>
        <div
            :class="
                cn(
                    'flex flex-col',
                    props.compact
                        ? 'min-w-0 flex-1 items-start gap-0.5'
                        : 'max-w-sm items-center gap-2',
                )
            "
        >
            <p class="text-sm font-medium tracking-tight">
                {{ title }}
            </p>
            <p class="text-sm/relaxed text-muted-foreground">
                {{ description }}
            </p>
        </div>
    </div>
</template>
