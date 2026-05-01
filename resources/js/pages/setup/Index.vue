<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Setup Center', href: '/setup-center' },
];
</script>

<template>
    <Head title="Setup Center" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-5 overflow-x-hidden p-4 md:p-6">
            <div>
                <h1 class="text-2xl font-semibold tracking-tight">Setup Center</h1>
                <p class="mt-1 text-sm text-muted-foreground">Coming soon.</p>
            </div>
        </div>
    </AppLayout>
</template>
