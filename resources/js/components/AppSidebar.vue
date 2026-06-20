<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed, ref, onMounted } from 'vue';
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
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useSidebarFavorites } from '@/composables/useSidebarFavorites';
import { useSidebarHistory } from '@/composables/useSidebarHistory';
import {
    appNavCatalog,
    navSectionLabels,
    navSectionOrder,
    navSectionIcons,
    type NavSectionKey,
} from '@/config/appNavCatalog';
import { filterSidebarNavCatalogItems } from '@/lib/routeAccess';
import { dashboard } from '@/routes';
import { type NavItem } from '@/types';
import AppLogo from './AppLogo.vue';

type NavSection = {
    key: NavSectionKey;
    label: string;
    items: NavItem[];
};

const { permissionNames, hasUniversalAdminAccess, facilityEntitlementNames } = usePlatformAccess();
const { toggleFavorite, getFavorites } = useSidebarFavorites();
const { recentItems } = useSidebarHistory();

const permissionsLoaded = ref(false);

onMounted(() => {
    requestAnimationFrame(() => {
        permissionsLoaded.value = true;
    });
});

const resolvedPermissionNames = computed(() => permissionNames.value ?? []);

const visibleNavItems = computed(() =>
    filterSidebarNavCatalogItems(
        appNavCatalog,
        resolvedPermissionNames.value,
        hasUniversalAdminAccess.value,
        facilityEntitlementNames.value,
    ),
);

const searchQuery = ref('');

const homeItems = computed<NavItem[]>(() => [
    { id: 'dashboard', title: 'Dashboard', href: dashboard(), iconName: 'layout-grid' },
    { id: 'help-shortcuts', title: 'Help & shortcuts', href: '/help/shortcuts', iconName: 'book-open' },
]);

const allNavItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [];
    for (const key of navSectionOrder) {
        const sectionItems = visibleNavItems.value
            .filter((item) => item.section === key)
            .map(({ id, title, href, iconName }) => ({
                id: id ?? `${key}:${href}`,
                title,
                href,
                iconName,
            }));
        items.push(...sectionItems);
    }
    return items;
});

const favoriteItems = computed<NavItem[]>(() => getFavorites(allNavItems.value));
const hasFavorites = computed(() => favoriteItems.value.length > 0);

const navSections = computed<NavSection[]>(() =>
    navSectionOrder
        .map((key) => ({
            key,
            label: navSectionLabels[key],
            items: visibleNavItems.value
                .filter((item) => item.section === key)
                .map(({ id, title, href, iconName }) => ({
                    id: id ?? `${key}:${href}`,
                    title,
                    href,
                    iconName,
                })),
        }))
        .filter((section) => section.items.length > 0),
);

const showLimitedAccessHint = computed(
    () => !hasUniversalAdminAccess.value && visibleNavItems.value.length === 0,
);

function onToggleFavorite(item: NavItem) {
    if (item.id) toggleFavorite(item.id);
}

function sectionHasMatches(key: NavSectionKey): boolean {
    if (!searchQuery.value) return true;
    const q = searchQuery.value.toLowerCase();
    return visibleNavItems.value
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
            <!-- 1. Nav search -->
            <SidebarGroup class="px-2 py-0 group-data-[collapsible=icon]:hidden">
                <div class="relative px-1 py-1">
                    <AppIcon
                        name="search"
                        class="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
                    />
                    <SidebarInput
                        v-model="searchQuery"
                        placeholder="Search modules…"
                        class="h-8 pl-8 text-xs"
                    />
                </div>
            </SidebarGroup>

            <!-- 4. Loading skeleton while permissions resolve -->
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
                />

                <!-- 2. Recent history section -->
                <NavMain
                    v-if="recentItems.length > 0 && !searchQuery"
                    :items="recentItems as unknown as NavItem[]"
                    label="Recent"
                    :show-favorites="false"
                    is-favorites-section
                />

                <NavMain :items="homeItems" label="Home" :search-query="searchQuery" />

                <template v-for="section in navSections" :key="section.key">
                    <!-- Only show sections that have a match in search mode -->
                    <template v-if="sectionHasMatches(section.key)">
                        <!-- 3. Section header with icon in collapsed state -->
                        <SidebarGroup class="px-2 py-0">
                            <SidebarGroupLabel
                                class="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:text-sidebar-foreground hidden pointer-events-none"
                            >
                                <AppIcon
                                    :name="navSectionIcons[section.key] ?? 'layout-grid'"
                                    class="size-4 group-data-[collapsible=icon]:block hidden shrink-0"
                                />
                                <span class="group-data-[collapsible=icon]:hidden block text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                                    {{ section.label }}
                                </span>
                            </SidebarGroupLabel>
                        </SidebarGroup>

                        <NavMain
                            :items="section.items"
                            :search-query="searchQuery"
                            :show-favorites="true"
                            @toggle-favorite="onToggleFavorite"
                        />
                    </template>
                </template>

                <div
                    v-if="showLimitedAccessHint"
                    class="mx-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
                >
                    No module permissions are assigned to this account yet.
                </div>
                <div
                    v-if="searchQuery && !showLimitedAccessHint && !navSections.some(s => s.items.some(i => i.title.toLowerCase().includes(searchQuery.toLowerCase())))"
                    class="mx-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
                >
                    No modules match "{{ searchQuery }}"
                </div>
            </template>
        </SidebarContent>

        <SidebarFooter>
            <NavUser />
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>