<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { messageFromUnknown, notifyError } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type FinancialControlsSummary = {
    generatedAt: string | null;
    window: {
        from: string | null;
        to: string | null;
        asOf: string | null;
        currencyCode: string | null;
        payerType: string | null;
        departmentId: string | null;
    };
    outstanding: {
        invoiceCount: number;
        balanceAmountTotal: number;
        overdueInvoiceCount: number;
        overdueBalanceAmountTotal: number;
        averageDaysOverdue: number;
    };
    agingBuckets: Record<string, { invoiceCount: number; balanceAmountTotal: number }>;
    denials: {
        deniedClaimCount: number;
        partialDeniedClaimCount: number;
        deniedAmountTotal: number;
        topReasons: Array<{ reason: string; claimCount: number; deniedAmountTotal: number }>;
    };
    settlement: {
        approvedAmountTotal: number;
        settledAmountTotal: number;
        pendingSettlementAmount: number;
        settlementRatePercent: number;
        reconciliationStatusCounts: Record<string, number>;
    };
};

type RevenueRecognitionSummary = {
    generatedAt: string | null;
    window: {
        from: string | null;
        to: string | null;
        asOf: string | null;
        currencyCode: string | null;
        departmentId: string | null;
    };
    infrastructure: {
        revenueRecognitionReady: boolean;
        glPostingReady: boolean;
        missingTables: string[];
    };
    recognition: {
        recognizedInvoiceCount: number;
        recognizedAmountTotal: number;
        adjustedAmountTotal: number;
        netRevenueTotal: number;
        latestRecognitionAt: string | null;
        recognitionMethodCounts: Record<string, number>;
    };
    coverage: {
        eligibleInvoiceCount: number;
        recognizedInvoiceCount: number;
        unrecognizedInvoiceCount: number;
        recognizedCoveragePercent: number;
        unrecognizedAmountTotal: number;
    };
    glPosting: {
        entryStatusCounts: Record<string, number>;
        draftDebitAmountTotal: number;
        draftCreditAmountTotal: number;
        postedDebitAmountTotal: number;
        postedCreditAmountTotal: number;
        staleDraftEntryCount: number;
        latestPostingDate: string | null;
        openBatchCount: number;
    };
};

type ApiResponse<T> = { data: T };
type DepartmentFilterOption = {
    id: string;
    code: string | null;
    name: string | null;
    serviceType: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Financial Reports', href: '/billing-financial-reports' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.financial-controls.read') === 'allowed');

const loading = ref(false);
const pageError = ref<string | null>(null);
const controlsSummary = ref<FinancialControlsSummary | null>(null);
const revenueSummary = ref<RevenueRecognitionSummary | null>(null);
const departmentOptions = ref<DepartmentFilterOption[]>([]);
const autoRefreshHandle = ref<ReturnType<typeof setTimeout> | null>(null);
let latestRequestId = 0;

const defaultFilters = {
    currencyCode: 'TZS',
    payerType: 'all',
    departmentId: 'all',
    from: '',
    to: '',
    asOfDate: '',
    asOfTime: '',
} as const;

const filters = reactive({ ...defaultFilters });

const asOfQueryValue = computed(() => {
    const date = filters.asOfDate.trim();
    if (date === '') return '';

    const time = filters.asOfTime.trim() || '23:59';
    return `${date}T${time}`;
});

const normalizedFilters = computed(() => ({
    currencyCode: filters.currencyCode.trim().toUpperCase() || defaultFilters.currencyCode,
    payerType: filters.payerType,
    departmentId: filters.departmentId.trim() || defaultFilters.departmentId,
    from: filters.from.trim(),
    to: filters.to.trim(),
    asOfDate: filters.asOfDate.trim(),
    asOfTime: filters.asOfTime.trim(),
}));

const filterSignature = computed(() => JSON.stringify(normalizedFilters.value));
const defaultFilterSignature = JSON.stringify(defaultFilters);
const hasActiveFilters = computed(() => filterSignature.value !== defaultFilterSignature);

const payerTypeOptions = [
    { value: 'all', label: 'All payer types' },
    { value: 'self_pay', label: 'Self pay' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'employer', label: 'Employer' },
    { value: 'government', label: 'Government' },
    { value: 'donor', label: 'Donor' },
    { value: 'other', label: 'Other' },
];

const selectedDepartmentLabel = computed(() => {
    if (filters.departmentId === 'all') {
        return 'All billing areas';
    }

    const selected = departmentOptions.value.find((option) => option.id === filters.departmentId);
    if (!selected) {
        return 'Selected billing area';
    }

    return selected.name?.trim() || selected.code?.trim() || 'Selected billing area';
});

const reportSummary = computed(() => {
    if (!controlsSummary.value || !revenueSummary.value) {
        return 'Loading the latest finance board.';
    }

    return [
        `${controlsSummary.value.outstanding.invoiceCount} invoices in balance watch`,
        `${formatCurrency(controlsSummary.value.settlement.pendingSettlementAmount)} waiting on payer settlement`,
        `${formatCurrency(revenueSummary.value.recognition.netRevenueTotal)} net recognized`,
        `${revenueSummary.value.coverage.recognizedCoveragePercent.toFixed(2)}% recognition coverage`,
    ].join(' | ');
});

const currentScopeChips = computed(() => {
    const chips = [
        `Currency ${filters.currencyCode.trim().toUpperCase() || 'TZS'}`,
        filters.payerType === 'all' ? 'All payer types' : formatLabel(filters.payerType),
        filters.departmentId === 'all' ? selectedDepartmentLabel.value : `Billing area ${selectedDepartmentLabel.value}`,
        filters.from.trim() !== '' ? `From ${formatDateTime(filters.from)}` : 'No start limit',
        filters.to.trim() !== '' ? `To ${formatDateTime(filters.to)}` : 'No end limit',
        asOfQueryValue.value !== '' ? `Position as at ${formatDateTime(asOfQueryValue.value)}` : 'Live current position',
    ];

    if (loading.value) {
        chips.unshift('Refreshing board');
    }

    return chips;
});

const fastAccessCards = computed(() => [
    {
        id: 'finance-pressure',
        title: 'Collections pressure',
        value: formatCurrency(controlsSummary.value?.outstanding.overdueBalanceAmountTotal),
        note: `${controlsSummary.value?.outstanding.overdueInvoiceCount ?? 0} overdue invoices need attention`,
        cta: 'Open pressure',
    },
    {
        id: 'finance-recognition',
        title: 'Recognition gap',
        value: formatCurrency(revenueSummary.value?.coverage.unrecognizedAmountTotal),
        note: `${revenueSummary.value?.coverage.unrecognizedInvoiceCount ?? 0} invoices still unrecognized`,
        cta: 'Open recognition',
    },
    {
        id: 'finance-gl-health',
        title: 'GL draft backlog',
        value: formatCurrency(revenueSummary.value?.glPosting.draftDebitAmountTotal),
        note: `${revenueSummary.value?.glPosting.staleDraftEntryCount ?? 0} stale drafts | ${revenueSummary.value?.glPosting.openBatchCount ?? 0} open batches`,
        cta: 'Open GL health',
    },
]);

const boardPulseRows = computed(() => [
    {
        label: 'Outstanding watch',
        value: formatCurrency(controlsSummary.value?.outstanding.balanceAmountTotal),
        detail: `${controlsSummary.value?.outstanding.invoiceCount ?? 0} invoices in balance watch`,
    },
    {
        label: 'Pending settlement',
        value: formatCurrency(controlsSummary.value?.settlement.pendingSettlementAmount),
        detail: `${controlsSummary.value?.settlement.settlementRatePercent ?? 0}% settled against approved claims`,
    },
    {
        label: 'Net recognized',
        value: formatCurrency(revenueSummary.value?.recognition.netRevenueTotal),
        detail: `${revenueSummary.value?.coverage.recognizedCoveragePercent ?? 0}% recognition coverage`,
    },
]);

const agingRows = computed(() => {
    const buckets = controlsSummary.value?.agingBuckets ?? {};
    const labels: Record<string, string> = {
        current: 'Current',
        days_1_30: '1-30 days',
        days_31_60: '31-60 days',
        days_61_90: '61-90 days',
        days_91_plus: '91+ days',
    };

    return Object.entries(labels).map(([key, label]) => ({
        key,
        label,
        invoiceCount: buckets[key]?.invoiceCount ?? 0,
        balanceAmountTotal: buckets[key]?.balanceAmountTotal ?? 0,
    }));
});

const recognitionMethodRows = computed(() =>
    Object.entries(revenueSummary.value?.recognition.recognitionMethodCounts ?? {}).map(([method, count]) => ({
        method: formatLabel(method),
        count,
    })),
);

const glStatusRows = computed(() => {
    const counts = revenueSummary.value?.glPosting.entryStatusCounts ?? {};
    const order = ['draft', 'posted', 'reversed', 'other', 'total'];

    return order.map((status) => ({
        status: formatLabel(status),
        count: counts[status] ?? 0,
    }));
});

const financeInfrastructureAlert = computed(() => {
    const infrastructure = revenueSummary.value?.infrastructure;
    if (!infrastructure) return null;

    if (infrastructure.revenueRecognitionReady && infrastructure.glPostingReady) {
        return null;
    }

    const missing = infrastructure.missingTables.length > 0
        ? infrastructure.missingTables.join(', ')
        : 'finance infrastructure tables';

    return {
        title: 'Finance ledger setup is incomplete',
        description: `This board is using fallback values because these tables are not available yet: ${missing}. Run the billing finance migration to activate full revenue-recognition and GL reporting.`,
    };
});

function formatCurrency(value: number | string | null | undefined, currency = filters.currencyCode || 'TZS'): string {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return `${currency} 0`;

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(numeric);
    } catch {
        return `${currency} ${numeric.toLocaleString()}`;
    }
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatLabel(value: string | null | undefined): string {
    if (!value) return 'Unknown';

    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function jumpToSection(id: string): void {
    const target = document.getElementById(id);
    if (!target) return;

    target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

function queryParams(includePayerType = true): URLSearchParams {
    const params = new URLSearchParams();

    if (filters.currencyCode.trim() !== '') params.set('currencyCode', filters.currencyCode.trim().toUpperCase());
    if (filters.from.trim() !== '') params.set('from', filters.from.trim());
    if (filters.to.trim() !== '') params.set('to', filters.to.trim());
    if (asOfQueryValue.value !== '') params.set('asOf', asOfQueryValue.value);
    if (filters.departmentId !== 'all') params.set('departmentId', filters.departmentId.trim());
    if (includePayerType && filters.payerType !== 'all') params.set('payerType', filters.payerType);

    return params;
}

async function fetchJson<T>(path: string, params: URLSearchParams): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    params.forEach((value, key) => url.searchParams.set(key, value));

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || `Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
}

async function loadReports(): Promise<void> {
    if (!canRead.value) {
        loading.value = false;
        return;
    }

    const requestId = ++latestRequestId;
    loading.value = true;
    pageError.value = null;

    try {
        const [controlsResponse, revenueResponse] = await Promise.all([
            fetchJson<ApiResponse<FinancialControlsSummary>>(
                '/billing-invoices/financial-controls/summary',
                queryParams(true),
            ),
            fetchJson<ApiResponse<RevenueRecognitionSummary>>(
                '/billing-invoices/financial-controls/revenue-recognition-summary',
                queryParams(false),
            ),
        ]);

        if (requestId !== latestRequestId) return;
        controlsSummary.value = controlsResponse.data;
        revenueSummary.value = revenueResponse.data;
    } catch (error) {
        if (requestId !== latestRequestId) return;
        pageError.value = messageFromUnknown(error, 'Unable to load billing financial reports.');
        notifyError(pageError.value);
    } finally {
        if (requestId !== latestRequestId) return;
        loading.value = false;
    }
}

async function loadDepartmentOptions(): Promise<void> {
    if (!canRead.value) {
        return;
    }

    try {
        const response = await fetchJson<ApiResponse<DepartmentFilterOption[]>>(
            '/billing-invoices/financial-controls/department-options',
            new URLSearchParams(),
        );
        departmentOptions.value = response.data;
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load finance department filters.'));
    }
}

function scheduleAutoRefresh(): void {
    if (!canRead.value) return;

    if (autoRefreshHandle.value) {
        clearTimeout(autoRefreshHandle.value);
    }

    autoRefreshHandle.value = setTimeout(() => {
        autoRefreshHandle.value = null;
        loadReports();
    }, 300);
}

function resetFilters(): void {
    filters.currencyCode = defaultFilters.currencyCode;
    filters.payerType = defaultFilters.payerType;
    filters.departmentId = defaultFilters.departmentId;
    filters.from = defaultFilters.from;
    filters.to = defaultFilters.to;
    filters.asOfDate = defaultFilters.asOfDate;
    filters.asOfTime = defaultFilters.asOfTime;
}

function exportControlsCsv(): void {
    const url = new URL('/api/v1/billing-invoices/financial-controls/summary/export', window.location.origin);
    queryParams(true).forEach((value, key) => url.searchParams.set(key, value));
    window.open(url.toString(), '_blank', 'noopener');
}

watch(filterSignature, (_next, previous) => {
    if (previous === undefined) return;
    scheduleAutoRefresh();
});

onMounted(() => {
    void loadDepartmentOptions();
    loadReports();
});

onBeforeUnmount(() => {
    if (autoRefreshHandle.value) {
        clearTimeout(autoRefreshHandle.value);
    }
});
</script>

<template>
    <Head title="Billing Financial Reports" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-6 p-4 md:p-6">
            <section class="rounded-lg border bg-background/80 p-4">
                <div class="flex flex-col gap-4">
                    <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div class="min-w-0 space-y-2">
                            <div class="flex items-center gap-2">
                                <h1 class="text-2xl font-semibold tracking-tight">Billing Financial Reports</h1>
                                <Badge variant="outline">Finance board</Badge>
                            </div>
                            <p class="max-w-3xl text-sm text-muted-foreground">
                                Track collections pressure, payer settlement exposure, revenue-recognition coverage, and GL posting health from one board.
                            </p>
                            <p class="text-sm text-muted-foreground">{{ reportSummary }}</p>
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            <Button variant="outline" as-child :disabled="!canRead">
                                <a href="/billing-payment-plans">Payment Plans</a>
                            </Button>
                            <Button variant="outline" as-child :disabled="!canRead">
                                <a href="/billing-corporate">Corporate Billing</a>
                            </Button>
                            <Button variant="outline" @click="loadReports" :disabled="loading || !canRead">
                                Refresh board
                            </Button>
                            <Button @click="exportControlsCsv" :disabled="loading || !canRead">
                                Export controls CSV
                            </Button>
                        </div>
                    </div>

                    <div v-if="canRead" class="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
                        <div class="rounded-lg border bg-background/70 p-3">
                            <div class="mb-3 flex flex-col gap-1">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Board setup</p>
                                <p class="text-sm text-muted-foreground">The board refreshes automatically when you change the reporting scope.</p>
                            </div>
                            <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-[8rem_11rem_12rem_minmax(0,1.1fr)_minmax(0,1fr)]">
                                <div class="space-y-2">
                                    <Label for="billing-finance-currency">Currency</Label>
                                    <Input id="billing-finance-currency" v-model="filters.currencyCode" maxlength="3" placeholder="TZS" />
                                </div>
                                <div class="space-y-2">
                                    <Label for="billing-finance-payer-type">Payer focus</Label>
                                    <Select v-model="filters.payerType">
                                        <SelectTrigger id="billing-finance-payer-type" class="w-full">
                                            <SelectValue placeholder="All payer types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="option in payerTypeOptions" :key="option.value" :value="option.value">
                                                {{ option.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="space-y-2">
                                    <Label for="billing-finance-department">Billing area</Label>
                                    <Select v-model="filters.departmentId">
                                        <SelectTrigger id="billing-finance-department" class="w-full">
                                            <SelectValue placeholder="All billing areas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All billing areas</SelectItem>
                                            <SelectItem
                                                v-for="option in departmentOptions"
                                                :key="option.id"
                                                :value="option.id"
                                            >
                                                {{ option.name || option.code || 'Unnamed department' }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="space-y-2">
                                    <DateRangeFilterPopover
                                        input-base-id="billing-finance-date-range"
                                        title="Reporting date range"
                                        helper-text="Choose the finance reporting window for controls, denials, settlements, and recognition."
                                        from-label="From"
                                        to-label="To"
                                        :number-of-months="1"
                                        v-model:from="filters.from"
                                        v-model:to="filters.to"
                                    />
                                </div>
                                <div>
                                    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
                                        <SingleDatePopoverField
                                            input-id="billing-finance-as-of-date"
                                            v-model="filters.asOfDate"
                                            label="Position date"
                                            helper-text="Optional report cutoff date for the finance snapshot."
                                            placeholder="Select date"
                                        />
                                        <TimePopoverField
                                            input-id="billing-finance-as-of-time"
                                            v-model="filters.asOfTime"
                                            label="Cutoff time"
                                            helper-text="Defaults to 23:59 when no time is chosen."
                                            placeholder="Select time"
                                            :disabled="filters.asOfDate.trim() === ''"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                                <p class="text-xs text-muted-foreground">
                                    Use <span class="font-medium text-foreground">Refresh board</span> only when you want to pull the latest figures again without changing filters.
                                </p>
                                <Button variant="ghost" size="sm" @click="resetFilters" :disabled="loading || !hasActiveFilters">
                                    Reset filters
                                </Button>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-background/70 p-3">
                            <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current scope</p>
                            <div class="mt-2 flex flex-wrap gap-2">
                                <Badge
                                    v-for="chip in currentScopeChips"
                                    :key="chip"
                                    variant="outline"
                                >
                                    {{ chip }}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <div v-if="canRead" class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <button type="button" class="rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40" @click="jumpToSection('finance-pressure')">
                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Outstanding watch</p>
                            <p class="mt-1 text-xl font-semibold">{{ formatCurrency(controlsSummary?.outstanding.balanceAmountTotal) }}</p>
                            <p class="mt-1 text-sm text-muted-foreground">{{ controlsSummary?.outstanding.invoiceCount ?? 0 }} invoices in active balance watch</p>
                        </button>
                        <button type="button" class="rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40" @click="jumpToSection('finance-pressure')">
                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Overdue pressure</p>
                            <p class="mt-1 text-xl font-semibold">{{ formatCurrency(controlsSummary?.outstanding.overdueBalanceAmountTotal) }}</p>
                            <p class="mt-1 text-sm text-muted-foreground">{{ controlsSummary?.outstanding.overdueInvoiceCount ?? 0 }} overdue invoices | {{ controlsSummary?.outstanding.averageDaysOverdue ?? 0 }} average days overdue</p>
                        </button>
                        <button type="button" class="rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40" @click="jumpToSection('finance-recognition')">
                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recognition gap</p>
                            <p class="mt-1 text-xl font-semibold">{{ formatCurrency(revenueSummary?.coverage.unrecognizedAmountTotal) }}</p>
                            <p class="mt-1 text-sm text-muted-foreground">{{ revenueSummary?.coverage.unrecognizedInvoiceCount ?? 0 }} invoices still unrecognized</p>
                        </button>
                        <button type="button" class="rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40" @click="jumpToSection('finance-gl-health')">
                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">GL draft backlog</p>
                            <p class="mt-1 text-xl font-semibold">{{ formatCurrency(revenueSummary?.glPosting.draftDebitAmountTotal) }}</p>
                            <p class="mt-1 text-sm text-muted-foreground">{{ revenueSummary?.glPosting.staleDraftEntryCount ?? 0 }} stale drafts | {{ revenueSummary?.glPosting.openBatchCount ?? 0 }} open batches</p>
                        </button>
                    </div>
                </div>
            </section>

            <Alert v-if="!canRead" variant="destructive" class="rounded-lg">
                <AlertTitle>Financial reporting access is required</AlertTitle>
                <AlertDescription>
                    Request <code>billing.financial-controls.read</code> to open the finance board and reporting summaries.
                </AlertDescription>
            </Alert>

            <Alert v-else-if="pageError" variant="destructive" class="rounded-lg">
                <AlertTitle>Unable to load the finance board</AlertTitle>
                <AlertDescription>{{ pageError }}</AlertDescription>
            </Alert>

            <Alert
                v-else-if="financeInfrastructureAlert"
                variant="destructive"
                class="rounded-lg"
            >
                <AlertTitle>{{ financeInfrastructureAlert.title }}</AlertTitle>
                <AlertDescription>{{ financeInfrastructureAlert.description }}</AlertDescription>
            </Alert>

            <section
                v-if="canRead"
                id="finance-pressure"
                class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
            >
                <Card class="rounded-lg">
                    <CardHeader>
                        <CardTitle>Collections and claims pressure</CardTitle>
                        <CardDescription>
                            Aging, denied exposure, and payer settlement posture across the current reporting window.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-5">
                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <div
                                v-for="bucket in agingRows"
                                :key="bucket.key"
                                class="rounded-lg border bg-muted/30 p-3"
                            >
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">{{ bucket.label }}</p>
                                <p class="mt-2 text-lg font-semibold">{{ formatCurrency(bucket.balanceAmountTotal) }}</p>
                                <p class="text-sm text-muted-foreground">{{ bucket.invoiceCount }} invoices</p>
                            </div>
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="rounded-lg border p-4">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Denials</p>
                                <p class="mt-2 text-2xl font-semibold">{{ formatCurrency(controlsSummary?.denials.deniedAmountTotal) }}</p>
                                <p class="text-sm text-muted-foreground">
                                    {{ controlsSummary?.denials.deniedClaimCount ?? 0 }} denied | {{ controlsSummary?.denials.partialDeniedClaimCount ?? 0 }} partially denied
                                </p>
                            </div>
                            <div class="rounded-lg border p-4">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Settlement cycle</p>
                                <p class="mt-2 text-2xl font-semibold">{{ formatCurrency(controlsSummary?.settlement.settledAmountTotal) }}</p>
                                <p class="text-sm text-muted-foreground">
                                    {{ formatCurrency(controlsSummary?.settlement.approvedAmountTotal) }} approved | {{ controlsSummary?.settlement.reconciliationStatusCounts.total ?? 0 }} claims in cohort
                                </p>
                            </div>
                        </div>

                        <div class="rounded-lg border p-4">
                            <div class="flex items-center justify-between gap-2">
                                <div>
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top denial reasons</p>
                                    <p class="text-sm text-muted-foreground">Keep payer challenge patterns visible for follow-up and contract review.</p>
                                </div>
                            </div>
                            <div class="mt-4 space-y-3">
                                <div
                                    v-for="reason in controlsSummary?.denials.topReasons ?? []"
                                    :key="reason.reason"
                                    class="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                                >
                                    <div class="min-w-0">
                                        <p class="font-medium">{{ reason.reason }}</p>
                                        <p class="text-sm text-muted-foreground">{{ reason.claimCount }} claims</p>
                                    </div>
                                    <p class="text-sm font-medium">{{ formatCurrency(reason.deniedAmountTotal) }}</p>
                                </div>
                                <p v-if="(controlsSummary?.denials.topReasons ?? []).length === 0" class="text-sm text-muted-foreground">
                                    No denied claims in the current window.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div class="grid gap-4">
                <Card id="finance-recognition" class="rounded-lg">
                    <CardHeader class="pb-3">
                        <CardTitle>Recognition coverage</CardTitle>
                        <CardDescription>
                            Revenue-recognition posture for billable invoices in the same reporting window.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="grid gap-3">
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="rounded-lg border bg-muted/20 p-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recognized revenue</p>
                                <p class="mt-1 text-xl font-semibold">{{ formatCurrency(revenueSummary?.recognition.recognizedAmountTotal) }}</p>
                                <p class="text-sm text-muted-foreground">{{ revenueSummary?.recognition.recognizedInvoiceCount ?? 0 }} invoices recognized</p>
                            </div>
                            <div class="rounded-lg border bg-muted/20 p-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Adjustments</p>
                                <p class="mt-1 text-xl font-semibold">{{ revenueSummary?.coverage.recognizedCoveragePercent ?? 0 }}%</p>
                                <p class="text-sm text-muted-foreground">{{ revenueSummary?.coverage.recognizedInvoiceCount ?? 0 }} of {{ revenueSummary?.coverage.eligibleInvoiceCount ?? 0 }} eligible invoices</p>
                            </div>
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="flex items-center justify-between gap-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recognition methods</p>
                                <p class="text-xs text-muted-foreground">Latest {{ formatDateTime(revenueSummary?.recognition.latestRecognitionAt) }}</p>
                            </div>
                            <div class="mt-3 space-y-2">
                                <div
                                    v-for="item in recognitionMethodRows"
                                    :key="item.method"
                                    class="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2"
                                >
                                    <span class="text-sm">{{ item.method }}</span>
                                    <Badge variant="secondary">{{ item.count }}</Badge>
                                </div>
                                <p v-if="recognitionMethodRows.length === 0" class="text-sm text-muted-foreground">
                                    No revenue-recognition records posted in this window yet.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            <Card v-if="canRead" id="finance-gl-health" class="rounded-lg">
                    <CardHeader class="pb-3">
                        <CardTitle>GL posting health</CardTitle>
                        <CardDescription>
                            Draft posting backlog, batch discipline, and posting volume before month-end close.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="grid gap-3">
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="rounded-lg border p-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Draft posting exposure</p>
                                <p class="mt-1 text-xl font-semibold">{{ formatCurrency(revenueSummary?.glPosting.draftDebitAmountTotal) }}</p>
                                <p class="text-sm text-muted-foreground">
                                    {{ revenueSummary?.glPosting.staleDraftEntryCount ?? 0 }} stale draft entries | {{ revenueSummary?.glPosting.openBatchCount ?? 0 }} open draft batches
                                </p>
                            </div>
                            <div class="rounded-lg border p-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Posted volume</p>
                                <p class="mt-1 text-xl font-semibold">{{ formatCurrency(revenueSummary?.glPosting.postedCreditAmountTotal) }}</p>
                                <p class="text-sm text-muted-foreground">
                                    Latest posting {{ formatDateTime(revenueSummary?.glPosting.latestPostingDate) }}
                                </p>
                            </div>
                        </div>

                        <div class="grid gap-3 md:grid-cols-2">
                            <div class="rounded-lg border p-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Entry status counts</p>
                                <div class="mt-3 space-y-2">
                                    <div
                                        v-for="item in glStatusRows"
                                        :key="item.status"
                                        class="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2"
                                    >
                                        <span class="text-sm">{{ item.status }}</span>
                                        <Badge variant="outline">{{ item.count }}</Badge>
                                    </div>
                                </div>
                            </div>
                            <div class="rounded-lg border p-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Posting amounts</p>
                                <div class="mt-3 space-y-3 text-sm">
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-muted-foreground">Draft debit</span>
                                        <span class="font-medium">{{ formatCurrency(revenueSummary?.glPosting.draftDebitAmountTotal) }}</span>
                                    </div>
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-muted-foreground">Draft credit</span>
                                        <span class="font-medium">{{ formatCurrency(revenueSummary?.glPosting.draftCreditAmountTotal) }}</span>
                                    </div>
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-muted-foreground">Posted debit</span>
                                        <span class="font-medium">{{ formatCurrency(revenueSummary?.glPosting.postedDebitAmountTotal) }}</span>
                                    </div>
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-muted-foreground">Posted credit</span>
                                        <span class="font-medium">{{ formatCurrency(revenueSummary?.glPosting.postedCreditAmountTotal) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                </div>
            </section>
        </div>
    </AppLayout>
</template>
