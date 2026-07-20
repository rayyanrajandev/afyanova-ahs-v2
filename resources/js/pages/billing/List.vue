<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import { refDebounced, useDebounceFn } from '@vueuse/core';
import { computed, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import ListPagination from '@/components/ListPagination.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBillingCashierQueue, type CashierQueueEntry } from '@/composables/billingCashierQueue/useBillingCashierQueue';
import { useBillingCashierQueueFilters } from '@/composables/billingCashierQueue/useBillingCashierQueueFilters';
import { useBillingCashierQueueLiveUpdates } from '@/composables/billingCashierQueue/useBillingCashierQueueLiveUpdates';
import { useBillingCashierQueueStatusCounts } from '@/composables/billingCashierQueue/useBillingCashierQueueStatusCounts';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

/**
 * List-only billing queue (reports/billing-module-architecture-redesign.md
 * Phase 6). This is IndexV2.vue with the right-hand patient detail panel,
 * payment sheets, and reversal/undo flow removed — selecting a patient now
 * navigates to their billing workspace (billing/workspace/Workspace.vue)
 * instead of opening an inline panel. Header/stat-tile/Tabs-wrapped-sticky-
 * header structure matches encounters/List.vue; cross-module navigation is
 * plain header buttons (BillingModuleNav's tab-strip is only used by the
 * pre-V2 pages that still need it) rather than a separate nav bar.
 */
const breadcrumbs: BreadcrumbItem[] = [{ title: 'Billing', href: '/billing' }];

const PER_PAGE_STORAGE_KEY = 'billing.queue-per-page.v1';

const filters = useBillingCashierQueueFilters();
const queue = useBillingCashierQueue(filters);
const statusCounts = useBillingCashierQueueStatusCounts(filters);
const queueEntries = computed(() => queue.data.value?.data ?? []);
const pagination = computed(() => queue.data.value?.meta ?? null);
const pageLoading = computed(() => queue.isLoading.value);
const listLoading = computed(() => queue.isFetching.value);
const queueError = computed(() => (queue.isError.value ? ((queue.error.value as Error | null)?.message ?? 'Unable to load billing queue.') : null));

const { isLive } = useBillingCashierQueueLiveUpdates([['billing-cashier-queue'], ['billing-cashier-queue-status-counts']]);

const compactRows = useLocalStorageBoolean('billing.queue-compact-rows.v1', false);

// Deep-link support from patientChartModuleHref('/billing', ...,
// { focusInvoiceId }) — the queue has no patient context of its own, so a
// deep-linked patient is forwarded straight to their workspace (which
// supports focusInvoiceId) instead of being loaded inline here.
const deepLinkParams = new URLSearchParams(window.location.search);
const deepLinkPatientId = deepLinkParams.get('patientId');
const deepLinkFocusInvoiceId = deepLinkParams.get('focusInvoiceId');

/**
 * Search input is decoupled from filters.q: binding the Input directly to
 * filters.q would fire a new query (and a URL sync) on every keystroke.
 * searchInputRaw debounces (250ms, matching patients/IndexV2.vue) before
 * committing into filters.q. Enter bypasses the debounce for an immediate
 * search.
 */
const searchInputRaw = ref(filters.q);
const searchInputDebounced = refDebounced(searchInputRaw, 250);

watch(searchInputDebounced, (value) => {
    if (filters.q === value) return;
    filters.q = value;
    filters.page = 1;
});

function submitSearchNow(): void {
    if (filters.q === searchInputRaw.value) return;
    filters.q = searchInputRaw.value;
    filters.page = 1;
}

function setStatus(value: string | number): void {
    filters.status = String(value) as typeof filters.status;
    filters.page = 1;
}

function setPerPage(value: number): void {
    filters.perPage = value;
    filters.page = 1;
    try {
        window.localStorage.setItem(PER_PAGE_STORAGE_KEY, String(value));
    } catch {
        /* storage unavailable, ignore */
    }
}

const hasActiveFilters = computed(() => filters.status !== 'all' || filters.q.trim() !== '');

function clearAllFilters(): void {
    searchInputRaw.value = '';
    filters.q = '';
    filters.status = 'all';
    filters.page = 1;
}

/**
 * Keeps the URL in sync with filters (patients/IndexV2.vue's "remembered
 * filters" contract) so a refresh, a copied link, or the back button all
 * land on the same filtered queue. history.replaceState, not an Inertia
 * visit, so the component never remounts and the TanStack Query cache
 * survives filter changes.
 */
const syncUrl = useDebounceFn(() => {
    const params = new URLSearchParams();
    if (filters.q.trim() !== '') params.set('q', filters.q.trim());
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.perPage !== 20) params.set('perPage', String(filters.perPage));
    if (filters.page !== 1) params.set('page', String(filters.page));

    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', newUrl);
}, 300);

watch(filters, () => void syncUrl(), { deep: true });

function goToPage(page: number): void {
    filters.page = page;
}

function selectPatient(entry: CashierQueueEntry): void {
    router.visit(`/billing/${entry.patientId}`);
}

function formatMoney(amount: number, currencyCode?: string | null): string {
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    return `${formatted} ${currencyCode || 'TZS'}`;
}

function queueStatusDotClass(entry: CashierQueueEntry): string {
    if (entry.unpaidInvoiceCount > 0) return 'bg-destructive';
    if (entry.unbilledServiceCount > 0) return 'bg-amber-500';
    return 'bg-emerald-500';
}

function queueStatusTitle(entry: CashierQueueEntry): string {
    if (entry.unpaidInvoiceCount > 0) return 'Has unpaid invoices';
    if (entry.unbilledServiceCount > 0) return 'Has unbilled services';
    return 'Fully paid';
}

onMounted(() => {
    try {
        const storedPerPage = window.localStorage.getItem(PER_PAGE_STORAGE_KEY);
        if (storedPerPage && !new URLSearchParams(window.location.search).has('perPage')) {
            const parsed = parseInt(storedPerPage, 10);
            if (Number.isFinite(parsed) && parsed > 0) filters.perPage = parsed;
        }
    } catch {
        /* storage unavailable, ignore */
    }

    if (deepLinkPatientId) {
        const target = deepLinkFocusInvoiceId
            ? `/billing/${deepLinkPatientId}?focusInvoiceId=${encodeURIComponent(deepLinkFocusInvoiceId)}`
            : `/billing/${deepLinkPatientId}`;
        router.visit(target, { replace: true });
    }
});

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Billing" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <Tabs :model-value="filters.status" class="contents" @update:model-value="setStatus">
                <div class="sticky top-0 z-10 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex items-center gap-2">
                                <h1 class="text-lg font-bold tracking-tight md:text-xl">Billing</h1>
                                <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <span class="size-1.5 rounded-full" :class="isLive ? 'bg-emerald-500' : 'bg-muted-foreground/40'" aria-hidden="true" />
                                    {{ isLive ? 'Live' : 'Polling' }}
                                </span>
                            </div>
                            <p class="text-xs text-muted-foreground">Cashier queue — patients with pending payments or unbilled charges.</p>
                        </div>
                        <div class="flex shrink-0 flex-wrap items-center gap-2">
                            <Badge v-if="pagination" variant="secondary">{{ pagination.total }} patients</Badge>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" as-child>
                                <Link href="/billing-cash">
                                    <AppIcon name="banknote" class="size-3.5" />
                                    Cash payments
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" as-child>
                                <Link href="/billing-refunds">
                                    <AppIcon name="undo-2" class="size-3.5" />
                                    Refunds
                                </Link>
                            </Button>
                            <Button v-if="hasActiveFilters" size="sm" variant="outline" class="h-8 gap-1.5" @click="clearAllFilters">
                                Clear filters
                            </Button>
                        </div>
                    </div>

                    <div class="mt-3 grid grid-cols-3 gap-2">
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">All</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.all ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Unpaid</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.unpaid ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Paid</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.paid ?? '—' }}</p>
                        </div>
                    </div>

                    <TabsList class="mt-3 grid w-full grid-cols-3">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.all ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="unpaid" class="inline-flex items-center gap-1.5">
                            Unpaid
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.unpaid ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="paid" class="inline-flex items-center gap-1.5">
                            Paid
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.paid ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <div class="relative min-w-0 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input v-model="searchInputRaw" placeholder="Search by name, MRN, or phone…" class="h-9 pl-9" @keyup.enter="submitSearchNow" />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="outline" size="sm" class="h-9 gap-1.5">
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    View
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-48">
                                <DropdownMenuItem @click="setPerPage(10)">10 per page</DropdownMenuItem>
                                <DropdownMenuItem @click="setPerPage(20)">20 per page</DropdownMenuItem>
                                <DropdownMenuItem @click="setPerPage(50)">50 per page</DropdownMenuItem>
                                <DropdownMenuItem @click="compactRows = true">Compact rows</DropdownMenuItem>
                                <DropdownMenuItem @click="compactRows = false">Comfortable rows</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div class="space-y-4 px-4 pb-6 md:px-6">
                    <!-- Error banner — no manual retry; the 30s refetchInterval on
                    useBillingCashierQueue recovers on its own, same as the other
                    queue pages (reception/emergency/pharmacy/lab/radiology). -->
                    <div v-if="queueError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                        <div class="flex items-start gap-2.5">
                            <AppIcon name="alert-triangle" class="mt-0.5 size-4 shrink-0 text-destructive" />
                            <div class="min-w-0">
                                <p class="text-sm font-medium text-destructive">Unable to load billing queue</p>
                                <p class="mt-1 text-xs break-all text-muted-foreground">{{ queueError }}</p>
                            </div>
                        </div>
                    </div>

                    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
                        <div class="min-h-0 flex-1 overflow-y-auto">
                            <RegistryListSkeleton v-if="pageLoading" :count="5" />
                            <div v-else-if="queueEntries.length === 0" class="p-4">
                                <InventoryEmptyState icon="check-circle" title="No patients in queue" description="All patients have been served or no pending charges found." />
                            </div>
                            <div
                                v-show="queueEntries.length > 0"
                                class="divide-y px-4"
                                :class="{ 'pointer-events-none opacity-40 transition-opacity duration-200': listLoading }"
                            >
                                <RegistryListRow
                                    v-for="entry in queueEntries"
                                    :key="entry.patientId"
                                    :class="compactRows ? '[&_p]:text-[11px]' : ''"
                                    :status-dot-class="queueStatusDotClass(entry)"
                                    :status-title="queueStatusTitle(entry)"
                                    @select="selectPatient(entry)"
                                >
                                    <template #title>
                                        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span class="truncate text-sm font-medium transition-colors hover:text-primary">{{ entry.patientName }}</span>
                                        </div>
                                    </template>
                                    <template #meta>
                                        <p class="truncate text-xs text-muted-foreground">
                                            {{ entry.patientNumber }}
                                            <span v-if="entry.phone"> · {{ entry.phone }}</span>
                                            — {{ entry.summaryLabel }}
                                        </p>
                                    </template>
                                    <template #badges>
                                        <Badge v-if="entry.unpaidInvoiceCount > 0" variant="destructive" class="h-5 px-1.5 text-[10px] tabular-nums">
                                            {{ formatMoney(entry.totalUnpaidAmount) }}
                                        </Badge>
                                        <Badge v-if="entry.unbilledServiceCount > 0" variant="secondary" class="h-5 px-1.5 text-[10px] tabular-nums">
                                            {{ entry.unbilledServiceCount }} unbilled
                                        </Badge>
                                    </template>
                                    <template #actions>
                                        <PatientSummaryPopover v-if="entry.patientId" :patient-id="entry.patientId">
                                            <template #trigger>
                                                <button type="button" class="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="View patient summary">
                                                    <AppIcon name="info" class="size-3.5" />
                                                </button>
                                            </template>
                                            <template #actions>
                                                <a :href="`/patients/${entry.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">View chart</a>
                                            </template>
                                        </PatientSummaryPopover>
                                        <AppIcon name="chevron-right" class="size-4 text-muted-foreground" />
                                    </template>
                                </RegistryListRow>
                            </div>
                        </div>

                        <footer v-if="pagination && pagination.lastPage > 1" class="shrink-0 border-t bg-muted/30 px-4 py-2">
                            <ListPagination :current-page="pagination.currentPage" :last-page="pagination.lastPage" :total="pagination.total" item-label="patients" @update:page="goToPage" />
                        </footer>
                    </div>
                </div>
            </Tabs>
        </div>
    </AppLayout>
</template>
