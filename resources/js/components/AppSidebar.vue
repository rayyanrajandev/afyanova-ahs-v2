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
import { filterSidebarNavCatalogItems } from '@/lib/routeAccess';
import { dashboard } from '@/routes';
import { type NavItem } from '@/types';
import AppLogo from './AppLogo.vue';

type NavSectionKey =
    | 'front_office'
    | 'clinical_care'
    | 'diagnostics'
    | 'billing'
    | 'stores'
    | 'people'
    | 'facility_setup'
    | 'system_access';

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
    // Registration & visits — front desk, OPD, and admissions
    {
        title: 'Patient registry',
        href: '/patients',
        iconName: 'users',
        section: 'front_office',
        permissionPrefixes: ['patients.'],
    },
    {
        title: 'Walk-in service desk',
        href: '/walk-in-service-requests',
        iconName: 'layout-list',
        section: 'front_office',
        permissionPrefixes: ['service.requests.'],
    },
    {
        title: 'OPD appointments',
        href: '/appointments',
        iconName: 'calendar-clock',
        section: 'front_office',
        permissionPrefixes: ['appointments.'],
    },
    {
        title: 'Inpatient admissions',
        href: '/admissions',
        iconName: 'bed-double',
        section: 'front_office',
        permissionPrefixes: ['admissions.'],
    },
    // Clinical care — emergency, wards, theatre, records
    {
        title: 'Emergency & triage',
        href: '/emergency-triage',
        iconName: 'alert-triangle',
        section: 'clinical_care',
        permissionPrefixes: ['emergency.triage.'],
    },
    {
        title: 'Ward management',
        href: '/inpatient-ward',
        iconName: 'clipboard-list',
        section: 'clinical_care',
        permissionPrefixes: ['inpatient.ward.'],
    },
    {
        title: 'Operating theatre',
        href: '/theatre-procedures',
        iconName: 'scissors',
        section: 'clinical_care',
        permissionPrefixes: ['theatre.procedures.'],
    },
    {
        title: 'Clinical records',
        href: '/medical-records',
        iconName: 'file-text',
        section: 'clinical_care',
        permissionPrefixes: ['medical.records.', 'medical-records.'],
    },
    // Diagnostics & pharmacy — lab, imaging, dispensing
    {
        title: 'Laboratory',
        href: '/laboratory-orders',
        iconName: 'flask-conical',
        section: 'diagnostics',
        permissionPrefixes: ['laboratory.orders.', 'laboratory-orders.'],
    },
    {
        title: 'Imaging & radiology',
        href: '/radiology-orders',
        iconName: 'activity',
        section: 'diagnostics',
        permissionPrefixes: ['radiology.orders.'],
    },
    {
        title: 'Pharmacy & dispensing',
        href: '/pharmacy-orders',
        iconName: 'pill',
        section: 'diagnostics',
        permissionPrefixes: ['pharmacy.orders.', 'pharmacy-orders.'],
    },
    // Billing & insurance — cash, NHIF, tariffs
    {
        title: 'Invoices & billing',
        href: '/billing-invoices',
        iconName: 'receipt',
        section: 'billing',
        permissionPrefixes: ['billing.', 'billing-invoices.'],
    },
    {
        title: 'Cashier',
        href: '/billing-cash',
        iconName: 'receipt',
        section: 'billing',
        permissionPrefixes: ['billing.cash-accounts.'],
    },
    {
        title: 'POS counter',
        href: '/pos',
        iconName: 'receipt',
        section: 'billing',
        permissionPrefixes: ['pos.'],
    },
    {
        title: 'Tariffs & services',
        href: '/billing-service-catalog',
        iconName: 'file-text',
        section: 'billing',
        permissionPrefixes: ['billing.service-catalog.'],
    },
    {
        title: 'NHIF & insurance',
        href: '/claims-insurance',
        iconName: 'shield-check',
        section: 'billing',
        permissionPrefixes: ['claims.insurance.'],
    },
    {
        title: 'Payer contracts',
        href: '/billing-payer-contracts',
        iconName: 'file-text',
        section: 'billing',
        permissionPrefixes: ['billing.payer-contracts.'],
    },
    {
        title: 'Refunds',
        href: '/billing-refunds',
        iconName: 'rotate-ccw',
        section: 'billing',
        permissionPrefixes: ['billing.refunds.'],
    },
    {
        title: 'Discount policies',
        href: '/billing-discounts',
        iconName: 'file-text',
        section: 'billing',
        permissionPrefixes: ['billing.discounts.'],
    },
    {
        title: 'Financial reports',
        href: '/billing-financial-reports',
        iconName: 'file-text',
        section: 'billing',
        permissionPrefixes: ['billing.financial-controls.'],
    },
    // Stores & supply — procurement and stock
    {
        title: 'Stores & procurement',
        href: '/inventory-procurement',
        iconName: 'package',
        section: 'stores',
        permissionPrefixes: ['inventory.procurement.'],
    },
    {
        title: 'Warehouses',
        href: '/inventory-procurement/warehouses',
        iconName: 'building-2',
        section: 'stores',
        permissionPrefixes: [
            'inventory.procurement.read',
            'inventory.procurement.manage-warehouses',
        ],
    },
    {
        title: 'Suppliers',
        href: '/inventory-procurement/suppliers',
        iconName: 'package',
        section: 'stores',
        permissionPrefixes: [
            'inventory.procurement.read',
            'inventory.procurement.manage-suppliers',
        ],
    },
    // People & credentials — staff and clinical privileges
    {
        title: 'Staff directory',
        href: '/staff',
        iconName: 'users',
        section: 'people',
        permissionPrefixes: ['staff.'],
    },
    {
        title: 'Staff credentialing',
        href: '/staff-credentialing',
        iconName: 'shield-check',
        section: 'people',
        permissionPrefixes: ['staff.credentialing.'],
    },
    {
        title: 'Clinical privileges',
        href: '/staff-privileges',
        iconName: 'shield-check',
        section: 'people',
        permissionPrefixes: ['staff.privileges.', 'staff.privileges'],
    },
    {
        title: 'Privilege catalog',
        href: '/platform/admin/privilege-catalogs',
        iconName: 'shield-check',
        section: 'people',
        permissionPrefixes: ['staff.privileges.'],
    },
    // Facility setup — structure, plans, and master data
    {
        title: 'Facility setup',
        href: '/platform/admin/facility-config',
        iconName: 'building-2',
        section: 'facility_setup',
        permissionPrefixes: [
            'platform.facilities.',
            'platform.multi-facility.',
            'platform.resources.',
            'platform.users.manage-facilities',
        ],
    },
    {
        title: 'Subscription plans',
        href: '/platform/admin/service-plans',
        iconName: 'receipt',
        section: 'facility_setup',
        permissionPrefixes: ['platform.subscription-plans.'],
    },
    {
        title: 'Facility rollouts',
        href: '/platform/admin/facility-rollouts',
        iconName: 'clipboard-list',
        section: 'facility_setup',
        permissionPrefixes: ['platform.multi-facility.'],
    },
    {
        title: 'Departments',
        href: '/platform/admin/departments',
        iconName: 'building-2',
        section: 'facility_setup',
        permissionPrefixes: ['departments.'],
    },
    {
        title: 'Service points',
        href: '/platform/admin/service-points',
        iconName: 'map-pin',
        section: 'facility_setup',
        permissionPrefixes: ['platform.resources.'],
    },
    {
        title: 'Wards & beds',
        href: '/platform/admin/ward-beds',
        iconName: 'bed-double',
        section: 'facility_setup',
        permissionPrefixes: ['platform.resources.'],
    },
    {
        title: 'Clinical specialties',
        href: '/platform/admin/specialties',
        iconName: 'activity',
        section: 'facility_setup',
        permissionPrefixes: ['specialties.', 'staff.specialties.'],
    },
    {
        title: 'Clinical service catalog',
        href: '/platform/admin/clinical-catalogs',
        iconName: 'book-open',
        section: 'facility_setup',
        permissionPrefixes: [
            'platform.clinical-catalog.',
            'laboratory.orders.',
            'radiology.orders.',
            'pharmacy.orders.',
            'billing.service-catalog.',
        ],
    },
    {
        title: 'Branding',
        href: '/platform/admin/branding',
        iconName: 'pencil',
        section: 'facility_setup',
        permissionPrefixes: ['platform.settings.'],
    },
    // Users & system — access control and approvals
    {
        title: 'Users & access',
        href: '/platform/admin/users',
        iconName: 'user',
        section: 'system_access',
        permissionPrefixes: ['platform.users.'],
    },
    {
        title: 'Access approvals',
        href: '/platform/admin/user-approval-cases',
        iconName: 'clipboard-list',
        section: 'system_access',
        permissionPrefixes: ['platform.users.approval-cases.'],
    },
    {
        title: 'Roles & permissions',
        href: '/platform/admin/roles',
        iconName: 'shield-check',
        section: 'system_access',
        permissionPrefixes: ['platform.rbac.'],
    },
];

const { permissionNames, hasUniversalAdminAccess, facilityEntitlementNames } = usePlatformAccess();

/** Resolved permission list — never omit filtering when null server-side gaps would otherwise show entire catalog */
const resolvedPermissionNames = computed(() => permissionNames.value ?? []);

const sectionLabels: Record<NavSectionKey, string> = {
    front_office: 'Registration & visits',
    clinical_care: 'Clinical care',
    diagnostics: 'Diagnostics & pharmacy',
    billing: 'Billing & insurance',
    stores: 'Stores & supply',
    people: 'People & credentials',
    facility_setup: 'Facility setup',
    system_access: 'Users & system',
};

const sectionOrder: NavSectionKey[] = [
    'front_office',
    'clinical_care',
    'diagnostics',
    'billing',
    'stores',
    'people',
    'facility_setup',
    'system_access',
];

const visibleNavItems = computed<NavCatalogItem[]>(() =>
    filterSidebarNavCatalogItems(
        navCatalog,
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
