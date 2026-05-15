<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { formatEnumLabel } from '@/lib/labels';
import { hasRouteAccess } from '@/lib/routeAccess';

const { subscriptionAccess, permissionNames, hasUniversalAdminAccess } =
    usePlatformAccess();

const showBanner = computed(() => {
    if (hasUniversalAdminAccess.value) return false;
    const s = subscriptionAccess.value;
    if (!s) return false;
    if (
        s.accessEnabled === true &&
        (s.accessState === 'enabled' || s.accessState === null)
    ) {
        return false;
    }
    return s.accessState !== 'guest';
});

const variant = computed(() => {
    const state = subscriptionAccess.value?.accessState;
    if (state === 'restricted' || state === 'pending')
        return 'destructive' as const;
    return 'default' as const;
});

const title = computed(() => {
    const code = subscriptionAccess.value?.code;
    if (code === 'FACILITY_SUBSCRIPTION_REQUIRED')
        return 'Facility subscription not configured';
    if (code === 'FACILITY_SUBSCRIPTION_EXPIRED')
        return 'Subscription period ended';
    if (code === 'FACILITY_SUBSCRIPTION_RESTRICTED')
        return 'Subscription is restricted';
    if (
        code === 'SUBSCRIPTION_TABLES_UNAVAILABLE' ||
        code === 'SUBSCRIPTION_ACCESS_UNAVAILABLE'
    ) {
        return 'Subscription status unavailable';
    }
    return 'Subscription access limited';
});

const description = computed(
    () =>
        subscriptionAccess.value?.message ||
        'Some modules may be unavailable until the facility subscription is active and aligned with your service plan.',
);

const planLabel = computed(() => {
    const subscription = subscriptionAccess.value?.subscription;
    if (!subscription?.planName) return null;

    const status = subscription.status
        ? formatEnumLabel(String(subscription.status))
        : null;
    return status
        ? `${subscription.planName} / ${status}`
        : subscription.planName;
});

const canOpenFacilityConfig = computed(() =>
    hasRouteAccess(
        '/platform/admin/facility-config',
        permissionNames.value,
        hasUniversalAdminAccess.value,
    ),
);
</script>

<template>
    <div
        v-if="showBanner"
        role="status"
        aria-live="polite"
        :class="
            variant === 'destructive'
                ? 'border-destructive/20 bg-destructive/5 text-foreground shadow-sm shadow-destructive/5'
                : 'border-amber-200/80 bg-amber-50/85 text-amber-950 shadow-sm shadow-amber-950/5 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-50'
        "
        class="rounded-lg border px-3 py-2.5"
    >
        <div
            class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
        >
            <div
                class="flex min-w-0 items-start gap-2.5 md:flex-1 md:items-center"
            >
                <span
                    :class="
                        variant === 'destructive'
                            ? 'border-destructive/20 bg-background text-destructive'
                            : 'border-amber-300/70 bg-background/75 text-amber-700 dark:border-amber-800/70 dark:text-amber-300'
                    "
                    class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border md:mt-0"
                >
                    <AppIcon name="receipt" class="size-4" />
                </span>

                <div
                    class="min-w-0 md:flex md:flex-1 md:items-center md:gap-2.5"
                >
                    <p
                        class="shrink-0 text-sm leading-5 font-semibold text-foreground"
                    >
                        {{ title }}
                    </p>
                    <p
                        class="min-w-0 text-sm leading-5 text-muted-foreground md:flex-1 md:truncate"
                        :title="description"
                    >
                        {{ description }}
                    </p>
                    <span
                        v-if="planLabel"
                        class="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background/80 px-2 py-1 text-xs font-medium text-foreground shadow-sm md:mt-0 md:shrink-0"
                    >
                        <span class="text-muted-foreground">Plan</span>
                        <span class="min-w-0 truncate">{{ planLabel }}</span>
                    </span>
                </div>
            </div>

            <Button
                v-if="canOpenFacilityConfig"
                variant="outline"
                size="sm"
                class="h-8 shrink-0"
                as-child
            >
                <Link href="/platform/admin/facility-config"
                    >Facility configuration</Link
                >
            </Button>
        </div>
    </div>
</template>
