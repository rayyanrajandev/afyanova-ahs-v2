<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import type { BreadcrumbItem } from '@/types';

type FacilitySummary = {
    code?: string | null;
    name?: string | null;
};

type SubscriptionSummary = {
    status?: string | null;
    planCode?: string | null;
    planName?: string | null;
    currentPeriodEndsAt?: string | null;
};

type SubscriptionAccess = {
    code?: string | null;
    message?: string | null;
    requiredEntitlements?: string[];
    missingEntitlements?: string[];
    facility?: FacilitySummary | null;
    subscription?: SubscriptionSummary | null;
};

const props = defineProps<{
    access: SubscriptionAccess;
}>();

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Access Restricted', href: '/dashboard' },
];

function entitlementLabel(value: string): string {
    return formatEnumLabel(value.replaceAll('.', ' '));
}

function dateLabel(value: string | null | undefined): string {
    if (!value) return 'Not set';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
</script>

<template>
    <Head title="Subscription Required" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex min-h-full flex-1 items-center justify-center p-4 md:p-8">
            <Card class="w-full max-w-3xl rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-3">
                    <div class="flex items-start gap-3">
                        <span class="rounded-md border bg-muted/30 p-2 text-muted-foreground">
                            <AppIcon name="receipt" class="size-5" />
                        </span>
                        <div class="min-w-0">
                            <CardTitle>Subscription Required</CardTitle>
                            <CardDescription>{{ props.access.message || 'This facility subscription does not include this service.' }}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="grid gap-4">
                    <Alert>
                        <AlertTitle>{{ props.access.facility?.name || props.access.facility?.code || 'Facility not selected' }}</AlertTitle>
                        <AlertDescription>
                            Plan:
                            {{ props.access.subscription?.planName || props.access.subscription?.planCode || 'Not configured' }}
                            |
                            Status:
                            {{ formatEnumLabel(props.access.subscription?.status || props.access.code || 'restricted') }}
                            |
                            Period ends:
                            {{ dateLabel(props.access.subscription?.currentPeriodEndsAt) }}
                        </AlertDescription>
                    </Alert>

                    <div class="grid gap-3 md:grid-cols-2">
                        <div class="rounded-lg border p-3">
                            <p class="text-sm font-medium">Required access</p>
                            <div class="mt-2 flex flex-wrap gap-1.5">
                                <Badge v-for="entitlement in props.access.requiredEntitlements ?? []" :key="entitlement" variant="outline">
                                    {{ entitlementLabel(entitlement) }}
                                </Badge>
                            </div>
                        </div>
                        <div class="rounded-lg border p-3">
                            <p class="text-sm font-medium">Missing access</p>
                            <div class="mt-2 flex flex-wrap gap-1.5">
                                <Badge v-for="entitlement in props.access.missingEntitlements ?? []" :key="entitlement" variant="destructive">
                                    {{ entitlementLabel(entitlement) }}
                                </Badge>
                                <span v-if="(props.access.missingEntitlements ?? []).length === 0" class="text-sm text-muted-foreground">
                                    Configure or activate the facility subscription.
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap justify-end gap-2 border-t pt-4">
                        <Button variant="outline" as-child>
                            <Link href="/dashboard">Dashboard</Link>
                        </Button>
                        <Button as-child>
                            <Link href="/platform/admin/facility-config">Facility Configuration</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    </AppLayout>
</template>
