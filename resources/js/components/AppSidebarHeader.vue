<script setup lang="ts">
import { computed } from 'vue';
import Breadcrumbs from '@/components/Breadcrumbs.vue';
import OPDQuickCommandPalette from '@/components/OPDQuickCommandPalette.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
    clearScopeCookies,
    setScopeCookies,
    usePlatformAccess,
} from '@/composables/usePlatformAccess';
import type { BreadcrumbItem } from '@/types';

withDefaults(
    defineProps<{
        breadcrumbs?: BreadcrumbItem[];
    }>(),
    {
        breadcrumbs: () => [],
    },
);

const {
    scope,
} = usePlatformAccess();

const accessibleFacilities = computed(() => {
    const facilities = scope.value?.userAccess?.facilities ?? [];
    return facilities
        .map((entry) => {
            const tenantCode = String(entry.tenantCode ?? '').trim().toUpperCase();
            const facilityCode = String(entry.code ?? '').trim().toUpperCase();
            if (!tenantCode || !facilityCode) return null;
            return {
                key: `${tenantCode}|${facilityCode}`,
                tenantCode,
                facilityCode,
                facilityName: String(entry.name ?? '').trim() || 'Facility',
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
});

const selectedScopeKey = computed(() => {
    const tenantCode = String(scope.value?.tenant?.code ?? '').trim().toUpperCase();
    const facilityCode = String(scope.value?.facility?.code ?? '').trim().toUpperCase();

    if (!tenantCode || !facilityCode) return 'auto';

    return `${tenantCode}|${facilityCode}`;
});

const facilityTriggerLabel = computed(() => {
    if (!scope.value) return 'Scope unavailable';
    if (scope.value.resolvedFrom === 'none') return 'Scope unresolved';
    const facility = scope.value.facility;
    if (facility?.name && facility?.code) return `${facility.name} (${facility.code})`;
    const tenant = scope.value.tenant;
    if (tenant?.name && tenant?.code) return `${tenant.name} (${tenant.code})`;
    return 'Scope ready';
});

function selectScope(key: string) {
    if (key === 'auto') {
        clearScopeCookies();
        window.location.reload();
        return;
    }
    const [tenantCodeRaw, facilityCodeRaw] = key.split('|');
    const tenantCode = tenantCodeRaw?.trim().toUpperCase() ?? '';
    const facilityCode = facilityCodeRaw?.trim().toUpperCase() ?? '';
    if (tenantCode && facilityCode) {
        setScopeCookies(tenantCode, facilityCode);
        window.location.reload();
    }
}
</script>

<template>
    <header
        class="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/70 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4"
    >
        <div class="flex items-center gap-2">
            <SidebarTrigger class="-ml-1" />
            <template v-if="breadcrumbs && breadcrumbs.length > 0">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />
            </template>
        </div>
        <div class="ml-auto flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger as-child>
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-9 min-w-[200px] gap-2 font-normal text-muted-foreground"
                    >
                        <span class="hidden truncate max-w-[140px] sm:inline">{{ facilityTriggerLabel }}</span>
                        <span class="sm:hidden">Facility</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="min-w-[200px]">
                    <DropdownMenuLabel class="text-sm font-medium">Active facility</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        class="cursor-pointer text-sm"
                        :class="{ 'bg-accent': selectedScopeKey === 'auto' }"
                        @select="selectScope('auto')"
                    >
                        Auto-resolve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        v-for="facility in accessibleFacilities"
                        :key="facility.key"
                        class="cursor-pointer text-sm"
                        :class="{ 'bg-accent': selectedScopeKey === facility.key }"
                        @select="selectScope(facility.key)"
                    >
                        {{ facility.tenantCode }} / {{ facility.facilityCode }} - {{ facility.facilityName }}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <OPDQuickCommandPalette />
        </div>
    </header>
</template>

