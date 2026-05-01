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
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { filterItemsByRouteAccess } from '@/lib/routeAccess';
import { dashboard } from '@/routes';
import { type NavItem } from '@/types';
import AppLogo from './AppLogo.vue';

type NavSectionKey = 'care_delivery' | 'revenue' | 'supply_chain' | 'configuration';

type NavCatalogItem = NavItem & {
    section: NavSectionKey;
    permissionPrefixes: string[];
};

type NavSection = {
    key: NavSectionKey;
    label: string;
    items: NavItem[];
};

const navCatalog: NavCatalogItem[] = [
    {
        title: 'Patients',
        href: '/patients',
        iconName: 'users',
        section: 'care_delivery',
        permissionPrefixes: ['patients.'],
    },
    {
        title: 'Appointments',
        href: '/appointments',
        iconName: 'calendar-clock',
        section: 'care_delivery',
        permissionPrefixes: ['appointments.'],
    },
    {
        title: 'Admissions',
        href: '/admissions',
        iconName: 'bed-double',
        section: 'care_delivery',
        permissionPrefixes: ['admissions.'],
    },
    {
        title: 'Medical Records',
        href: '/medical-records',
        iconName: 'file-text',
        section: 'care_delivery',
        permissionPrefixes: ['medical.records.', 'medical-records.'],
    },
    {
        title: 'Emergency & Triage',
        href: '/emergency-triage',
        iconName: 'alert-triangle',
        section: 'care_delivery',
        permissionPrefixes: ['emergency.triage.'],
    },
    {
        title: 'Inpatient Ward',
        href: '/inpatient-ward',
        iconName: 'clipboard-list',
        section: 'care_delivery',
        permissionPrefixes: ['inpatient.ward.'],
    },
    {
        title: 'Theatre & Procedures',
        href: '/theatre-procedures',
        iconName: 'scissors',
        section: 'care_delivery',
        permissionPrefixes: ['theatre.procedures.'],
    },
    {
        title: 'Laboratory',
        href: '/laboratory-orders',
        iconName: 'flask-conical',
        section: 'care_delivery',
        permissionPrefixes: ['laboratory.orders.', 'laboratory-orders.'],
    },
    {
        title: 'Radiology',
        href: '/radiology-orders',
        iconName: 'activity',
        section: 'care_delivery',
        permissionPrefixes: ['radiology.orders.'],
    },
    {
        title: 'Pharmacy',
        href: '/pharmacy-orders',
        iconName: 'pill',
        section: 'care_delivery',
        permissionPrefixes: ['pharmacy.orders.', 'pharmacy-orders.'],
    },
    {
        title: 'Billing',
        href: '/billing-invoices',
        iconName: 'receipt',
        section: 'revenue',
        permissionPrefixes: ['billing.', 'billing-invoices.'],
    },
    {
        title: 'Cash Billing',
        href: '/billing-cash',
        iconName: 'receipt',
        section: 'revenue',
        permissionPrefixes: ['billing.cash-accounts.'],
    },
    {
        title: 'Point of Sale',
        href: '/pos',
        iconName: 'receipt',
        section: 'revenue',
        permissionPrefixes: ['pos.'],
    },
    {
        title: 'Billable Service Catalog',
        href: '/billing-service-catalog',
        iconName: 'receipt',
        section: 'revenue',
        permissionPrefixes: ['billing.service-catalog.'],
    },
    {
        title: 'Claims & Insurance',
        href: '/claims-insurance',
        iconName: 'shield-check',
        section: 'revenue',
        permissionPrefixes: ['claims.insurance.'],
    },
    {
        title: 'Payer Contracts',
        href: '/billing-payer-contracts',
        iconName: 'file-text',
        section: 'revenue',
        permissionPrefixes: ['billing.payer-contracts.'],
    },
    {
        title: 'Refund Operations',
        href: '/billing-refunds',
        iconName: 'rotate-ccw',
        section: 'revenue',
        permissionPrefixes: ['billing.refunds.'],
    },
    {
        title: 'Discount Policies',
        href: '/billing-discounts',
        iconName: 'file-text',
        section: 'revenue',
        permissionPrefixes: ['billing.discounts.'],
    },
    {
        title: 'Financial Reports',
        href: '/billing-financial-reports',
        iconName: 'file-text',
        section: 'revenue',
        permissionPrefixes: ['billing.financial-controls.'],
    },
    {
        title: 'Inventory & Procurement',
        href: '/inventory-procurement',
        iconName: 'package',
        section: 'supply_chain',
        permissionPrefixes: ['inventory.procurement.'],
    },
    {
        title: 'Warehouses',
        href: '/inventory-procurement/warehouses',
        iconName: 'building-2',
        section: 'supply_chain',
        permissionPrefixes: [
            'inventory.procurement.read',
            'inventory.procurement.manage-warehouses',
        ],
    },
    {
        title: 'Suppliers',
        href: '/inventory-procurement/suppliers',
        iconName: 'package',
        section: 'supply_chain',
        permissionPrefixes: [
            'inventory.procurement.read',
            'inventory.procurement.manage-suppliers',
        ],
    },
    {
        title: 'Clinical Care Catalog',
        href: '/platform/admin/clinical-catalogs',
        iconName: 'book-open',
        section: 'configuration',
        permissionPrefixes: [
            'platform.clinical-catalog.',
            'laboratory.orders.',
            'radiology.orders.',
            'pharmacy.orders.',
            'billing.service-catalog.',
        ],
    },
    {
        title: 'Departments',
        href: '/platform/admin/departments',
        iconName: 'building-2',
        section: 'configuration',
        permissionPrefixes: ['departments.'],
    },
    {
        title: 'Service Points',
        href: '/platform/admin/service-points',
        iconName: 'map-pin',
        section: 'configuration',
        permissionPrefixes: ['platform.resources.'],
    },
    {
        title: 'Ward & Beds',
        href: '/platform/admin/ward-beds',
        iconName: 'bed-double',
        section: 'configuration',
        permissionPrefixes: ['platform.resources.'],
    },
    {
        title: 'Clinical Specialties',
        href: '/platform/admin/specialties',
        iconName: 'activity',
        section: 'configuration',
        permissionPrefixes: ['specialties.', 'staff.specialties.'],
    },
    {
        title: 'Staff Directory',
        href: '/staff',
        iconName: 'users',
        section: 'configuration',
        permissionPrefixes: ['staff.'],
    },
    {
        title: 'Staff Credentialing',
        href: '/staff-credentialing',
        iconName: 'shield-check',
        section: 'configuration',
        permissionPrefixes: ['staff.credentialing.'],
    },
    {
        title: 'Staff Privileges',
        href: '/staff-privileges',
        iconName: 'shield-check',
        section: 'configuration',
        permissionPrefixes: ['staff.'],
    },
    {
        title: 'Privilege Catalog',
        href: '/platform/admin/privilege-catalogs',
        iconName: 'shield-check',
        section: 'configuration',
        permissionPrefixes: ['staff.privileges.'],
    },
    {
        title: 'Facility Configuration',
        href: '/platform/admin/facility-config',
        iconName: 'building-2',
        section: 'configuration',
        permissionPrefixes: [
            'platform.facilities.',
            'platform.multi-facility.',
            'platform.resources.',
            'platform.users.manage-facilities',
        ],
    },
    {
        title: 'Facility Subscription Plans',
        href: '/platform/admin/service-plans',
        iconName: 'receipt',
        section: 'configuration',
        permissionPrefixes: ['platform.subscription-plans.'],
    },
    {
        title: 'Facility Rollouts',
        href: '/platform/admin/facility-rollouts',
        iconName: 'clipboard-list',
        section: 'configuration',
        permissionPrefixes: ['platform.multi-facility.'],
    },
    {
        title: 'Branding',
        href: '/platform/admin/branding',
        iconName: 'pencil',
        section: 'configuration',
        permissionPrefixes: ['platform.settings.'],
    },
    {
        title: 'Users & Access',
        href: '/platform/admin/users',
        iconName: 'user',
        section: 'configuration',
        permissionPrefixes: ['platform.users.'],
    },
    {
        title: 'User Approval Cases',
        href: '/platform/admin/user-approval-cases',
        iconName: 'clipboard-list',
        section: 'configuration',
        permissionPrefixes: ['platform.users.approval-cases.'],
    },
    {
        title: 'Roles & Permissions',
        href: '/platform/admin/roles',
        iconName: 'shield-check',
        section: 'configuration',
        permissionPrefixes: ['platform.rbac.'],
    },
];

const { permissionNames, hasUniversalAdminAccess } = usePlatformAccess();

const sectionLabels: Record<NavSectionKey, string> = {
    care_delivery: 'Care Delivery',
    revenue: 'Revenue',
    supply_chain: 'Supply Chain',
    configuration: 'Configuration',
};

const sectionOrder: NavSectionKey[] = [
    'care_delivery',
    'revenue',
    'supply_chain',
    'configuration',
];

const shouldRestrictByPermissions = computed(
    () => permissionNames.value !== null,
);

const visibleNavItems = computed<NavCatalogItem[]>(() => {
    if (hasUniversalAdminAccess.value) {
        return navCatalog;
    }

    if (!shouldRestrictByPermissions.value) {
        return navCatalog;
    }

    return filterItemsByRouteAccess(navCatalog, permissionNames.value);
});

const homeItems = computed<NavItem[]>(() => [
    {
        title: 'Dashboard',
        href: dashboard(),
        iconName: 'layout-grid',
    },
    {
        title: 'Shortcuts',
        href: '/help/shortcuts',
        iconName: 'book-open',
    },
]);

const navSections = computed<NavSection[]>(() =>
    sectionOrder
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
                label: sectionLabels[key],
                items,
            };
        })
        .filter((section) => section.items.length > 0),
);

const showLimitedAccessHint = computed(
    () => shouldRestrictByPermissions.value && visibleNavItems.value.length === 0,
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
