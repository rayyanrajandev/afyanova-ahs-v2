<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import NavMain from '@/components/NavMain.vue';
import NavUser from '@/components/NavUser.vue';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarInput,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { useActiveRole } from '@/composables/useActiveRole';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useSidebarBadges } from '@/composables/useSidebarBadges';
import { useSidebarFavorites } from '@/composables/useSidebarFavorites';

import {
    appNavCatalog,
    navSectionLabels,
    navSectionOrder,
    navSectionIcons,
    navSubGroupLabels,
    navSubGroupIcons,
    type NavSectionKey,
} from '@/config/appNavCatalog';
import { setModulePathRules } from '@/config/facilityPageEntitlements';
import { filterSidebarNavCatalogItems } from '@/lib/routeAccess';
import { dashboard } from '@/routes';
import { type NavItem } from '@/types';
import AppLogo from './AppLogo.vue';

type NavSection = {
    key: NavSectionKey;
    label: string;
    items: NavItem[];
};

const { permissionNames, hasUniversalAdminAccess, facilityEntitlementNames } =
    usePlatformAccess();
const { toggleFavorite, getFavorites } = useSidebarFavorites();
const { activeSections } = useActiveRole();

const { badges } = useSidebarBadges();

const BADGE_HREF_MAP: Record<string, string> = {
    '/reception/queue': 'reception-queue',
    '/triage/queue': 'triage-queue',
    '/clinician/queue': 'clinician-queue',
    '/emergency/queue': 'emergency-queue',
    '/clinical-procedure-orders': 'clinical-procedure',
    '/laboratory-orders': 'laboratory',
    '/radiology-orders': 'radiology',
    '/pharmacy-orders': 'pharmacy',
    '/billing': 'billing',
};

const BADGE_CLASS_MAP: Record<string, string> = {
    'reception-queue': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'triage-queue': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'clinician-queue': 'bg-red-500/10 text-red-600 dark:text-red-400',
    'emergency-queue': 'bg-red-500/10 text-red-600 dark:text-red-400',
    laboratory: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    radiology: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    pharmacy: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    'billing': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

function badgeForHref(href: string): number | undefined {
    const key = BADGE_HREF_MAP[href];
    if (!key) return undefined;
    const count = badges.value[key];
    return count && count > 0 ? count : undefined;
}

function badgeClassForHref(href: string): string | undefined {
    const key = BADGE_HREF_MAP[href];
    if (!key) return undefined;
    const count = badges.value[key];
    if (!count || count <= 0) return undefined;
    return BADGE_CLASS_MAP[key];
}

const searchQuery = ref('');

const permissionsLoaded = computed(
    () => hasUniversalAdminAccess.value || permissionNames.value !== null,
);
const resolvedPermissionNames = computed(() => permissionNames.value ?? []);

// Populate module-derived facility path rules from the module registry (config/modules.php).
{
    const rules = (usePage().props.facilityPathRules ?? []) as {
        path_prefix: string;
        required_all?: string[];
        required_any?: string[];
    }[];
    setModulePathRules(
        rules.map((r) => ({
            pathPrefix: r.path_prefix,
            ...(r.required_all ? { requiredAll: r.required_all } : {}),
            ...(r.required_any ? { requiredAny: r.required_any } : {}),
        })),
    );
}

const moduleNavItems = computed(() =>
    ((usePage().props.moduleNavCatalog ?? []) as {
        title: string;
        href: string;
        icon: string;
        section: string;
        sub_group?: string;
        permission_prefixes: string[];
        help_note?: string;
    }[]).map((item) => ({
        id: `module:${item.href}`,
        title: item.title,
        href: item.href,
        iconName: item.icon,
        section: item.section as NavSectionKey,
        subGroup: item.sub_group,
        permissionPrefixes: item.permission_prefixes,
        helpNote: item.help_note,
    })),
);

const visibleNavItems = computed(() =>
    filterSidebarNavCatalogItems(
        [...appNavCatalog, ...moduleNavItems.value],
        resolvedPermissionNames.value,
        hasUniversalAdminAccess.value,
        facilityEntitlementNames.value,
    ),
);

const roleFilteredNavItems = computed(() => {
    const items = visibleNavItems.value;
    if (!activeSections.value) return items;
    const allowed = new Set(activeSections.value);
    return items.filter((item) => allowed.has(item.section));
});

const homeItems = computed<NavItem[]>(() => [
    {
        id: 'dashboard',
        title: 'My Workspace',
        href: dashboard(),
        iconName: 'layout-grid',
    },
    {
        id: 'help-shortcuts',
        title: 'Help & shortcuts',
        href: '/help/shortcuts',
        iconName: 'book-open',
    },
]);

const allNavItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [];
    for (const key of navSectionOrder) {
        const sectionItems = roleFilteredNavItems.value
            .filter((item) => item.section === key)
            .map(({ id, title, href, iconName, section, subGroup }) => ({
                id: id ?? `${key}:${href}`,
                title,
                href,
                iconName,
                section,
                subGroup,
                subGroupLabel: subGroup
                    ? (navSubGroupLabels[section]?.[subGroup] ?? subGroup)
                    : undefined,
                subGroupIcon: subGroup
                    ? (navSubGroupIcons[section]?.[subGroup] ?? 'folder')
                    : undefined,
                badge: badgeForHref(href as string),
                badgeClass: badgeClassForHref(href as string),
            }));
        items.push(...sectionItems);
    }
    return items;
});

const favoriteItems = computed<NavItem[]>(() =>
    getFavorites(allNavItems.value),
);
const hasFavorites = computed(() => favoriteItems.value.length > 0);

const navSections = computed<NavSection[]>(() =>
    navSectionOrder
        .map((key) => ({
            key,
            label: navSectionLabels[key],
            items: roleFilteredNavItems.value
                .filter((item) => item.section === key)
                .map(({ id, title, href, iconName, section, subGroup }) => ({
                    id: id ?? `${key}:${href}`,
                    title,
                    href,
                    iconName,
                    section,
                    subGroup,
                    subGroupLabel: subGroup
                        ? (navSubGroupLabels[section]?.[subGroup] ?? subGroup)
                        : undefined,
                    subGroupIcon: subGroup
                        ? (navSubGroupIcons[section]?.[subGroup] ?? 'folder')
                        : undefined,
                    badge: badgeForHref(href as string),
                    badgeClass: badgeClassForHref(href as string),
                })),
        }))
        .filter((section) => section.items.length > 0),
);

function onToggleFavorite(item: NavItem) {
    if (item.id) toggleFavorite(item.id);
}

function onItemSelect(item: NavItem) {
    if (!item.id || typeof item.href !== 'string') return;

    emitSidebarNavigationEvent(item);
}

function emitSidebarNavigationEvent(item: NavItem) {
    if (typeof window === 'undefined' || typeof item.href !== 'string') return;

    const payload = {
        id: item.id ?? item.href,
        title: item.title,
        href: item.href,
        section: item.section ?? null,
        subGroup: item.subGroup ?? null,
    };

    window.dispatchEvent(
        new CustomEvent('afyanova:sidebar-navigation', {
            detail: payload,
        }),
    );

    const analyticsWindow = window as Window & {
        dataLayer?: Array<Record<string, unknown>>;
    };

    analyticsWindow.dataLayer?.push({
        event: 'sidebar_navigation_select',
        ...payload,
    });
}


function sectionHasMatches(key: NavSectionKey): boolean {
    if (!searchQuery.value) return true;
    const q = searchQuery.value.toLowerCase();
    return roleFilteredNavItems.value
        .filter((item) => item.section === key)
        .some((item) => item.title.toLowerCase().includes(q));
}
</script>

<template>
    <Sidebar collapsible="icon" variant="inset" aria-label="Main navigation">
        <SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg" as-child>
                        <Link :href="dashboard()">
                            <AppLogo />
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
            <!-- Nav search (hidden when collapsed) -->
            <SidebarGroup
                class="px-2 py-0 group-data-[collapsible=icon]:hidden"
            >
                <div class="relative px-1 py-1">
                    <AppIcon
                        name="search"
                        class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/50"
                    />
                    <SidebarInput
                        v-model="searchQuery"
                        placeholder="Search modules…"
                        class="h-8 pl-8 text-xs"
                    />
                </div>
            </SidebarGroup>

            <!-- Loading skeleton while permissions resolve -->
            <SidebarGroup v-if="!permissionsLoaded" class="px-2 py-0">
                <SidebarMenu>
                    <SidebarMenuSkeleton v-for="n in 5" :key="n" show-icon />
                </SidebarMenu>
            </SidebarGroup>

            <template v-else>
                <!-- Favorites section -->
                <NavMain
                    v-if="hasFavorites && !searchQuery"
                    :items="favoriteItems"
                    label="Favorites"
                    :show-favorites="false"
                    is-favorites-section
                    @item-select="onItemSelect"
                />

                <NavMain
                    :items="homeItems"
                    label="Home"
                    :search-query="searchQuery"
                    @item-select="onItemSelect"
                />

                <template v-for="section in navSections" :key="section.key">
                    <template v-if="sectionHasMatches(section.key)">
                        <!-- Section header: shows icon when collapsed, label when expanded -->
                        <SidebarGroup class="px-2 py-0">
                            <SidebarGroupLabel
                                class="pointer-events-none group-data-[collapsible=icon]:hidden"
                            >
                                {{ section.label }}
                            </SidebarGroupLabel>
                            <div
                                class="hidden size-8 items-center justify-center rounded-md text-muted-foreground group-data-[collapsible=icon]:flex"
                                :title="section.label"
                            >
                                <AppIcon
                                    :name="
                                        navSectionIcons[section.key] ??
                                        'layout-grid'
                                    "
                                    class="size-4 shrink-0"
                                />
                            </div>
                        </SidebarGroup>

                        <NavMain
                            :items="section.items"
                            :search-query="searchQuery"
                            :show-favorites="true"
                            @toggle-favorite="onToggleFavorite"
                            @item-select="onItemSelect"
                        />
                    </template>
                </template>


                <div
                    v-if="
                        searchQuery &&
                        !showLimitedAccessHint &&
                        !navSections.some((s) =>
                            s.items.some((i) =>
                                i.title
                                    .toLowerCase()
                                    .includes(searchQuery.toLowerCase()),
                            ),
                        )
                    "
                    class="mx-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
                >
                    No modules match "{{ searchQuery }}"
                </div>
            </template>
        </SidebarContent>

        <SidebarFooter class="gap-2">
            <NavUser />
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>
