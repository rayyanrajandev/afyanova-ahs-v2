<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { refDebounced } from '@vueuse/core';
import { computed, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import ListPagination from '@/components/ListPagination.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet, apiPost } from '@/lib/apiClient';
import { generateRequestKey } from '@/lib/idempotency';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

type DailyCloseRecord = {
    id: string;
    closedAt: string;
    totalRevenue: number;
    netRevenue: number;
    status: string;
};

type DailyCloseStatus = 'all' | 'draft' | 'submitted' | 'verified';

type DailyCloseForm = {
    openedAt: string;
    closedAt: string;
    totalCash: number;
    totalCard: number;
    totalMpesa: number;
    totalOther: number;
    totalRefunds: number;
    notes: string;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing' },
    { title: 'Daily Revenue Close', href: '/billing-daily-close' },
];

const closes = ref<DailyCloseRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const searchInputRaw = ref('');
const searchInputDebounced = refDebounced(searchInputRaw, 250);
const statusFilter = ref<DailyCloseStatus>('all');
const page = ref(1);
const perPage = ref(25);
const totalPages = ref(1);
const total = ref(0);

const showDialog = ref(false);
const submitting = ref(false);

const form = ref<DailyCloseForm>({
    openedAt: new Date(Date.now() - 28800000).toISOString().slice(0, 16),
    closedAt: new Date().toISOString().slice(0, 16),
    totalCash: 0,
    totalCard: 0,
    totalMpesa: 0,
    totalOther: 0,
    totalRefunds: 0,
    notes: '',
});

const requestKey = ref(generateRequestKey('daily-close-create'));

const statusCounts = computed(() => {
    const all = total.value;
    const draft = closes.value.filter((r) => r.status === 'draft').length;
    const submitted = closes.value.filter((r) => r.status === 'submitted').length;
    const verified = closes.value.filter((r) => r.status === 'verified').length;
    return { all, draft, submitted, verified };
});

const netRevenue = computed(() => {
    const net = form.value.totalCash + form.value.totalCard + form.value.totalMpesa + form.value.totalOther - form.value.totalRefunds;
    return Math.max(0, net);
});

const validationError = computed(() => {
    const opened = new Date(form.value.openedAt);
    const closed = new Date(form.value.closedAt);
    if (closed <= opened) return 'Close time must be after open time.';
    const totalAmt = form.value.totalCash + form.value.totalCard + form.value.totalMpesa + form.value.totalOther;
    if (totalAmt <= 0 && form.value.totalRefunds <= 0) return 'Enter at least one payment amount.';
    return null;
});

const hasActiveFilters = computed(() => statusFilter.value !== 'all' || searchInputRaw.value.trim() !== '');

watch(searchInputDebounced, () => {
    page.value = 1;
    load();
});

function submitSearchNow(): void {
    load();
}

function setStatus(value: string | number): void {
    statusFilter.value = String(value) as DailyCloseStatus;
    page.value = 1;
    load();
}

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
            q: searchInputDebounced.value || null,
            status: statusFilter.value === 'all' ? null : statusFilter.value,
            page: page.value,
            perPage: perPage.value,
        };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null));
        const res: any = await apiGet('/daily-closes', clean);
        closes.value = res.data ?? [];
        total.value = res.meta?.total ?? 0;
        totalPages.value = res.meta?.lastPage ?? 1;
    } catch (e) {
        error.value = 'Failed to load daily closes.';
    } finally {
        loading.value = false;
    }
}

async function submitClose() {
    if (validationError.value) return;
    submitting.value = true;
    error.value = null;
    try {
        await apiPost('/daily-closes', {
            body: {
                closed_at: form.value.closedAt,
                opened_at: form.value.openedAt,
                total_cash_amount: form.value.totalCash,
                total_card_amount: form.value.totalCard,
                total_mpesa_amount: form.value.totalMpesa,
                total_other_amount: form.value.totalOther,
                total_refunds: form.value.totalRefunds,
                notes: form.value.notes,
                idempotencyKey: requestKey.value,
            },
        });
        notifySuccess('Daily close created successfully.');
        showDialog.value = false;
        requestKey.value = generateRequestKey('daily-close-create');
        await load();
    } catch (e: any) {
        error.value = e?.payload?.message || messageFromUnknown(e);
    } finally {
        submitting.value = false;
    }
}

const { scrollContainerHeight } = useStickyScrollContainer();
onMounted(load);
</script>

<template>
    <Head title="Daily Revenue Close" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <Tabs :model-value="statusFilter" class="contents" @update:model-value="setStatus">
                <div class="sticky top-0 z-10 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex items-center gap-2">
                                <h1 class="text-lg font-bold tracking-tight md:text-xl">Daily Revenue Close</h1>
                                <Badge v-if="total > 0" variant="secondary">{{ total }} total</Badge>
                            </div>
                            <p class="text-xs text-muted-foreground">Cashier settlement and revenue reconciliation</p>
                        </div>
                        <div class="flex shrink-0 flex-wrap items-center gap-2">
                            <Button size="sm" class="h-8 gap-1.5" @click="showDialog = true">
                                <AppIcon name="plus" class="size-3.5" />
                                New Close
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

                    <div class="mt-3 grid grid-cols-4 gap-2">
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">All</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.all }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Draft</p>
                            <p class="text-sm font-bold tabular-nums text-yellow-600">{{ statusCounts.draft }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Submitted</p>
                            <p class="text-sm font-bold tabular-nums text-blue-600">{{ statusCounts.submitted }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Verified</p>
                            <p class="text-sm font-bold tabular-nums text-green-600">{{ statusCounts.verified }}</p>
                        </div>
                    </div>

                    <TabsList class="mt-3 grid w-full grid-cols-4">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.all }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="draft" class="inline-flex items-center gap-1.5">
                            Draft
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.draft }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="submitted" class="inline-flex items-center gap-1.5">
                            Submitted
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.submitted }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="verified" class="inline-flex items-center gap-1.5">
                            Verified
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.verified }}</Badge>
                        </TabsTrigger>
                    </TabsList>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <div class="relative min-w-0 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input v-model="searchInputRaw" placeholder="Search closes..." class="h-9 pl-9" @keydown.enter="submitSearchNow" />
                        </div>
                    </div>
                </div>

            <div v-if="error" class="px-4 md:px-6">
                <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</div>
            </div>

            <div v-if="loading" class="flex items-center justify-center py-16 text-sm text-muted-foreground">
                Loading...
            </div>

            <div v-else-if="closes.length > 0" class="divide-y px-4 md:px-6">
                <div
                    v-for="c in closes"
                    :key="c.id"
                    class="flex items-center justify-between py-3 text-sm hover:bg-muted/50"
                >
                    <div class="grid flex-1 grid-cols-4 gap-4">
                        <div>
                            <span class="text-muted-foreground text-xs">Date</span>
                            <p class="font-medium">{{ new Date(c.closedAt).toLocaleDateString() }}</p>
                        </div>
                        <div>
                            <span class="text-muted-foreground text-xs">Revenue</span>
                            <p class="font-medium">{{ c.totalRevenue?.toLocaleString() }}</p>
                        </div>
                        <div>
                            <span class="text-muted-foreground text-xs">Net</span>
                            <p class="font-medium">{{ c.netRevenue?.toLocaleString() }}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Badge
                                :variant="
                                    c.status === 'verified'
                                        ? 'success'
                                        : c.status === 'submitted'
                                            ? 'secondary'
                                            : 'default'
                                "
                            >
                                {{ c.status }}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="!loading && closes.length === 0" class="px-4 md:px-6">
                <InventoryEmptyState
                    :has-filters="hasActiveFilters"
                    title="No daily closes found"
                    description="Create a new close to record shift settlement."
                    @clear="clearAllFilters"
                />
            </div>

            <div v-if="totalPages > 1" class="flex justify-center px-4 py-4 md:px-6">
                <ListPagination
                    v-model:page="page"
                    :total-pages="totalPages"
                    :total="total"
                    :per-page="perPage"
                    @update:page="load"
                />
            </div>
            </Tabs>
        </div>

        <Dialog v-model:open="showDialog">
            <DialogContent class="max-w-lg">
                <DialogHeader>
                    <DialogTitle>New Daily Close</DialogTitle>
                    <DialogDescription>Record cashier shift settlement</DialogDescription>
                </DialogHeader>
                <div v-if="validationError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ validationError }}</div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <Label>Opened At</Label>
                        <Input v-model="form.openedAt" type="datetime-local" class="w-full" />
                    </div>
                    <div class="space-y-2">
                        <Label>Closed At</Label>
                        <Input v-model="form.closedAt" type="datetime-local" class="w-full" />
                    </div>
                    <div class="space-y-2">
                        <Label>Cash Amount</Label>
                        <Input v-model.number="form.totalCash" type="number" step="0.01" min="0" class="w-full" />
                    </div>
                    <div class="space-y-2">
                        <Label>Card Amount</Label>
                        <Input v-model.number="form.totalCard" type="number" step="0.01" min="0" class="w-full" />
                    </div>
                    <div class="space-y-2">
                        <Label>M-Pesa Amount</Label>
                        <Input v-model.number="form.totalMpesa" type="number" step="0.01" min="0" class="w-full" />
                    </div>
                    <div class="space-y-2">
                        <Label>Other Amount</Label>
                        <Input v-model.number="form.totalOther" type="number" step="0.01" min="0" class="w-full" />
                    </div>
                    <div class="space-y-2">
                        <Label>Refunds</Label>
                        <Input v-model.number="form.totalRefunds" type="number" step="0.01" min="0" class="w-full" />
                    </div>
                    <div class="space-y-2">
                        <Label>Net Revenue</Label>
                        <Input :model-value="netRevenue.toFixed(2)" disabled class="w-full" />
                    </div>
                    <div class="col-span-2 space-y-2">
                        <Label>Notes</Label>
                        <Textarea v-model="form.notes" class="w-full" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="showDialog = false">Cancel</Button>
                    <Button :disabled="submitting || !!validationError" @click="submitClose">
                        {{ submitting ? 'Submitting...' : 'Create Close' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
