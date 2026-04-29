<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppBrandMark from '@/components/AppBrandMark.vue';
import { useBranding } from '@/composables/useBranding';
import { home } from '@/routes';

const { branding, systemName, hasCustomLogo } = useBranding();

const markShellClass = computed(() =>
    hasCustomLogo.value
        ? 'mr-3 flex size-10 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-white p-1 shadow-sm'
        : 'mr-2 flex size-8 items-center justify-center text-white',
);

const markClass = computed(() =>
    hasCustomLogo.value
        ? 'size-full object-contain'
        : 'size-8 fill-current text-white',
);

defineProps<{
    title?: string;
    description?: string;
}>();
</script>

<template>
    <div
        class="relative grid h-dvh flex-col items-center justify-center px-8 sm:px-0 lg:max-w-none lg:grid-cols-2 lg:px-0"
    >
        <div
            class="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r"
        >
            <div class="absolute inset-0 bg-zinc-900" />
            <Link
                :href="home()"
                class="relative z-20 flex items-center text-lg font-medium"
            >
                <div :class="markShellClass">
                    <AppBrandMark :branding="branding" :class-name="markClass" />
                </div>
                {{ systemName }}
            </Link>
        </div>
        <div class="lg:p-8">
            <div
                class="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]"
            >
                <div class="flex flex-col space-y-2 text-center">
                    <h1 class="text-xl font-medium tracking-tight" v-if="title">
                        {{ title }}
                    </h1>
                    <p class="text-sm text-muted-foreground" v-if="description">
                        {{ description }}
                    </p>
                </div>
                <slot />
            </div>
        </div>
    </div>
</template>
