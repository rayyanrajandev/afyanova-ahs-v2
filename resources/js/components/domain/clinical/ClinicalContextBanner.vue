<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge, type BadgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const props = withDefaults(
    defineProps<{
        title?: string;
        description?: string;
        patientName?: string | null;
        patientMeta?: string | null;
        patientNumber?: string | null;
        facilityName?: string | null;
        tenantName?: string | null;
        contextLabel?: string | null;
        contextMeta?: string | null;
        statusLabel?: string | null;
        statusVariant?: BadgeVariants['variant'];
        locked?: boolean;
        emptyTitle?: string;
        emptyDescription?: string;
        tone?: 'default' | 'muted' | 'warning';
    }>(),
    {
        title: 'Clinical context',
        description: '',
        patientName: null,
        patientMeta: null,
        patientNumber: null,
        facilityName: null,
        tenantName: null,
        contextLabel: null,
        contextMeta: null,
        statusLabel: null,
        statusVariant: 'secondary',
        locked: false,
        emptyTitle: 'No patient context selected',
        emptyDescription: 'Select a patient or open this workflow from a clinical handoff.',
        tone: 'default',
    },
);

const hasPatientContext = computed(() => Boolean(props.patientName || props.patientMeta || props.patientNumber));
const hasFacilityContext = computed(() => Boolean(props.facilityName || props.tenantName));
const hasWorkflowContext = computed(() => Boolean(props.contextLabel || props.contextMeta));
const hasAnyContext = computed(() => hasPatientContext.value || hasFacilityContext.value || hasWorkflowContext.value);

const toneClasses = computed(() => {
    if (props.tone === 'warning') {
        return 'border-amber-300 bg-amber-50 text-amber-950';
    }

    if (props.tone === 'muted') {
        return 'border-border bg-muted/20';
    }

    return 'border-border bg-card';
});
</script>

<template>
    <section
        :class="cn(
            'w-full rounded-lg border px-3 py-3 shadow-sm',
            toneClasses,
        )"
        aria-live="polite"
    >
        <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div class="min-w-0">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <div
                        class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15"
                        aria-hidden="true"
                    >
                        <AppIcon :name="locked ? 'shield-check' : 'user'" class="size-4" />
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-semibold leading-5 text-foreground">
                            {{ hasAnyContext ? title : emptyTitle }}
                        </p>
                        <p v-if="description || !hasAnyContext" class="text-xs leading-5 text-muted-foreground">
                            {{ hasAnyContext ? description : emptyDescription }}
                        </p>
                    </div>
                </div>
            </div>

            <div v-if="statusLabel || $slots.actions" class="flex shrink-0 flex-wrap items-center gap-2 justify-start lg:justify-end">
                <Badge v-if="statusLabel" :variant="statusVariant">{{ statusLabel }}</Badge>
                <slot name="actions" />
            </div>

            <div
                v-if="hasAnyContext"
                class="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-2 text-sm lg:col-span-2"
            >
                <div v-if="hasPatientContext" class="min-w-0 rounded-md border bg-background/70 px-3 py-2">
                    <div class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <AppIcon name="user" class="size-3" aria-hidden="true" />
                        Patient
                    </div>
                    <p class="mt-1 truncate font-medium text-foreground">{{ patientName || 'Selected patient' }}</p>
                    <p v-if="patientMeta || patientNumber" class="mt-0.5 truncate text-xs text-muted-foreground">
                        {{ patientMeta || patientNumber }}
                    </p>
                </div>

                <div v-if="hasFacilityContext" class="min-w-0 rounded-md border bg-background/70 px-3 py-2">
                    <div class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <AppIcon name="building-2" class="size-3" aria-hidden="true" />
                        Facility
                    </div>
                    <p class="mt-1 truncate font-medium text-foreground">{{ facilityName || 'No facility selected' }}</p>
                    <p v-if="tenantName" class="mt-0.5 truncate text-xs text-muted-foreground">{{ tenantName }}</p>
                </div>

                <div v-if="hasWorkflowContext" class="min-w-0 rounded-md border bg-background/70 px-3 py-2">
                    <div class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <AppIcon name="activity" class="size-3" aria-hidden="true" />
                        Workflow
                    </div>
                    <p class="mt-1 truncate font-medium text-foreground">{{ contextLabel || 'Active workflow' }}</p>
                    <p v-if="contextMeta" class="mt-0.5 truncate text-xs text-muted-foreground">{{ contextMeta }}</p>
                </div>
            </div>
        </div>

        <div v-if="$slots.default" class="mt-3">
            <slot />
        </div>
    </section>
</template>
