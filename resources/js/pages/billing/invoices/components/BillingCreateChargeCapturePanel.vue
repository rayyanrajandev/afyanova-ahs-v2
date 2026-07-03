<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEnumLabel } from '@/lib/labels';
import { amountToNumber, formatDateTime } from '../helpers';
import type {
    BillingChargeCaptureCandidate,
    BillingCreateCoverageMode,
} from '../types';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

interface Props {
    patientId: string;
    billingChargeCaptureCoverageBadgeVariant: BadgeVariant;
    billingChargeCaptureCoverageBadgeLabel: string;
    billingChargeCaptureSectionDescription: string;
    billingChargeCaptureReadyCount: number;
    billingChargeCaptureImportedCount: number;
    billingChargeCaptureNeedsTariffCount: number;
    visibleBillingChargeCaptureCandidates: BillingChargeCaptureCandidate[];
    billingChargeCaptureImportableCandidatesCount: number;
    billingChargeCaptureBulkActionLabel: string;
    billingChargeCaptureContextGuidance: string;
    billingChargeCaptureError: string | null;
    billingChargeCaptureLoading: boolean;
    billingChargeCaptureEmptyStateDescription: string;
    importedChargeCaptureCandidateIds: string[];
    createCoverageNeedsContract: boolean;
    createCoverageMode: BillingCreateCoverageMode;
    selectedCreateBillingPayerPreviewClaimReady: boolean;
    currencyCode: string | null;
    defaultCurrencyCode: string;
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'import-ready-candidates': [];
    'import-candidate': [candidate: BillingChargeCaptureCandidate];
}>();

function candidateMetaLabel(candidate: BillingChargeCaptureCandidate): string {
    return [
        `Source ${formatEnumLabel(candidate.sourceWorkflowKind || 'service')}`,
        candidate.sourceWorkflowLabel || candidate.sourceNumber || null,
        candidate.performedAt
            ? `Completed ${formatDateTime(candidate.performedAt)}`
            : null,
        candidate.serviceCode ? `Code ${candidate.serviceCode}` : null,
    ]
        .filter((value): value is string => Boolean(value))
        .join(' | ');
}

function candidateQuantityLabel(candidate: BillingChargeCaptureCandidate): string {
    const quantity = amountToNumber(candidate.quantity ?? null) ?? 1;

    return candidate.unit
        ? `Qty ${quantity} | ${candidate.unit}`
        : `Qty ${quantity}`;
}
</script>

<template>
    <div class="space-y-3 rounded-lg border p-4">
        <div
            v-if="patientId.trim()"
            class="space-y-3"
        >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div class="space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium text-foreground">
                            Clinical services ready to bill
                        </p>
                        <Badge :variant="billingChargeCaptureCoverageBadgeVariant">
                            {{ billingChargeCaptureCoverageBadgeLabel }}
                        </Badge>
                    </div>
                    <p class="text-sm text-muted-foreground">
                        {{ billingChargeCaptureSectionDescription }}
                    </p>
                </div>
                <div class="flex flex-col items-start gap-2 lg:items-end">
                    <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Badge variant="secondary">
                            {{ billingChargeCaptureReadyCount }} priced
                        </Badge>
                        <Badge
                            v-if="billingChargeCaptureImportedCount > 0"
                            variant="outline"
                        >
                            {{ billingChargeCaptureImportedCount }} in draft
                        </Badge>
                    </div>
                    <p
                        v-if="billingChargeCaptureNeedsTariffCount > 0"
                        class="text-xs text-muted-foreground lg:text-right"
                    >
                        {{ billingChargeCaptureNeedsTariffCount }} service{{
                            billingChargeCaptureNeedsTariffCount === 1 ? '' : 's'
                        }} need pricing review.
                    </p>
                    <Button
                        v-if="visibleBillingChargeCaptureCandidates.length > 0"
                        type="button"
                        size="sm"
                        variant="default"
                        class="gap-1.5"
                        :disabled="billingChargeCaptureImportableCandidatesCount === 0"
                        @click="emit('import-ready-candidates')"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        {{ billingChargeCaptureBulkActionLabel }}
                    </Button>
                </div>
            </div>

            <p class="text-xs text-muted-foreground">
                {{ billingChargeCaptureContextGuidance }}
            </p>

            <Alert
                v-if="billingChargeCaptureError"
                variant="destructive"
            >
                <AlertTitle>Charge capture unavailable</AlertTitle>
                <AlertDescription>
                    {{ billingChargeCaptureError }}
                </AlertDescription>
            </Alert>

            <div
                v-else-if="billingChargeCaptureLoading"
                class="space-y-2"
            >
                <Skeleton class="h-16 w-full rounded-md" />
                <Skeleton class="h-16 w-full rounded-md" />
            </div>

            <div
                v-else-if="visibleBillingChargeCaptureCandidates.length === 0"
                class="rounded-md border border-dashed bg-muted/10 px-4 py-4"
            >
                <p class="text-sm font-medium text-foreground">
                    No pending billable services in this patient context
                </p>
                <p class="mt-1 text-sm text-muted-foreground">
                    {{ billingChargeCaptureEmptyStateDescription }}
                </p>
            </div>

            <div v-else class="space-y-2">
                <div
                    v-for="candidate in visibleBillingChargeCaptureCandidates"
                    :key="candidate.id"
                    class="rounded-md border bg-background p-3"
                >
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div class="min-w-0 space-y-1.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="text-sm font-medium text-foreground">
                                    {{ candidate.serviceName || candidate.sourceWorkflowLabel || 'Billable service' }}
                                </p>
                                <Badge variant="outline">
                                    {{ formatEnumLabel(candidate.serviceType || 'service') }}
                                </Badge>
                                <Badge
                                    v-if="candidate.pricingStatus !== 'priced'"
                                    variant="outline"
                                >
                                    {{
                                        candidate.pricingStatus === 'missing_service_code'
                                            ? 'Missing service code'
                                            : 'Needs pricing review'
                                    }}
                                </Badge>
                                <Badge
                                    v-if="importedChargeCaptureCandidateIds.includes(candidate.id)"
                                    variant="secondary"
                                >
                                    In basket
                                </Badge>
                            </div>
                            <p class="text-xs text-muted-foreground">
                                {{ candidateMetaLabel(candidate) }}
                            </p>
                            <p
                                v-if="candidate.pricingStatus !== 'priced'"
                                class="text-xs text-amber-700 dark:text-amber-300"
                            >
                                No billing tariff was resolved yet. Review this charge before invoicing.
                            </p>
                            <p
                                v-else-if="createCoverageNeedsContract"
                                class="text-xs text-amber-700 dark:text-amber-300"
                            >
                                Tariff found. Link the payer contract before issue.
                            </p>
                            <p
                                v-else-if="
                                    createCoverageMode === 'third_party' &&
                                    !selectedCreateBillingPayerPreviewClaimReady
                                "
                                class="text-xs text-muted-foreground"
                            >
                                Tariff found. Claim review is still required.
                            </p>
                        </div>

                        <div class="flex flex-col items-start gap-2 lg:items-end">
                            <p class="text-sm font-medium text-foreground">
                                {{
                                    formatMoney(
                                        candidate.lineTotal ?? candidate.unitPrice ?? 0,
                                        candidate.currencyCode || currencyCode || defaultCurrencyCode,
                                    )
                                }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                {{ candidateQuantityLabel(candidate) }}
                            </p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                class="gap-1.5"
                                :disabled="importedChargeCaptureCandidateIds.includes(candidate.id)"
                                @click="emit('import-candidate', candidate)"
                            >
                                <AppIcon name="plus" class="size-3.5" />
                                {{
                                    importedChargeCaptureCandidateIds.includes(candidate.id)
                                        ? 'In basket'
                                        : 'Add to basket'
                                }}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div
            v-else
            class="rounded-lg border border-dashed px-4 py-4"
        >
            <p class="text-sm font-medium text-foreground">
                Select the patient context first
            </p>
            <p class="mt-1 text-sm text-muted-foreground">
                Clinical-service charge capture becomes available once this invoice is tied to the correct patient visit.
            </p>
        </div>
    </div>
</template>
