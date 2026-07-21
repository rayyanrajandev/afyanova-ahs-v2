<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ServiceCatalogAuditTab from '@/components/service-catalog/workspace/ServiceCatalogAuditTab.vue';
import ServiceCatalogCurrentPriceTab from '@/components/service-catalog/workspace/ServiceCatalogCurrentPriceTab.vue';
import ServiceCatalogNewVersionTab from '@/components/service-catalog/workspace/ServiceCatalogNewVersionTab.vue';
import ServiceCatalogOverviewTab from '@/components/service-catalog/workspace/ServiceCatalogOverviewTab.vue';
import ServiceCatalogPriceHistoryTab from '@/components/service-catalog/workspace/ServiceCatalogPriceHistoryTab.vue';
import ServiceCatalogStatusTab from '@/components/service-catalog/workspace/ServiceCatalogStatusTab.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useServiceCatalogItemDetail } from '@/composables/serviceCatalogIndex/useServiceCatalogItemDetail';
import { useServiceCatalogPayerImpact } from '@/composables/serviceCatalogIndex/useServiceCatalogPayerImpact';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    formatMoney,
    statusVariant,
    tariffLifecycleLabel,
    tariffWindowLabel,
    type CatalogItem,
    type ScopeData,
} from '@/lib/billingServiceCatalog';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

const props = defineProps<{ itemId: string }>();

const { permissionState, scope: platformScope, multiTenantIsolationEnabled } = usePlatformAccess();
const { activeCurrencyCode, loadCountryProfile } = usePlatformCountryProfile();

const canManageLegacy = computed(() => permissionState('billing.service-catalog.manage') === 'allowed');
const canManageIdentity = computed(() => canManageLegacy.value || permissionState('billing.service-catalog.manage-identity') === 'allowed');
const canManagePricing = computed(() => canManageLegacy.value || permissionState('billing.service-catalog.manage-pricing') === 'allowed');
const canViewAudit = computed(() => permissionState('billing.service-catalog.view-audit-logs') === 'allowed');
const canReadPayerContracts = computed(() => permissionState('billing.payer-contracts.read') === 'allowed');
const defaultCurrencyCode = computed(() => activeCurrencyCode.value || 'TZS');

const scope = computed<ScopeData | null>(() => (platformScope.value as ScopeData | null) ?? null);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');

// Viewing a different version (via Price History's "View this version") swaps this without
// navigating the browser URL — same behavior as the legacy page's openVersionFromHistory().
const activeItemId = ref(props.itemId);
const detailsTab = ref('overview');

const detail = useServiceCatalogItemDetail(() => activeItemId.value);
const item = computed<CatalogItem | null>(() => detail.data.value ?? null);
const payerImpact = useServiceCatalogPayerImpact(() => activeItemId.value, canReadPayerContracts);

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Billing Service Catalog', href: '/billing-service-catalog' },
    { title: item.value?.serviceName || 'Service price', href: '#' },
]);

function clinicalCatalogLinkLabel(): string {
    return item.value?.clinicalCatalogItemId ? 'Linked clinical definition' : 'Standalone billing price';
}

const summaryCards = computed(() => {
    if (!item.value) return [];
    return [
        { key: 'clinical-link', label: 'Clinical linkage', value: clinicalCatalogLinkLabel(), helper: item.value.clinicalCatalogItem?.name || 'No clinical catalog definition linked yet.' },
        { key: 'tariff', label: 'Current price', value: formatMoney(item.value.basePrice, item.value.currencyCode), helper: `Version ${item.value.versionNumber || 1}` },
        { key: 'lifecycle', label: 'Price window', value: tariffLifecycleLabel(item.value.effectiveFrom, item.value.effectiveTo), helper: tariffWindowLabel(item.value.effectiveFrom, item.value.effectiveTo) },
        {
            key: 'impact',
            label: 'Payer impact',
            value: payerImpact.data.value ? `${payerImpact.data.value.activeContractCount} active contracts` : 'Contract context pending',
            helper: payerImpact.data.value ? `${payerImpact.data.value.matchingRuleCount} matching rules in ${payerImpact.data.value.currencyCode || item.value.currencyCode || defaultCurrencyCode.value}` : 'Open History for contract reach and authorization pressure.',
        },
    ];
});

const queryClient = useQueryClient();
function refreshItem(updated: CatalogItem): void {
    activeItemId.value = String(updated.id ?? activeItemId.value);
    void queryClient.invalidateQueries({ queryKey: ['service-catalog-item-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['service-catalog-payer-impact'] });
    void queryClient.invalidateQueries({ queryKey: ['service-catalog-version-history'] });
}

function openVersion(version: CatalogItem): void {
    const versionId = String(version.id ?? '').trim();
    if (!versionId || versionId === activeItemId.value) return;
    detailsTab.value = 'overview';
    activeItemId.value = versionId;
}

onMounted(async () => {
    await loadCountryProfile();
});
</script>

<template>
    <Head :title="`${item?.serviceName || 'Service price'} - Billing Service Catalog`" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20" aria-hidden="true">
                            <AppIcon name="receipt" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">{{ item?.serviceName || 'Service price' }}</h1>
                                <Badge v-if="item" :variant="statusVariant(item.status)" class="capitalize">{{ formatEnumLabel(item.status) }}</Badge>
                                <Badge v-if="item" variant="outline">Version {{ item.versionNumber || 1 }}</Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">{{ item?.serviceCode || 'Loading...' }} | {{ clinicalCatalogLinkLabel() }}</p>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" class="gap-1.5" as-child>
                        <Link href="/billing-service-catalog">
                            <AppIcon name="chevron-left" class="size-3.5" />
                            Billing Service Catalog
                        </Link>
                    </Button>
                </div>
            </section>

            <Alert v-if="scopeUnresolved" variant="destructive">
                <AlertTitle>Scope unresolved</AlertTitle>
                <AlertDescription>Multi-tenant isolation is enabled but no tenant/facility scope was resolved. Resolve scope before editing service catalog items.</AlertDescription>
            </Alert>

            <div v-else-if="detail.isLoading.value" class="space-y-2">
                <Skeleton class="h-16 w-full" />
                <Skeleton class="h-64 w-full" />
            </div>

            <Alert v-else-if="detail.isError.value" variant="destructive">
                <AlertTitle>Details sync issue</AlertTitle>
                <AlertDescription>{{ messageFromUnknown(detail.error.value, 'Unable to load service catalog item details.') }}</AlertDescription>
            </Alert>

            <template v-else-if="item">
                <div v-if="item.supersedesBillingServiceCatalogItemId" class="text-xs text-muted-foreground">
                    This version replaces an earlier price version in the same service family.
                </div>

                <div class="flex flex-wrap items-stretch gap-2">
                    <div v-for="card in summaryCards" :key="card.key" class="min-w-[180px] flex-1 rounded-lg border bg-background/70 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                        <p class="mt-1 text-sm font-semibold">{{ card.value }}</p>
                        <p class="mt-1 text-xs text-muted-foreground">{{ card.helper }}</p>
                    </div>
                </div>

                <Card class="flex flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <Tabs v-model="detailsTab" class="flex h-full min-h-0 flex-col">
                        <div class="border-b bg-muted/5 px-4 py-2.5">
                            <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
                                <TabsTrigger value="overview" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Overview</TabsTrigger>
                                <TabsTrigger value="current" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Current Price</TabsTrigger>
                                <TabsTrigger v-if="canManagePricing" value="version" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">New Version</TabsTrigger>
                                <TabsTrigger value="history" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Price History</TabsTrigger>
                                <TabsTrigger value="status" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Status</TabsTrigger>
                                <TabsTrigger v-if="canViewAudit" value="audit" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Audit</TabsTrigger>
                            </TabsList>
                        </div>

                        <div class="min-h-0 flex-1 overflow-y-auto p-4">
                            <TabsContent value="overview">
                                <ServiceCatalogOverviewTab
                                    :item="item"
                                    :can-manage="canManageIdentity"
                                    @updated="refreshItem"
                                    @open-new-version="detailsTab = 'version'"
                                />
                            </TabsContent>
                            <TabsContent value="current">
                                <ServiceCatalogCurrentPriceTab
                                    :item="item"
                                    :can-manage="canManagePricing"
                                    @updated="refreshItem"
                                    @open-status="detailsTab = 'status'"
                                />
                            </TabsContent>
                            <TabsContent v-if="canManagePricing" value="version">
                                <ServiceCatalogNewVersionTab :item="item" @created="refreshItem" />
                            </TabsContent>
                            <TabsContent value="history">
                                <ServiceCatalogPriceHistoryTab :item="item" :can-read-payer-contracts="canReadPayerContracts" @open-version="openVersion" />
                            </TabsContent>
                            <TabsContent value="status">
                                <ServiceCatalogStatusTab :item="item" :can-manage="canManagePricing" @updated="refreshItem" @open-history="detailsTab = 'history'" />
                            </TabsContent>
                            <TabsContent v-if="canViewAudit" value="audit">
                                <ServiceCatalogAuditTab :item="item" />
                            </TabsContent>
                        </div>
                    </Tabs>
                </Card>
            </template>
        </div>
    </AppLayout>
</template>
