<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import {
    isOperationalFacilityScopePath,
    normalizePlatformPath,
} from '@/lib/platformScopeRoutes';

const page = usePage();
const {
    scope,
    hasUniversalAdminAccess,
    multiTenantIsolationEnabled,
} = usePlatformAccess();

const currentPath = computed(() => normalizePlatformPath(page.url));
const facilityCode = computed(() => String(scope.value?.facility?.code ?? '').trim());
const accessibleFacilityCount = computed(() =>
    Number(scope.value?.userAccess?.accessibleFacilityCount ?? scope.value?.userAccess?.facilities?.length ?? 0),
);

const shouldShow = computed(() =>
    multiTenantIsolationEnabled.value
    && isOperationalFacilityScopePath(currentPath.value)
    && facilityCode.value === '',
);

const canOpenFacilitySwitcher = computed(() =>
    hasUniversalAdminAccess.value || accessibleFacilityCount.value > 0,
);

const noticeDescription = computed(() => {
    if (canOpenFacilitySwitcher.value) {
        return 'This workspace must run inside one facility so patient, billing, inventory, and staff records stay isolated. Select a facility before continuing.';
    }

    return 'No active facility assignment is available for this account. A platform administrator must create or assign a facility before operational work can continue.';
});

function openFacilitySwitcher(): void {
    if (typeof document === 'undefined') return;

    document.getElementById('app-facility-scope-trigger')?.click();
}
</script>

<template>
    <div v-if="shouldShow" class="border-b border-destructive/20 bg-destructive/5 px-4 py-3 md:px-6">
        <Alert variant="destructive" class="mx-auto max-w-screen-2xl border-destructive/30 bg-background/80">
            <AppIcon name="building-2" class="size-4" />
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <AlertTitle>Facility scope required</AlertTitle>
                        <Badge variant="destructive" class="px-1.5 py-0 text-[10px] font-medium">
                            Operational workspace
                        </Badge>
                    </div>
                    <AlertDescription>{{ noticeDescription }}</AlertDescription>
                </div>
                <div class="flex shrink-0 flex-wrap gap-2">
                    <Button
                        v-if="canOpenFacilitySwitcher"
                        type="button"
                        size="sm"
                        variant="outline"
                        class="bg-background"
                        @click="openFacilitySwitcher"
                    >
                        <AppIcon name="building-2" class="mr-1.5 size-3.5" />
                        Choose facility
                    </Button>
                    <Button
                        v-if="hasUniversalAdminAccess"
                        size="sm"
                        variant="outline"
                        class="bg-background"
                        as-child
                    >
                        <Link href="/platform/admin/facility-config">Facility configuration</Link>
                    </Button>
                </div>
            </div>
        </Alert>
    </div>
</template>
