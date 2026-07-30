<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import Heading from '@/components/Heading.vue';
import { type BreadcrumbItem } from '@/types';

const props = withDefaults(defineProps<{
    title: string;
    description?: string;
    breadcrumbs?: BreadcrumbItem[];
}>(), {
    description: '',
    breadcrumbs: () => [],
});
</script>

<template>
    <AppLayout :breadcrumbs="props.breadcrumbs">
        <Head :title="props.title" />
        <div class="flex flex-col gap-6 p-6">
            <div class="flex items-center justify-between">
                <Heading :title="props.title" :description="props.description" />
                <div class="flex items-center gap-2">
                    <slot name="actions" />
                </div>
            </div>
            <slot name="filters" />
            <slot name="default" />
        </div>
    </AppLayout>
</template>
