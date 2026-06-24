<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/AppLayout.vue';
</script>

<template>
    <Head title="Account Pending Setup" />
    <AppLayout :breadcrumbs="[{ title: 'Account Pending Setup', href: '/pending-setup' }]">
        <div class="flex flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="shield-off" class="size-6 text-muted-foreground" />
                        <span>Account not configured</span>
                    </div>
                    <p class="mt-1 max-w-3xl text-sm text-muted-foreground">
                        Your account has been created but has not been assigned any module permissions yet.
                    </p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Link href="/logout" method="post" as="button">
                        <Button variant="outline">Sign out</Button>
                    </Link>
                </div>
            </div>

            <Alert class="rounded-lg">
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
                        <p class="mt-1 text-sm font-medium text-foreground">
                            No roles assigned to your account
                        </p>
                        <p class="mt-0.5 text-xs text-muted-foreground">
                            An administrator needs to assign at least one role (e.g. LAB.STAFF, ADMIN.FACILITY)
                            to grant you access to the relevant modules.
                        </p>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70">
                    <CardContent class="p-4">
                        <p class="text-xs font-medium tracking-normal text-muted-foreground uppercase">
                            Next steps
                        </p>
                        <p class="mt-1 text-sm font-medium text-foreground">
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
