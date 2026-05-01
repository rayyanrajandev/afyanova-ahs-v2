<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

type RegistrationAction = {
    id: string;
    icon: string;
    label: string;
    href: string;
    description: string;
    isPrimary?: boolean;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

const { scope } = usePlatformAccess();
const searchQuery = ref('');
const isLoading = ref(false);

const facilityName = computed(() => scope.value?.facility?.name ?? 'My Facility');

/**
 * Quick action tiles for registration workflow
 */
const quickActions: RegistrationAction[] = [
    {
        id: 'new_patient',
        icon: 'user-plus',
        label: 'Register New Patient',
        href: '/patients?mode=create',
        description: 'Start fresh patient registration',
        isPrimary: true,
    },
    {
        id: 'check_in',
        icon: 'log-in',
        label: 'Check In Arrival',
        href: '/patients?mode=checkin',
        description: 'Check in waiting patients',
    },
    {
        id: 'schedule_appointment',
        icon: 'calendar-plus',
        label: 'Schedule Appointment',
        href: '/appointments?mode=create',
        description: 'Book patient appointments',
    },
    {
        id: 'search_patient',
        icon: 'search',
        label: 'Search Patient',
        href: '/patients?mode=search',
        description: 'Find and edit patient details',
    },
];

/**
 * Stats for the registration workflow
 * In production, these would be real data from the API
 */
const stats = [
    { label: 'Arrivals Today', value: '12', icon: 'users', variant: 'default' as const },
    { label: 'Pending Registration', value: '3', icon: 'clipboard-list', variant: 'secondary' as const },
    { label: 'Scheduled Today', value: '18', icon: 'calendar', variant: 'outline' as const },
];

async function handleSearch(e: Event) {
    e.preventDefault();
    if (!searchQuery.value.trim()) return;

    // In production, this would navigate with search params or open a modal
    isLoading.value = true;
    setTimeout(() => {
        isLoading.value = false;
    }, 300);
}
</script>

<template>
    <Head title="Registration - Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-5 overflow-x-hidden p-4 md:p-6">

            <!-- Header -->
            <div class="flex flex-col gap-2">
                <div class="flex items-baseline justify-between gap-3">
                    <h1 class="text-2xl font-semibold">Registration</h1>
                    <p class="text-sm text-muted-foreground">{{ facilityName }}</p>
                </div>
                <p class="text-sm text-muted-foreground">
                    Manage patient arrivals, registrations, and appointments
                </p>
            </div>

            <!-- Quick Search -->
            <form @submit="handleSearch" class="flex gap-2">
                <div class="relative flex-1">
                    <AppIcon name="search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search patient by name, ID, or phone..."
                        class="pl-9 md:max-w-sm"
                    />
                </div>
                <Button type="submit" size="sm" :disabled="isLoading">
                    <AppIcon v-if="isLoading" name="loader-2" class="size-3.5 animate-spin" />
                    <AppIcon v-else name="search" class="size-3.5" />
                </Button>
            </form>

            <!-- Stats Row -->
            <div class="grid gap-3 sm:grid-cols-3">
                <div
                    v-for="stat in stats"
                    :key="stat.label"
                    class="rounded-lg border border-sidebar-border/70 bg-card px-4 py-3"
                >
                    <div class="flex items-baseline justify-between gap-2">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                {{ stat.label }}
                            </p>
                            <p class="mt-1 text-2xl font-semibold">{{ stat.value }}</p>
                        </div>
                        <div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <AppIcon :name="stat.icon" class="size-4" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="space-y-3">
                <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quick actions</p>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Link
                        v-for="action in quickActions"
                        :key="action.id"
                        :href="action.href"
                        :as="'div'"
                        class="group cursor-pointer"
                    >
                        <Card
                            class="h-full transition-colors hover:bg-muted/40"
                            :class="action.isPrimary ? 'ring-2 ring-primary' : ''"
                        >
                            <CardContent class="flex flex-col items-start gap-3 p-4">
                                <div
                                    class="flex size-10 items-center justify-center rounded-lg transition-colors"
                                    :class="action.isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'"
                                >
                                    <AppIcon :name="action.icon" class="size-5" />
                                </div>
                                <div>
                                    <p class="font-semibold leading-tight">{{ action.label }}</p>
                                    <p class="mt-0.5 text-xs text-muted-foreground">{{ action.description }}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>

            <!-- Recent Activity / Queue (Placeholder) -->
            <Card class="flex-1 overflow-hidden">
                <CardHeader>
                    <CardTitle class="text-base">Today's Activity</CardTitle>
                    <CardDescription>Recent check-ins and registrations</CardDescription>
                </CardHeader>
                <CardContent class="space-y-2">
                    <div class="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center">
                        <AppIcon name="inbox" class="mx-auto size-6 text-muted-foreground/30" />
                        <p class="mt-2 text-sm text-muted-foreground">Loading today's activity...</p>
                    </div>
                </CardContent>
            </Card>

        </div>
    </AppLayout>
</template>
