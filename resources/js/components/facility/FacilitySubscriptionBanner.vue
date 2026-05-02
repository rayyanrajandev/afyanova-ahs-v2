<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { formatEnumLabel } from '@/lib/labels';
import { hasRouteAccess } from '@/lib/routeAccess';

const { subscriptionAccess, permissionNames, hasUniversalAdminAccess } = usePlatformAccess();

const showBanner = computed(() => {
    if (hasUniversalAdminAccess.value) return false;
    const s = subscriptionAccess.value;
    if (!s) return false;
    if (s.accessEnabled === true && (s.accessState === 'enabled' || s.accessState === null)) {
        return false;
    }
    return s.accessState !== 'guest';
});

const variant = computed(() => {
    const state = subscriptionAccess.value?.accessState;
    if (state === 'restricted' || state === 'pending') return 'destructive' as const;
    return 'default' as const;
});

const title = computed(() => {
    const code = subscriptionAccess.value?.code;
    if (code === 'FACILITY_SUBSCRIPTION_REQUIRED') return 'Facility subscription not configured';
    if (code === 'FACILITY_SUBSCRIPTION_EXPIRED') return 'Subscription period ended';
    if (code === 'FACILITY_SUBSCRIPTION_RESTRICTED') return 'Subscription is restricted';
    if (code === 'SUBSCRIPTION_TABLES_UNAVAILABLE' || code === 'SUBSCRIPTION_ACCESS_UNAVAILABLE') {
        return 'Subscription status unavailable';
    }
    return 'Subscription access limited';
});

const description = computed(
    () =>
        subscriptionAccess.value?.message ||
        'Some modules may be unavailable until the facility subscription is active and aligned with your service plan.',
);

const canOpenFacilityConfig = computed(() =>
    hasRouteAccess('/platform/admin/facility-config', permissionNames.value, hasUniversalAdminAccess.value),
);
</script>

<template>
    <Alert
        v-if="showBanner"
        :variant="variant"
        :class="
            variant === 'destructive'
                ? 'border-sidebar-border/80'
                : 'border-amber-200/80 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/30'
        "
    >
        <div class="flex items-start gap-3">
            <AppIcon name="receipt" class="mt-0.5 size-4 shrink-0 opacity-80" />
            <div class="min-w-0 flex-1 space-y-1">
                <AlertTitle class="text-sm">{{ title }}</AlertTitle>
                <AlertDescription class="text-xs leading-relaxed text-muted-foreground">
                    {{ description }}
                    <span v-if="subscriptionAccess?.subscription?.planName" class="mt-1 block font-medium text-foreground">
                        Current plan:
                        {{ subscriptionAccess.subscription.planName }}
                        <template v-if="subscriptionAccess.subscription?.status">
                            · {{ formatEnumLabel(String(subscriptionAccess.subscription.status)) }}
                        </template>
                    </span>
                </AlertDescription>
                <div v-if="canOpenFacilityConfig" class="pt-2">
                    <Button variant="outline" size="sm" class="h-8" as-child>
                        <Link href="/platform/admin/facility-config">Open facility configuration</Link>
                    </Button>
                </div>
            </div>
        </div>
    </Alert>
</template>
