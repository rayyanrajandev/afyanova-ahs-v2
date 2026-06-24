<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Account Pending Setup', href: '/pending-setup' },
];

const page = usePage<{
    auth: { isFacilitySuperAdmin: boolean; hasFacilityAssignments: boolean };
}>();
const isFacilitySuperAdmin = computed(() => page.props.auth?.isFacilitySuperAdmin ?? false);
const hasFacilityAssignments = computed(() => page.props.auth?.hasFacilityAssignments ?? false);
const needsPlatformAdmin = computed(() => isFacilitySuperAdmin.value || !hasFacilityAssignments.value);
</script>

<template>
    <Head title="Account Pending Setup" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="shield-off" class="size-6 text-muted-foreground" />
                        <span>Account not configured</span>
                    </div>
                    <p class="mt-1 max-w-3xl text-sm text-muted-foreground">
                        <template v-if="isFacilitySuperAdmin">
                            Your facility admin account has been created but has not been assigned any roles yet.
                            A platform super administrator needs to assign the appropriate roles before you can
                            manage this facility.
                        </template>
                        <template v-else-if="!hasFacilityAssignments">
                            Your account has been created but has not been linked to a facility yet.
                            A platform super administrator needs to assign the appropriate roles before you can
                            access the system.
                        </template>
                        <template v-else>
                            Your account has been created but has not been assigned any module permissions yet.
                        </template>
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">Setup pending</Badge>
                        <Badge variant="secondary">No role assigned</Badge>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Link href="/logout" method="post" as="button">
                        <Button variant="outline">Sign out</Button>
                    </Link>
                </div>
            </div>

            <Alert v-if="needsPlatformAdmin" class="rounded-lg">
                <AppIcon name="info" class="size-4" />
                <AlertTitle>Platform administrator action needed</AlertTitle>
                <AlertDescription>
                    Contact your platform super administrator to assign the appropriate roles to your account.
                    Once roles are assigned, you will be able to access the system.
                </AlertDescription>
            </Alert>
            <Alert v-else class="rounded-lg">
                <AppIcon name="info" class="size-4" />
                <AlertTitle>Administrator action needed</AlertTitle>
                <AlertDescription>
                    Contact your facility administrator to assign the appropriate roles to your account.
                    Once roles are assigned, you will be able to access the system.
                </AlertDescription>
            </Alert>

            <div class="grid gap-3 md:grid-cols-2">
                <Card class="rounded-lg border-sidebar-border/70">
                    <CardContent class="p-4">
                        <p class="text-xs font-medium tracking-normal text-muted-foreground uppercase">
                            What's missing
                        </p>
                        <p v-if="isFacilitySuperAdmin" class="mt-1 truncate text-sm font-medium text-foreground">
                            No roles assigned to this facility admin account
                        </p>
                        <p v-else-if="!hasFacilityAssignments" class="mt-1 truncate text-sm font-medium text-foreground">
                            No facility or roles assigned
                        </p>
                        <p v-else class="mt-1 truncate text-sm font-medium text-foreground">
                            No roles assigned to your account
                        </p>
                        <p v-if="isFacilitySuperAdmin" class="mt-0.5 text-xs text-muted-foreground">
                            A platform super administrator needs to assign at least one role to grant you
                            access to the relevant modules and facility management features.
                        </p>
                        <p v-else-if="!hasFacilityAssignments" class="mt-0.5 text-xs text-muted-foreground">
                            A platform super administrator needs to link you to a facility and assign
                            at least one role to grant you access.
                        </p>
                        <p v-else class="mt-0.5 text-xs text-muted-foreground">
                            An administrator needs to assign at least one role to grant you access to the
                            relevant modules.
                        </p>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70">
                    <CardContent class="p-4">
                        <p class="text-xs font-medium tracking-normal text-muted-foreground uppercase">
                            Next steps
                        </p>
                        <p v-if="needsPlatformAdmin" class="mt-1 truncate text-sm font-medium text-foreground">
                            Reach out to your platform super administrator
                        </p>
                        <p v-else class="mt-1 truncate text-sm font-medium text-foreground">
                            Reach out to your facility admin
                        </p>
                        <p class="mt-0.5 text-xs text-muted-foreground">
                            Once roles are assigned, simply refresh this page or sign out and back in
                            to access the dashboard and modules.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    </AppLayout>
</template>
