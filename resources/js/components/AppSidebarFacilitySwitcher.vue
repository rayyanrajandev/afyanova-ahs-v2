<script setup lang="ts">
import { router, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
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

const { scope, subscriptionAccess, hasUniversalAdminAccess } =
    usePlatformAccess();
const page = usePage();

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
        const alreadyListed = merged.some(
            (entry) =>
                String(entry.tenantCode ?? '')
                    .trim()
                    .toUpperCase() ===
                    String(scopedTenant.code ?? '')
                        .trim()
                        .toUpperCase() &&
                String(entry.code ?? '')
                    .trim()
                    .toUpperCase() ===
                    String(scopedFacility.code ?? '')
                        .trim()
                        .toUpperCase(),
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
            const tenantCode = String(entry.tenantCode ?? '')
                .trim()
                .toUpperCase();
            const facilityCode = String(entry.code ?? '')
                .trim()
                .toUpperCase();
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
            if (left.isPrimary !== right.isPrimary)
                return left.isPrimary ? -1 : 1;

            return `${left.tenantCode}${left.facilityCode}`.localeCompare(
                `${right.tenantCode}${right.facilityCode}`,
            );
        });
});

const selectedScopeKey = computed(() => {
    const tenantCode = String(scope.value?.tenant?.code ?? '')
        .trim()
        .toUpperCase();
    const facilityCode = String(scope.value?.facility?.code ?? '')
        .trim()
        .toUpperCase();

    if (!tenantCode || !facilityCode) return 'auto';

    return `${tenantCode}|${facilityCode}`;
});

const hasSelectedFacility = computed(() =>
    Boolean(scope.value?.facility?.code),
);

const scopeMode = computed(() => {
    if (hasSelectedFacility.value) {
        return {
            label: 'Facility',
            description: 'Facility-scoped data',
            variant: 'secondary' as const,
        };
    }

    if (hasUniversalAdminAccess.value && isPlatformAdminPage.value) {
        return {
            label: 'Global',
            description: 'Platform-wide administration',
            variant: 'outline' as const,
        };
    }

    if (isOperationalPage.value) {
        return {
            label: 'Required',
            description: 'Choose a facility',
            variant: 'destructive' as const,
        };
    }

    return {
        label: hasUniversalAdminAccess.value ? 'All' : 'None',
        description: hasUniversalAdminAccess.value
            ? 'Platform-wide access'
            : 'No active facility scope',
        variant: 'outline' as const,
    };
});

const facilityTriggerLabel = computed(() => {
    const facilityCode = String(scope.value?.facility?.code ?? '')
        .trim()
        .toUpperCase();
    if (facilityCode) return facilityCode;
    if (hasUniversalAdminAccess.value && isPlatformAdminPage.value) {
        return 'Global admin';
    }
    if (hasUniversalAdminAccess.value) return 'All facilities';

    return 'Select facility';
});

const facilityTriggerMeta = computed(() => {
    const count = accessibleFacilities.value.length;
    if (hasSelectedFacility.value) {
        const planName = String(
            subscriptionAccess.value?.subscription?.planName ?? '',
        ).trim();
        const status = String(
            subscriptionAccess.value?.subscription?.status ?? '',
        ).trim();
        const accessState = String(
            subscriptionAccess.value?.accessState ?? '',
        ).trim();
        const planLabel = planName
            ? `${planName}${status ? ` / ${formatEnumLabel(status)}` : ''}`
            : accessState
              ? formatEnumLabel(accessState)
              : 'Facility scope';

        return planLabel;
    }
    if (hasUniversalAdminAccess.value && isPlatformAdminPage.value) {
        return 'All facilities visible';
    }
    if (count === 0) return 'No facilities available';
    if (count === 1) return '1 facility';

    return `${count} facilities available`;
});

const switcherOpen = ref(false);

function selectScope(key: string) {
    switcherOpen.value = false;

    if (key === selectedScopeKey.value) return;

    if (key === 'auto') {
        clearScopeCookies();
        router.reload();
        return;
    }

    const [tenantCodeRaw, facilityCodeRaw] = key.split('|');
    const tenantCode = tenantCodeRaw?.trim().toUpperCase() ?? '';
    const facilityCode = facilityCodeRaw?.trim().toUpperCase() ?? '';

    if (tenantCode && facilityCode) {
        setScopeCookies(tenantCode, facilityCode);
        router.reload();
    }
}
</script>

<template>
    <Popover v-model:open="switcherOpen">
        <PopoverTrigger as-child>
            <button
                type="button"
                class="mx-2 flex min-h-9 items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2 py-1.5 text-left text-sidebar-foreground transition-colors group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 hover:bg-sidebar-accent"
                title="Switch facility"
            >
                <AppIcon name="building-2" class="size-4 shrink-0" />
                <span
                    class="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"
                >
                    <span class="block truncate text-xs font-medium">
                        {{ facilityTriggerLabel }}
                    </span>
                    <span
                        class="block truncate text-[11px] text-muted-foreground"
                    >
                        {{ facilityTriggerMeta }}
                    </span>
                </span>
                <Badge
                    :variant="scopeMode.variant"
                    class="shrink-0 px-1.5 py-0 text-[10px] group-data-[collapsible=icon]:hidden"
                >
                    {{ scopeMode.label }}
                </Badge>
            </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="right" class="w-[320px] p-0">
            <div class="space-y-0.5 px-3 pt-3 pb-2">
                <span class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium">Facility scope</span>
                    <Badge
                        :variant="scopeMode.variant"
                        class="px-1.5 py-0 text-[10px] font-medium"
                    >
                        {{ scopeMode.label }}
                    </Badge>
                </span>
                <span class="block text-xs font-normal text-muted-foreground">
                    {{ scopeMode.description }} | {{ facilityTriggerMeta }}
                </span>
            </div>
            <Command class="rounded-t-none border-t">
                <CommandInput placeholder="Search facilities..." />
                <CommandList>
                    <CommandEmpty>No matching facility found.</CommandEmpty>
                    <CommandGroup>
                        <CommandItem
                            value="auto-resolve global admin all facilities primary default"
                            class="cursor-pointer"
                            :class="{
                                'bg-accent': selectedScopeKey === 'auto',
                            }"
                            @select="selectScope('auto')"
                        >
                            <div class="flex min-w-0 items-center gap-2">
                                <AppIcon
                                    :name="
                                        hasUniversalAdminAccess
                                            ? 'shield-check'
                                            : 'refresh-cw'
                                    "
                                    class="size-3.5 shrink-0 text-muted-foreground"
                                />
                                <div class="min-w-0">
                                    <p class="text-sm font-medium">
                                        {{
                                            hasUniversalAdminAccess
                                                ? 'Global admin / all facilities'
                                                : 'Auto-resolve'
                                        }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            hasUniversalAdminAccess
                                                ? 'Use platform-wide scope where pages support it.'
                                                : 'Use your primary assigned facility.'
                                        }}
                                    </p>
                                </div>
                            </div>
                        </CommandItem>
                    </CommandGroup>
                    <div
                        v-if="accessibleFacilities.length === 0"
                        class="px-2 py-1.5 text-sm text-muted-foreground"
                    >
                        No active facility assignments.
                    </div>
                    <CommandGroup
                        v-if="accessibleFacilities.length > 0"
                        heading="Facilities"
                    >
                        <CommandItem
                            v-for="facility in accessibleFacilities"
                            :key="facility.key"
                            :value="`${facility.facilityName} ${facility.facilityCode} ${facility.tenantName} ${facility.tenantCode}`"
                            class="cursor-pointer"
                            :class="{
                                'bg-accent': selectedScopeKey === facility.key,
                            }"
                            @select="selectScope(facility.key)"
                        >
                            <div class="flex min-w-0 items-center gap-2">
                                <AppIcon
                                    name="map-pin"
                                    class="size-3.5 shrink-0 text-muted-foreground"
                                />
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-medium">
                                        {{ facility.facilityName }}
                                    </p>
                                    <p
                                        class="truncate text-xs text-muted-foreground"
                                    >
                                        {{ facility.facilityCode
                                        }}{{
                                            facility.isPrimary
                                                ? ' | Primary facility'
                                                : ''
                                        }}
                                    </p>
                                </div>
                            </div>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </PopoverContent>
    </Popover>
</template>
