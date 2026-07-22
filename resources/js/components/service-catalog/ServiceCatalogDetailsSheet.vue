<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceCatalogItemDetail } from '@/composables/serviceCatalogIndex/useServiceCatalogItemDetail';
import { useServiceCatalogPayerImpact } from '@/composables/serviceCatalogIndex/useServiceCatalogPayerImpact';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import {
    formatDateTime,
    formatMoney,
    statusVariant,
    tariffLifecycleLabel,
    tariffWindowLabel,
} from '@/lib/billingServiceCatalog';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown } from '@/lib/notify';

const props = defineProps<{
    itemId: string | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const { permissionState } = usePlatformAccess();
const canReadPayerContracts = computed(() => permissionState('billing.payer-contracts.read') === 'allowed');

const detail = useServiceCatalogItemDetail(() => props.itemId);
const item = computed(() => detail.data.value ?? null);
const payerImpact = useServiceCatalogPayerImpact(() => props.itemId, canReadPayerContracts);

function tariffLifecycleVariant(effectiveFrom: string | null | undefined, effectiveTo: string | null | undefined): 'outline' | 'secondary' | 'destructive' {
    const label = tariffLifecycleLabel(effectiveFrom ?? null, effectiveTo ?? null);
    if (label === 'Scheduled') return 'outline';
    if (label === 'Expired window') return 'destructive';
    return 'secondary';
}

function clinicalCatalogLinkLabel(): string {
    return item.value?.clinicalCatalogItemId ? 'Linked clinical definition' : 'Standalone billing price';
}

function clinicalCatalogLinkDetail(): string {
    const linkedItem = item.value?.clinicalCatalogItem;
    if (!item.value?.clinicalCatalogItemId || !linkedItem) {
        return 'No clinical catalog definition is linked yet. This price stays billing-only until a matching care catalog code is connected.';
    }

    const parts = [
        linkedItem.catalogType ? formatEnumLabel(linkedItem.catalogType) : null,
        linkedItem.code || null,
        linkedItem.status ? formatEnumLabel(linkedItem.status) : null,
    ].filter((value): value is string => Boolean(value && value.trim()));

    const summary = parts.length ? parts.join(' | ') : 'Linked clinical definition';
    return linkedItem.name ? `${linkedItem.name} | ${summary}` : summary;
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="workspace" size="3xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>{{ item?.serviceName || 'Service price details' }}</SheetTitle>
                <SheetDescription>{{ item?.serviceCode || item?.id || 'Service code pending' }} · {{ clinicalCatalogLinkLabel() }}</SheetDescription>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                    <Badge v-if="detail.isLoading.value" variant="secondary" class="gap-1.5">
                        <AppIcon name="loader-circle" class="size-3 animate-spin" />
                        Loading
                    </Badge>
                    <template v-if="item">
                        <Badge variant="outline">v{{ item.versionNumber || 1 }}</Badge>
                        <Badge :variant="statusVariant(item.status)">{{ formatEnumLabel(item.status) }}</Badge>
                        <Badge :variant="tariffLifecycleVariant(item.effectiveFrom, item.effectiveTo)">{{ tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo) }}</Badge>
                    </template>
                </div>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-4 p-5">
                    <div v-if="detail.isLoading.value" class="space-y-3">
                        <Skeleton class="h-20 w-full" />
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="detail.isError.value" variant="destructive">
                        <AlertTitle>Unable to load this service price</AlertTitle>
                        <AlertDescription>{{ messageFromUnknown(detail.error.value, 'Unknown error.') }}</AlertDescription>
                    </Alert>

                    <template v-else-if="item">
                        <div v-if="item.supersedesBillingServiceCatalogItemId" class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                            <AppIcon name="info" class="mr-1 inline size-3.5 align-text-top" />
                            This version replaces an earlier price version in the same service family.
                        </div>

                        <div class="rounded-lg border bg-primary/5 px-4 py-3.5">
                            <div class="flex items-baseline justify-between gap-4">
                                <div class="min-w-0">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Current base price</p>
                                    <p class="mt-0.5 text-2xl font-bold tracking-tight text-primary">{{ formatMoney(item.basePrice, item.currencyCode) }}</p>
                                </div>
                                <div class="shrink-0 text-right">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Department</p>
                                    <p class="mt-0.5 truncate text-sm font-semibold">{{ item.department || item.departmentId || 'Unassigned' }}</p>
                                    <p class="text-xs text-muted-foreground">{{ formatEnumLabel(item.serviceType) }}</p>
                                </div>
                            </div>
                            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>{{ tariffWindowLabel(item.effectiveFrom, item.effectiveTo) }}</span>
                                <span>·</span>
                                <span>{{ tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo) }}</span>
                                <span v-if="item.taxRatePercent">·</span>
                                <span v-if="item.taxRatePercent">{{ item.taxRatePercent }}% tax</span>
                            </div>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Clinical linkage</p>
                                <p class="mt-1 truncate text-sm font-semibold">{{ clinicalCatalogLinkLabel() }}</p>
                                <p class="truncate text-xs text-muted-foreground">{{ clinicalCatalogLinkDetail() }}</p>
                            </div>
                            <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Payer impact</p>
                                <p class="mt-1 text-sm font-semibold">{{ payerImpact.data.value ? `${payerImpact.data.value.activeContractCount} active contracts` : 'Loading...' }}</p>
                                <p class="truncate text-xs text-muted-foreground">{{ payerImpact.data.value ? `${payerImpact.data.value.matchingRuleCount} matching rules` : 'Contract reach & auth pressure' }}</p>
                            </div>
                        </div>

                        <p class="text-xs text-muted-foreground">
                            Last updated {{ formatDateTime(item.updatedAt) }} · Created {{ formatDateTime(item.createdAt) }}
                        </p>
                    </template>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button v-if="item" as-child class="gap-1.5">
                    <Link :href="`/billing-service-catalog/${item.id}/prices`">
                        <AppIcon name="receipt" class="size-3.5" />
                        Manage Prices
                    </Link>
                </Button>
                <Button variant="outline" @click="open = false">Close</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
