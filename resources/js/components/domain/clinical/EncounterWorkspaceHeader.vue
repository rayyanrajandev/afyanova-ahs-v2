<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type PatientSummary = {
    patientNumber: string | null;
};

defineProps<{
    loading: boolean;
    hasPatient: boolean;
    patientSummary: PatientSummary | null;
    patientName: string;
    patientInitials: string;
    headerContextLine: string | null;
    patientContextMeta: string;
    patientChartHref: string | null;
    backLabel: string;
    backIcon: string;
    introTitle: string;
    introText: string;
    noteTypeLabel: string;
    workflowLabel: string;
    workflowStatusLabel: string | null;
    workflowStatusVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    statusPrimaryLabel: string;
    statusPrimaryVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    draftHeaderAlert: {
        label: string;
        detail: string | null;
        tone: 'info' | 'warning';
    } | null;
}>();

const emit = defineEmits<{
    back: [];
}>();
</script>

<template>
    <section
        id="encounter-workspace-header"
        class="rounded-lg border border-border bg-card shadow-sm"
        data-test="encounter-workspace-header"
        aria-label="Encounter workspace header"
        :aria-busy="loading"
    >
        <div
            v-if="loading"
            class="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:gap-6"
        >
            <div class="flex min-w-0 items-center gap-3">
                <div
                    class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                    aria-hidden="true"
                >
                    <AppIcon name="stethoscope" class="size-5" />
                </div>
                <div class="min-w-0 space-y-1">
                    <p
                        class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                        {{ introTitle }}
                    </p>
                    <div class="flex flex-wrap items-center gap-2">
                        <Skeleton class="h-5 w-40 rounded-lg" />
                        <Skeleton class="h-5 w-28 rounded-full" />
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                        <Skeleton class="h-5 w-16 rounded-full" />
                        <Skeleton class="h-5 w-24 rounded-full" />
                        <Skeleton class="h-5 w-32 rounded-full" />
                        <Skeleton class="h-5 w-28 rounded-full" />
                    </div>
                    <p class="truncate text-xs text-muted-foreground">
                        Loading patient and visit context...
                    </p>
                </div>
            </div>
            <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                <Button
                    v-if="hasPatient"
                    size="sm"
                    variant="outline"
                    class="h-8 gap-1.5"
                    disabled
                >
                    <AppIcon name="user" class="size-3.5" />
                    Patient chart
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    class="h-8 gap-1.5"
                    data-test="encounter-workspace-back"
                    @click="emit('back')"
                >
                    <AppIcon :name="backIcon" class="size-3.5" />
                    {{ backLabel }}
                </Button>
            </div>
        </div>

        <div
            v-else-if="patientSummary"
            class="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:gap-6"
        >
            <div class="flex min-w-0 items-center gap-3">
                <Avatar
                    class="size-10 shrink-0 rounded-lg bg-primary/10 text-primary"
                >
                    <AvatarFallback
                        class="rounded-lg bg-primary/10 text-sm font-semibold text-primary"
                    >
                        {{ patientInitials }}
                    </AvatarFallback>
                </Avatar>
                <div class="min-w-0 space-y-0.5">
                    <p
                        class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                        {{ introTitle }}
                    </p>
                    <div class="flex flex-wrap items-center gap-2">
                        <h1
                            class="truncate text-base font-semibold tracking-tight md:text-lg"
                        >
                            {{ patientName }}
                        </h1>
                        <Badge
                            v-if="patientSummary.patientNumber"
                            variant="secondary"
                            class="h-5 px-1.5 text-xs"
                        >
                            {{ patientSummary.patientNumber }}
                        </Badge>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <Badge
                            :variant="statusPrimaryVariant"
                            class="h-5 px-1.5 text-xs"
                            data-test="encounter-workspace-status-badge"
                        >
                            {{ statusPrimaryLabel }}
                        </Badge>
                        <Badge
                            variant="outline"
                            class="h-5 px-1.5 text-xs"
                        >
                            {{ noteTypeLabel }}
                        </Badge>
                        <Badge
                            variant="secondary"
                            class="h-5 px-1.5 text-xs"
                        >
                            {{ workflowLabel }}
                        </Badge>
                        <Badge
                            v-if="workflowStatusLabel"
                            :variant="workflowStatusVariant"
                            class="h-5 px-1.5 text-xs"
                        >
                            {{ workflowStatusLabel }}
                        </Badge>
                    </div>
                    <p
                        v-if="headerContextLine"
                        class="truncate text-xs text-muted-foreground"
                    >
                        {{ headerContextLine }}
                    </p>
                    <p
                        v-else
                        class="truncate text-xs text-muted-foreground"
                    >
                        {{ patientContextMeta }}
                    </p>
                </div>
            </div>
            <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                <Button
                    v-if="patientChartHref"
                    size="sm"
                    variant="outline"
                    class="h-8 gap-1.5"
                    as-child
                >
                    <Link :href="patientChartHref">
                        <AppIcon name="user" class="size-3.5" />
                        Patient chart
                    </Link>
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    class="h-8 gap-1.5"
                    data-test="encounter-workspace-back"
                    @click="emit('back')"
                >
                    <AppIcon :name="backIcon" class="size-3.5" />
                    {{ backLabel }}
                </Button>
            </div>
        </div>

        <div
            v-else
            class="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:gap-6"
        >
            <div class="flex min-w-0 items-center gap-3">
                <div
                    class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                    aria-hidden="true"
                >
                    <AppIcon name="stethoscope" class="size-5" />
                </div>
                <div class="min-w-0 space-y-0.5">
                    <h1
                        class="text-base font-semibold tracking-tight md:text-lg"
                    >
                        {{ introTitle }}
                    </h1>
                    <p class="truncate text-xs text-muted-foreground">
                        {{ introText }}
                    </p>
                </div>
            </div>
            <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    class="h-8 gap-1.5"
                    data-test="encounter-workspace-back"
                    @click="emit('back')"
                >
                    <AppIcon :name="backIcon" class="size-3.5" />
                    {{ backLabel }}
                </Button>
            </div>
        </div>

        <div
            v-if="draftHeaderAlert"
            class="flex flex-wrap items-center gap-2 px-6 pb-4 pt-0 text-xs"
            role="status"
            data-test="encounter-workspace-draft-alert"
        >
            <AppIcon
                v-if="draftHeaderAlert.tone === 'info'"
                name="loader-circle"
                class="size-3.5 shrink-0 animate-spin text-primary"
            />
            <AppIcon
                v-else
                name="alert-triangle"
                class="size-3.5 shrink-0 text-amber-600"
            />
            <span class="font-medium text-foreground">{{
                draftHeaderAlert.label
            }}</span>
            <span
                v-if="draftHeaderAlert.detail"
                class="text-muted-foreground"
            >
                &middot; {{ draftHeaderAlert.detail }}
            </span>
        </div>
    </section>
</template>
