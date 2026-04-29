<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppBrandMark from '@/components/AppBrandMark.vue';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useBranding } from '@/composables/useBranding';
import { home } from '@/routes';

const { branding, displayName, hasCustomLogo } = useBranding();

const markShellClass = computed(() =>
    hasCustomLogo.value
        ? 'flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-white p-1 shadow-sm'
        : 'flex h-9 w-9 items-center justify-center',
);

const markClass = computed(() =>
    hasCustomLogo.value
        ? 'size-full object-contain'
        : 'size-9 fill-current text-black dark:text-white',
);

defineProps<{
    title?: string;
    description?: string;
}>();
</script>

<template>
    <div
        class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10"
    >
        <div class="flex w-full max-w-md flex-col gap-6">
            <Link
                :href="home()"
                class="flex items-center gap-3 self-center font-medium"
            >
                <div :class="markShellClass">
                    <AppBrandMark :branding="branding" :class-name="markClass" />
                </div>
                <span>{{ displayName }}</span>
            </Link>

            <div class="flex flex-col gap-6">
                <Card class="rounded-lg">
                    <CardHeader class="px-10 pt-8 pb-0 text-center">
                        <CardTitle class="text-xl">{{ title }}</CardTitle>
                        <CardDescription>
                            {{ description }}
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="px-10 py-8">
                        <slot />
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
</template>
