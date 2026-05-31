<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
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
} from '@/components/ui/sidebar';
import {
    appNavCatalog,
    navSectionLabels,
    navSectionOrder,
    type NavSectionKey,
} from '@/config/appNavCatalog';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
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

const homeItems = computed<NavItem[]>(() => [
    {
        title: 'Dashboard',
        href: dashboard(),
        iconName: 'layout-grid',
    },
    {
        title: 'Help & shortcuts',
        href: '/help/shortcuts',
        iconName: 'book-open',
    },
]);

const navSections = computed<NavSection[]>(() =>
    navSectionOrder
        .map((key) => {
            const items = visibleNavItems.value
                .filter((item) => item.section === key)
                .map(({ title, href, icon, iconName, isActive }) => ({
                    title,
                    href,
                    icon,
                    iconName,
                    isActive,
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
            <NavMain :items="homeItems" label="Home" />
            <NavMain
                v-for="section in navSections"
                :key="section.key"
                :items="section.items"
                :label="section.label"
            />
            <div
                v-if="showLimitedAccessHint"
                class="mx-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
            >
                No module permissions are assigned to this account yet.
            </div>
        </SidebarContent>

        <SidebarFooter>
            <NavUser />
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>
