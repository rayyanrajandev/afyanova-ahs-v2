<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const props = withDefaults(
    defineProps<{
        title: string;
        description: string;
        class?: HTMLAttributes['class'];
    }>(),
    {
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
                'flex min-w-0 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 p-5 text-center text-balance',
                props.class,
            )
        "
    >
        <div class="flex max-w-sm flex-col items-center gap-2">
            <div
                class="mb-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"
            >
                <Spinner class="size-4" />
            </div>
            <p class="text-sm font-medium tracking-tight">
                {{ title }}
            </p>
            <p class="text-sm/relaxed text-muted-foreground">
                {{ description }}
            </p>
        </div>
    </div>
</template>
