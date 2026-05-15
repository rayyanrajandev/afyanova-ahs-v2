<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { hasRouteAccess } from '@/lib/routeAccess';
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

const { permissionNames, hasUniversalAdminAccess } = usePlatformAccess();

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Access Restricted', href: '/dashboard' },
];

const facilityLabel = computed(
    () =>
        props.access.facility?.name ||
        props.access.facility?.code ||
        'Facility not selected',
);
const planLabel = computed(
    () =>
        props.access.subscription?.planName ||
        props.access.subscription?.planCode ||
        'Not configured',
);
const statusLabel = computed(() =>
    formatEnumLabel(
        props.access.subscription?.status || props.access.code || 'restricted',
    ),
);
const accessMessage = computed(
    () =>
        props.access.message ||
        "This facility's active service plan does not include this module.",
);
const canOpenFacilityConfig = computed(() =>
    hasRouteAccess(
        '/platform/admin/facility-config',
        permissionNames.value,
        hasUniversalAdminAccess.value,
    ),
);

function entitlementLabel(value: string): string {
    return formatEnumLabel(value.replaceAll('.', ' '));
}

function dateLabel(value: string | null | undefined): string {
    if (!value) return 'Not set';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          });
}
</script>

<template>
    <Head title="Subscription Required" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <div
                class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"
            >
                <div class="min-w-0">
                    <div
                        class="flex items-center gap-2 text-2xl font-semibold tracking-tight"
                    >
                        <AppIcon
                            name="shield-alert"
                            class="size-6 text-muted-foreground"
                        />
                        <span>Plan access restricted</span>
                    </div>
                    <p class="mt-1 max-w-3xl text-sm text-muted-foreground">
                        This facility subscription does not currently unlock the
                        requested service.
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">Subscription</Badge>
                        <Badge variant="destructive">{{ statusLabel }}</Badge>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button variant="outline" as-child>
                        <Link href="/dashboard">Dashboard</Link>
                    </Button>
                    <Button v-if="canOpenFacilityConfig" as-child>
                        <Link href="/platform/admin/facility-config">
                            Facility configuration
                        </Link>
                    </Button>
                </div>
            </div>

            <Alert variant="destructive" class="rounded-lg">
                <AppIcon name="receipt" class="size-4" />
                <AlertTitle>Not included in this facility's plan</AlertTitle>
                <AlertDescription>{{ accessMessage }}</AlertDescription>
            </Alert>

            <div class="grid gap-3 md:grid-cols-3">
                <Card class="rounded-lg border-sidebar-border/70">
                    <CardContent class="p-4">
                        <p
                            class="text-xs font-medium tracking-normal text-muted-foreground uppercase"
                        >
                            Facility
                        </p>
                        <p
                            class="mt-1 truncate text-sm font-medium text-foreground"
                            :title="facilityLabel"
                        >
                            {{ facilityLabel }}
                        </p>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70">
                    <CardContent class="p-4">
                        <p
                            class="text-xs font-medium tracking-normal text-muted-foreground uppercase"
                        >
                            Plan
                        </p>
                        <p
                            class="mt-1 truncate text-sm font-medium text-foreground"
                            :title="planLabel"
                        >
                            {{ planLabel }}
                        </p>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70">
                    <CardContent class="p-4">
                        <p
                            class="text-xs font-medium tracking-normal text-muted-foreground uppercase"
                        >
                            Period ends
                        </p>
                        <p
                            class="mt-1 truncate text-sm font-medium text-foreground"
                        >
                            {{
                                dateLabel(
                                    props.access.subscription
                                        ?.currentPeriodEndsAt,
                                )
                            }}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
                <Card class="rounded-lg border-sidebar-border/70">
                    <CardContent class="p-4">
                        <div class="flex items-center justify-between gap-3">
                            <p class="text-sm font-medium">Required access</p>
                            <Badge
                                v-if="
                                    (props.access.requiredEntitlements ?? [])
                                        .length > 1
                                "
                                variant="outline"
                                class="rounded-md"
                            >
                                Any one
                            </Badge>
                        </div>
                        <div class="mt-3 flex flex-wrap gap-1.5">
                            <Badge
                                v-for="entitlement in props.access
                                    .requiredEntitlements ?? []"
                                :key="entitlement"
                                variant="outline"
                            >
                                {{ entitlementLabel(entitlement) }}
                            </Badge>
                            <span
                                v-if="
                                    (props.access.requiredEntitlements ?? [])
                                        .length === 0
                                "
                                class="text-sm text-muted-foreground"
                            >
                                Required entitlement was not provided.
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70">
                    <CardContent class="p-4">
                        <p class="text-sm font-medium">Missing access</p>
                        <div class="mt-3 flex flex-wrap gap-1.5">
                            <Badge
                                v-for="entitlement in props.access
                                    .missingEntitlements ?? []"
                                :key="entitlement"
                                variant="destructive"
                            >
                                {{ entitlementLabel(entitlement) }}
                            </Badge>
                            <span
                                v-if="
                                    (props.access.missingEntitlements ?? [])
                                        .length === 0
                                "
                                class="text-sm text-muted-foreground"
                            >
                                Activate or update the facility subscription.
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Alert v-if="!canOpenFacilityConfig" class="rounded-lg">
                <AppIcon name="info" class="size-4" />
                <AlertTitle>Administrator action needed</AlertTitle>
                <AlertDescription>
                    Contact a facility administrator to activate the
                    subscription or assign a plan that includes this service.
                </AlertDescription>
            </Alert>
        </div>
    </AppLayout>
</template>
