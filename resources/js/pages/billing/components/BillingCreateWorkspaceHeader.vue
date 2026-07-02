<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type BillingCreateStage = 'context' | 'charges' | 'finalize';

interface Props {
    createWorkspaceTitle: string;
    createWorkspaceDescription: string;
    showPatientChartReturn: boolean;
    createPatientChartHref: string;
    showConsultationReturn: boolean;
    consultationContextHref: string;
    consultationReturnLabel: string;
    createInvoiceStage: BillingCreateStage;
    createLineItemsCount: number;
    createWorkspaceReviewStepDescription: string;
    createWorkspaceModeBadgeLabel: string;
    createWorkspaceIsEditingDraft: boolean;
    createWorkspaceDraftInvoiceLabel: string | null;
    hasActiveDraft: boolean;
    createContextActiveDraftLabel: string;
    createContextActiveDraftDescription: string;
    createContextActiveDraftSummary: string | null;
    hasPendingCreateWorkflow: boolean;
    createContextActiveDraftError: string | null;
    createContextActiveDraftLoading: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
    'update:createInvoiceStage': [stage: BillingCreateStage];
    'continue-active-draft': [];
    'preview-active-draft': [];
}>();

function selectStage(stage: BillingCreateStage): void {
    emit('update:createInvoiceStage', stage);
}
</script>

<template>
    <div class="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div class="flex flex-wrap items-center gap-2">
            <Button
                v-if="showPatientChartReturn"
                variant="outline"
                size="sm"
                as-child
            >
                <Link :href="createPatientChartHref">
                    <AppIcon name="arrow-left" class="size-3.5" />
                    Back to Patient Chart
                </Link>
            </Button>
            <Button
                v-if="showConsultationReturn"
                variant="outline"
                size="sm"
                as-child
            >
                <Link :href="consultationContextHref">
                    <AppIcon name="arrow-left" class="size-3.5" />
                    {{ consultationReturnLabel }}
                </Link>
            </Button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <Badge variant="outline" class="rounded-lg">
                {{ createWorkspaceModeBadgeLabel }}
            </Badge>
            <Badge
                v-if="createWorkspaceIsEditingDraft"
                variant="secondary"
                class="rounded-lg"
            >
                {{ createWorkspaceDraftInvoiceLabel || 'Draft invoice' }}
            </Badge>
        </div>
    </div>
    <div class="space-y-4">
        <div class="rounded-lg border bg-muted/20 p-2">
            <div class="grid gap-2 md:grid-cols-3">
                <button
                    type="button"
                    class="rounded-lg border px-4 py-3 text-left transition-colors"
                    :class="
                        createInvoiceStage === 'context'
                            ? 'border-primary/40 bg-muted/20 shadow-sm'
                            : 'border-transparent bg-transparent hover:border-border/70 hover:bg-muted/20'
                    "
                    @click="selectStage('context')"
                >
                    <p class="text-sm font-medium text-foreground">1. Context</p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        Confirm patient, visit link, and settlement route.
                    </p>
                </button>
                <button
                    type="button"
                    class="rounded-lg border px-4 py-3 text-left transition-colors"
                    :class="
                        createInvoiceStage === 'charges'
                            ? 'border-primary/40 bg-muted/20 shadow-sm'
                            : 'border-transparent bg-transparent hover:border-border/70 hover:bg-muted/20'
                    "
                    @click="selectStage('charges')"
                >
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-sm font-medium text-foreground">2. Charges</p>
                        <Badge variant="outline" class="text-[10px]">
                            {{ createLineItemsCount }} items
                        </Badge>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">
                        Import services or add governed exception charges.
                    </p>
                </button>
                <button
                    type="button"
                    class="rounded-lg border px-4 py-3 text-left transition-colors"
                    :class="
                        createInvoiceStage === 'finalize'
                            ? 'border-primary/40 bg-muted/20 shadow-sm'
                            : 'border-transparent bg-transparent hover:border-border/70 hover:bg-muted/20'
                    "
                    @click="selectStage('finalize')"
                >
                    <p class="text-sm font-medium text-foreground">3. Review & Save</p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ createWorkspaceReviewStepDescription }}
                    </p>
                </button>
            </div>
        </div>
        <Alert
            v-if="hasActiveDraft"
            class="border-primary/20 bg-primary/5"
        >
            <AlertTitle class="flex flex-wrap items-center gap-2">
                <span>Active draft already in progress</span>
                <Badge variant="secondary" class="rounded-lg">
                    {{ createContextActiveDraftLabel }}
                </Badge>
            </AlertTitle>
            <AlertDescription class="space-y-3">
                <p>
                    {{ createContextActiveDraftDescription }}
                </p>
                <div
                    v-if="createContextActiveDraftSummary"
                    class="text-xs text-muted-foreground"
                >
                    {{ createContextActiveDraftSummary }}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        v-if="!hasPendingCreateWorkflow"
                        type="button"
                        size="sm"
                        class="gap-1.5"
                        @click="emit('continue-active-draft')"
                    >
                        <AppIcon name="folder-open" class="size-3.5" />
                        Continue active draft
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="gap-1.5"
                        @click="emit('preview-active-draft')"
                    >
                        <AppIcon name="file-search" class="size-3.5" />
                        View current draft
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
        <Alert
            v-else-if="createContextActiveDraftError"
            variant="destructive"
            class="py-2"
        >
            <AlertTitle>Draft continuity check unavailable</AlertTitle>
            <AlertDescription>
                {{ createContextActiveDraftError }}
            </AlertDescription>
        </Alert>
        <div
            v-else-if="createContextActiveDraftLoading"
            class="flex items-center gap-2 text-xs text-muted-foreground"
        >
            <AppIcon name="loader-circle" class="size-3.5 animate-spin" />
            Checking for an active draft in this billing context...
        </div>
    </div>
</template>
