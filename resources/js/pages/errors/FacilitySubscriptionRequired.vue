<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
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
        <div
            class="flex min-h-full flex-1 items-center justify-center p-4 md:p-8"
        >
            <Card
                class="w-full max-w-4xl rounded-lg border-sidebar-border/70 shadow-sm"
            >
                <CardContent class="p-0">
                    <div class="border-b bg-muted/20 px-5 py-4 md:px-6">
                        <div
                            class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                        >
                            <div class="flex min-w-0 items-start gap-3">
                                <span
                                    class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground"
                                >
                                    <AppIcon name="receipt" class="size-5" />
                                </span>
                                <div class="min-w-0">
                                    <div
                                        class="mb-1 flex flex-wrap items-center gap-2"
                                    >
                                        <Badge
                                            variant="outline"
                                            class="rounded-md"
                                            >Plan access</Badge
                                        >
                                        <Badge
                                            variant="destructive"
                                            class="rounded-md"
                                            >{{ statusLabel }}</Badge
                                        >
                                    </div>
                                    <h1
                                        class="text-lg leading-6 font-semibold text-foreground"
                                    >
                                        Not included in this facility's plan
                                    </h1>
                                    <p
                                        class="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground"
                                    >
                                        {{ accessMessage }}
                                    </p>
                                </div>
                            </div>

                            <div class="flex shrink-0 flex-wrap gap-2">
                                <Button variant="outline" as-child>
                                    <Link href="/dashboard">Dashboard</Link>
                                </Button>
                                <Button v-if="canOpenFacilityConfig" as-child>
                                    <Link href="/platform/admin/facility-config"
                                        >Facility configuration</Link
                                    >
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-4 p-5 md:p-6">
                        <div class="grid gap-2 md:grid-cols-3">
                            <div
                                class="rounded-lg border bg-background px-3 py-2.5"
                            >
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
                            </div>
                            <div
                                class="rounded-lg border bg-background px-3 py-2.5"
                            >
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
                            </div>
                            <div
                                class="rounded-lg border bg-background px-3 py-2.5"
                            >
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
                            </div>
                        </div>

                        <div class="grid gap-3 md:grid-cols-2">
                            <div class="rounded-lg border p-3">
                                <div
                                    class="flex items-center justify-between gap-3"
                                >
                                    <p class="text-sm font-medium">
                                        Required access
                                    </p>
                                    <Badge
                                        v-if="
                                            (
                                                props.access
                                                    .requiredEntitlements ?? []
                                            ).length > 1
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
                                            (
                                                props.access
                                                    .requiredEntitlements ?? []
                                            ).length === 0
                                        "
                                        class="text-sm text-muted-foreground"
                                    >
                                        Required entitlement was not provided.
                                    </span>
                                </div>
                            </div>

                            <div class="rounded-lg border p-3">
                                <p class="text-sm font-medium">
                                    Missing access
                                </p>
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
                                            (
                                                props.access
                                                    .missingEntitlements ?? []
                                            ).length === 0
                                        "
                                        class="text-sm text-muted-foreground"
                                    >
                                        Activate or update the facility
                                        subscription.
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p
                            v-if="!canOpenFacilityConfig"
                            class="text-sm text-muted-foreground"
                        >
                            Contact a facility administrator to activate the
                            subscription or assign a plan that includes this
                            service.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    </AppLayout>
</template>
