<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { filterItemsByRouteAccess } from '@/lib/routeAccess';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Help & Shortcuts', href: '/help/shortcuts' },
];

// â”€â”€â”€ Shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type ShortcutItem = {
    action: string;
    keys: string[];
    notes?: string;
};

const shortcuts: ShortcutItem[] = [
    {
        action: 'Open OPD quick command palette',
        keys: ['Ctrl', 'K'],
        notes: 'On Mac use Cmd + K.',
    },
    {
        action: 'Search queue records quickly',
        keys: ['Type in search field'],
        notes: 'Search auto-runs after a short pause on OPD queue screens.',
    },
    {
        action: 'Run queue preset from command palette',
        keys: ['Ctrl', 'K'],
        notes: 'Use queue presets for scheduled/checked-in/lab/pharmacy/billing states.',
    },
];

// â”€â”€â”€ Role-aware workflow tips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type TipGroup = {
    label: string;
    /** Empty = shown to everyone. Otherwise shown only when user has a matching role code. Elevated admins always see all. */
    roleMatch: string[];
    tips: string[];
};

const allTipGroups: TipGroup[] = [
    {
        label: 'General Navigation',
        roleMatch: [],
        tips: [
            'Use header "Create workflow" chips to move between Consultation, Lab, Pharmacy, and Billing without losing context.',
            'Use "Back to Consultation" and "Back to Appointments" links to return with appointment focus preserved.',
            'Use "Compact Rows" in busy queues for faster scanning. Preference is shared across OPD queues.',
            'Use advanced filters only when needed; each page remembers whether advanced filters were expanded.',
        ],
    },
    {
        label: 'Clinical Workflow',
        roleMatch: ['CLINICIAN', 'DOCTOR', 'NURSE', 'NURSING', 'EMERGENCY'],
        tips: [
            'Triage categories (P1â€“P5) sort the appointments queue automatically â€” P1 critical patients always appear first.',
            'The Emergency preset on the dashboard shows a critical alert banner when any P1 patient is in the queue.',
            'Use "Record Triage" in the appointments queue to set priority before the provider starts consultation.',
            'Theatre, Lab, and Radiology orders linked to a visit are visible in the visit side panel under the relevant tab.',
        ],
    },
    {
        label: 'Front Desk & Admissions',
        roleMatch: ['FRONT_DESK', 'RECEPTIONIST', 'ADMISSIONS'],
        tips: [
            'Walk-in patients without a booked slot show an amber "Walk-in" badge in the appointments queue.',
            'Use the quick booking chip in the Appointments header to add a new slot without navigating away.',
            'Patient demographics and insurance details can be updated from the patient record at any time.',
            'The Admissions page tracks inpatient bed assignment â€” use it after a clinician orders admission.',
        ],
    },
    {
        label: 'Billing & Finance',
        roleMatch: ['CASHIER', 'BILLING', 'FINANCE', 'ACCOUNTANT'],
        tips: [
            'The POS workspace handles cash and card receipts for walk-in payments and over-the-counter sales.',
            'Use the Billing queue preset on the dashboard to see invoices awaiting settlement.',
            'Claims adjudication workspace tracks insurance pre-authorisation and claim submission status.',
            'Billable Service Catalog is the master source for tariffs â€” changes here affect all new invoices.',
        ],
    },
    {
        label: 'Platform Administration',
        roleMatch: ['PLATFORM_SUPER_ADMIN', 'FACILITY_ADMIN', 'FACILITY_SUPER_ADMIN', 'ADMIN'],
        tips: [
            'The Platform RBAC workspace controls role permissions across the entire platform.',
            'Facility Subscription Plans define which modules are available to each facility â€” changes take effect immediately.',
            'The Facility Rollouts command centre allows multi-facility provisioning from a single workspace.',
            'Service plan entitlements gate sidebar navigation â€” users will not see modules their facility plan does not include.',
        ],
    },
];

// â”€â”€â”€ Grouped quick links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type PageLink = { title: string; href: string; note: string };
type PageGroup = { label: string; icon: string; pages: PageLink[] };

const pageGroups: PageGroup[] = [
    {
        label: 'Outpatient & Front Desk',
        icon: 'calendar-clock',
        pages: [
            { title: 'Patients', href: '/patients', note: 'Front desk lookup + registration' },
            { title: 'Appointments', href: '/appointments', note: 'Check-in queue + quick booking' },
            { title: 'Admissions', href: '/admissions', note: 'Inpatient admission list + status transitions' },
        ],
    },
    {
        label: 'Clinical & Care',
        icon: 'heart-pulse',
        pages: [
            { title: 'Medical Records', href: '/medical-records', note: 'Consultation + records review' },
            { title: 'Emergency & Triage', href: '/emergency-triage', note: 'Rapid intake and triage workspace' },
            { title: 'Inpatient Ward', href: '/inpatient-ward', note: 'Ward census and nursing workflow' },
            { title: 'Theatre & Procedures', href: '/theatre-procedures', note: 'Procedure/surgical workflow' },
        ],
    },
    {
        label: 'Diagnostics',
        icon: 'stethoscope',
        pages: [
            { title: 'Laboratory', href: '/laboratory-orders', note: 'Lab order queue + status updates' },
            { title: 'Radiology', href: '/radiology-orders', note: 'Imaging order workspace' },
            { title: 'Pharmacy', href: '/pharmacy-orders', note: 'Dispense queue + status updates' },
        ],
    },
    {
        label: 'Finance & Revenue',
        icon: 'circle-check-big',
        pages: [
            { title: 'Billing', href: '/billing-invoices', note: 'Invoice queue + settlement actions' },
            { title: 'Billable Service Catalog', href: '/billing-service-catalog', note: 'Billable services, tariffs, and pricing history' },
            { title: 'Point of Sale', href: '/pos', note: 'Cashier workspace for receipts and shift closeout' },
            { title: 'Claims & Insurance', href: '/claims-insurance', note: 'Claims adjudication workflow' },
        ],
    },
    {
        label: 'Supply Chain',
        icon: 'layout-list',
        pages: [
            { title: 'Inventory & Procurement', href: '/inventory-procurement', note: 'Stock and procurement workflow' },
            { title: 'Supplier Admin', href: '/inventory-procurement/suppliers', note: 'Supplier registry and status management' },
            { title: 'Warehouse Admin', href: '/inventory-procurement/warehouses', note: 'Warehouse registry and status management' },
        ],
    },
    {
        label: 'People & Staff',
        icon: 'user-check',
        pages: [
            { title: 'Staff', href: '/staff', note: 'Staff profile directory + credentialing updates' },
        ],
    },
    {
        label: 'Platform Administration',
        icon: 'panel-right-open',
        pages: [
            { title: 'Platform Users', href: '/platform/admin/users', note: 'Identity lifecycle administration' },
            { title: 'Platform RBAC', href: '/platform/admin/roles', note: 'Role and permission administration' },
            { title: 'Clinical Specialties', href: '/platform/admin/specialties', note: 'Specialty registry and staff-specialty assignment' },
            { title: 'Departments', href: '/platform/admin/departments', note: 'Department master-data administration' },
            { title: 'Service Points', href: '/platform/admin/service-points', note: 'Service point resource administration' },
            { title: 'Ward/Beds', href: '/platform/admin/ward-beds', note: 'Ward and bed resource administration' },
            { title: 'Facility Configuration', href: '/platform/admin/facility-config', note: 'Tenant, facility, owner, and subscription assignment' },
            { title: 'Facility Subscription Plans', href: '/platform/admin/service-plans', note: 'Facility subscription packages, fees, and entitlements' },
            { title: 'Facility Rollouts', href: '/platform/admin/facility-rollouts', note: 'Multi-facility rollout queue and command-centre controls' },
        ],
    },
];

// â”€â”€â”€ Platform access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const {
    permissionNames,
    sessionRoleCodes,
    hasUniversalAdminAccess,
    facilityEntitlementNames,
    isPlatformSuperAdmin,
    isFacilitySuperAdmin,
    scope,
} = usePlatformAccess();

// Role tier badge
const roleTier = computed<'platform_super_admin' | 'facility_admin' | 'standard'>(() => {
    if (isPlatformSuperAdmin.value) return 'platform_super_admin';
    if (isFacilitySuperAdmin.value) return 'facility_admin';
    return 'standard';
});

const roleTierLabel = computed(() => {
    if (roleTier.value === 'platform_super_admin') return 'Platform Super Admin';
    if (roleTier.value === 'facility_admin') return 'Facility Admin';
    return 'Standard User';
});

const roleTierBadgeClass = computed(() => {
    if (roleTier.value === 'platform_super_admin')
        return 'border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/50';
    if (roleTier.value === 'facility_admin')
        return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    return '';
});

// Tip groups filtered to role codes (elevated admins see all)
const visibleTipGroups = computed(() => {
    const codes = sessionRoleCodes.value.map((c) => c.toUpperCase());
    const elevated = roleTier.value !== 'standard';
    return allTipGroups.filter((g) => {
        if (g.roleMatch.length === 0) return true;
        if (elevated) return true;
        return g.roleMatch.some((match) => codes.some((code) => code.includes(match)));
    });
});

// Quick-link groups: each group filtered by access; empty groups hidden
const visiblePageGroups = computed(() =>
    pageGroups
        .map((group) => ({
            ...group,
            pages: filterItemsByRouteAccess(
                group.pages,
                permissionNames.value,
                hasUniversalAdminAccess.value,
                facilityEntitlementNames.value,
            ),
        }))
        .filter((group) => group.pages.length > 0),
);
</script>

<template>
    <Head title="Help & Shortcuts" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 md:p-6">

            <!-- PAGE HEADER â€” card-shell pattern (matches patients / appointments / dashboard) -->
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                            <AppIcon name="book-open" class="size-5 text-primary" />
                        </div>
                        <div class="min-w-0">
                            <h1 class="text-base font-semibold leading-tight tracking-tight text-foreground">
                                Help & Shortcuts
                            </h1>
                            <p class="mt-0.5 truncate text-xs text-muted-foreground">
                                <span v-if="scope?.facility?.name">{{ scope.facility.name }}</span>
                                <span v-if="scope?.facility?.name && scope?.tenant?.name" class="mx-1 opacity-40">Â·</span>
                                <span v-if="scope?.tenant?.name">{{ scope.tenant.name }}</span>
                                <span v-if="!scope?.facility?.name && !scope?.tenant?.name">
                                    Keyboard shortcuts, workflow tips, and screen navigation
                                </span>
                            </p>
                        </div>
                    </div>

                    <!-- Role context ribbon -->
                    <div class="flex shrink-0 flex-wrap items-center gap-2">
                        <Badge variant="outline" class="rounded-lg text-xs" :class="roleTierBadgeClass">
                            {{ roleTierLabel }}
                        </Badge>
                        <Badge
                            v-for="code in sessionRoleCodes.slice(0, 3)"
                            :key="code"
                            variant="outline"
                            class="rounded-lg font-mono text-[10px] text-muted-foreground"
                        >
                            {{ code }}
                        </Badge>
                        <Badge
                            v-if="sessionRoleCodes.length > 3"
                            variant="outline"
                            class="rounded-lg text-[10px] text-muted-foreground"
                        >
                            +{{ sessionRoleCodes.length - 3 }} more
                        </Badge>
                    </div>
                </div>
            </section>

            <!-- Service plan note -->
            <Card class="rounded-lg border-sidebar-border/70 border-dashed bg-muted/20">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Service plan & navigation</CardTitle>
                    <CardDescription>
                        The sidebar, command palette, and this list hide modules that are not included in your facility's
                        active subscription, even when your user account has role permissions. That keeps navigation aligned
                        with what the server will allow. If something you expect is missing, ask a facility administrator to
                        review the subscription plan and entitlements.
                    </CardDescription>
                </CardHeader>
            </Card>

            <!-- Documentation links -->
            <Card class="border-sidebar-border/70 rounded-lg">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Documentation & Contracts</CardTitle>
                    <CardDescription>
                        Project docs and workflow contracts (open in new tab).
                    </CardDescription>
                </CardHeader>
                <CardContent class="flex flex-wrap gap-2 pt-0">
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/project-restructure-plan" target="_blank">Project Plan</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/controlled-breadth-first-plan" target="_blank">Breadth Plan</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/emergency-triage-v1-contract" target="_blank">Emergency & Triage</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/inpatient-ward-operations-v1-contract" target="_blank">Inpatient Ward</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/theatre-procedure-workflow-v1-contract" target="_blank">Theatre/Procedure</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/claims-insurance-adjudication-v1-contract" target="_blank">Claims/Insurance</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/inventory-procurement-stores-v1-contract" target="_blank">Inventory/Procurement</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/supplier-management-v1-contract" target="_blank">Supplier Management</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/warehouse-management-v1-contract" target="_blank">Warehouse Management</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/clinical-specialty-registry-v1-contract" target="_blank">Clinical Specialties</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/department-management-v1-contract" target="_blank">Departments</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/service-point-ward-resource-registry-v1-contract" target="_blank">Service/Ward Resources</Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/platform-multi-facility-rollout-operations-v1-contract" target="_blank">Facility Rollouts</Link>
                    </Button>
                </CardContent>
            </Card>

            <!-- Keyboard shortcuts + role-aware tips side-by-side -->
            <div class="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-2">
                        <CardTitle class="text-base">Keyboard & Command Palette</CardTitle>
                        <CardDescription>
                            Fast navigation and queue setup without leaving the keyboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3 pt-0">
                        <div
                            v-for="item in shortcuts"
                            :key="item.action"
                            class="rounded-lg border p-3"
                        >
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <p class="text-sm font-medium">{{ item.action }}</p>
                                <div class="flex flex-wrap items-center gap-1">
                                    <template
                                        v-for="(key, index) in item.keys"
                                        :key="`${item.action}-${key}-${index}`"
                                    >
                                        <Kbd>{{ key }}</Kbd>
                                        <span
                                            v-if="index < item.keys.length - 1 && item.keys.length > 1"
                                            class="text-xs text-muted-foreground"
                                        >
                                            +
                                        </span>
                                    </template>
                                </div>
                            </div>
                            <p v-if="item.notes" class="mt-2 text-xs text-muted-foreground">
                                {{ item.notes }}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <!-- Role-aware workflow tips -->
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-2">
                        <CardTitle class="text-base">Workflow Tips</CardTitle>
                        <CardDescription>
                            Filtered to your role â€” showing tips relevant to your access level.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-5 pt-0">
                        <div v-for="group in visibleTipGroups" :key="group.label">
                            <p class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                {{ group.label }}
                            </p>
                            <div class="space-y-2">
                                <div
                                    v-for="tip in group.tips"
                                    :key="tip"
                                    class="rounded-lg border bg-muted/30 p-3 text-sm"
                                >
                                    {{ tip }}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <!-- Role-aware grouped quick links -->
            <Card class="border-sidebar-border/70 rounded-lg">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Quick Links</CardTitle>
                    <CardDescription>
                        Grouped by function and filtered to your current role permissions and service plan.
                    </CardDescription>
                </CardHeader>

                <CardContent v-if="visiblePageGroups.length" class="space-y-7 pt-0">
                    <div v-for="group in visiblePageGroups" :key="group.label">
                        <!-- Group header with divider -->
                        <div class="mb-3 flex items-center gap-2">
                            <div class="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
                                <AppIcon :name="group.icon" class="size-3.5 text-muted-foreground" />
                            </div>
                            <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {{ group.label }}
                            </p>
                            <div class="h-px flex-1 bg-border" />
                        </div>

                        <!-- Pages grid -->
                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <div
                                v-for="page in group.pages"
                                :key="page.href"
                                class="rounded-lg border p-3 transition-colors hover:bg-muted/30"
                            >
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-medium">{{ page.title }}</p>
                                        <p class="mt-1 text-xs text-muted-foreground">{{ page.note }}</p>
                                    </div>
                                    <Button size="sm" variant="outline" as-child class="shrink-0">
                                        <Link :href="page.href">Open</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>

                <!-- Empty state â€” inventory pattern -->
                <CardContent v-else class="pt-0">
                    <div class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                        <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                            <AppIcon name="circle-x" class="size-5 text-muted-foreground/40" />
                        </div>
                        <div>
                            <p class="text-sm font-medium text-muted-foreground">No quick links available</p>
                            <p class="mt-0.5 text-xs text-muted-foreground/70">
                                No workflow screens are accessible with your current permissions and service plan.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
    </AppLayout>
</template>
