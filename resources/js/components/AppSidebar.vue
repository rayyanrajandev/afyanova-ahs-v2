<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
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
} from '@/components/ui/sidebar';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useSidebarFavorites } from '@/composables/useSidebarFavorites';
import {
    appNavCatalog,
    navSectionLabels,
    navSectionOrder,
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

/** Resolved permission list — never omit filtering when null server-side gaps would otherwise show entire catalog */
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
    {
        id: 'dashboard',
        title: 'Dashboard',
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

/** Build all nav items from the catalog with stable IDs from section+href */
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

/** Favorites derived from the full visible set */
const favoriteItems = computed<NavItem[]>(() => {
    return getFavorites(allNavItems.value);
});

const hasFavorites = computed(() => favoriteItems.value.length > 0);

const navSections = computed<NavSection[]>(() =>
    navSectionOrder
        .map((key) => {
            const items = visibleNavItems.value
                .filter((item) => item.section === key)
                .map(({ id, title, href, iconName }) => ({
                    id: id ?? `${key}:${href}`,
                    title,
                    href,
                    iconName,
                }));

            return {
                key,
                label: navSectionLabels[key],
                items,
            };
        })
        .filter((section) => section.items.length > 0),
);

const showLimitedAccessHint = computed(
    () => !hasUniversalAdminAccess.value && visibleNavItems.value.length === 0,
);

function onToggleFavorite(item: NavItem) {
    if (item.id) {
        toggleFavorite(item.id);
    }
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
            <!-- Nav search -->
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

            <!-- Favorites section -->
            <NavMain
                v-if="hasFavorites && !searchQuery"
                :items="favoriteItems"
                label="Favorites"
                :show-favorites="false"
                is-favorites-section
            />

            <NavMain :items="homeItems" label="Home" :search-query="searchQuery" />
            <NavMain
                v-for="section in navSections"
                :key="section.key"
                :items="section.items"
                :label="section.label"
                :search-query="searchQuery"
                :show-favorites="true"
                @toggle-favorite="onToggleFavorite"
            />
            <div
                v-if="showLimitedAccessHint"
                class="mx-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
            >
                No module permissions are assigned to this account yet.
            </div>
            <!-- No results message -->
            <div
                v-if="searchQuery && !showLimitedAccessHint && allNavItems.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0"
                class="mx-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
            >
                No modules match "{{ searchQuery }}"
            </div>
        </SidebarContent>

        <SidebarFooter>
            <NavUser />
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>