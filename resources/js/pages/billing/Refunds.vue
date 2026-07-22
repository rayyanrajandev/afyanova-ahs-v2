<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { refDebounced, useDebounceFn } from '@vueuse/core';
import { computed, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import ListPagination from '@/components/ListPagination.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing' },
    { title: 'Refunds', href: '/billing-refunds' },
];

interface RefundRecord {
    id: string;
    invoice_id: string;
    invoice_number: string | null;
    amount: number;
    currency_code: string | null;
    reason: string | null;
    status: string;
    created_at: string | null;
}

type RefundStatus = 'all' | 'pending' | 'approved' | 'processed' | 'rejected';

const refunds = ref<RefundRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const searchInputRaw = ref('');
const searchInputDebounced = refDebounced(searchInputRaw, 250);
const statusFilter = ref<RefundStatus>('all');
const page = ref(1);
const perPage = ref(25);
const totalPages = ref(1);
const total = ref(0);

const sheetOpen = ref(false);
const newInvoiceId = ref('');
const newAmount = ref<number | null>(null);
const newReason = ref('');
const submitting = ref(false);
const sheetError = ref<string | null>(null);

const statusCounts = computed(() => {
    const all = refunds.value.length;
    const pending = refunds.value.filter((r) => r.status === 'pending').length;
    const approved = refunds.value.filter((r) => r.status === 'approved').length;
    const processed = refunds.value.filter((r) => r.status === 'processed').length;
    const rejected = refunds.value.filter((r) => r.status === 'rejected').length;
    return { all, pending, approved, processed, rejected };
});

watch(searchInputDebounced, () => {
    page.value = 1;
    load();
});

function submitSearchNow(): void {
    if (searchInputRaw.value === searchInputDebounced.value) load();
    else searchInputDebounced.value = searchInputRaw.value;
}

function setStatus(value: string | number): void {
    statusFilter.value = String(value) as RefundStatus;
    page.value = 1;
    load();
}

const hasActiveFilters = computed(() => statusFilter.value !== 'all' || searchInputRaw.value.trim() !== '');

function clearAllFilters(): void {
    searchInputRaw.value = '';
    statusFilter.value = 'all';
    page.value = 1;
    load();
}

async function load() {
    loading.value = true;
    error.value = null;

    try {
        const params: Record<string, string | number | null> = {
            q: searchInputRaw.value || null,
            status: statusFilter.value === 'all' ? null : statusFilter.value,
            page: page.value,
            perPage: perPage.value,
        };

        const response = await apiRequestJson<{ data: RefundRecord[]; meta?: { currentPage: number; lastPage: number; total: number } }>(
            'GET',
            '/billing-refunds',
            { query: params },
        );
        refunds.value = response.data ?? [];
        totalPages.value = response.meta?.lastPage ?? 1;
        total.value = response.meta?.total ?? 0;
    } catch (err) {
        error.value = messageFromUnknown(err, 'Unable to load refunds.');
    } finally {
        loading.value = false;
    }
}

function goToPage(newPage: number): void {
    page.value = newPage;
    load();
}

async function createRefund() {
    if (!newInvoiceId.value.trim() || !newAmount.value || !newReason.value.trim()) return;

    submitting.value = true;
    sheetError.value = null;

    try {
        await apiRequestJson('/billing-refunds', {
            method: 'POST',
            body: JSON.stringify({
                invoiceId: newInvoiceId.value.trim(),
                amount: newAmount.value,
                reason: newReason.value.trim(),
            }),
        });
        notifySuccess('Refund request submitted.');
        sheetOpen.value = false;
        newInvoiceId.value = '';
        newAmount.value = null;
        newReason.value = '';
        await load();
    } catch (err) {
        sheetError.value = messageFromUnknown(err, 'Unable to create refund.');
    } finally {
        submitting.value = false;
    }
}

function formatMoney(amount: number, currencyCode?: string | null): string {
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    return `${formatted} ${currencyCode || 'TZS'}`;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    try {
        return new Intl.DateTimeFormat('en-TZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
}

const statusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'pending': return 'default';
        case 'approved': return 'secondary';
        case 'processed': return 'outline';
        case 'rejected': return 'destructive';
        default: return 'outline';
    }
};

const statusTabLabel = (key: string): string => {
    switch (key) {
        case 'all': return 'All';
        case 'pending': return 'Pending';
        case 'approved': return 'Approved';
        case 'processed': return 'Processed';
        case 'rejected': return 'Rejected';
        default: return key;
    }
};

onMounted(() => load());

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Refunds" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <Tabs :model-value="statusFilter" class="contents" @update:model-value="setStatus">
                <div class="sticky top-0 z-10 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex items-center gap-2">
                                <h1 class="text-lg font-bold tracking-tight md:text-xl">Refunds</h1>
                                <Badge v-if="total > 0" variant="secondary">{{ total }} total</Badge>
                            </div>
                            <p class="text-xs text-muted-foreground">Finance workboard for refund control: request, approve, and process payouts.</p>
                        </div>
                        <div class="flex shrink-0 flex-wrap items-center gap-2">
                            <Button size="sm" class="h-8 gap-1.5" @click="sheetOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                New refund
                            </Button>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="loading" @click="load">
                                <AppIcon name="refresh-cw" class="size-3.5" />
                                Refresh
                            </Button>
                            <Button v-if="hasActiveFilters" size="sm" variant="outline" class="h-8 gap-1.5" @click="clearAllFilters">
                                Clear filters
                            </Button>
                        </div>
                    </div>

                    <div class="mt-3 grid grid-cols-5 gap-2">
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">All</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.all }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Pending</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.pending }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Approved</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.approved }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Processed</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.processed }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Rejected</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.rejected }}</p>
                        </div>
                    </div>

                    <TabsList class="mt-3 grid w-full grid-cols-5">
                        <TabsTrigger v-for="status in (['all', 'pending', 'approved', 'processed', 'rejected'] as const)" :key="status" :value="status" class="inline-flex items-center gap-1.5">
                            {{ statusTabLabel(status) }}
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts[status] }}</Badge>
                        </TabsTrigger>
                    </TabsList>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <div class="relative min-w-0 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input v-model="searchInputRaw" placeholder="Search by invoice number..." class="h-9 pl-9" @keyup.enter="submitSearchNow" />
                        </div>
                    </div>
                </div>

                <div class="space-y-4 px-4 pb-6 md:px-6">
                    <div v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                        <div class="flex items-start gap-2.5">
                            <AppIcon name="alert-triangle" class="mt-0.5 size-4 shrink-0 text-destructive" />
                            <div class="min-w-0">
                                <p class="text-sm font-medium text-destructive">Unable to load refunds</p>
                                <p class="mt-1 text-xs break-all text-muted-foreground">{{ error }}</p>
                            </div>
                        </div>
                    </div>

                    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
                        <div class="min-h-0 flex-1 overflow-y-auto">
                            <div v-if="loading && refunds.length === 0" class="divide-y px-4">
                                <div v-for="i in 5" :key="i" class="flex items-center gap-4 py-3">
                                    <div class="h-4 w-1/3 rounded bg-muted" />
                                    <div class="h-4 w-1/4 rounded bg-muted" />
                                </div>
                            </div>
                            <div v-else-if="refunds.length === 0" class="p-4">
                                <InventoryEmptyState icon="undo-2" title="No refunds found" description="No refund requests match the current filters." />
                            </div>
                            <div
                                v-show="refunds.length > 0"
                                class="divide-y px-4"
                                :class="{ 'pointer-events-none opacity-40 transition-opacity duration-200': loading }"
                            >
                                <div v-for="refund in refunds" :key="refund.id" class="flex items-center justify-between gap-4 py-3">
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-2">
                                            <p class="text-sm font-medium">{{ refund.invoice_number || refund.invoice_id }}</p>
                                            <Badge :variant="statusBadgeVariant(refund.status)" class="text-[10px]">{{ refund.status }}</Badge>
                                        </div>
                                        <p class="mt-0.5 text-xs text-muted-foreground">
                                            {{ refund.reason || 'No reason provided' }}
                                            <span v-if="refund.created_at"> · {{ formatDate(refund.created_at) }}</span>
                                        </p>
                                    </div>
                                    <div class="shrink-0 text-right">
                                        <p class="text-sm font-semibold tabular-nums">{{ formatMoney(refund.amount, refund.currency_code) }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <footer v-if="totalPages > 1" class="shrink-0 border-t bg-muted/30 px-4 py-2">
                            <ListPagination :current-page="page" :last-page="totalPages" :total="total" item-label="refunds" @update:page="goToPage" />
                        </footer>
                    </div>
                </div>
            </Tabs>
        </div>

        <Sheet v-model:open="sheetOpen">
            <SheetContent side="right" variant="workspace" size="2xl" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon name="undo-2" class="size-5 text-muted-foreground" />
                        New refund
                    </SheetTitle>
                    <SheetDescription>Create a refund request against an invoice.</SheetDescription>
                </SheetHeader>

                <ScrollArea class="min-h-0 flex-1">
                    <div class="grid gap-4 px-6 py-4">
                        <div v-if="sheetError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {{ sheetError }}
                        </div>

                        <fieldset class="grid gap-3 rounded-lg border p-3">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Refund details</legend>
                            <div>
                                <Label for="rf-invoice-id">Invoice ID</Label>
                                <Input id="rf-invoice-id" v-model="newInvoiceId" placeholder="Enter invoice ID" class="mt-1 w-full" />
                            </div>
                            <div>
                                <Label for="rf-amount">Amount</Label>
                                <Input id="rf-amount" v-model.number="newAmount" type="number" placeholder="0.00" min="0" step="0.01" class="mt-1 w-full" />
                            </div>
                            <div>
                                <Label for="rf-reason">Reason</Label>
                                <Textarea id="rf-reason" v-model="newReason" placeholder="Why is this refund being requested?" rows="3" class="mt-1 w-full" />
                            </div>
                        </fieldset>
                    </div>
                </ScrollArea>

                <SheetFooter class="shrink-0 border-t bg-background px-6 py-4">
                    <Button variant="outline" @click="sheetOpen = false">Cancel</Button>
                    <Button :disabled="submitting" @click="createRefund">
                        {{ submitting ? 'Submitting...' : 'Submit refund' }}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    </AppLayout>
</template>
