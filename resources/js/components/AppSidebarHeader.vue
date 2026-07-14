<script setup lang="ts">
import { router, usePage } from '@inertiajs/vue3';
import { ChevronsUpDown } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import AppSettingsDialog from '@/components/AppSettingsDialog.vue';
import Breadcrumbs from '@/components/Breadcrumbs.vue';
import GlobalPatientSearch from '@/components/GlobalPatientSearch.vue';
import OPDQuickCommandPalette from '@/components/OPDQuickCommandPalette.vue';
import UserInfo from '@/components/UserInfo.vue';
import UserMenuContent from '@/components/UserMenuContent.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useActiveRole } from '@/composables/useActiveRole';
import {
    clearScopeCookies,
    setScopeCookies,
    usePlatformAccess,
} from '@/composables/usePlatformAccess';
import { formatEnumLabel } from '@/lib/labels';
import {
    isOperationalFacilityScopePath,
    isPlatformAdminPath,
    normalizePlatformPath,
} from '@/lib/platformScopeRoutes';
import type { BreadcrumbItem } from '@/types';

withDefaults(
    defineProps<{
        breadcrumbs?: BreadcrumbItem[];
    }>(),
    {
        breadcrumbs: () => [],
    },
);

const isSettingsDialogOpen = ref(false);

const {
    scope,
    subscriptionAccess,
    hasUniversalAdminAccess,
} = usePlatformAccess();

const {
    activeRole,
    availableRoles,
    hasMultipleRoles,
    setActiveRole,
} = useActiveRole();

const page = usePage();
const user = page.props.auth?.user ?? null;

const currentPath = computed(() => normalizePlatformPath(page.url));

const isPlatformAdminPage = computed(() =>
    isPlatformAdminPath(currentPath.value),
);

const isOperationalPage = computed(() =>
    isOperationalFacilityScopePath(currentPath.value),
);

const accessibleFacilities = computed(() => {
    const facilities = scope.value?.userAccess?.facilities ?? [];
    const scopedFacility = scope.value?.facility;
    const scopedTenant = scope.value?.tenant;
    const merged = [...facilities];

    if (scopedFacility?.code && scopedTenant?.code) {
        const alreadyListed = merged.some((entry) =>
            String(entry.tenantCode ?? '').trim().toUpperCase() === String(scopedTenant.code ?? '').trim().toUpperCase()
            && String(entry.code ?? '').trim().toUpperCase() === String(scopedFacility.code ?? '').trim().toUpperCase(),
        );

        if (!alreadyListed) {
            merged.unshift({
                ...scopedFacility,
                tenantId: scopedTenant.id,
                tenantCode: scopedTenant.code,
                tenantName: scopedTenant.name,
            });
        }
    }

    return merged
        .map((entry) => {
            const tenantCode = String(entry.tenantCode ?? '').trim().toUpperCase();
            const facilityCode = String(entry.code ?? '').trim().toUpperCase();
            if (!tenantCode || !facilityCode) return null;
            return {
                key: `${tenantCode}|${facilityCode}`,
                tenantCode,
                facilityCode,
                facilityName: String(entry.name ?? '').trim() || 'Facility',
                tenantName: String(entry.tenantName ?? '').trim() || tenantCode,
                isPrimary: Boolean(entry.isPrimary),
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((left, right) => {
            if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;

            return `${left.tenantCode}${left.facilityCode}`.localeCompare(`${right.tenantCode}${right.facilityCode}`);
        });
});

const selectedScopeKey = computed(() => {
    const tenantCode = String(scope.value?.tenant?.code ?? '').trim().toUpperCase();
    const facilityCode = String(scope.value?.facility?.code ?? '').trim().toUpperCase();

    if (!tenantCode || !facilityCode) return 'auto';

    return `${tenantCode}|${facilityCode}`;
});

const hasSelectedFacility = computed(() => Boolean(scope.value?.facility?.code));

const scopeMode = computed(() => {
    if (hasSelectedFacility.value) {
        return {
            label: 'Working facility',
            description: 'Facility-scoped data',
            variant: 'secondary' as const,
        };
    }

    if (hasUniversalAdminAccess.value && isPlatformAdminPage.value) {
        return {
            label: 'Global admin',
            description: 'Platform-wide administration',
            variant: 'outline' as const,
        };
    }

    if (isOperationalPage.value) {
        return {
            label: 'Facility required',
            description: 'Choose a facility',
            variant: 'destructive' as const,
        };
    }

    return {
        label: hasUniversalAdminAccess.value ? 'All facilities' : 'No facility',
        description: hasUniversalAdminAccess.value ? 'Platform-wide access' : 'No active facility scope',
        variant: 'outline' as const,
    };
});

const facilityTriggerLabel = computed(() => {
    const facilityCode = String(scope.value?.facility?.code ?? '').trim().toUpperCase();
    if (facilityCode) return facilityCode;
    if (hasUniversalAdminAccess.value && isPlatformAdminPage.value) return 'Global admin mode';
    if (hasUniversalAdminAccess.value) return 'All facilities';

    return 'Select facility';
});

const facilityTriggerMeta = computed(() => {
    const count = accessibleFacilities.value.length;
    if (hasSelectedFacility.value) {
        const facilityCode = String(scope.value?.facility?.code ?? '').trim().toUpperCase();
        const planName = String(subscriptionAccess.value?.subscription?.planName ?? '').trim();
        const status = String(subscriptionAccess.value?.subscription?.status ?? '').trim();
        const accessState = String(subscriptionAccess.value?.accessState ?? '').trim();
        const planLabel = planName
            ? `${planName}${status ? ` / ${formatEnumLabel(status)}` : ''}`
            : accessState
                ? formatEnumLabel(accessState)
                : 'Facility scope';

        return [facilityCode, planLabel].filter(Boolean).join(' | ');
    }
    if (hasUniversalAdminAccess.value && isPlatformAdminPage.value) return 'All facilities visible';
    if (count === 0) return 'No facilities available';
    if (count === 1) return '1 facility';

    return `${count} facilities available`;
});

function selectScope(key: string) {
    if (key === selectedScopeKey.value) return;

    if (key === 'auto') {
        clearScopeCookies();
        router.reload({ preserveScroll: false, preserveState: false });
        return;
    }
    const [tenantCodeRaw, facilityCodeRaw] = key.split('|');
    const tenantCode = tenantCodeRaw?.trim().toUpperCase() ?? '';
    const facilityCode = facilityCodeRaw?.trim().toUpperCase() ?? '';
    if (tenantCode && facilityCode) {
        setScopeCookies(tenantCode, facilityCode);
        router.reload({ preserveScroll: false, preserveState: false });
    }
}
</script>

<template>
    <header
        class="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border/70 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4"
    >
        <div class="flex min-w-0 items-center gap-2 overflow-hidden">
            <SidebarTrigger />
            <template v-if="breadcrumbs && breadcrumbs.length > 0">
                <Breadcrumbs :breadcrumbs="breadcrumbs" />
            </template>
        </div>

        <div class="flex min-w-0 items-center gap-2">
            <DropdownMenu v-if="hasUniversalAdminAccess">
                <DropdownMenuTrigger as-child>
                    <Button
                        id="app-facility-scope-trigger"
                        variant="ghost"
                        size="sm"
                        class="h-9 max-w-[340px] gap-2 px-2.5 font-normal text-muted-foreground"
                    >
                        <AppIcon name="building-2" class="size-3.5 shrink-0" />
                        <Badge :variant="scopeMode.variant" class="hidden shrink-0 px-1.5 py-0 text-[10px] font-medium sm:inline-flex">
                            {{ scopeMode.label }}
                        </Badge>
                        <span class="hidden max-w-[170px] truncate text-left sm:inline">{{ facilityTriggerLabel }}</span>
                        <span class="sm:hidden">Facility</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-[320px]">
                    <DropdownMenuLabel class="space-y-0.5">
                        <span class="flex items-center justify-between gap-2">
                            <span class="text-sm font-medium">Facility scope</span>
                            <Badge :variant="scopeMode.variant" class="px-1.5 py-0 text-[10px] font-medium">
                                {{ scopeMode.label }}
                            </Badge>
                        </span>
                        <span class="block text-xs font-normal text-muted-foreground">{{ scopeMode.description }} | {{ facilityTriggerMeta }}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        class="cursor-pointer text-sm"
                        :class="{ 'bg-accent': selectedScopeKey === 'auto' }"
                        @select="selectScope('auto')"
                    >
                        <div class="flex min-w-0 items-center gap-2">
                            <AppIcon :name="hasUniversalAdminAccess ? 'shield-check' : 'refresh-cw'" class="size-3.5 shrink-0 text-muted-foreground" />
                            <div class="min-w-0">
                                <p class="text-sm font-medium">{{ hasUniversalAdminAccess ? 'Global admin / all facilities' : 'Auto-resolve' }}</p>
                                <p class="text-xs text-muted-foreground">
                                    {{ hasUniversalAdminAccess ? 'Use platform-wide scope where pages support it.' : 'Use your primary assigned facility.' }}
                                </p>
                            </div>
                        </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        v-if="accessibleFacilities.length === 0"
                        disabled
                        class="text-sm text-muted-foreground"
                    >
                        No active facility assignments.
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        v-for="facility in accessibleFacilities"
                        :key="facility.key"
                        class="cursor-pointer text-sm"
                        :class="{ 'bg-accent': selectedScopeKey === facility.key }"
                        @select="selectScope(facility.key)"
                    >
                        <div class="flex min-w-0 items-center gap-2">
                            <AppIcon name="map-pin" class="size-3.5 shrink-0 text-muted-foreground" />
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium">{{ facility.facilityName }}</p>
                                <p class="truncate text-xs text-muted-foreground">
                                    {{ facility.facilityCode }}{{ facility.isPrimary ? ' | Primary facility' : '' }}
                                </p>
                            </div>
                        </div>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <OPDQuickCommandPalette variant="ghost" />

            <Separator orientation="vertical" class="mx-1 !h-6" />

            <div class="hidden md:flex">
                <GlobalPatientSearch variant="ghost" />
            </div>

            <div class="md:hidden">
                <GlobalPatientSearch variant="ghost" />
            </div>

            <Separator orientation="vertical" class="mx-1 !h-6" />

            <DropdownMenu v-if="hasMultipleRoles">
                <DropdownMenuTrigger as-child>
                    <Button
                        id="app-role-switch-trigger"
                        variant="ghost"
                        size="sm"
                        class="h-9 gap-2 px-2.5 font-normal text-muted-foreground"
                    >
                        <AppIcon name="user" class="size-3.5 shrink-0" />
                        <span class="hidden max-w-[130px] truncate text-left sm:inline">{{ activeRole?.label ?? 'All access' }}</span>
                        <span class="sm:hidden">Role</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-[240px]">
                    <DropdownMenuLabel class="space-y-0.5">
                        <span class="text-sm font-medium">Active role</span>
                        <span class="block text-xs font-normal text-muted-foreground">Show sidebar for selected role</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        class="cursor-pointer text-sm"
                        :class="{ 'bg-accent': !activeRole }"
                        @select="setActiveRole(null)"
                    >
                        <div class="flex min-w-0 items-center gap-2">
                            <AppIcon name="layout-grid" class="size-3.5 shrink-0 text-muted-foreground" />
                            <div class="min-w-0">
                                <p class="text-sm font-medium">All access</p>
                                <p class="text-xs text-muted-foreground">Show all available modules</p>
                            </div>
                        </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        v-for="role in availableRoles"
                        :key="role.code"
                        class="cursor-pointer text-sm"
                        :class="{ 'bg-accent': activeRole?.code === role.code }"
                        @select="setActiveRole(role.code)"
                    >
                        <div class="flex min-w-0 items-center gap-2">
                            <AppIcon name="shield-check" class="size-3.5 shrink-0 text-muted-foreground" />
                            <div class="min-w-0">
                                <p class="text-sm font-medium">{{ role.label }}</p>
                                <p class="text-xs text-muted-foreground">{{ role.code }}</p>
                            </div>
                        </div>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu v-if="user">
                <DropdownMenuTrigger as-child>
                    <Button
                        variant="ghost"
                        size="sm"
                        class="h-9 gap-2 px-2 font-normal text-muted-foreground"
                    >
                        <UserInfo :user="user" hide-avatar />
                        <ChevronsUpDown class="size-4 shrink-0 text-muted-foreground/50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    class="w-(--reka-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                    align="end"
                    :side-offset="4"
                >
                    <UserMenuContent
                        :user="user"
                        @open-settings="isSettingsDialogOpen = true"
                    />
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </header>
    <AppSettingsDialog v-model:open="isSettingsDialogOpen" />
</template>
