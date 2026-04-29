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

const workflowTips = [
    'Use header "Create workflow" chips to move between Consultation, Lab, Pharmacy, and Billing without losing context.',
    'Use "Back to Consultation" and "Back to Appointments" links to return with appointment focus preserved.',
    'Use "Compact Rows" in busy queues for faster scanning. Preference is shared across OPD queues.',
    'Use advanced filters only when needed; each page remembers whether advanced filters were expanded.',
];

const queuePages = [
    { title: 'Patients', href: '/patients', note: 'Front desk lookup + registration' },
    { title: 'Appointments', href: '/appointments', note: 'Check-in queue + quick booking' },
    { title: 'Admissions', href: '/admissions', note: 'Inpatient admission list + status transitions' },
    { title: 'Medical Records', href: '/medical-records', note: 'Consultation + records review' },
    { title: 'Emergency & Triage', href: '/emergency-triage', note: 'Rapid intake and triage workspace foundation' },
    { title: 'Inpatient Ward', href: '/inpatient-ward', note: 'Ward census and nursing workflow foundation' },
    { title: 'Theatre & Procedures', href: '/theatre-procedures', note: 'Procedure/surgical workflow foundation' },
    { title: 'Laboratory', href: '/laboratory-orders', note: 'Lab order queue + status updates' },
    { title: 'Pharmacy', href: '/pharmacy-orders', note: 'Dispense queue + status updates' },
    { title: 'Radiology', href: '/radiology-orders', note: 'Imaging order workspace foundation' },
    { title: 'Billing', href: '/billing-invoices', note: 'Invoice queue + settlement actions' },
    { title: 'Point of Sale', href: '/pos', note: 'Cashier workspace for receipts, quick lanes, and shift closeout' },
    { title: 'Claims & Insurance', href: '/claims-insurance', note: 'Claims adjudication workflow foundation' },
    { title: 'Inventory & Procurement', href: '/inventory-procurement', note: 'Stock and procurement workflow foundation' },
    { title: 'Supplier Admin', href: '/inventory-procurement/suppliers', note: 'Supplier registry and status management workspace' },
    { title: 'Warehouse Admin', href: '/inventory-procurement/warehouses', note: 'Warehouse registry and status management workspace' },
    { title: 'Staff', href: '/staff', note: 'Staff profile directory + credentialing updates' },
    { title: 'Platform Users', href: '/platform/admin/users', note: 'Identity lifecycle administration workspace' },
    { title: 'Platform RBAC', href: '/platform/admin/roles', note: 'Role and permission administration workspace' },
    { title: 'Clinical Specialties', href: '/platform/admin/specialties', note: 'Specialty registry and staff-specialty assignment workspace' },
    { title: 'Departments', href: '/platform/admin/departments', note: 'Department master-data administration workspace' },
    { title: 'Service Points', href: '/platform/admin/service-points', note: 'Service point resource administration workspace' },
    { title: 'Ward/Beds', href: '/platform/admin/ward-beds', note: 'Ward and bed resource administration workspace' },
    { title: 'Facility Rollouts', href: '/platform/admin/facility-rollouts', note: 'Multi-facility rollout queue and command-center controls' },
];

const { permissionNames } = usePlatformAccess();

const visibleQueuePages = computed(() =>
    filterItemsByRouteAccess(queuePages, permissionNames.value),
);
</script>

<template>
    <Head title="Help & Shortcuts" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 md:p-6">
            <!-- PAGE HEADER -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="book-open" class="size-7 text-primary" />
                        Help & Shortcuts
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Quick reference for keyboard shortcuts, queue presets, and workflow navigation patterns.
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Badge variant="outline">OPD</Badge>
                    <Button size="sm" variant="outline" as-child>
                        <Link href="/docs/opd-ui-sprint1-workflow-status" target="_blank">
                            Sprint Status
                        </Link>
                    </Button>
                </div>
            </div>

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

                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-2">
                        <CardTitle class="text-base">Workflow Tips</CardTitle>
                        <CardDescription>
                            Patterns implemented in the OPD UI to reduce clicks and avoid context loss.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-2 pt-0">
                        <div
                            v-for="tip in workflowTips"
                            :key="tip"
                            class="rounded-lg border bg-muted/30 p-3 text-sm"
                        >
                            {{ tip }}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card class="border-sidebar-border/70 rounded-lg">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">OPD Screen Quick Links</CardTitle>
                    <CardDescription>
                        Primary workflow screens used during outpatient operations.
                    </CardDescription>
                </CardHeader>
                <CardContent
                    v-if="visibleQueuePages.length"
                    class="grid gap-3 pt-0 md:grid-cols-2 xl:grid-cols-3"
                >
                    <div
                        v-for="page in visibleQueuePages"
                        :key="page.href"
                        class="rounded-lg border p-3"
                    >
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <p class="text-sm font-medium">{{ page.title }}</p>
                                <p class="mt-1 text-xs text-muted-foreground">{{ page.note }}</p>
                            </div>
                            <Button size="sm" variant="outline" as-child>
                                <Link :href="page.href">Open</Link>
                            </Button>
                        </div>
                    </div>
                </CardContent>
                <CardContent v-else class="pt-0">
                    <div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No workflow quick links are available for the current permissions.
                    </div>
                </CardContent>
            </Card>
        </div>
    </AppLayout>
</template>
