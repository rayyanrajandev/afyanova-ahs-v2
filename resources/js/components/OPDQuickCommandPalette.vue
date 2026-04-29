<script setup lang="ts">
import { router } from '@inertiajs/vue3';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import type { AppIconName } from '@/lib/icons';
import { filterItemsByRouteAccess } from '@/lib/routeAccess';

type CommandRoute = {
    label: string;
    href: string;
    icon: AppIconName;
    shortcut: string;
};

type CommandPreset = {
    label: string;
    href: string;
    icon: AppIconName;
};

type WorkflowActionCommand = {
    label: string;
    href: string;
    icon: AppIconName;
    compactRows?: boolean;
};

const open = ref(false);
const { permissionNames } = usePlatformAccess();

const routes: CommandRoute[] = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'layout-grid',
        shortcut: 'G D',
    },
    {
        label: 'Patients',
        href: '/patients',
        icon: 'users',
        shortcut: 'G P',
    },
    {
        label: 'Appointments',
        href: '/appointments',
        icon: 'calendar-clock',
        shortcut: 'G A',
    },
    {
        label: 'Admissions',
        href: '/admissions',
        icon: 'bed-double',
        shortcut: 'G I',
    },
    {
        label: 'Medical Records',
        href: '/medical-records',
        icon: 'stethoscope',
        shortcut: 'G M',
    },
    {
        label: 'Emergency & Triage',
        href: '/emergency-triage',
        icon: 'alert-triangle',
        shortcut: 'G E',
    },
    {
        label: 'Inpatient Ward Operations',
        href: '/inpatient-ward',
        icon: 'clipboard-list',
        shortcut: 'G W',
    },
    {
        label: 'Theatre & Procedures',
        href: '/theatre-procedures',
        icon: 'scissors',
        shortcut: 'G T',
    },
    {
        label: 'Laboratory Orders',
        href: '/laboratory-orders',
        icon: 'flask-conical',
        shortcut: 'G L',
    },
    {
        label: 'Pharmacy Orders',
        href: '/pharmacy-orders',
        icon: 'pill',
        shortcut: 'G H',
    },
    {
        label: 'Radiology Orders',
        href: '/radiology-orders',
        icon: 'activity',
        shortcut: 'G R',
    },
    {
        label: 'Billing Invoices',
        href: '/billing-invoices',
        icon: 'receipt',
        shortcut: 'G B',
    },
    {
        label: 'Cash Billing',
        href: '/billing-cash',
        icon: 'receipt',
        shortcut: 'G 1',
    },
    {
        label: 'Point of Sale',
        href: '/pos',
        icon: 'receipt',
        shortcut: 'G 5',
    },
    {
        label: 'Refund Operations',
        href: '/billing-refunds',
        icon: 'rotate-ccw',
        shortcut: 'G 2',
    },
    {
        label: 'Discount Policies',
        href: '/billing-discounts',
        icon: 'file-text',
        shortcut: 'G 3',
    },
    {
        label: 'Billing Financial Reports',
        href: '/billing-financial-reports',
        icon: 'file-text',
        shortcut: 'G 4',
    },
    {
        label: 'Billing Payer Contracts',
        href: '/billing-payer-contracts',
        icon: 'stethoscope',
        shortcut: 'G K',
    },
    {
        label: 'Billing Service Price List',
        href: '/billing-service-catalog',
        icon: 'receipt',
        shortcut: 'G 7',
    },
    {
        label: 'Claims & Insurance',
        href: '/claims-insurance',
        icon: 'shield-check',
        shortcut: 'G C',
    },
    {
        label: 'Inventory & Procurement',
        href: '/inventory-procurement',
        icon: 'package',
        shortcut: 'G V',
    },
    {
        label: 'Supplier Admin',
        href: '/inventory-procurement/suppliers',
        icon: 'package',
        shortcut: 'G Q',
    },
    {
        label: 'Warehouse Admin',
        href: '/inventory-procurement/warehouses',
        icon: 'building-2',
        shortcut: 'G Z',
    },
    {
        label: 'Staff',
        href: '/staff',
        icon: 'users',
        shortcut: 'G S',
    },
    {
        label: 'Staff Credentialing',
        href: '/staff-credentialing',
        icon: 'shield-check',
        shortcut: 'G 9',
    },
    {
        label: 'Staff Privileging',
        href: '/staff-privileges',
        icon: 'shield-check',
        shortcut: 'G J',
    },
    {
        label: 'Platform Users',
        href: '/platform/admin/users',
        icon: 'user',
        shortcut: 'G U',
    },
    {
        label: 'User Approval Cases',
        href: '/platform/admin/user-approval-cases',
        icon: 'clipboard-list',
        shortcut: 'G N',
    },
    {
        label: 'Platform RBAC',
        href: '/platform/admin/roles',
        icon: 'shield-check',
        shortcut: 'G X',
    },
    {
        label: 'Facility Rollouts',
        href: '/platform/admin/facility-rollouts',
        icon: 'clipboard-list',
        shortcut: 'G F',
    },
    {
        label: 'Facility Config',
        href: '/platform/admin/facility-config',
        icon: 'building-2',
        shortcut: 'G 6',
    },
    {
        label: 'Clinical Care Catalogs',
        href: '/platform/admin/clinical-catalogs',
        icon: 'book-open',
        shortcut: 'G 8',
    },
    {
        label: 'Clinical Specialties',
        href: '/platform/admin/specialties',
        icon: 'activity',
        shortcut: 'G Y',
    },
    {
        label: 'Privilege Catalog',
        href: '/platform/admin/privilege-catalogs',
        icon: 'shield-check',
        shortcut: 'G 0',
    },
    {
        label: 'Departments',
        href: '/platform/admin/departments',
        icon: 'building-2',
        shortcut: 'G D',
    },
    {
        label: 'Service Points',
        href: '/platform/admin/service-points',
        icon: 'map-pin',
        shortcut: 'G O',
    },
    {
        label: 'Ward/Beds',
        href: '/platform/admin/ward-beds',
        icon: 'bed-double',
        shortcut: 'G W',
    },
];

const createWorkflowRoutes: CommandRoute[] = [
    {
        label: 'Create Patient (Front Desk)',
        href: '/patients',
        icon: 'users',
        shortcut: 'C P',
    },
    {
        label: 'Book Appointment (Queue + Create)',
        href: '/appointments',
        icon: 'calendar-clock',
        shortcut: 'C A',
    },
    {
        label: 'New Admission',
        href: '/admissions',
        icon: 'bed-double',
        shortcut: 'C I',
    },
    {
        label: 'Consultation Queue',
        href: '/appointments?status=waiting_provider&from=quick-command',
        icon: 'stethoscope',
        shortcut: 'C M',
    },
    {
        label: 'New Laboratory Order',
        href: '/laboratory-orders',
        icon: 'flask-conical',
        shortcut: 'C L',
    },
    {
        label: 'New Emergency Triage Intake',
        href: '/emergency-triage',
        icon: 'alert-triangle',
        shortcut: 'C E',
    },
    {
        label: 'Open Inpatient Ward Workspace',
        href: '/inpatient-ward',
        icon: 'clipboard-list',
        shortcut: 'C W',
    },
    {
        label: 'New Theatre Procedure Case',
        href: '/theatre-procedures',
        icon: 'scissors',
        shortcut: 'C T',
    },
    {
        label: 'New Pharmacy Order',
        href: '/pharmacy-orders',
        icon: 'pill',
        shortcut: 'C H',
    },
    {
        label: 'New Radiology Order',
        href: '/radiology-orders',
        icon: 'activity',
        shortcut: 'C R',
    },
    {
        label: 'New Billing Invoice',
        href: '/billing-invoices',
        icon: 'receipt',
        shortcut: 'C B',
    },
    {
        label: 'Manage Billing Payer Contracts',
        href: '/billing-payer-contracts',
        icon: 'stethoscope',
        shortcut: 'C K',
    },
    {
        label: 'Manage Service Prices',
        href: '/billing-service-catalog',
        icon: 'receipt',
        shortcut: 'C 7',
    },
    {
        label: 'New Claims/Insurance Case',
        href: '/claims-insurance',
        icon: 'shield-check',
        shortcut: 'C C',
    },
    {
        label: 'Open Inventory/Procurement Workspace',
        href: '/inventory-procurement',
        icon: 'package',
        shortcut: 'C V',
    },
    {
        label: 'Manage Supplier Registry',
        href: '/inventory-procurement/suppliers',
        icon: 'package',
        shortcut: 'C Q',
    },
    {
        label: 'Manage Warehouse Registry',
        href: '/inventory-procurement/warehouses',
        icon: 'building-2',
        shortcut: 'C Z',
    },
    {
        label: 'Manage Staff Profiles',
        href: '/staff',
        icon: 'users',
        shortcut: 'C S',
    },
    {
        label: 'Manage Staff Credentialing',
        href: '/staff-credentialing',
        icon: 'shield-check',
        shortcut: 'C 9',
    },
    {
        label: 'Manage Staff Privileging',
        href: '/staff-privileges',
        icon: 'shield-check',
        shortcut: 'C J',
    },
    {
        label: 'Manage Platform Users',
        href: '/platform/admin/users',
        icon: 'user',
        shortcut: 'C U',
    },
    {
        label: 'Manage User Approval Cases',
        href: '/platform/admin/user-approval-cases',
        icon: 'clipboard-list',
        shortcut: 'C N',
    },
    {
        label: 'Manage Platform RBAC',
        href: '/platform/admin/roles',
        icon: 'shield-check',
        shortcut: 'C X',
    },
    {
        label: 'Manage Facility Rollouts',
        href: '/platform/admin/facility-rollouts',
        icon: 'clipboard-list',
        shortcut: 'C F',
    },
    {
        label: 'Manage Facility Configuration',
        href: '/platform/admin/facility-config',
        icon: 'building-2',
        shortcut: 'C 6',
    },
    {
        label: 'Manage Clinical Care Catalogs',
        href: '/platform/admin/clinical-catalogs',
        icon: 'book-open',
        shortcut: 'C 8',
    },
    {
        label: 'Manage Clinical Specialties',
        href: '/platform/admin/specialties',
        icon: 'activity',
        shortcut: 'C Y',
    },
    {
        label: 'Manage Privilege Catalog',
        href: '/platform/admin/privilege-catalogs',
        icon: 'shield-check',
        shortcut: 'C 0',
    },
    {
        label: 'Manage Departments',
        href: '/platform/admin/departments',
        icon: 'building-2',
        shortcut: 'C D',
    },
    {
        label: 'Manage Service Points',
        href: '/platform/admin/service-points',
        icon: 'map-pin',
        shortcut: 'C O',
    },
    {
        label: 'Manage Ward/Beds',
        href: '/platform/admin/ward-beds',
        icon: 'bed-double',
        shortcut: 'C J',
    },
];

function localTodayIsoDate(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
}

function localIsoDatePlusDays(days: number): string {
    const now = new Date();
    now.setDate(now.getDate() + days);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
}

function buildHref(
    path: string,
    query: Record<string, string | string[] | null | undefined>,
): string {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.filter(Boolean).forEach((item) => params.append(key, item));
            return;
        }
        if (!value) return;
        params.set(key, value);
    });

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

const queuePresets = computed<CommandPreset[]>(() => {
    const today = localTodayIsoDate();

    return [
        {
            label: 'Appointments - Scheduled Today',
            href: buildHref('/appointments', { status: 'scheduled', from: today }),
            icon: 'calendar-clock',
        },
        {
            label: 'Appointments - Checked In',
            href: buildHref('/appointments', { status: 'checked_in', from: today }),
            icon: 'calendar-clock',
        },
        {
            label: 'Patients - Active',
            href: buildHref('/patients', { status: 'active' }),
            icon: 'users',
        },
        {
            label: 'Patients - Inactive',
            href: buildHref('/patients', { status: 'inactive' }),
            icon: 'users',
        },
        {
            label: 'Medical Records - Records List (Today)',
            href: buildHref('/medical-records', { tab: 'list', from: today }),
            icon: 'stethoscope',
        },
        {
            label: 'Admissions - Admitted Today',
            href: buildHref('/admissions', { status: 'admitted', from: today }),
            icon: 'bed-double',
        },
        {
            label: 'Admissions - Discharged Today',
            href: buildHref('/admissions', { status: 'discharged', from: today }),
            icon: 'bed-double',
        },
        {
            label: 'Admissions - Transferred Today',
            href: buildHref('/admissions', { status: 'transferred', from: today }),
            icon: 'bed-double',
        },
        {
            label: 'Admissions - Cancelled Today',
            href: buildHref('/admissions', { status: 'cancelled', from: today }),
            icon: 'bed-double',
        },
        {
            label: 'Staff - Active Profiles',
            href: buildHref('/staff', { status: 'active' }),
            icon: 'users',
        },
        {
            label: 'Staff - Suspended Profiles',
            href: buildHref('/staff', { status: 'suspended' }),
            icon: 'users',
        },
        {
            label: 'Staff - Inactive Profiles',
            href: buildHref('/staff', { status: 'inactive' }),
            icon: 'users',
        },
        {
            label: 'Staff Credentialing - Alerts',
            href: '/staff-credentialing?tab=alerts',
            icon: 'shield-check',
        },
        {
            label: 'Staff Privileging - Workspace',
            href: '/staff-privileges',
            icon: 'shield-check',
        },
        {
            label: 'Laboratory - Ordered Queue',
            href: buildHref('/laboratory-orders', { status: 'ordered', from: today }),
            icon: 'flask-conical',
        },
        {
            label: 'Pharmacy - Pending Queue',
            href: buildHref('/pharmacy-orders', { status: 'pending', from: today }),
            icon: 'pill',
        },
        {
            label: 'Billing - Today Collections',
            href: buildHref('/billing-invoices', {
                paymentActivityFrom: today,
                paymentActivityTo: today,
            }),
            icon: 'receipt',
        },
        {
            label: 'Billing - Outstanding (Issued + Partial)',
            href: buildHref('/billing-invoices', {
                'statusIn[]': ['issued', 'partially_paid'],
                from: today,
            }),
            icon: 'receipt',
        },
        {
            label: 'Billing - Issued Invoices',
            href: buildHref('/billing-invoices', { status: 'issued', from: today }),
            icon: 'receipt',
        },
        {
            label: 'Billing - Draft Invoices',
            href: buildHref('/billing-invoices', { status: 'draft', from: today }),
            icon: 'receipt',
        },
        {
            label: 'Billing - Partially Paid',
            href: buildHref('/billing-invoices', {
                status: 'partially_paid',
                from: today,
            }),
            icon: 'receipt',
        },
        {
            label: 'Billing - Paid Invoices',
            href: buildHref('/billing-invoices', { status: 'paid', from: today }),
            icon: 'receipt',
        },
        {
            label: 'Suppliers - Active',
            href: buildHref('/inventory-procurement/suppliers', { status: 'active' }),
            icon: 'package',
        },
        {
            label: 'Warehouses - Active',
            href: buildHref('/inventory-procurement/warehouses', { status: 'active' }),
            icon: 'building-2',
        },
        {
            label: 'Facility Rollouts - Active',
            href: buildHref('/platform/admin/facility-rollouts', { status: 'active' }),
            icon: 'clipboard-list',
        },
        {
            label: 'Clinical Care Catalogs - Workspace',
            href: '/platform/admin/clinical-catalogs',
            icon: 'book-open',
        },
        {
            label: 'Approval Cases - Submitted',
            href: buildHref('/platform/admin/user-approval-cases', { status: 'submitted' }),
            icon: 'clipboard-list',
        },
    ];
});

const workflowActions = computed<WorkflowActionCommand[]>(() => {
    const today = localTodayIsoDate();
    const weekAhead = localIsoDatePlusDays(7);

    return [
        {
            label: 'Open Appointments - Today Queue (Compact)',
            href: buildHref('/appointments', { from: today }),
            icon: 'calendar-clock',
            compactRows: true,
        },
        {
            label: 'Open Appointments - Checked In (Compact)',
            href: buildHref('/appointments', { status: 'checked_in', from: today }),
            icon: 'calendar-clock',
            compactRows: true,
        },
        {
            label: 'Open Patients - Active',
            href: buildHref('/patients', { status: 'active' }),
            icon: 'users',
        },
        {
            label: 'Open Patients - Inactive',
            href: buildHref('/patients', { status: 'inactive' }),
            icon: 'users',
        },
        {
            label: 'Open Medical Records - Records List Today (Compact)',
            href: buildHref('/medical-records', { tab: 'list', from: today }),
            icon: 'stethoscope',
            compactRows: true,
        },
        {
            label: 'Open Emergency & Triage Workspace',
            href: '/emergency-triage',
            icon: 'alert-triangle',
        },
        {
            label: 'Open Inpatient Ward Workspace',
            href: '/inpatient-ward',
            icon: 'clipboard-list',
        },
        {
            label: 'Open Theatre & Procedures Workspace',
            href: '/theatre-procedures',
            icon: 'scissors',
        },
        {
            label: 'Open Admissions - Admitted Today',
            href: buildHref('/admissions', { status: 'admitted', from: today }),
            icon: 'bed-double',
        },
        {
            label: 'Open Admissions - Discharged Today',
            href: buildHref('/admissions', { status: 'discharged', from: today }),
            icon: 'bed-double',
        },
        {
            label: 'Open Admissions - Transferred Today',
            href: buildHref('/admissions', { status: 'transferred', from: today }),
            icon: 'bed-double',
        },
        {
            label: 'Open Admissions - Cancelled Today',
            href: buildHref('/admissions', { status: 'cancelled', from: today }),
            icon: 'bed-double',
        },
        {
            label: 'Open Staff - Active Profiles',
            href: buildHref('/staff', { status: 'active' }),
            icon: 'users',
        },
        {
            label: 'Open Staff - Suspended Profiles',
            href: buildHref('/staff', { status: 'suspended' }),
            icon: 'users',
        },
        {
            label: 'Open Staff - Inactive Profiles',
            href: buildHref('/staff', { status: 'inactive' }),
            icon: 'users',
        },
        {
            label: 'Open Staff Credentialing Workspace',
            href: '/staff-credentialing',
            icon: 'shield-check',
        },
        {
            label: 'Open Staff Privileging Workspace',
            href: '/staff-privileges',
            icon: 'shield-check',
        },
        {
            label: 'Open Laboratory - Ordered Queue (Compact)',
            href: buildHref('/laboratory-orders', { status: 'ordered', from: today }),
            icon: 'flask-conical',
            compactRows: true,
        },
        {
            label: 'Open Pharmacy - Pending Queue (Compact)',
            href: buildHref('/pharmacy-orders', { status: 'pending', from: today }),
            icon: 'pill',
            compactRows: true,
        },
        {
            label: 'Open Radiology - Orders Workspace',
            href: '/radiology-orders',
            icon: 'activity',
        },
        {
            label: 'Open Billing - Today Collections (Compact)',
            href: buildHref('/billing-invoices', {
                paymentActivityFrom: today,
                paymentActivityTo: today,
            }),
            icon: 'receipt',
            compactRows: true,
        },
        {
            label: 'Open Billing - Outstanding This Week (Compact)',
            href: buildHref('/billing-invoices', {
                'statusIn[]': ['issued', 'partially_paid'],
                from: today,
                to: weekAhead,
            }),
            icon: 'receipt',
            compactRows: true,
        },
        {
            label: 'Open Billing - Issued This Week (Compact)',
            href: buildHref('/billing-invoices', {
                status: 'issued',
                from: today,
                to: weekAhead,
            }),
            icon: 'receipt',
            compactRows: true,
        },
        {
            label: 'Open Billing - Partially Paid Today (Compact)',
            href: buildHref('/billing-invoices', {
                status: 'partially_paid',
                from: today,
                to: today,
            }),
            icon: 'receipt',
            compactRows: true,
        },
        {
            label: 'Open Billing Payer Contracts Workspace',
            href: '/billing-payer-contracts',
            icon: 'stethoscope',
        },
        {
            label: 'Open Service Price List Workspace',
            href: '/billing-service-catalog',
            icon: 'receipt',
        },
        {
            label: 'Open Claims & Insurance Workspace',
            href: '/claims-insurance',
            icon: 'shield-check',
        },
        {
            label: 'Open Inventory & Procurement Workspace',
            href: '/inventory-procurement',
            icon: 'package',
        },
        {
            label: 'Open Supplier Admin Workspace',
            href: '/inventory-procurement/suppliers',
            icon: 'package',
        },
        {
            label: 'Open Warehouse Admin Workspace',
            href: '/inventory-procurement/warehouses',
            icon: 'building-2',
        },
        {
            label: 'Open Approval Cases - Submitted Queue',
            href: buildHref('/platform/admin/user-approval-cases', { status: 'submitted' }),
            icon: 'clipboard-list',
        },
        {
            label: 'Open Facility Configuration Workspace',
            href: '/platform/admin/facility-config',
            icon: 'building-2',
        },
        {
            label: 'Open Clinical Care Catalogs Workspace',
            href: '/platform/admin/clinical-catalogs',
            icon: 'book-open',
        },
    ];
});

const visibleRoutes = computed(() =>
    filterItemsByRouteAccess(routes, permissionNames.value),
);

const visibleCreateWorkflowRoutes = computed(() =>
    filterItemsByRouteAccess(createWorkflowRoutes, permissionNames.value),
);

const visibleQueuePresets = computed(() =>
    filterItemsByRouteAccess(queuePresets.value, permissionNames.value),
);

const visibleWorkflowActions = computed(() =>
    filterItemsByRouteAccess(workflowActions.value, permissionNames.value),
);

const isMac = computed(() => {
    if (typeof window === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/i.test(window.navigator.platform);
});

function togglePalette() {
    open.value = !open.value;
}

function goToRoute(href: string) {
    open.value = false;
    router.visit(href);
}

function setCompactRowsPreference(enabled: boolean) {
    try {
        window.localStorage.setItem('opd.queueRows.compact', enabled ? '1' : '0');
    } catch {
        // ignore localStorage failures and continue with navigation
    }
}

function runWorkflowAction(action: WorkflowActionCommand) {
    if (typeof action.compactRows === 'boolean') {
        setCompactRowsPreference(action.compactRows);
    }

    goToRoute(action.href);
}

function refreshCurrentPage() {
    open.value = false;
    window.location.reload();
}

function onGlobalKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        togglePalette();
        return;
    }

    if (isTypingTarget) return;

    if (event.key.toLowerCase() === 'g') {
        // command palette handles fuzzy search; do not hijack two-key sequences here yet
        return;
    }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown));
</script>

<template>
    <div class="flex items-center gap-2">
        <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-9 min-w-[200px] gap-2"
            @click="togglePalette"
        >
            <AppIcon name="activity" class="size-4" />
            <span class="hidden md:inline">Quick Switch</span>
            <span class="md:hidden">Command</span>
            <span class="hidden items-center gap-1 md:inline-flex">
                <Kbd>{{ isMac ? 'Cmd' : 'Ctrl' }}</Kbd>
                <Kbd>K</Kbd>
            </span>
        </Button>

        <CommandDialog
            v-model:open="open"
            title="OPD Quick Switch"
            description="Jump between OPD workflow screens and run quick actions."
        >
            <CommandInput placeholder="Search screens or actions..." />
            <CommandList>
                <CommandEmpty>No matching OPD command.</CommandEmpty>

                <CommandGroup v-if="visibleRoutes.length" heading="Navigate">
                    <CommandItem
                        v-for="routeItem in visibleRoutes"
                        :key="routeItem.href"
                        :value="routeItem.label"
                        @select="goToRoute(routeItem.href)"
                    >
                        <AppIcon :name="routeItem.icon" class="size-4" />
                        <span>{{ routeItem.label }}</span>
                        <CommandShortcut>{{ routeItem.shortcut }}</CommandShortcut>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator v-if="visibleRoutes.length && visibleQueuePresets.length" />

                <CommandGroup v-if="visibleQueuePresets.length" heading="Queue Presets">
                    <CommandItem
                        v-for="preset in visibleQueuePresets"
                        :key="preset.href"
                        :value="preset.label"
                        @select="goToRoute(preset.href)"
                    >
                        <AppIcon :name="preset.icon" class="size-4" />
                        <span>{{ preset.label }}</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator
                    v-if="
                        (visibleRoutes.length || visibleQueuePresets.length) &&
                        visibleCreateWorkflowRoutes.length
                    "
                />

                <CommandGroup v-if="visibleCreateWorkflowRoutes.length" heading="Create Workflow">
                    <CommandItem
                        v-for="createRoute in visibleCreateWorkflowRoutes"
                        :key="createRoute.label"
                        :value="createRoute.label"
                        @select="goToRoute(createRoute.href)"
                    >
                        <AppIcon :name="createRoute.icon" class="size-4" />
                        <span>{{ createRoute.label }}</span>
                        <CommandShortcut>{{ createRoute.shortcut }}</CommandShortcut>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator
                    v-if="
                        (visibleRoutes.length || visibleQueuePresets.length || visibleCreateWorkflowRoutes.length) &&
                        visibleWorkflowActions.length
                    "
                />

                <CommandGroup v-if="visibleWorkflowActions.length" heading="Workflow Actions">
                    <CommandItem
                        v-for="action in visibleWorkflowActions"
                        :key="action.label"
                        :value="action.label"
                        @select="runWorkflowAction(action)"
                    >
                        <AppIcon :name="action.icon" class="size-4" />
                        <span>{{ action.label }}</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Actions">
                    <CommandItem value="Refresh current page" @select="refreshCurrentPage">
                        <AppIcon name="activity" class="size-4" />
                        <span>Refresh Current Page</span>
                        <CommandShortcut>R</CommandShortcut>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    </div>
</template>




