<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CreateContextEditorTab } from '../types';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

interface Props {
    createOrderContextSummary: string;
    createPatientContextLocked: boolean;
    createFormPatientId: string;
    createFormAppointmentId: string;
    createFormAdmissionId: string;
    createPatientContextMeta: string | null;
    createPatientContextLabel: string;
    hasCreateAppointmentContext: boolean;
    createAppointmentContextLabel: string;
    createAppointmentContextMeta: string | null;
    createAppointmentContextReason: string | null;
    createAppointmentContextStatusLabel: string | null;
    createAppointmentContextStatusVariant: BadgeVariant;
    createAppointmentContextSourceLabel: string | null;
    hasCreateAdmissionContext: boolean;
    createAdmissionContextLabel: string;
    createAdmissionContextMeta: string | null;
    createAdmissionContextReason: string | null;
    createAdmissionContextStatusLabel: string | null;
    createAdmissionContextStatusVariant: BadgeVariant;
    createAdmissionContextSourceLabel: string | null;
    hasSourceWorkflowContext: boolean;
    sourceWorkflowKindBadge: string;
    sourceWorkflowReference: string;
    sourceWorkflowHref: string | null;
    sourceWorkflowSummary: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'open-context-dialog': [
        tab: CreateContextEditorTab,
        options?: { unlockPatient?: boolean },
    ];
    'clear-clinical-links': [];
}>();

const canUnlinkClinicalContext = computed(
    () =>
        !props.createPatientContextLocked &&
        (
            props.createFormAppointmentId.trim() !== '' ||
            props.createFormAdmissionId.trim() !== ''
        ),
);

function openContextDialog(): void {
    const preferredTab: CreateContextEditorTab = props.createPatientContextLocked
        ? 'patient'
        : props.hasCreateAppointmentContext
          ? 'appointment'
          : props.hasCreateAdmissionContext
            ? 'admission'
            : 'patient';

    emit('open-context-dialog', preferredTab, {
        unlockPatient: props.createPatientContextLocked,
    });
}
</script>

<template>
    <div class="rounded-lg border bg-muted/20 p-3">
        <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0 space-y-1.5">
                    <p class="text-sm font-medium">Patient & order context</p>
                    <p class="text-xs text-muted-foreground">
                        {{ createOrderContextSummary }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button
                        id="billing-open-context-dialog"
                        variant="outline"
                        size="sm"
                        class="gap-1.5"
                        @click="openContextDialog"
                    >
                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                        {{
                            createPatientContextLocked
                                ? 'Change patient'
                                : 'Review or change context'
                        }}
                    </Button>
                    <Button
                        v-if="canUnlinkClinicalContext"
                        variant="outline"
                        size="sm"
                        class="gap-1.5"
                        @click="emit('clear-clinical-links')"
                    >
                        <AppIcon name="unlink" class="size-3.5" />
                        Unlink context
                    </Button>
                </div>
            </div>
            <div class="grid gap-2 lg:grid-cols-3">
                <div
                    class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                    :class="
                        createFormPatientId
                            ? 'border-primary/30 bg-primary/5'
                            : 'bg-muted/20'
                    "
                >
                    <AppIcon name="user" class="size-3.5 shrink-0 text-muted-foreground" />
                    <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-center gap-2">
                            <span class="shrink-0 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                                Patient
                            </span>
                            <span
                                class="truncate text-sm font-medium"
                                :title="createPatientContextMeta"
                            >
                                {{ createPatientContextLabel }}
                            </span>
                        </div>
                    </div>
                    <Badge
                        v-if="createPatientContextLocked"
                        variant="secondary"
                        class="shrink-0 text-[10px]"
                    >
                        Locked
                    </Badge>
                </div>
                <div
                    class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                    :class="
                        hasCreateAppointmentContext
                            ? 'border-primary/30 bg-primary/5'
                            : 'bg-muted/20'
                    "
                >
                    <AppIcon name="calendar-clock" class="size-3.5 shrink-0 text-muted-foreground" />
                    <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-center gap-2">
                            <span class="shrink-0 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                                Appointment
                            </span>
                            <span
                                class="truncate text-sm font-medium"
                                :title="[createAppointmentContextLabel, createAppointmentContextMeta, createAppointmentContextReason].filter(Boolean).join(' | ')"
                            >
                                {{ createAppointmentContextLabel }}
                            </span>
                        </div>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Badge
                            v-if="createAppointmentContextStatusLabel"
                            :variant="createAppointmentContextStatusVariant"
                            class="text-[10px]"
                        >
                            {{ createAppointmentContextStatusLabel }}
                        </Badge>
                        <Badge
                            v-if="createAppointmentContextSourceLabel"
                            variant="outline"
                            class="text-[10px]"
                        >
                            {{ createAppointmentContextSourceLabel }}
                        </Badge>
                    </div>
                </div>
                <div
                    class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                    :class="
                        hasCreateAdmissionContext
                            ? 'border-primary/30 bg-primary/5'
                            : 'bg-muted/20'
                    "
                >
                    <AppIcon name="bed-double" class="size-3.5 shrink-0 text-muted-foreground" />
                    <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-center gap-2">
                            <span class="shrink-0 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                                Admission
                            </span>
                            <span
                                class="truncate text-sm font-medium"
                                :title="[createAdmissionContextLabel, createAdmissionContextMeta, createAdmissionContextReason].filter(Boolean).join(' | ')"
                            >
                                {{ createAdmissionContextLabel }}
                            </span>
                        </div>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Badge
                            v-if="createAdmissionContextStatusLabel"
                            :variant="createAdmissionContextStatusVariant"
                            class="text-[10px]"
                        >
                            {{ createAdmissionContextStatusLabel }}
                        </Badge>
                        <Badge
                            v-if="createAdmissionContextSourceLabel"
                            variant="outline"
                            class="text-[10px]"
                        >
                            {{ createAdmissionContextSourceLabel }}
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div
        v-if="hasSourceWorkflowContext"
        class="rounded-lg border border-dashed bg-muted/10 p-3"
    >
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 space-y-1">
                <p class="text-sm font-medium">Source workflow</p>
                <p class="text-xs text-muted-foreground">
                    Billing context was opened from a clinical order for traceability.
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                    {{ sourceWorkflowKindBadge }}
                </Badge>
                <Badge variant="outline">
                    {{ sourceWorkflowReference }}
                </Badge>
                <Button
                    v-if="sourceWorkflowHref"
                    size="sm"
                    variant="outline"
                    class="gap-1.5"
                    as-child
                >
                    <Link :href="sourceWorkflowHref">
                        <AppIcon name="arrow-up-right" class="size-3.5" />
                        Open source order
                    </Link>
                </Button>
            </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
            {{ sourceWorkflowSummary }}
        </p>
    </div>
</template>
