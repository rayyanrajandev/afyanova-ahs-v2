<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppBrandMark from '@/components/AppBrandMark.vue';
import { useBranding } from '@/composables/useBranding';
import { home } from '@/routes';

const { branding, displayName, hasCustomLogo } = useBranding();

const markShellClass = computed(() =>
    hasCustomLogo.value
        ? 'mb-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-white p-1 shadow-sm'
        : 'mb-1 flex h-9 w-9 items-center justify-center rounded-md',
);

const markClass = computed(() =>
    hasCustomLogo.value
        ? 'size-full object-contain'
        : 'size-9 fill-current text-[var(--foreground)] dark:text-white',
);

defineProps<{
    title?: string;
    description?: string;
}>();
</script>

<template>
    <div
        class="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10"
    >
        <div class="w-full max-w-sm">
            <div class="flex flex-col gap-8">
                <div class="flex flex-col items-center gap-4">
                    <Link
                        :href="home()"
                        class="flex flex-col items-center gap-2 font-medium"
                    >
                        <div :class="markShellClass">
                            <AppBrandMark :branding="branding" :class-name="markClass" />
                        </div>
                        <span>{{ displayName }}</span>
                    </Link>
                    <div class="space-y-2 text-center">
                        <h1 class="text-xl font-medium">{{ title }}</h1>
                        <p class="text-center text-sm text-muted-foreground">
                            {{ description }}
                        </p>
                    </div>
                </div>
                <slot />
            </div>
        </div>
    </div>
</template>
