<script setup lang="ts">
import { computed } from 'vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { formatDate, formatPercent } from '../helpers';
import type {
    BillingCreateCoverageMode,
    BillingDraftExecutionPreview,
    BillingInvoicePayerPreview,
    BillingInvoiceVisitCoverage,
} from '../types';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

type CoverageMetricBadge = {
    key: string;
    label: string;
    variant: BadgeVariant;
};

interface Props {
    createCoverageStatusTone: BadgeVariant;
    createCoverageStatusLabel: string;
    createBillingDraftPreviewLoading: boolean;
    hasCreateBillingDraftPreviewInvoice: boolean;
    createCoverageMode: BillingCreateCoverageMode;
    createBillingPayerContractId: string;
    createCoverageModeContextHint: string | null;
    createVisitCoverage: BillingInvoiceVisitCoverage | null;
    createVisitCoverageSummary: string | null;
    createVisitCoverageContractLabel: string | null;
    canReadBillingPayerContracts: boolean;
    createBillingPayerContractOptions: SearchableSelectOption[];
    createCoverageContractHelperText: string;
    billingPayerContractsLoading: boolean;
    createBillingPayerContractIdError: string | null;
    billingPayerContractsError: string | null;
    billingPayerContractsLoaded: boolean;
    billingPayerContractsCount: number;
    createDraftExecutionPreview: BillingDraftExecutionPreview;
    createCoverageSettlementPathDisplay: string;
    createCoverageExpectedPayerDisplay: string;
    createCoverageExpectedPatientDisplay: string;
    selectedCreateBillingPayerPreview: BillingInvoicePayerPreview;
    createBillingDraftPreviewCoverageMetricBadges: CoverageMetricBadge[];
    createBillingDraftPreviewNegotiatedCount: number;
    createCoverageBlockingReasons: string[];
    createCoverageGuidance: string[];
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'set-coverage-mode': [mode: BillingCreateCoverageMode];
    'clear-billing-payer-contract': [];
    'update:billing-payer-contract-id': [value: string];
}>();

const showLivePayerPolicyBadge = computed(
    () =>
        !props.createBillingDraftPreviewLoading &&
        props.hasCreateBillingDraftPreviewInvoice,
);
const showSelectedContractDetails = computed(
    () =>
        props.createCoverageMode === 'third_party' &&
        Boolean(props.selectedCreateBillingPayerPreview.selectedContract),
);
const showCoverageMetricBadges = computed(
    () =>
        props.createCoverageMode === 'third_party' &&
        (
            props.createBillingDraftPreviewCoverageMetricBadges.length > 0 ||
            props.createBillingDraftPreviewNegotiatedCount > 0
        ),
);
const selectedContractCopayLabel = computed(() => {
    if (props.selectedCreateBillingPayerPreview.copayType === 'fixed') {
        return props.formatMoney(
            props.selectedCreateBillingPayerPreview.copayAmount,
            props.selectedCreateBillingPayerPreview.currencyCode,
        );
    }

    if (props.selectedCreateBillingPayerPreview.copayType === 'percentage') {
        return `${formatPercent(props.selectedCreateBillingPayerPreview.copayValue)} / ${props.formatMoney(
            props.selectedCreateBillingPayerPreview.copayAmount,
            props.selectedCreateBillingPayerPreview.currencyCode,
        )}`;
    }

    return 'None';
});
const selectedContractEffectiveWindowLabel = computed(() => {
    const contract = props.selectedCreateBillingPayerPreview.selectedContract;
    if (!contract) return null;

    const parts = [
        contract.effectiveFrom ? `From ${formatDate(contract.effectiveFrom)}` : null,
        contract.effectiveTo ? `To ${formatDate(contract.effectiveTo)}` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(' | ') : null;
});

function updateBillingPayerContractId(value: string): void {
    emit('update:billing-payer-contract-id', value);
}
</script>

<template>
    <div class="space-y-3 rounded-lg border p-3">
        <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div class="space-y-1">
                <p class="text-sm font-medium">Billing responsibility</p>
                <p class="text-xs text-muted-foreground">
                    Choose whether the patient pays directly or a linked payer contract covers part or all of this invoice.
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Badge :variant="createCoverageStatusTone">
                    {{ createCoverageStatusLabel }}
                </Badge>
                <Badge
                    v-if="createBillingDraftPreviewLoading"
                    variant="outline"
                >
                    Refreshing live preview
                </Badge>
                <Badge
                    v-else-if="showLivePayerPolicyBadge"
                    variant="secondary"
                >
                    Live payer policy
                </Badge>
                <Button
                    v-if="createCoverageMode === 'third_party' && createBillingPayerContractId.trim()"
                    type="button"
                    size="sm"
                    variant="outline"
                    @click="emit('clear-billing-payer-contract')"
                >
                    Clear contract
                </Button>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
            <button
                type="button"
                class="rounded-lg border px-4 py-3 text-left transition-colors"
                :class="
                    createCoverageMode === 'self_pay'
                        ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
                        : 'border-border/70 bg-muted/20 hover:border-primary/30'
                "
                @click="emit('set-coverage-mode', 'self_pay')"
            >
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-medium text-foreground">
                        Self-pay / cash
                    </p>
                    <Badge
                        :variant="
                            createCoverageMode === 'self_pay'
                                ? 'secondary'
                                : 'outline'
                        "
                    >
                        {{
                            createCoverageMode === 'self_pay'
                                ? 'Selected'
                                : 'Available'
                        }}
                    </Badge>
                </div>
                <p class="mt-1 text-xs text-muted-foreground">
                    Patient or family settles the invoice directly. No claim routing is expected from this invoice.
                </p>
            </button>
            <button
                type="button"
                class="rounded-lg border px-4 py-3 text-left transition-colors"
                :class="
                    createCoverageMode === 'third_party'
                        ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
                        : 'border-border/70 bg-muted/20 hover:border-primary/30'
                "
                @click="emit('set-coverage-mode', 'third_party')"
            >
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-medium text-foreground">
                        Third-party coverage
                    </p>
                    <Badge
                        :variant="
                            createCoverageMode === 'third_party'
                                ? 'secondary'
                                : 'outline'
                        "
                    >
                        {{
                            createCoverageMode === 'third_party'
                                ? 'Selected'
                                : 'Available'
                        }}
                    </Badge>
                </div>
                <p class="mt-1 text-xs text-muted-foreground">
                    Insurance, employer, government, donor, or sponsor settles part of the invoice through a payer contract.
                </p>
            </button>
        </div>

        <p
            v-if="createCoverageModeContextHint"
            class="text-xs text-muted-foreground"
        >
            {{ createCoverageModeContextHint }}
        </p>

        <Alert v-if="createVisitCoverage" class="py-2">
            <AlertTitle>Visit coverage inherited</AlertTitle>
            <AlertDescription>
                {{ createVisitCoverageSummary }}
                <span v-if="createVisitCoverageContractLabel">
                    | {{ createVisitCoverageContractLabel }}
                </span>
                <span v-else-if="createVisitCoverage.billingPayerContractId">
                    | linked payer contract
                </span>
                <span
                    v-else-if="
                        createVisitCoverage.financialClass &&
                        createVisitCoverage.financialClass !== 'self_pay'
                    "
                >
                    | Billing should link the exact payer contract before issuing a claim.
                </span>
            </AlertDescription>
        </Alert>

        <div
            v-if="
                createCoverageMode === 'third_party' &&
                canReadBillingPayerContracts
            "
            class="grid gap-2"
        >
            <SearchableSelectField
                input-id="bil-create-payer-contract"
                label="Payer Contract"
                :model-value="createBillingPayerContractId"
                :options="createBillingPayerContractOptions"
                placeholder="Select contract for third-party billing"
                search-placeholder="Search contract code, payer, plan"
                :helper-text="createCoverageContractHelperText"
                empty-text="No matching payer contract found."
                :disabled="billingPayerContractsLoading"
                @update:model-value="updateBillingPayerContractId"
            />
            <p
                v-if="createBillingPayerContractIdError"
                class="text-xs text-destructive"
            >
                {{ createBillingPayerContractIdError }}
            </p>
        </div>

        <Alert
            v-else-if="createCoverageMode === 'third_party'"
            class="py-2"
        >
            <AlertTitle>Payer contract access unavailable</AlertTitle>
            <AlertDescription>
                This user cannot browse payer contracts here, so billing stays self-pay unless another billing user links the contract.
            </AlertDescription>
        </Alert>

        <Alert
            v-if="
                createCoverageMode === 'third_party' &&
                canReadBillingPayerContracts &&
                billingPayerContractsError
            "
            variant="destructive"
            class="py-2"
        >
            <AlertTitle>Payer contracts unavailable</AlertTitle>
            <AlertDescription>
                {{ billingPayerContractsError }}
            </AlertDescription>
        </Alert>
        <Alert
            v-else-if="
                createCoverageMode === 'third_party' &&
                canReadBillingPayerContracts &&
                billingPayerContractsLoaded &&
                !billingPayerContractsLoading &&
                billingPayerContractsCount === 0
            "
            class="py-2"
        >
            <AlertDescription>
                No active payer contracts are available in this billing scope. Keep the invoice as self-pay until payer contract master data is added.
            </AlertDescription>
        </Alert>

        <div class="rounded-lg bg-muted/30 p-3">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Draft execution after issue
                    </p>
                    <p class="mt-1 text-sm font-medium text-foreground">
                        {{ createDraftExecutionPreview.title }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ createDraftExecutionPreview.helper }}
                    </p>
                </div>
                <Badge :variant="createDraftExecutionPreview.badgeVariant">
                    {{ createDraftExecutionPreview.afterIssueLabel }}
                </Badge>
            </div>
        </div>

        <div class="grid grid-cols-4 gap-3">
            <div class="rounded-lg bg-background/80 p-3">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Billing Path
                </p>
                <p class="mt-1 text-sm font-medium text-foreground">
                    {{ createCoverageSettlementPathDisplay }}
                </p>
            </div>
            <div class="rounded-lg bg-background/80 p-3">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Payer Share
                </p>
                <p class="mt-1 text-sm font-medium text-foreground">
                    {{ createCoverageExpectedPayerDisplay }}
                </p>
            </div>
            <div class="rounded-lg bg-background/80 p-3">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Patient Share
                </p>
                <p class="mt-1 text-sm font-medium text-foreground">
                    {{ createCoverageExpectedPatientDisplay }}
                </p>
            </div>
            <div class="rounded-lg bg-background/80 p-3">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                    After Issue Queue
                </p>
                <p class="mt-1 text-sm font-medium text-foreground">
                    {{ createDraftExecutionPreview.afterIssueLabel }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                    {{ createDraftExecutionPreview.afterIssueHelper }}
                </p>
            </div>
        </div>

        <div
            v-if="showSelectedContractDetails"
            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
            <Badge variant="outline">
                Coverage
                {{ formatPercent(selectedCreateBillingPayerPreview.coveragePercent) }}
            </Badge>
            <Badge variant="outline">
                Copay
                {{ selectedContractCopayLabel }}
            </Badge>
            <Badge
                v-if="selectedCreateBillingPayerPreview.requiresPreAuthorization"
                variant="outline"
            >
                Pre-authorization required
            </Badge>
            <Badge
                v-if="selectedContractEffectiveWindowLabel"
                variant="outline"
            >
                {{ selectedContractEffectiveWindowLabel }}
            </Badge>
        </div>
        <div
            v-if="showCoverageMetricBadges"
            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
            <Badge
                v-for="badge in createBillingDraftPreviewCoverageMetricBadges"
                :key="`create-preview-badge-${badge.key}`"
                :variant="badge.variant"
            >
                {{ badge.label }}
            </Badge>
            <Badge
                v-if="createBillingDraftPreviewNegotiatedCount > 0"
                variant="secondary"
            >
                {{
                    `${createBillingDraftPreviewNegotiatedCount} negotiated price${createBillingDraftPreviewNegotiatedCount === 1 ? '' : 's'}`
                }}
            </Badge>
        </div>

        <Alert
            v-if="createCoverageBlockingReasons.length > 0"
            variant="destructive"
            class="py-2"
        >
            <AlertTitle>Coverage review needed</AlertTitle>
            <AlertDescription class="space-y-1 text-sm leading-5">
                <p
                    v-for="reason in createCoverageBlockingReasons"
                    :key="`create-payer-block-${reason}`"
                >
                    {{ reason }}
                </p>
            </AlertDescription>
        </Alert>
        <Alert
            v-else-if="createCoverageGuidance.length > 0"
            class="py-2"
        >
            <AlertDescription class="space-y-1 text-sm leading-5">
                <p
                    v-for="guidance in createCoverageGuidance"
                    :key="`create-payer-guidance-${guidance}`"
                >
                    {{ guidance }}
                </p>
            </AlertDescription>
        </Alert>
        <p
            v-if="createBillingDraftPreviewLoading"
            class="text-xs text-muted-foreground"
        >
            Refreshing negotiated price and payer policy preview from the current draft line items.
        </p>
        <p
            v-else-if="hasCreateBillingDraftPreviewInvoice"
            class="text-xs text-muted-foreground"
        >
            Live preview already reflects negotiated prices and active payer policy. Final validation runs again when the invoice is saved.
        </p>
    </div>
</template>
