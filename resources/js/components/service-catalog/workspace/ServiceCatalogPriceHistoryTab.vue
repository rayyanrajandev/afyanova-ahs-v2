<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceCatalogPayerImpact } from '@/composables/serviceCatalogIndex/useServiceCatalogPayerImpact';
import { useServiceCatalogVersionHistory } from '@/composables/serviceCatalogWorkspace/useServiceCatalogVersionHistory';
import {
    formatDateTime,
    formatMoney,
    statusVariant,
    tariffLifecycleLabel,
    tariffWindowLabel,
    type CatalogItem,
} from '@/lib/billingServiceCatalog';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown } from '@/lib/notify';

const props = defineProps<{
    item: CatalogItem;
    canReadPayerContracts: boolean;
}>();

const emit = defineEmits<{
    openVersion: [item: CatalogItem];
}>();

const itemId = computed(() => String(props.item.id ?? ''));
const history = useServiceCatalogVersionHistory(() => itemId.value);
const versionHistory = computed(() => history.data.value ?? []);
const payerImpact = useServiceCatalogPayerImpact(() => itemId.value, () => props.canReadPayerContracts);

function tariffLifecycleVariant(effectiveFrom: string | null, effectiveTo: string | null): 'outline' | 'secondary' | 'destructive' {
    const label = tariffLifecycleLabel(effectiveFrom, effectiveTo);
    if (label === 'Scheduled') return 'outline';
    if (label === 'Expired window') return 'destructive';
    return 'secondary';
}

function versionFamilyRole(version: CatalogItem): string {
    if (String(version.id ?? '') === itemId.value) return 'Current view';
    const lifecycle = tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo);
    if (lifecycle === 'Scheduled') return 'Scheduled revision';
    if (version.supersedesBillingServiceCatalogItemId) return 'Revision';
    if (lifecycle === 'Expired window') return 'Historical price';
    return 'Base version';
}

function versionFamilyRoleVariant(version: CatalogItem): 'secondary' | 'outline' | 'destructive' {
    const role = versionFamilyRole(version);
    if (role === 'Current view') return 'secondary';
    if (role === 'Historical price') return 'destructive';
    return 'outline';
}

function findSupersededVersionLabel(version: CatalogItem): string | null {
    const supersededId = String(version.supersedesBillingServiceCatalogItemId ?? '').trim();
    if (!supersededId) return null;
    const matched = versionHistory.value.find((candidate) => String(candidate.id ?? '') === supersededId);
    if (!matched) return null;
    return `Supersedes v${matched.versionNumber || 1}`;
}

function compareVersionToPrevious(version: CatalogItem): string | null {
    const currentVersion = version.versionNumber ?? 1;
    const previous = versionHistory.value.find((candidate) => (candidate.versionNumber ?? 0) === currentVersion - 1);
    if (!previous) return null;

    const currentPrice = Number.parseFloat(version.basePrice ?? '');
    const previousPrice = Number.parseFloat(previous.basePrice ?? '');
    if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice)) return `Based on v${previous.versionNumber || 1}`;

    const delta = currentPrice - previousPrice;
    if (delta === 0) return `No price change vs v${previous.versionNumber || 1}`;

    const deltaLabel = Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${delta > 0 ? '+' : '-'}${deltaLabel} vs v${previous.versionNumber || 1}`;
}

function versionSummaryBadgeText(version: CatalogItem | null): string {
    return version ? `v${version.versionNumber || 1}` : 'Unavailable';
}

function formatCoverageRange(min: number | null, max: number | null): string {
    if (min === null || max === null) return 'No contract coverage defaults';
    if (min === max) return `${min.toFixed(0)}% default coverage`;
    return `${min.toFixed(0)}%-${max.toFixed(0)}% default coverage`;
}

const impactSummary = computed(() => {
    const versions = [...versionHistory.value];
    const live = versions.find((version) => (
        (version.status ?? '').toLowerCase() === 'active'
        && tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo) === 'Effective window active'
    )) ?? null;

    const scheduled = versions
        .filter((version) => tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo) === 'Scheduled')
        .sort((left, right) => {
            const leftTime = left.effectiveFrom ? new Date(left.effectiveFrom).getTime() : Number.POSITIVE_INFINITY;
            const rightTime = right.effectiveFrom ? new Date(right.effectiveFrom).getTime() : Number.POSITIVE_INFINITY;
            return leftTime - rightTime;
        })[0] ?? null;

    const historical = versions
        .filter((version) => tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo) === 'Expired window')
        .sort((left, right) => {
            const leftTime = left.effectiveTo ? new Date(left.effectiveTo).getTime() : 0;
            const rightTime = right.effectiveTo ? new Date(right.effectiveTo).getTime() : 0;
            return rightTime - leftTime;
        })[0] ?? null;

    return [
        { key: 'live', label: 'Current price', emptyLabel: 'No active price window', description: 'Price currently used by billing.', item: live },
        { key: 'scheduled', label: 'Next scheduled price', emptyLabel: 'No scheduled revision', description: 'Next price that will take over this service code.', item: scheduled },
        { key: 'historical', label: 'Latest previous price', emptyLabel: 'No historical version', description: 'Most recent replaced price in this service family.', item: historical },
    ];
});

function openVersion(version: CatalogItem): void {
    if (String(version.id ?? '').trim() === itemId.value) return;
    emit('openVersion', version);
}
</script>

<template>
    <div class="space-y-3">
        <div class="rounded-lg border p-3">
            <p class="text-sm font-medium">Price history</p>
            <p class="text-xs text-muted-foreground">Current, replaced, and scheduled price versions for this service code.</p>

            <div v-if="!history.isError.value && !history.isLoading.value && versionHistory.length > 0" class="mt-3 grid gap-2 lg:grid-cols-3">
                <div v-for="summary in impactSummary" :key="summary.key" class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 space-y-1">
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ summary.label }}</p>
                            <p class="text-xs text-muted-foreground">{{ summary.description }}</p>
                        </div>
                        <Badge :variant="summary.item ? 'outline' : 'secondary'">{{ versionSummaryBadgeText(summary.item) }}</Badge>
                    </div>
                    <div class="mt-2">
                        <template v-if="summary.item">
                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                <span class="font-semibold">{{ formatMoney(summary.item.basePrice, summary.item.currencyCode) }}</span>
                                <span class="text-muted-foreground">{{ tariffWindowLabel(summary.item.effectiveFrom, summary.item.effectiveTo) }}</span>
                            </div>
                            <p class="mt-1 text-xs text-muted-foreground">{{ compareVersionToPrevious(summary.item) || versionFamilyRole(summary.item) }}</p>
                        </template>
                        <p v-else class="text-sm font-medium text-muted-foreground">{{ summary.emptyLabel }}</p>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="canReadPayerContracts" class="rounded-lg border p-3">
            <div class="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p class="text-sm font-medium">Contract impact</p>
                    <p class="text-xs text-muted-foreground">Active contracts and authorization rules currently aligned to this service price.</p>
                </div>
                <div class="flex items-center gap-2">
                    <Badge variant="outline">{{ item.currencyCode || payerImpact.data.value?.currencyCode || 'TZS' }}</Badge>
                    <Button as-child variant="outline" size="sm">
                        <a href="/billing-payer-contracts">Open contracts</a>
                    </Button>
                </div>
            </div>
            <div v-if="payerImpact.isError.value" class="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {{ messageFromUnknown(payerImpact.error.value, 'Unable to load payer contract impact.') }}
            </div>
            <div v-else-if="payerImpact.isLoading.value" class="grid gap-3 md:grid-cols-3">
                <Skeleton class="h-24 w-full" /><Skeleton class="h-24 w-full" /><Skeleton class="h-24 w-full" />
            </div>
            <div v-else-if="payerImpact.data.value" class="grid gap-2 md:grid-cols-3">
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Contract Reach</p>
                    <p class="mt-1 text-lg font-semibold">{{ payerImpact.data.value.activeContractCount }}</p>
                    <p class="mt-1 text-xs text-muted-foreground">active contracts pricing in {{ payerImpact.data.value.currencyCode || item.currencyCode || 'TZS' }}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Coverage Defaults</p>
                    <p class="mt-1 text-lg font-semibold">{{ formatCoverageRange(payerImpact.data.value.coveragePercentMin, payerImpact.data.value.coveragePercentMax) }}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Authorization Pressure</p>
                    <p class="mt-1 text-lg font-semibold">{{ payerImpact.data.value.matchingRuleCount }} matching rules</p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ payerImpact.data.value.authorizationRequiredRuleCount }} require authorization, {{ payerImpact.data.value.autoApproveRuleCount }} auto-approve
                    </p>
                </div>
            </div>
        </div>

        <div v-if="history.isError.value" class="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {{ messageFromUnknown(history.error.value, 'Unable to load price history.') }}
        </div>
        <div v-else-if="history.isLoading.value" class="space-y-2"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
        <div v-else-if="versionHistory.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No price versions found for this service code.
        </div>
        <div v-else class="space-y-2">
            <div v-for="version in versionHistory" :key="String(version.id)" class="rounded-lg border bg-background/70 p-3">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div class="min-w-0 space-y-2">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">v{{ version.versionNumber || 1 }}</Badge>
                            <Badge :variant="versionFamilyRoleVariant(version)">{{ versionFamilyRole(version) }}</Badge>
                            <Badge :variant="statusVariant(version.status)">{{ formatEnumLabel(version.status) }}</Badge>
                            <Badge :variant="tariffLifecycleVariant(version.effectiveFrom, version.effectiveTo)">{{ tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo) }}</Badge>
                        </div>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p class="text-sm font-medium">{{ formatMoney(version.basePrice, version.currencyCode) }}</p>
                            <p class="text-xs text-muted-foreground">{{ tariffWindowLabel(version.effectiveFrom, version.effectiveTo) }}</p>
                            <p class="text-xs text-muted-foreground">Updated {{ formatDateTime(version.updatedAt) }}</p>
                        </div>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span v-if="findSupersededVersionLabel(version)">{{ findSupersededVersionLabel(version) }}</span>
                            <span v-if="compareVersionToPrevious(version)">{{ compareVersionToPrevious(version) }}</span>
                        </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Button v-if="String(version.id) !== itemId" variant="outline" size="sm" @click="openVersion(version)">View this version</Button>
                        <Badge v-else variant="secondary">Viewing</Badge>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
