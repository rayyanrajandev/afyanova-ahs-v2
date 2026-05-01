<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

type PatientRow = {
    id: string;
    name: string;
    bedNumber: string;
    status: 'stable' | 'monitoring' | 'critical' | 'pending-discharge';
    lastVitals: string;
    primaryConcern: string;
    assignedCareTeam?: string[];
};

type AlertItem = {
    id: string;
    patientName: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
    actionHref?: string;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

const { scope } = usePlatformAccess();
const activeTab = ref<'alerts' | 'rounds' | 'tasks'>('rounds');

const facilityName = computed(() => scope.value?.facility?.name ?? 'My Facility');

/**
 * Mock alerts - in production, these would come from real-time API
 */
const alerts: AlertItem[] = [
    {
        id: 'alert-1',
        patientName: 'John Mbugua',
        severity: 'critical',
        message: 'High fever, temperature 40.2°C',
        timestamp: '2 min ago',
        actionHref: '/patients/uuid-1/chart',
    },
    {
        id: 'alert-2',
        patientName: 'Mary Kipchoge',
        severity: 'warning',
        message: 'Pending medication review',
        timestamp: '15 min ago',
        actionHref: '/patients/uuid-2/chart',
    },
];

/**
 * Mock ward rounds - in production, these would be real patient list
 */
const wardPatients: PatientRow[] = [
    {
        id: 'pt-1',
        name: 'John Mbugua',
        bedNumber: 'A-12',
        status: 'critical',
        lastVitals: '5 min ago',
        primaryConcern: 'High fever, dehydration',
    },
    {
        id: 'pt-2',
        name: 'Mary Kipchoge',
        bedNumber: 'A-15',
        status: 'monitoring',
        lastVitals: '12 min ago',
        primaryConcern: 'Post-op monitoring',
    },
    {
        id: 'pt-3',
        name: 'Samuel Kimani',
        bedNumber: 'B-8',
        status: 'stable',
        lastVitals: '30 min ago',
        primaryConcern: 'Routine observation',
    },
];

/**
 * Mock tasks - in production, these would be nurse tasks/orders
 */
const nurseTasks = [
    {
        id: 'task-1',
        title: 'Medication - Paracetamol 500mg',
        patient: 'John Mbugua (A-12)',
        dueTime: '14:00',
        priority: 'high' as const,
        completed: false,
    },
    {
        id: 'task-2',
        title: 'Vitals check - All patients',
        patient: 'Ward rounds',
        dueTime: '15:00',
        priority: 'high' as const,
        completed: false,
    },
    {
        id: 'task-3',
        title: 'Wound dressing - Mary Kipchoge',
        patient: 'Mary Kipchoge (A-15)',
        dueTime: '15:30',
        priority: 'medium' as const,
        completed: false,
    },
];

const statusBadgeVariant = (status: PatientRow['status']) => {
    switch (status) {
        case 'critical':
            return 'destructive';
        case 'monitoring':
            return 'secondary';
        case 'stable':
            return 'outline';
        case 'pending-discharge':
            return 'secondary';
        default:
            return 'outline';
    }
};

const statusIcon = (status: PatientRow['status']) => {
    switch (status) {
        case 'critical':
            return 'alert-circle';
        case 'monitoring':
            return 'eye';
        case 'stable':
            return 'check-circle';
        case 'pending-discharge':
            return 'log-out';
        default:
            return 'help-circle';
    }
};
</script>

<template>
    <Head title="Nursing - Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-3 md:gap-5 md:p-6">

            <!-- Header -->
            <div class="flex flex-col gap-1">
                <div class="flex items-baseline justify-between gap-2">
                    <h1 class="text-xl font-semibold md:text-2xl">Nursing</h1>
                    <p class="truncate text-xs text-muted-foreground md:text-sm">{{ facilityName }}</p>
                </div>
                <p class="text-xs text-muted-foreground md:text-sm">
                    Ward rounds, patient monitoring, and care tasks
                </p>
            </div>

            <!-- Critical Alerts Banner -->
            <div v-if="alerts.length > 0" class="grid gap-2">
                <div
                    v-for="alert in alerts"
                    :key="alert.id"
                    class="flex items-start gap-2 rounded-lg border-l-4 border-destructive bg-destructive/5 px-3 py-2 md:px-4 md:py-3"
                >
                    <AppIcon :name="alert.severity === 'critical' ? 'alert-circle' : 'alert-triangle'" class="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-medium md:text-sm">{{ alert.patientName }}</p>
                        <p class="mt-0.5 text-[11px] text-muted-foreground md:text-xs">{{ alert.message }}</p>
                    </div>
                    <Link v-if="alert.actionHref" :href="alert.actionHref" as="div">
                        <Button size="sm" variant="outline" class="h-7 gap-1 px-2 text-[11px] md:text-xs">
                            View
                            <AppIcon name="chevron-right" class="size-3" />
                        </Button>
                    </Link>
                </div>
            </div>

            <!-- Tabs: Rounds / Tasks / Alerts -->
            <Tabs v-model="activeTab" class="flex-1 overflow-hidden">
                <TabsList class="w-full justify-start">
                    <TabsTrigger value="rounds" class="gap-1.5 text-xs md:text-sm">
                        <AppIcon name="users" class="size-3.5" />
                        <span>Ward Rounds</span>
                    </TabsTrigger>
                    <TabsTrigger value="tasks" class="gap-1.5 text-xs md:text-sm">
                        <AppIcon name="check-square" class="size-3.5" />
                        <span>Tasks</span>
                    </TabsTrigger>
                    <TabsTrigger v-if="alerts.length > 0" value="alerts" class="gap-1.5 text-xs md:text-sm">
                        <AppIcon name="alert-circle" class="size-3.5" />
                        <span>Alerts</span>
                    </TabsTrigger>
                </TabsList>

                <!-- Ward Rounds Tab -->
                <TabsContent value="rounds" class="space-y-2 md:space-y-3">
                    <div class="space-y-2 md:space-y-3">
                        <div
                            v-for="patient in wardPatients"
                            :key="patient.id"
                            class="rounded-lg border border-sidebar-border/70 p-3 md:p-4"
                        >
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <p class="font-semibold text-xs md:text-sm">{{ patient.name }}</p>
                                        <Badge variant="outline" class="text-[10px]">Bed {{ patient.bedNumber }}</Badge>
                                    </div>
                                    <p class="mt-1 text-[11px] text-muted-foreground md:text-xs">
                                        {{ patient.primaryConcern }}
                                    </p>
                                    <p class="mt-0.5 text-[10px] text-muted-foreground">
                                        Vitals: {{ patient.lastVitals }}
                                    </p>
                                </div>
                                <div class="flex shrink-0 flex-col items-end gap-1.5">
                                    <Badge :variant="statusBadgeVariant(patient.status)" class="text-[10px]">
                                        <AppIcon :name="statusIcon(patient.status)" class="mr-1 size-3" />
                                        {{ patient.status }}
                                    </Badge>
                                    <Link href="#" as="div">
                                        <Button size="sm" variant="outline" class="h-6 gap-1 px-1.5 text-[10px]">
                                            <AppIcon name="stethoscope" class="size-3" />
                                            <span class="hidden sm:inline">View</span>
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <!-- Tasks Tab -->
                <TabsContent value="tasks" class="space-y-2 md:space-y-3">
                    <div class="space-y-2 md:space-y-3">
                        <div
                            v-for="task in nurseTasks"
                            :key="task.id"
                            class="flex items-start gap-2 rounded-lg border border-sidebar-border/70 p-3 md:p-4"
                        >
                            <input
                                type="checkbox"
                                :checked="task.completed"
                                class="mt-1 size-4 rounded border-muted-foreground transition-colors md:size-4"
                            />
                            <div class="min-w-0 flex-1">
                                <p class="text-xs font-semibold md:text-sm" :class="task.completed ? 'line-through text-muted-foreground' : ''">
                                    {{ task.title }}
                                </p>
                                <p class="mt-0.5 text-[11px] text-muted-foreground md:text-xs">
                                    {{ task.patient }}
                                </p>
                                <div class="mt-1 flex items-center gap-2">
                                    <Badge :variant="task.priority === 'high' ? 'destructive' : 'secondary'" class="text-[9px]">
                                        {{ task.priority }}
                                    </Badge>
                                    <span class="text-[10px] text-muted-foreground">{{ task.dueTime }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <!-- Alerts Tab -->
                <TabsContent value="alerts" class="space-y-2 md:space-y-3">
                    <div class="space-y-2 md:space-y-3">
                        <div
                            v-for="alert in alerts"
                            :key="alert.id"
                            class="rounded-lg border border-l-4 border-destructive p-3 md:p-4"
                        >
                            <div class="flex items-start gap-2">
                                <AppIcon name="alert-circle" class="mt-0.5 size-4 shrink-0 text-destructive" />
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-semibold md:text-sm">{{ alert.patientName }}</p>
                                    <p class="mt-0.5 text-[11px] text-muted-foreground md:text-xs">{{ alert.message }}</p>
                                    <p class="mt-1 text-[10px] text-muted-foreground">{{ alert.timestamp }}</p>
                                </div>
                                <Link v-if="alert.actionHref" :href="alert.actionHref" as="div">
                                    <Button size="sm" variant="outline" class="h-6 gap-1 px-1.5 text-[10px]">
                                        View
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

        </div>
    </AppLayout>
</template>
