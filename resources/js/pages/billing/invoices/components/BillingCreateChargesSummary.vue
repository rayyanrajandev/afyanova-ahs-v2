<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Props {
    createLineItemsCount: number;
    createLineItemsSubtotal: number;
    currencyCode: string | null;
    defaultCurrencyCode: string;
    createCoverageSettlementPathDisplay: string;
    createCoverageExpectedPayerDisplay: string;
    createCoverageExpectedPatientDisplay: string;
    createCoverageClaimPostureDisplay: string;
    canReadBillingServiceCatalog: boolean;
    billingServiceCatalogError: string | null;
    billingServiceCatalogLoading: boolean;
    billingServiceCatalogItemsCount: number;
    catalogCurrencyCodeLabel: string;
    createLineItemsError: string | null;
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
}

defineProps<Props>();
</script>

<template>
    <div class="space-y-4 rounded-lg border p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div class="space-y-1">
                <p class="text-sm font-medium">Charge workspace</p>
                <p class="text-xs text-muted-foreground">
                    Start from the basket, then open only the one line you need
                    to review or edit.
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                    {{ createLineItemsCount }} items
                </Badge>
                <Badge variant="secondary">
                    {{ formatMoney(createLineItemsSubtotal, currencyCode || defaultCurrencyCode) }}
                </Badge>
            </div>
        </div>

        <div class="rounded-lg border bg-muted/20 p-3">
            <div class="grid grid-cols-4 gap-3">
                <div class="space-y-1">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Billing Path
                    </p>
                    <p class="text-sm font-medium text-foreground">
                        {{ createCoverageSettlementPathDisplay }}
                    </p>
                </div>
                <div class="space-y-1">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Primary Payer
                    </p>
                    <p class="text-sm font-medium text-foreground">
                        {{ createCoverageExpectedPayerDisplay }}
                    </p>
                </div>
                <div class="space-y-1">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Patient Share
                    </p>
                    <p class="text-sm font-medium text-foreground">
                        {{ createCoverageExpectedPatientDisplay }}
                    </p>
                </div>
                <div class="space-y-1">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Coverage Readiness
                    </p>
                    <p class="text-sm font-medium text-foreground">
                        {{ createCoverageClaimPostureDisplay }}
                    </p>
                </div>
            </div>
        </div>

        <Alert
            v-if="canReadBillingServiceCatalog && billingServiceCatalogError"
            variant="destructive"
        >
            <AlertTitle>Service catalog unavailable</AlertTitle>
            <AlertDescription>
                {{ billingServiceCatalogError }}
            </AlertDescription>
        </Alert>
        <Alert
            v-else-if="
                canReadBillingServiceCatalog &&
                !billingServiceCatalogLoading &&
                billingServiceCatalogItemsCount === 0
            "
            class="py-2"
        >
            <AlertDescription class="space-y-1 text-sm leading-5">
                <p class="font-medium text-foreground">
                    No active billable services for
                    {{ catalogCurrencyCodeLabel }}.
                </p>
                <p class="flex flex-wrap items-center gap-1 text-muted-foreground">
                    <span>Use</span>
                    <span
                        class="rounded border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
                    >
                        Exception charge
                    </span>
                    <span>
                        only when a central tariff is genuinely unavailable.
                    </span>
                </p>
            </AlertDescription>
        </Alert>
        <Alert v-else-if="!canReadBillingServiceCatalog">
            <AlertTitle>Catalog pricing not available</AlertTitle>
            <AlertDescription>
                Billing service-catalog access is not available for this user,
                so invoice lines must be entered as governed exception charges.
            </AlertDescription>
        </Alert>

        <p
            v-if="createLineItemsError"
            class="text-xs text-destructive"
        >
            {{ createLineItemsError }}
        </p>
    </div>
</template>
