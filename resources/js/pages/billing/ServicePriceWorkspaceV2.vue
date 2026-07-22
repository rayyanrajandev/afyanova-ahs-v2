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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useServiceCatalogItemDetail } from '@/composables/serviceCatalogIndex/useServiceCatalogItemDetail';
import { useServiceCatalogPayerImpact } from '@/composables/serviceCatalogIndex/useServiceCatalogPayerImpact';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    formatMoney,
    statusVariant,
    tariffLifecycleLabel,
    type CatalogItem,
    type ScopeData,
} from '@/lib/billingServiceCatalog';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

const props = defineProps<{ itemId: string }>();

const { permissionState, scope: platformScope, multiTenantIsolationEnabled } = usePlatformAccess();
const { loadCountryProfile } = usePlatformCountryProfile();

const canManageLegacy = computed(() => permissionState('billing.service-catalog.manage') === 'allowed');
const canManageIdentity = computed(() => canManageLegacy.value || permissionState('billing.service-catalog.manage-identity') === 'allowed');
const canManagePricing = computed(() => canManageLegacy.value || permissionState('billing.service-catalog.manage-pricing') === 'allowed');
const canViewAudit = computed(() => permissionState('billing.service-catalog.view-audit-logs') === 'allowed');
const canReadPayerContracts = computed(() => permissionState('billing.payer-contracts.read') === 'allowed');

const tabsGridColsClass = computed(() => {
    const visibleCount = 4 + (canManagePricing.value ? 1 : 0) + (canViewAudit.value ? 1 : 0);
    if (visibleCount >= 6) return 'grid-cols-6';
    if (visibleCount === 5) return 'grid-cols-5';
    return 'grid-cols-4';
});

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
    { title: 'Billing', href: '/billing' },
    { title: 'Billing Service Catalog', href: '/billing-service-catalog' },
    { title: item.value?.serviceName || 'Service price', href: '#' },
]);

function clinicalCatalogLinkLabel(): string {
    return item.value?.clinicalCatalogItemId ? 'Linked clinical definition' : 'Standalone billing price';
}

const summaryTiles = computed(() => {
    if (!item.value) return [];
    return [
        { key: 'price', label: 'Current price', value: formatMoney(item.value.basePrice, item.value.currencyCode) },
        { key: 'window', label: 'Price window', value: tariffLifecycleLabel(item.value.effectiveFrom, item.value.effectiveTo) },
        { key: 'linkage', label: 'Clinical linkage', value: clinicalCatalogLinkLabel() },
        {
            key: 'impact',
            label: 'Payer impact',
            value: payerImpact.data.value ? `${payerImpact.data.value.activeContractCount} contracts` : '—',
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

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head :title="`${item?.serviceName || 'Service price'} - Billing Service Catalog`" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1 class="truncate text-lg font-bold tracking-tight md:text-xl">{{ item?.serviceName || 'Service price' }}</h1>
                            <Badge v-if="item" :variant="statusVariant(item.status)" class="capitalize">{{ formatEnumLabel(item.status) }}</Badge>
                            <Badge v-if="item" variant="outline">v{{ item.versionNumber || 1 }}</Badge>
                        </div>
                        <p class="truncate text-sm text-muted-foreground">{{ item?.serviceCode || 'Loading...' }} · {{ clinicalCatalogLinkLabel() }}</p>
                    </div>
                    <Button size="sm" variant="outline" class="h-8 gap-1.5" as-child>
                        <Link href="/billing-service-catalog">
                            <AppIcon name="chevron-left" class="size-3.5" />
                            Billing Service Catalog
                        </Link>
                    </Button>
                </div>

                <div v-if="item" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div v-for="tile in summaryTiles" :key="tile.key" class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{{ tile.label }}</p>
                        <p class="truncate text-sm font-bold">{{ tile.value }}</p>
                    </div>
                </div>

                <Tabs v-if="item" v-model="detailsTab" class="mt-3">
                    <TabsList class="grid h-9 w-full gap-1 bg-muted/40 p-1" :class="tabsGridColsClass">
                        <TabsTrigger value="overview" class="gap-1.5 rounded-md border border-transparent px-2 text-xs text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            <AppIcon name="layout-grid" class="size-3" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="current" class="gap-1.5 rounded-md border border-transparent px-2 text-xs text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            <AppIcon name="banknote" class="size-3" />
                            Current Price
                        </TabsTrigger>
                        <TabsTrigger v-if="canManagePricing" value="version" class="gap-1.5 rounded-md border border-transparent px-2 text-xs text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            <AppIcon name="layers" class="size-3" />
                            New Version
                        </TabsTrigger>
                        <TabsTrigger value="history" class="gap-1.5 rounded-md border border-transparent px-2 text-xs text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            <AppIcon name="clock" class="size-3" />
                            Price History
                        </TabsTrigger>
                        <TabsTrigger value="status" class="gap-1.5 rounded-md border border-transparent px-2 text-xs text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            <AppIcon name="activity" class="size-3" />
                            Status
                        </TabsTrigger>
                        <TabsTrigger v-if="canViewAudit" value="audit" class="gap-1.5 rounded-md border border-transparent px-2 text-xs text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            <AppIcon name="file-text" class="size-3" />
                            Audit
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div class="space-y-4 px-6 pb-6">
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

                    <Tabs v-model="detailsTab">
                        <TabsContent value="overview">
                            <ServiceCatalogOverviewTab :item="item" :can-manage="canManageIdentity" @updated="refreshItem" @open-new-version="detailsTab = 'version'" />
                        </TabsContent>
                        <TabsContent value="current">
                            <ServiceCatalogCurrentPriceTab :item="item" :can-manage="canManagePricing" @open-new-version="detailsTab = 'version'" />
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
                    </Tabs>
                </template>
            </div>
        </div>
    </AppLayout>
</template>
