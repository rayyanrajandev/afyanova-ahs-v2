<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    auditActionDisplayLabel,
    type AuditActorSummary,
} from '@/lib/audit';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { errors?: Record<string, string[]>; message?: string } };
type ClaimsWorkspaceView = 'queue' | 'board' | 'create';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Claims & Insurance', href: '/claims-insurance' }];
const payerTypeOptions = ['self_pay', 'insurance', 'employer', 'government', 'donor', 'other'];
const statusOptions = ['draft', 'submitted', 'adjudicating', 'approved', 'rejected', 'partial', 'cancelled'];
const statusActionOptions = ['submitted', 'adjudicating', 'approved', 'rejected', 'partial', 'cancelled'];
const reconciliationStatusOptions = ['pending', 'partial_settled', 'settled'];
const reconciliationExceptionStatusOptions = ['none', 'open', 'resolved'];
const followUpStatusOptions = ['pending', 'in_progress', 'resolved', 'waived'];
const auditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
];
const claimsAuditActionOptions = [
    { value: 'claims-insurance-case.created', label: 'Claim Created' },
    { value: 'claims-insurance-case.updated', label: 'Claim Updated' },
    { value: 'claims-insurance-case.status.updated', label: 'Status Updated' },
    { value: 'claims-insurance-case.reconciliation.updated', label: 'Settlement Reconciled' },
    { value: 'claims-insurance-case.reconciliation-follow-up.updated', label: 'Follow-up Updated' },
    { value: 'claims-insurance-case.document.pdf.downloaded', label: 'PDF Downloaded' },
] as const;

type ClaimsAuditLog = {
    id: string;
    claimsInsuranceCaseId: string | null;
    actorId: number | null;
    actorType: 'system' | 'user' | string | null;
    actor?: AuditActorSummary | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
};

type BillingInvoicePreview = {
    id: string;
    invoiceNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    status: string | null;
    invoiceDate: string | null;
    paymentDueAt: string | null;
    currencyCode: string | null;
    totalAmount: string | number | null;
    balanceAmount: string | number | null;
    payerSummary: {
        payerType?: string | null;
        payerName?: string | null;
        contractName?: string | null;
        settlementPath?: string | null;
        expectedPayerAmount?: string | number | null;
        expectedPatientAmount?: string | number | null;
    } | null;
    claimReadiness: {
        ready?: boolean;
        claimEligible?: boolean;
        blockingReasons?: string[];
        guidance?: string[];
    } | null;
};

const canRead = ref(false);
const canCreate = ref(false);
const canUpdate = ref(false);
const canUpdateStatus = ref(false);
const canViewAudit = ref(false);
const canReadBillingInvoices = ref(false);

const queueLoading = ref(false);
const queueError = ref<string | null>(null);
const claims = ref<any[]>([]);
const counts = ref({ draft: 0, submitted: 0, adjudicating: 0, approved: 0, rejected: 0, partial: 0, cancelled: 0, other: 0, total: 0 });
const pagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const pageLoading = ref(true);

const compactQueueRows = useLocalStorageBoolean('claims.insurance.queueRows.compact', false);
const mobileFiltersDrawerOpen = ref(false);
const advancedFiltersSheetOpen = ref(false);
const advancedFiltersDraft = reactive({
    payerType: '',
    reconciliationStatus: '',
    reconciliationExceptionStatus: '',
});
const claimsWorkspaceView = ref<ClaimsWorkspaceView>(
    queryParam('tab') === 'board'
        ? 'board'
        : queryParam('tab') === 'new'
          ? 'create'
          : 'queue',
);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryEnumParam(name: string, allowed: string[]): string {
    const value = queryParam(name);
    if (!value) return '';
    return allowed.includes(value) ? value : '';
}

function queryPositiveIntParam(name: string, fallback: number, min = 1, max = Number.POSITIVE_INFINITY): number {
    const raw = queryParam(name);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < min) return fallback;
    return Math.min(parsed, max);
}

function queryPerPageParam(name: string, fallback: number, allowed: number[]): number {
    const parsed = queryPositiveIntParam(name, fallback, 1, 500);
    return allowed.includes(parsed) ? parsed : fallback;
}

const searchForm = reactive({
    q: queryParam('q'),
    invoiceId: queryParam('invoiceId'),
    status: queryEnumParam('status', statusOptions),
    payerType: queryEnumParam('payerType', payerTypeOptions),
    reconciliationStatus: queryEnumParam('reconciliationStatus', reconciliationStatusOptions),
    reconciliationExceptionStatus: queryEnumParam('reconciliationExceptionStatus', reconciliationExceptionStatusOptions),
    page: queryPositiveIntParam('page', 1),
    perPage: queryPerPageParam('perPage', 25, [10, 25, 50]),
});

function syncQueueFiltersToUrl(): void {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    if (claimsWorkspaceView.value === 'board') {
        params.set('tab', 'board');
    } else if (claimsWorkspaceView.value === 'create') {
        params.set('tab', 'new');
    }
    const q = searchForm.q.trim();
    const invoiceId = claimsWorkspaceView.value === 'create'
        ? createForm.invoiceId.trim()
        : searchForm.invoiceId.trim();
    if (q) params.set('q', q);
    if (invoiceId) params.set('invoiceId', invoiceId);
    if (searchForm.status) params.set('status', searchForm.status);
    if (claimsWorkspaceView.value === 'create') {
        if (createForm.payerType) params.set('payerType', createForm.payerType);
        if (createForm.payerName.trim()) params.set('payerName', createForm.payerName.trim());
        if (createForm.payerReference.trim()) params.set('payerReference', createForm.payerReference.trim());
        if (createInvoiceContextLocked.value && createContextSource.value) {
            params.set('from', createContextSource.value);
        }
    } else if (searchForm.payerType) {
        params.set('payerType', searchForm.payerType);
    }
    if (searchForm.reconciliationStatus) params.set('reconciliationStatus', searchForm.reconciliationStatus);
    if (searchForm.reconciliationExceptionStatus) {
        params.set('reconciliationExceptionStatus', searchForm.reconciliationExceptionStatus);
    }
    if (searchForm.page > 1) params.set('page', String(searchForm.page));
    if (searchForm.perPage !== 25) params.set('perPage', String(searchForm.perPage));

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
        window.history.replaceState(window.history.state, '', nextUrl);
    }
}

function setClaimsWorkspaceView(
    view: ClaimsWorkspaceView,
    options?: { focusSearch?: boolean; scroll?: boolean },
) {
    claimsWorkspaceView.value = view;
    syncQueueFiltersToUrl();

    if (view === 'queue' && options?.focusSearch) {
        nextTick(() => {
            const input = document.getElementById('claims-q') as HTMLInputElement | null;
            input?.focus();
        });
    }

    if (!options?.scroll) return;

    nextTick(() => {
        const id = view === 'board'
            ? 'claims-insurance-board'
            : view === 'create'
              ? 'create-claims-insurance'
              : 'claims-insurance-queue';
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function openClaimsBoardWorkspace() {
    setClaimsWorkspaceView('board', { scroll: true });
}

function openCreateClaimWorkspace() {
    setClaimsWorkspaceView('create', { scroll: true });
}

const statusSelectValue = computed({
    get: () => searchForm.status || 'all',
    set: (v: string) => {
        searchForm.status = v === 'all' ? '' : v;
        searchForm.page = 1;
        void loadQueue();
    },
});

const reconciliationStatusSelectValue = computed({
    get: () => searchForm.reconciliationStatus || 'all',
    set: (v: string) => {
        searchForm.reconciliationStatus = v === 'all' ? '' : v;
        searchForm.page = 1;
        void loadQueue();
    },
});

const reconciliationExceptionSelectValue = computed({
    get: () => searchForm.reconciliationExceptionStatus || 'all',
    set: (v: string) => {
        searchForm.reconciliationExceptionStatus = v === 'all' ? '' : v;
        searchForm.page = 1;
        void loadQueue();
    },
});

const hasAnyFilters = computed(() => !!(
    searchForm.q
    || searchForm.invoiceId
    || searchForm.status
    || searchForm.payerType
    || searchForm.reconciliationStatus
    || searchForm.reconciliationExceptionStatus
));

const claimsActiveFilterCount = computed(() => (
    Number(Boolean(searchForm.status))
    + Number(Boolean(searchForm.invoiceId))
    + Number(Boolean(searchForm.payerType))
    + Number(Boolean(searchForm.reconciliationStatus))
    + Number(Boolean(searchForm.reconciliationExceptionStatus))
));

const claimsQueueStateLabel = computed(() => {
    if (searchForm.q.trim()) return 'Search active';
    if (claimsActiveFilterCount.value > 0) return 'Filters active';
    return 'All claims';
});

const claimsQueueFilterBadgeLabel = computed(() => {
    if (claimsActiveFilterCount.value === 0) return null;
    return `${claimsActiveFilterCount.value} filter${claimsActiveFilterCount.value === 1 ? '' : 's'}`;
});

const queueActiveFilterChips = computed(() => {
    const chips: string[] = [];
    if (searchForm.q.trim()) chips.push(`Search: ${searchForm.q.trim()}`);
    if (searchForm.invoiceId.trim()) chips.push(`Invoice: ${searchForm.invoiceId.trim()}`);
    if (searchForm.status) chips.push(`Status: ${formatEnumLabel(searchForm.status)}`);
    if (searchForm.payerType) chips.push(`Payer: ${formatEnumLabel(searchForm.payerType)}`);
    if (searchForm.reconciliationStatus) chips.push(`Recon: ${formatEnumLabel(searchForm.reconciliationStatus)}`);
    if (searchForm.reconciliationExceptionStatus) {
        chips.push(`Exception: ${formatEnumLabel(searchForm.reconciliationExceptionStatus)}`);
    }
    if (searchForm.perPage !== 25) chips.push(`${searchForm.perPage} rows`);
    if (compactQueueRows.value) chips.push('Compact view');
    return chips;
});

const claimQueueDetailsActionLabel = computed(() =>
    canUpdateStatus.value ? 'Open claim' : 'Review',
);

function claimInvoiceHref(invoiceId: string | null | undefined): string {
    const resolvedId = String(invoiceId ?? '').trim();
    if (!resolvedId) return '/billing-invoices';
    const url = new URL('/billing-invoices', window.location.origin);
    url.searchParams.set('focusInvoiceId', resolvedId);
    url.searchParams.set('from', 'claims');
    return `${url.pathname}${url.search}`;
}

function syncAdvancedFiltersDraftFromSearchForm() {
    advancedFiltersDraft.payerType = searchForm.payerType;
    advancedFiltersDraft.reconciliationStatus = searchForm.reconciliationStatus;
    advancedFiltersDraft.reconciliationExceptionStatus = searchForm.reconciliationExceptionStatus;
}

function openQueueFiltersSheet() {
    syncAdvancedFiltersDraftFromSearchForm();
    advancedFiltersSheetOpen.value = true;
}

function openQueueFiltersDrawer() {
    syncAdvancedFiltersDraftFromSearchForm();
    mobileFiltersDrawerOpen.value = true;
}

function applyAdvancedFilters(options?: { closeSheet?: boolean; closeDrawer?: boolean }) {
    searchForm.payerType = advancedFiltersDraft.payerType;
    searchForm.reconciliationStatus = advancedFiltersDraft.reconciliationStatus;
    searchForm.reconciliationExceptionStatus = advancedFiltersDraft.reconciliationExceptionStatus;
    searchForm.page = 1;
    if (options?.closeSheet) advancedFiltersSheetOpen.value = false;
    if (options?.closeDrawer) mobileFiltersDrawerOpen.value = false;
    void loadQueue();
}

function resetAdvancedFilters(options?: { closeSheet?: boolean; closeDrawer?: boolean }) {
    advancedFiltersDraft.payerType = '';
    advancedFiltersDraft.reconciliationStatus = '';
    advancedFiltersDraft.reconciliationExceptionStatus = '';
    searchForm.payerType = '';
    searchForm.reconciliationStatus = '';
    searchForm.reconciliationExceptionStatus = '';
    searchForm.page = 1;
    if (options?.closeSheet) advancedFiltersSheetOpen.value = false;
    if (options?.closeDrawer) mobileFiltersDrawerOpen.value = false;
    void loadQueue();
}

function submitSearch() {
    searchForm.page = 1;
    void loadQueue();
}

function setClaimsResultsPerPage(perPage: number) {
    if (searchForm.perPage === perPage) return;
    searchForm.perPage = perPage;
    searchForm.page = 1;
    void loadQueue();
}

function setClaimsQueueDensity(compact: boolean) {
    compactQueueRows.value = compact;
}

function submitSearchFromMobileDrawer() {
    applyAdvancedFilters({ closeDrawer: true });
}

function resetFiltersFromMobileDrawer() {
    resetAdvancedFilters({ closeDrawer: true });
}
const createForm = reactive({
    invoiceId: queryParam('invoiceId'),
    payerType: queryEnumParam('payerType', payerTypeOptions) || 'insurance',
    payerName: queryParam('payerName'),
    payerReference: queryParam('payerReference'),
    submittedAt: '',
    notes: '',
});
const createContextSource = ref(queryParam('from'));
const createInvoiceContextLocked = ref(
    createContextSource.value === 'billing' && createForm.invoiceId.trim() !== '',
);
const createInvoicePreview = ref<BillingInvoicePreview | null>(null);
const createInvoicePreviewLoading = ref(false);
const createInvoicePreviewError = ref<string | null>(null);
const createSubmitting = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const hasCreateFeedback = computed(() => Object.keys(createErrors.value).length > 0);

function resetCreateMessages() {
    createErrors.value = {};
}

function previewCreateSubmittedAt(value: string): string {
    return value ? formatDateTime(`${value.replace('T', ' ')}:00`) : 'Not set';
}

function isUuidLike(value: string | null | undefined): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(value ?? '').trim(),
    );
}

function resetCreateInvoicePreview(): void {
    createInvoicePreview.value = null;
    createInvoicePreviewError.value = null;
}

async function loadCreateInvoicePreview(invoiceId: string): Promise<void> {
    if (!canReadBillingInvoices.value || !isUuidLike(invoiceId)) {
        resetCreateInvoicePreview();
        return;
    }

    createInvoicePreviewLoading.value = true;
    createInvoicePreviewError.value = null;

    try {
        const response = await apiRequest<{ data: BillingInvoicePreview }>(
            'GET',
            `/billing-invoices/${invoiceId}`,
        );
        createInvoicePreview.value = response.data;

        const resolvedPayerType = String(response.data.payerSummary?.payerType ?? '').trim();
        if (
            createInvoiceContextLocked.value
            && payerTypeOptions.includes(resolvedPayerType)
        ) {
            createForm.payerType = resolvedPayerType;
        }

        const resolvedPayerName = String(
            response.data.payerSummary?.payerName
            ?? response.data.payerSummary?.contractName
            ?? '',
        ).trim();
        if (
            createInvoiceContextLocked.value
            && resolvedPayerName !== ''
            && createForm.payerName.trim() === ''
        ) {
            createForm.payerName = resolvedPayerName;
        }
    } catch (error) {
        createInvoicePreview.value = null;
        createInvoicePreviewError.value = messageFromUnknown(
            error,
            'Unable to load billing invoice handoff.',
        );
    } finally {
        createInvoicePreviewLoading.value = false;
    }
}

const createInvoiceSummaryLabel = computed(() =>
    createInvoicePreview.value?.invoiceNumber?.trim()
        || createForm.invoiceId.trim()
        || 'Invoice pending',
);

const createInvoiceSettlementRouteLabel = computed(() => {
    const payerSummary = createInvoicePreview.value?.payerSummary;
    return (
        payerSummary?.contractName?.trim()
        || payerSummary?.payerName?.trim()
        || payerSummary?.settlementPath?.trim()
        || 'Self-pay'
    );
});

const createInvoiceClaimReadinessLabel = computed(() => {
    if (createInvoicePreview.value?.claimReadiness?.ready) return 'Claim-ready';
    if (createInvoicePreview.value?.claimReadiness?.claimEligible) {
        return 'Authorization review';
    }

    return createInvoiceContextLocked.value ? 'Billing handoff' : 'Claim review';
});

const createInvoiceClaimReadinessVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (createInvoicePreview.value?.claimReadiness?.ready) return 'default';
    if (createInvoicePreview.value?.claimReadiness?.claimEligible) return 'secondary';
    if (createInvoicePreviewError.value) return 'destructive';
    return 'outline';
});

const createClaimCardDescription = computed(() =>
    createInvoiceContextLocked.value
        ? 'Start a claim from the locked billing handoff, then capture submission details for payer review.'
        : 'Link a billing invoice, set payer context, and capture submission handoff.',
);

const createClaimSourceTitle = computed(() =>
    createInvoiceContextLocked.value ? 'Billing handoff' : 'Claim source',
);

const createClaimSourceDescription = computed(() =>
    createInvoiceContextLocked.value
        ? 'This claim stays tied to the billing invoice so settlement and reconciliation stay aligned.'
        : 'Choose the billing invoice that should move into payer review.',
);

const createResolvedInvoicePayerType = computed(() => {
    const payerType = String(createInvoicePreview.value?.payerSummary?.payerType ?? '').trim();
    return payerTypeOptions.includes(payerType) ? payerType : '';
});

const createResolvedInvoicePayerName = computed(() =>
    String(
        createInvoicePreview.value?.payerSummary?.payerName
        ?? createInvoicePreview.value?.payerSummary?.contractName
        ?? '',
    ).trim(),
);

const createPayerTypeLocked = computed(
    () => createInvoiceContextLocked.value && createResolvedInvoicePayerType.value !== '',
);

const createPayerNameLocked = computed(
    () => createInvoiceContextLocked.value && createResolvedInvoicePayerName.value !== '',
);

function clearCreateInvoiceLock(): void {
    createContextSource.value = '';
    createInvoiceContextLocked.value = false;
    createForm.invoiceId = '';
    createForm.payerType = 'insurance';
    createForm.payerName = '';
    createForm.payerReference = '';
    resetCreateInvoicePreview();
    syncQueueFiltersToUrl();

    nextTick(() => {
        const input = document.getElementById('claims-create-invoice-id') as HTMLInputElement | null;
        input?.focus();
    });
}

const statusDialogOpen = ref(false);
const statusClaim = ref<any | null>(null);
const statusAction = ref<string>('submitted');
const statusReason = ref('');
const statusDecisionReason = ref('');
const statusSubmittedAt = ref(defaultDateTimeLocal());
const statusAdjudicatedAt = ref(defaultDateTimeLocal());
const statusApprovedAmount = ref('');
const statusRejectedAmount = ref('');
const statusSubmitting = ref(false);
const statusError = ref<string | null>(null);

const followUpDialogOpen = ref(false);
const followUpClaim = ref<any | null>(null);
const followUpStatus = ref('pending');
const followUpDueAt = ref('');
const followUpNote = ref('');
const followUpSubmitting = ref(false);
const followUpError = ref<string | null>(null);

const detailsOpen = ref(false);
const detailsClaim = ref<any | null>(null);
const detailsLoading = ref(false);
const detailsSheetTab = ref<'overview' | 'workflows' | 'audit'>('overview');
const detailsAuditFiltersOpen = ref(false);
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<ClaimsAuditLog[]>([]);
const detailsAuditExporting = ref(false);
const detailsAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const detailsAuditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});

function defaultDateTimeLocal(): string {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatAmount(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toInputDateTime(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function csrfToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return element?.content ?? null;
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, opts?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(opts?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(opts?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.payload = payload;
        throw error;
    }
    return payload as T;
}

async function loadPermissions() {
    try {
        const response = await apiRequest<{ data?: Array<{ name?: string }> }>('GET', '/auth/me/permissions');
        const names = new Set((response.data ?? []).map((item) => (item.name ?? '').trim()));
        canRead.value = names.has('claims.insurance.read');
        canCreate.value = names.has('claims.insurance.create');
        canUpdate.value = names.has('claims.insurance.update');
        canUpdateStatus.value = names.has('claims.insurance.update-status');
        canViewAudit.value = names.has('claims.insurance.view-audit-logs');
        canReadBillingInvoices.value = names.has('billing.invoices.read');
    } catch {
        canRead.value = false;
        canCreate.value = false;
        canUpdate.value = false;
        canUpdateStatus.value = false;
        canViewAudit.value = false;
        canReadBillingInvoices.value = false;
    }
}

async function loadQueue() {
    if (!canRead.value) return;
    syncQueueFiltersToUrl();
    queueLoading.value = true;
    queueError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<{ data: any[]; meta: { currentPage: number; lastPage: number } }>('GET', '/claims-insurance', {
                query: {
                    q: searchForm.q.trim() || null,
                    invoiceId: searchForm.invoiceId.trim() || null,
                    status: searchForm.status || null,
                    payerType: searchForm.payerType || null,
                    reconciliationStatus: searchForm.reconciliationStatus || null,
                    reconciliationExceptionStatus: searchForm.reconciliationExceptionStatus || null,
                    page: searchForm.page,
                    perPage: searchForm.perPage,
                },
            }),
            apiRequest<{ data: typeof counts.value }>('GET', '/claims-insurance/status-counts', {
                query: {
                    q: searchForm.q.trim() || null,
                    invoiceId: searchForm.invoiceId.trim() || null,
                    payerType: searchForm.payerType || null,
                    reconciliationStatus: searchForm.reconciliationStatus || null,
                    reconciliationExceptionStatus: searchForm.reconciliationExceptionStatus || null,
                },
            }),
        ]);
        claims.value = listResponse.data;
        pagination.value = listResponse.meta;
        counts.value = countsResponse.data;
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load claims queue.');
        claims.value = [];
        pagination.value = null;
    } finally {
        queueLoading.value = false;
    }
}

function resetQueueFilters() {
    searchForm.q = '';
    searchForm.invoiceId = '';
    searchForm.status = '';
    searchForm.payerType = '';
    searchForm.reconciliationStatus = '';
    searchForm.reconciliationExceptionStatus = '';
    searchForm.page = 1;
    void loadQueue();
}

function applyExceptionPreset(status: '' | 'open' | 'resolved' | 'none') {
    searchForm.reconciliationExceptionStatus = status;
    searchForm.page = 1;
    void loadQueue();
}

function createFieldError(name: string): string | null {
    return createErrors.value[name]?.[0] ?? null;
}

async function submitCreate() {
    if (!canCreate.value || createSubmitting.value) return;
    createSubmitting.value = true;
    createErrors.value = {};
    try {
        await apiRequest('POST', '/claims-insurance', {
            body: {
                invoiceId: createForm.invoiceId.trim(),
                payerType: createForm.payerType,
                payerName: createForm.payerName.trim() || null,
                payerReference: createForm.payerReference.trim() || null,
                submittedAt: createForm.submittedAt ? `${createForm.submittedAt.replace('T', ' ')}:00` : null,
                notes: createForm.notes.trim() || null,
            },
        });
        notifySuccess('Claims insurance case created.');
        createForm.invoiceId = '';
        createForm.payerName = '';
        createForm.payerReference = '';
        createForm.notes = '';
        createForm.submittedAt = '';
        createForm.payerType = 'insurance';
        createContextSource.value = '';
        createInvoiceContextLocked.value = false;
        resetCreateInvoicePreview();
        await loadQueue();
        setClaimsWorkspaceView('queue', { focusSearch: true, scroll: true });
    } catch (error) {
        createErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to create claims insurance case.'));
    } finally {
        createSubmitting.value = false;
    }
}

async function loadClaimDetails(id: string) {
    const response = await apiRequest<{ data: any }>('GET', `/claims-insurance/${id}`);
    detailsClaim.value = response.data;
}

function openStatusDialog(item: any, action: string) {
    statusClaim.value = item;
    statusAction.value = action;
    statusReason.value = '';
    statusDecisionReason.value = '';
    statusSubmittedAt.value = defaultDateTimeLocal();
    statusAdjudicatedAt.value = defaultDateTimeLocal();
    statusApprovedAmount.value = '';
    statusRejectedAmount.value = '';
    statusError.value = null;
    statusDialogOpen.value = true;
}

function statusNeedsDecision(): boolean {
    return statusAction.value === 'rejected' || statusAction.value === 'partial';
}

function statusNeedsSubmittedAt(): boolean {
    return statusAction.value === 'submitted';
}

function statusNeedsAdjudicatedAt(): boolean {
    return statusAction.value === 'approved' || statusAction.value === 'rejected' || statusAction.value === 'partial';
}

function statusNeedsApprovedAmount(): boolean {
    return statusAction.value === 'approved' || statusAction.value === 'partial';
}

function statusNeedsRejectedAmount(): boolean {
    return statusAction.value === 'rejected' || statusAction.value === 'partial';
}

async function submitStatusDialog() {
    if (!statusClaim.value || !canUpdateStatus.value || statusSubmitting.value) return;
    statusSubmitting.value = true;
    statusError.value = null;
    try {
        await apiRequest('PATCH', `/claims-insurance/${statusClaim.value.id}/status`, {
            body: {
                status: statusAction.value,
                reason: statusReason.value.trim() || null,
                decisionReason: statusDecisionReason.value.trim() || null,
                submittedAt: statusNeedsSubmittedAt() ? `${statusSubmittedAt.value.replace('T', ' ')}:00` : null,
                adjudicatedAt: statusNeedsAdjudicatedAt() ? `${statusAdjudicatedAt.value.replace('T', ' ')}:00` : null,
                approvedAmount: statusNeedsApprovedAmount()
                    ? (statusApprovedAmount.value.trim() === '' ? null : Number(statusApprovedAmount.value))
                    : null,
                rejectedAmount: statusNeedsRejectedAmount()
                    ? (statusRejectedAmount.value.trim() === '' ? null : Number(statusRejectedAmount.value))
                    : null,
            },
        });
        notifySuccess('Claim status updated.');
        statusDialogOpen.value = false;
        await loadQueue();
        if (detailsClaim.value?.id === statusClaim.value.id) {
            await loadClaimDetails(statusClaim.value.id);
        }
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update claim status.');
        notifyError(statusError.value);
    } finally {
        statusSubmitting.value = false;
    }
}

function canOpenFollowUp(item: any): boolean {
    return !!item
        && String(item.reconciliationExceptionStatus ?? '') === 'open'
        && canUpdateStatus.value;
}

function openFollowUpDialog(item: any) {
    followUpClaim.value = item;
    followUpStatus.value = String(item?.reconciliationFollowUpStatus || 'pending');
    followUpDueAt.value = toInputDateTime(item?.reconciliationFollowUpDueAt);
    followUpNote.value = String(item?.reconciliationFollowUpNote || '');
    followUpError.value = null;
    followUpDialogOpen.value = true;
}

function followUpNeedsDueAt(): boolean {
    return followUpStatus.value === 'pending' || followUpStatus.value === 'in_progress';
}

async function submitFollowUpDialog() {
    if (!followUpClaim.value || followUpSubmitting.value || !canUpdateStatus.value) return;
    followUpSubmitting.value = true;
    followUpError.value = null;
    try {
        const response = await apiRequest<{ data: any }>('PATCH', `/claims-insurance/${followUpClaim.value.id}/reconciliation-follow-up`, {
            body: {
                followUpStatus: followUpStatus.value,
                followUpDueAt: followUpNeedsDueAt() && followUpDueAt.value
                    ? `${followUpDueAt.value.replace('T', ' ')}:00`
                    : null,
                followUpNote: followUpNote.value.trim() || null,
            },
        });
        const updated = response.data;
        claims.value = claims.value.map((item) => (item.id === updated.id ? updated : item));
        if (detailsClaim.value?.id === updated.id) {
            detailsClaim.value = updated;
        }
        followUpDialogOpen.value = false;
        notifySuccess('Reconciliation follow-up updated.');
        await loadQueue();
        if (detailsClaim.value?.id === followUpClaim.value.id) {
            await loadClaimDetails(followUpClaim.value.id);
        }
    } catch (error) {
        followUpError.value = messageFromUnknown(error, 'Unable to update reconciliation follow-up.');
        notifyError(followUpError.value);
    } finally {
        followUpSubmitting.value = false;
    }
}

async function openDetails(item: any) {
    detailsClaim.value = item;
    detailsOpen.value = true;
    detailsLoading.value = true;
    detailsSheetTab.value = 'overview';
    detailsAuditFiltersOpen.value = false;
    detailsAuditLogs.value = [];
    detailsAuditError.value = null;
    detailsAuditMeta.value = null;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    try {
        await loadClaimDetails(item.id);
        if (canViewAudit.value) {
            await loadDetailsAuditLogs();
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load claim details.'));
    } finally {
        detailsLoading.value = false;
    }
}

function detailsAuditQuery() {
    return {
        q: detailsAuditFilters.q.trim() || null,
        action: detailsAuditFilters.action.trim() || null,
        actorType: detailsAuditFilters.actorType || null,
        actorId: detailsAuditFilters.actorId.trim() || null,
        from: detailsAuditFilters.from || null,
        to: detailsAuditFilters.to || null,
        page: detailsAuditFilters.page,
        perPage: detailsAuditFilters.perPage,
    };
}

function claimStatusVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (String(status ?? '')) {
        case 'approved':
        case 'settled':
            return 'default';
        case 'partial':
        case 'adjudicating':
            return 'secondary';
        case 'rejected':
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function claimMoneySummary(item: any): string {
    const amount = item?.claimAmount ?? item?.approvedAmount ?? item?.settledAmount ?? null;
    if (amount === null || amount === undefined || amount === '') return 'Amount pending';
    return `${formatAmount(amount)} ${String(item?.currencyCode ?? '').trim()}`.trim();
}

function claimMoneyWithCurrency(amount: string | number | null | undefined, item: any): string {
    if (amount === null || amount === undefined || amount === '') return 'N/A';
    return `${formatAmount(amount)} ${String(item?.currencyCode ?? '').trim()}`.trim();
}

function claimSlaDays(item: any): number {
    switch (String(item?.payerType ?? 'other')) {
        case 'self_pay':
            return 3;
        case 'insurance':
            return 14;
        case 'employer':
            return 10;
        case 'government':
        case 'donor':
            return 21;
        default:
            return 7;
    }
}

function claimSlaSnapshot(item: any): {
    title: string;
    dueAt: Date | null;
    dayDelta: number | null;
    tone: 'default' | 'warning' | 'destructive';
} | null {
    const exceptionStatus = String(item?.reconciliationExceptionStatus ?? '');
    const followUpDueAt = item?.reconciliationFollowUpDueAt ? new Date(item.reconciliationFollowUpDueAt) : null;
    if (exceptionStatus === 'open' && followUpDueAt && !Number.isNaN(followUpDueAt.getTime())) {
        const dayDelta = Math.ceil((followUpDueAt.getTime() - Date.now()) / 86_400_000);
        return {
            title: 'Reconciliation follow-up due',
            dueAt: followUpDueAt,
            dayDelta,
            tone: dayDelta < 0 ? 'destructive' : dayDelta <= 2 ? 'warning' : 'default',
        };
    }

    if (!['submitted', 'adjudicating', 'partial', 'approved'].includes(String(item?.status ?? ''))) {
        return null;
    }

    const submittedAt = item?.submittedAt ? new Date(item.submittedAt) : null;
    if (!submittedAt || Number.isNaN(submittedAt.getTime())) return null;

    const dueAt = new Date(submittedAt.getTime() + claimSlaDays(item) * 86_400_000);
    const dayDelta = Math.ceil((dueAt.getTime() - Date.now()) / 86_400_000);

    return {
        title: 'Payer adjudication SLA',
        dueAt,
        dayDelta,
        tone: dayDelta < 0 ? 'destructive' : dayDelta <= 2 ? 'warning' : 'default',
    };
}

function claimSlaBadgeLabel(item: any): string {
    const snapshot = claimSlaSnapshot(item);
    if (!snapshot || snapshot.dayDelta === null) return 'No SLA';
    if (snapshot.dayDelta < 0) return `${Math.abs(snapshot.dayDelta)}d overdue`;
    if (snapshot.dayDelta === 0) return 'Due today';
    return `${snapshot.dayDelta}d left`;
}

function claimCurrentStepLabel(item: any): string {
    if (!item) return 'Claim review';
    if (String(item.reconciliationExceptionStatus ?? '') === 'open') return 'Reconciliation follow-up';

    switch (String(item.status ?? '')) {
        case 'draft':
            return 'Draft intake';
        case 'submitted':
            return 'Submitted to payer';
        case 'adjudicating':
            return 'Payer adjudication';
        case 'approved':
            return ['partial_settled', 'settled'].includes(String(item.reconciliationStatus ?? ''))
                ? 'Settlement recorded'
                : 'Approved awaiting settlement';
        case 'partial':
            return 'Partial approval recovery';
        case 'rejected':
            return 'Denied claim review';
        case 'cancelled':
            return 'Claim closed';
        default:
            return 'Claim review';
    }
}

function claimNextActionLabel(item: any): string {
    if (!item) return 'Review claim';

    if (String(item.reconciliationExceptionStatus ?? '') === 'open') {
        if (['resolved', 'waived'].includes(String(item.reconciliationFollowUpStatus ?? ''))) {
            return 'Confirm settlement closure';
        }

        return 'Update reconciliation follow-up';
    }

    switch (String(item.status ?? '')) {
        case 'draft':
            return 'Submit claim to payer';
        case 'submitted':
            return 'Mark adjudicating';
        case 'adjudicating':
            return 'Record payer decision';
        case 'approved':
            return ['partial_settled', 'settled'].includes(String(item.reconciliationStatus ?? ''))
                ? 'No further action'
                : 'Reconcile settlement';
        case 'partial':
            return 'Track shortfall and recovery';
        case 'rejected':
            return 'Capture rework or closure';
        case 'cancelled':
            return 'No further action';
        default:
            return 'Review claim';
    }
}

function claimAfterStepLabel(item: any): string {
    if (!item) return 'Claim remains available for review.';

    if (String(item.reconciliationExceptionStatus ?? '') === 'open') {
        if (['resolved', 'waived'].includes(String(item.reconciliationFollowUpStatus ?? ''))) {
            return 'Claim returns to settlement review.';
        }

        return 'Exception stays visible until follow-up is resolved.';
    }

    switch (String(item.status ?? '')) {
        case 'draft':
            return 'Payer SLA watch begins.';
        case 'submitted':
            return 'Decision recording becomes the next claim step.';
        case 'adjudicating':
            return 'Approved, rejected, or partial decision is recorded.';
        case 'approved':
            return ['partial_settled', 'settled'].includes(String(item.reconciliationStatus ?? ''))
                ? 'Claim stays closed with settlement recorded.'
                : 'Settlement reconciliation closes the claim cleanly.';
        case 'partial':
            return 'Shortfall follow-up and settlement remain visible.';
        case 'rejected':
            return 'Claim moves into denial handling or closure.';
        case 'cancelled':
            return 'Claim remains closed out of active adjudication.';
        default:
            return 'Claim remains available for review.';
    }
}

function claimNextActionVariant(item: any): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (!item) return 'outline';
    if (String(item.reconciliationExceptionStatus ?? '') === 'open') return 'destructive';

    switch (String(item.status ?? '')) {
        case 'approved':
            return ['partial_settled', 'settled'].includes(String(item.reconciliationStatus ?? '')) ? 'outline' : 'default';
        case 'submitted':
        case 'adjudicating':
        case 'partial':
            return 'secondary';
        case 'rejected':
            return 'destructive';
        default:
            return 'outline';
    }
}

function claimQueueAccentClass(item: any): string {
    if (!item) return 'border-border bg-background';
    if (String(item.reconciliationExceptionStatus ?? '') === 'open') return 'border-destructive/30 bg-destructive/5';

    const snapshot = claimSlaSnapshot(item);
    if (snapshot?.tone === 'destructive') return 'border-destructive/30 bg-destructive/5';
    if (snapshot?.tone === 'warning') return 'border-amber-500/30 bg-amber-500/5';

    switch (String(item.status ?? '')) {
        case 'submitted':
        case 'approved':
            return 'border-primary/20 bg-primary/5';
        case 'adjudicating':
        case 'partial':
            return 'border-amber-500/30 bg-amber-500/5';
        case 'rejected':
            return 'border-destructive/30 bg-destructive/5';
        case 'cancelled':
            return 'border-border bg-muted/40';
        default:
            return 'border-border bg-background';
    }
}

function claimQueueWorkflowStripClass(item: any): string {
    if (!item) return 'border-border bg-background/80';
    if (String(item.reconciliationExceptionStatus ?? '') === 'open') return 'border-destructive/20 bg-background/80';

    const snapshot = claimSlaSnapshot(item);
    if (snapshot?.tone === 'destructive') return 'border-destructive/20 bg-background/80';
    if (snapshot?.tone === 'warning') return 'border-amber-500/20 bg-background/80';

    switch (String(item.status ?? '')) {
        case 'submitted':
        case 'approved':
            return 'border-primary/20 bg-background/80';
        case 'adjudicating':
        case 'partial':
            return 'border-amber-500/20 bg-background/80';
        default:
            return 'border-border bg-background/80';
    }
}

function claimQueueWorkflowBadgeLabel(item: any): string {
    if (!item) return 'Review';
    if (String(item.reconciliationExceptionStatus ?? '') === 'open') return 'Exception open';

    const snapshot = claimSlaSnapshot(item);
    if (snapshot) return claimSlaBadgeLabel(item);

    if (
        String(item.status ?? '') === 'approved'
        && !['partial_settled', 'settled'].includes(String(item.reconciliationStatus ?? ''))
    ) {
        return 'Settlement';
    }

    return formatEnumLabel(item.status || 'draft');
}

function claimQueueWorkflowBadgeVariant(item: any): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (!item) return 'outline';
    if (String(item.reconciliationExceptionStatus ?? '') === 'open') return 'destructive';

    const snapshot = claimSlaSnapshot(item);
    if (snapshot?.tone === 'destructive') return 'destructive';
    if (snapshot?.tone === 'warning') return 'secondary';

    if (
        String(item.status ?? '') === 'approved'
        && !['partial_settled', 'settled'].includes(String(item.reconciliationStatus ?? ''))
    ) {
        return 'default';
    }

    return claimStatusVariant(item.status);
}

function claimQueueMetaItems(item: any): string[] {
    if (!item) return [];

    const items: string[] = [];

    if (item.invoiceId) items.push(`Invoice ${item.invoiceId}`);
    if (item.payerType) items.push(formatEnumLabel(item.payerType));
    if (item.submittedAt) {
        items.push(`Submitted ${formatDateTime(item.submittedAt)}`);
    } else if (item.createdAt) {
        items.push(`Created ${formatDateTime(item.createdAt)}`);
    }

    if (String(item.reconciliationExceptionStatus ?? '') === 'open') {
        if (item.reconciliationFollowUpDueAt) {
            items.push(`Follow-up ${formatDateTime(item.reconciliationFollowUpDueAt)}`);
        }
        return items;
    }

    const snapshot = claimSlaSnapshot(item);
    if (snapshot?.dueAt) {
        items.push(`${snapshot.title}: ${formatDateTime(snapshot.dueAt.toISOString())}`);
    }

    return items;
}

function claimQueueFinancialBadges(item: any): Array<{
    label: string;
    value: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> {
    if (!item) return [];

    const badges: Array<{
        label: string;
        value: string;
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
    }> = [
        {
            label: 'Claim',
            value: claimMoneySummary(item),
            variant: 'secondary',
        },
    ];

    if (Number(item.approvedAmount ?? 0) > 0) {
        badges.push({
            label: 'Approved',
            value: claimMoneyWithCurrency(item.approvedAmount, item),
            variant: 'outline',
        });
    }

    if (Number(item.settledAmount ?? 0) > 0) {
        badges.push({
            label: 'Settled',
            value: claimMoneyWithCurrency(item.settledAmount, item),
            variant: 'default',
        });
    }

    if (Number(item.rejectedAmount ?? 0) > 0) {
        badges.push({
            label: 'Rejected',
            value: claimMoneyWithCurrency(item.rejectedAmount, item),
            variant: 'destructive',
        });
    }

    if (Number(item.reconciliationShortfallAmount ?? 0) > 0) {
        badges.push({
            label: 'Shortfall',
            value: claimMoneyWithCurrency(item.reconciliationShortfallAmount, item),
            variant: 'destructive',
        });
    }

    return badges.slice(0, 4);
}

function claimQueuePreview(item: any): { label: string; text: string } | null {
    if (!item) return null;

    const followUpNote = String(item.reconciliationFollowUpNote || '').trim();
    if (String(item.reconciliationExceptionStatus ?? '') === 'open' && followUpNote) {
        return {
            label: 'Exception',
            text: followUpNote,
        };
    }

    const reason = String(item.decisionReason || item.statusReason || '').trim();
    if (['partial', 'rejected', 'cancelled'].includes(String(item.status ?? '')) && reason) {
        return {
            label: 'Reason',
            text: reason,
        };
    }

    if (String(item.status ?? '') === 'approved' && Number(item.reconciliationShortfallAmount ?? 0) > 0) {
        return {
            label: 'Shortfall',
            text: `Outstanding ${claimMoneyWithCurrency(item.reconciliationShortfallAmount, item)} still needs recovery.`,
        };
    }

    return null;
}

function claimQueuePrimaryStatusAction(item: any): string {
    switch (String(item?.status ?? '')) {
        case 'draft':
            return 'submitted';
        case 'submitted':
            return 'adjudicating';
        default:
            return '';
    }
}

function claimQueuePrimaryStatusActionLabel(item: any): string {
    switch (String(item?.status ?? '')) {
        case 'draft':
            return 'Submit claim';
        case 'submitted':
            return 'Mark adjudicating';
        default:
            return '';
    }
}

function claimQueuePrimaryStatusActionVariant(item: any): 'default' | 'secondary' | 'destructive' | 'outline' {
    const action = claimQueuePrimaryStatusAction(item);
    return action ? claimStatusActionVariant(action) : 'outline';
}

function claimStatusActionLabel(action: string): string {
    switch (action) {
        case 'submitted':
            return 'Submit claim';
        case 'adjudicating':
            return 'Mark adjudicating';
        case 'approved':
            return 'Approve claim';
        case 'rejected':
            return 'Reject claim';
        case 'partial':
            return 'Record partial decision';
        case 'cancelled':
            return 'Cancel claim';
        default:
            return 'Update claim status';
    }
}

function claimStatusActionDescription(action: string): string {
    switch (action) {
        case 'submitted':
            return 'Send the claim to payer review once invoice context and payer reference are ready.';
        case 'adjudicating':
            return 'Record that payer review has started so the SLA watch stays honest.';
        case 'approved':
            return 'Capture the approved amount and adjudication date so settlement can begin.';
        case 'rejected':
            return 'Capture denial reasoning and rejected amount before closing the claim path.';
        case 'partial':
            return 'Record approved and rejected amounts together so shortfall follow-up stays visible.';
        case 'cancelled':
            return 'Close the claim when it should not continue through adjudication.';
        default:
            return 'Update the claim lifecycle state and supporting notes.';
    }
}

function claimStatusActionAfterLabel(action: string): string {
    switch (action) {
        case 'submitted':
            return 'Payer SLA watch begins.';
        case 'adjudicating':
            return 'Decision recording becomes the next active step.';
        case 'approved':
            return 'Settlement reconciliation becomes the next focus.';
        case 'rejected':
            return 'Denial handling or closure becomes the next focus.';
        case 'partial':
            return 'Recovery follow-up and settlement remain visible.';
        case 'cancelled':
            return 'Claim leaves the active adjudication queue.';
        default:
            return 'Claim workflow stays available for review.';
    }
}

function claimStatusActionVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (action) {
        case 'approved':
            return 'default';
        case 'submitted':
        case 'adjudicating':
        case 'partial':
            return 'secondary';
        case 'rejected':
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function followUpStatusActionLabel(status: string): string {
    switch (status) {
        case 'in_progress':
            return 'Start follow-up';
        case 'resolved':
            return 'Resolve follow-up';
        case 'waived':
            return 'Waive follow-up';
        default:
            return 'Save follow-up';
    }
}

function followUpStatusAfterLabel(status: string): string {
    switch (status) {
        case 'pending':
            return 'Exception stays on the watchlist with the due date intact.';
        case 'in_progress':
            return 'Ownership stays visible until follow-up is resolved.';
        case 'resolved':
            return 'Claim can move back into settlement review.';
        case 'waived':
            return 'Exception is closed without further recovery work.';
        default:
            return 'Follow-up state is updated.';
    }
}

function followUpStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'resolved':
            return 'default';
        case 'in_progress':
            return 'secondary';
        case 'waived':
            return 'outline';
        default:
            return 'destructive';
    }
}

function claimWorkflowDefaultAction(item: any): string {
    switch (String(item?.status ?? '')) {
        case 'draft':
            return 'submitted';
        case 'submitted':
            return 'adjudicating';
        case 'adjudicating':
            return 'approved';
        case 'approved':
            return 'approved';
        case 'partial':
            return 'partial';
        case 'rejected':
            return 'rejected';
        case 'cancelled':
            return 'cancelled';
        default:
            return 'submitted';
    }
}

function claimWorkflowStatusButtonLabel(item: any): string {
    switch (String(item?.status ?? '')) {
        case 'draft':
            return 'Submit claim';
        case 'submitted':
            return 'Mark adjudicating';
        case 'adjudicating':
            return 'Record decision';
        default:
            return 'Update status';
    }
}

const lifecycleBoardColumns = computed(() => {
    const laneConfig = [
        { id: 'draft', label: 'Draft Intake', statuses: ['draft'] },
        { id: 'submitted', label: 'Submitted', statuses: ['submitted'] },
        { id: 'adjudicating', label: 'Adjudicating', statuses: ['adjudicating'] },
        { id: 'approved', label: 'Approved / Recovery', statuses: ['approved', 'partial'] },
        { id: 'exceptions', label: 'Denied / Closed', statuses: ['rejected', 'cancelled'] },
    ] as const;

    return laneConfig.map((lane) => ({
        ...lane,
        total: lane.statuses.reduce((sum, status) => sum + Number((counts.value as Record<string, number>)[status] ?? 0), 0),
        items: claims.value
            .filter((item) => lane.statuses.includes(String(item?.status ?? '')))
            .slice(0, 4),
    }));
});

const denialReasonRows = computed(() => {
    const reasonCounts = new Map<string, number>();
    let total = 0;

    claims.value
        .filter((item) => ['rejected', 'partial'].includes(String(item?.status ?? '')))
        .forEach((item) => {
            const reason = String(item?.decisionReason || item?.statusReason || 'Reason not recorded').trim() || 'Reason not recorded';
            total += 1;
            reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
        });

    return {
        total,
        rows: Array.from(reasonCounts.entries())
            .map(([reason, count]) => ({
                reason,
                count,
                ratio: total > 0 ? Math.round((count / total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
    };
});

const escalationQueueRows = computed(() => {
    return claims.value
        .map((item) => {
            const snapshot = claimSlaSnapshot(item);
            if (!snapshot) return null;
            return { item, snapshot };
        })
        .filter((row): row is { item: any; snapshot: NonNullable<ReturnType<typeof claimSlaSnapshot>> } => row !== null)
        .sort((a, b) => (a.snapshot.dayDelta ?? Number.POSITIVE_INFINITY) - (b.snapshot.dayDelta ?? Number.POSITIVE_INFINITY))
        .slice(0, 6);
});

const escalationSummary = computed(() => {
    let overdue = 0;
    let dueSoon = 0;
    let openExceptions = 0;

    escalationQueueRows.value.forEach(({ item, snapshot }) => {
        if (String(item?.reconciliationExceptionStatus ?? '') === 'open') openExceptions += 1;
        if ((snapshot.dayDelta ?? 0) < 0) {
            overdue += 1;
        } else if ((snapshot.dayDelta ?? Number.POSITIVE_INFINITY) <= 2) {
            dueSoon += 1;
        }
    });

    return { overdue, dueSoon, openExceptions };
});

const detailsFocusCard = computed(() => {
    const item = detailsClaim.value;
    if (!item) return null;

    if (String(item.reconciliationExceptionStatus ?? '') === 'open') {
        return {
            title: 'Exception follow-up is open',
            description: item.reconciliationFollowUpNote || 'This claim has an active reconciliation exception that needs owner follow-up.',
            toneClass: 'border-destructive/30 bg-destructive/5',
        };
    }

    switch (String(item.status ?? '')) {
        case 'draft':
            return {
                title: 'Claim is still draft',
                description: 'Submit the claim when invoice context and payer reference are ready.',
                toneClass: 'border-border bg-background',
            };
        case 'submitted':
            return {
                title: 'Awaiting payer review',
                description: 'Monitor SLA countdown and move to adjudicating when payer review begins.',
                toneClass: 'border-primary/20 bg-primary/5',
            };
        case 'adjudicating':
            return {
                title: 'Payer decision in progress',
                description: 'Keep decision reasons and adjudication amounts up to date to reduce rework.',
                toneClass: 'border-amber-500/30 bg-amber-500/5',
            };
        case 'approved':
            return {
                title: 'Approved and ready for settlement',
                description: 'Complete reconciliation once settlement lands to close the claim cleanly.',
                toneClass: 'border-primary/20 bg-primary/5',
            };
        case 'partial':
            return {
                title: 'Partially approved claim needs recovery',
                description: 'Track shortfall, payer response, and follow-up due dates without leaving the claim.',
                toneClass: 'border-amber-500/30 bg-amber-500/5',
            };
        case 'rejected':
            return {
                title: 'Denied claim needs rework or closure',
                description: item.decisionReason || item.statusReason || 'Capture denial reasoning clearly before rework or closure.',
                toneClass: 'border-destructive/30 bg-destructive/5',
            };
        case 'cancelled':
            return {
                title: 'Claim is closed',
                description: item.statusReason || 'This claim is cancelled and should not continue through active adjudication.',
                toneClass: 'border-border bg-muted/40',
            };
        default:
            return {
                title: 'Review current claim state',
                description: 'Use workflows and audit together to keep adjudication, settlement, and follow-up synchronized.',
                toneClass: 'border-border bg-background',
            };
    }
});

const detailsOverviewCards = computed(() => {
    const item = detailsClaim.value;
    if (!item) return [];

    return [
        {
            id: 'reconciliation',
            title: 'Reconciliation',
            helper: 'Settlement parity for this claim.',
            value: formatEnumLabel(item.reconciliationStatus || 'pending'),
            badgeVariant: claimStatusVariant(item.reconciliationStatus),
        },
        {
            id: 'exception',
            title: 'Exception',
            helper: 'Exception pressure on this claim.',
            value: formatEnumLabel(item.reconciliationExceptionStatus || 'none'),
            badgeVariant: String(item.reconciliationExceptionStatus ?? '') === 'open' ? 'destructive' : 'outline',
        },
        {
            id: 'follow-up',
            title: 'Follow-up',
            helper: 'Current follow-up owner state.',
            value: formatEnumLabel(item.reconciliationFollowUpStatus || 'none'),
            badgeVariant: String(item.reconciliationFollowUpStatus ?? '') === 'resolved' ? 'default' : 'outline',
        },
    ];
});

const detailsFinancialSnapshotCards = computed(() => {
    const item = detailsClaim.value;
    if (!item) return [];

    return [
        {
            id: 'claim-amount',
            title: 'Claim amount',
            helper: 'Original billed claim total.',
            value: claimMoneyWithCurrency(item.claimAmount, item),
            badgeVariant: 'outline',
        },
        {
            id: 'approved-amount',
            title: 'Approved',
            helper: 'Amount payer approved.',
            value: claimMoneyWithCurrency(item.approvedAmount, item),
            badgeVariant: 'default',
        },
        {
            id: 'rejected-amount',
            title: 'Rejected',
            helper: 'Amount payer rejected.',
            value: claimMoneyWithCurrency(item.rejectedAmount, item),
            badgeVariant: Number(item.rejectedAmount ?? 0) > 0 ? 'destructive' : 'outline',
        },
        {
            id: 'settled-amount',
            title: 'Settled',
            helper: 'Amount already reconciled.',
            value: claimMoneyWithCurrency(item.settledAmount, item),
            badgeVariant: ['partial_settled', 'settled'].includes(String(item.reconciliationStatus ?? '')) ? 'default' : 'outline',
        },
        {
            id: 'shortfall-amount',
            title: 'Shortfall',
            helper: 'Outstanding reconciliation gap.',
            value: claimMoneyWithCurrency(item.reconciliationShortfallAmount, item),
            badgeVariant: Number(item.reconciliationShortfallAmount ?? 0) > 0 ? 'destructive' : 'outline',
        },
    ];
});

const detailsTimelineItems = computed(() => {
    const item = detailsClaim.value;
    if (!item) return [];

    const events = [
        {
            id: 'created',
            title: 'Claim created',
            description: 'Claim record opened from billing invoice context.',
            at: item.createdAt,
            complete: Boolean(item.createdAt),
        },
        {
            id: 'submitted',
            title: 'Claim submitted',
            description: 'Sent to payer for adjudication.',
            at: item.submittedAt,
            complete: ['submitted', 'adjudicating', 'approved', 'rejected', 'partial', 'cancelled'].includes(String(item.status ?? '')),
        },
        {
            id: 'adjudicating',
            title: 'Payer adjudication',
            description: 'Claim is under payer review.',
            at: String(item.status ?? '') === 'adjudicating' ? item.updatedAt : item.adjudicatedAt,
            complete: ['adjudicating', 'approved', 'rejected', 'partial'].includes(String(item.status ?? '')),
        },
        {
            id: 'decision',
            title: 'Decision recorded',
            description: item.decisionReason || 'Approved, rejected, or partially approved claim decision.',
            at: item.adjudicatedAt,
            complete: ['approved', 'rejected', 'partial'].includes(String(item.status ?? '')),
        },
        {
            id: 'settlement',
            title: 'Settlement reconciliation',
            description: item.reconciliationNotes || 'Reconcile settlement amounts and shortfall against payer outcome.',
            at: item.settledAt,
            complete: ['partial_settled', 'settled'].includes(String(item.reconciliationStatus ?? '')),
        },
    ];

    if (String(item.reconciliationExceptionStatus ?? '') === 'open' || item.reconciliationFollowUpDueAt) {
        events.push({
            id: 'follow-up',
            title: 'Reconciliation follow-up',
            description: item.reconciliationFollowUpNote || 'Follow-up owner, due date, and exception handling.',
            at: item.reconciliationFollowUpUpdatedAt || item.reconciliationFollowUpDueAt,
            complete: ['resolved', 'waived'].includes(String(item.reconciliationFollowUpStatus ?? '')),
        });
    }

    return events;
});

const detailsWorkflowHeading = computed(() =>
    canUpdateStatus.value ? 'Workflow focus' : 'Claim summary',
);

const detailsWorkflowSummaryCards = computed(() => {
    const item = detailsClaim.value;
    if (!item) return [];

    return [
        {
            id: 'current-step',
            title: 'Current step',
            helper: 'Where this claim sits right now.',
            value: claimCurrentStepLabel(item),
            badgeVariant: claimStatusVariant(item.status),
        },
        {
            id: 'next-action',
            title: canUpdateStatus.value ? 'Next action' : 'Access scope',
            helper: canUpdateStatus.value ? 'Best next operational move from here.' : 'What operators need to do next.',
            value: canUpdateStatus.value ? claimNextActionLabel(item) : 'Review access',
            badgeVariant: canUpdateStatus.value ? claimNextActionVariant(item) : 'outline',
        },
        {
            id: 'after-step',
            title: 'After this step',
            helper: 'What changes after the next move.',
            value: claimAfterStepLabel(item),
            badgeVariant: 'outline',
        },
    ];
});

const detailsWorkflowStatusAction = computed(() =>
    detailsClaim.value ? claimWorkflowDefaultAction(detailsClaim.value) : 'submitted',
);

const detailsWorkflowStatusButtonLabel = computed(() =>
    detailsClaim.value ? claimWorkflowStatusButtonLabel(detailsClaim.value) : 'Update status',
);

const statusDialogTitle = computed(() => claimStatusActionLabel(statusAction.value));

const statusDialogDescription = computed(() => claimStatusActionDescription(statusAction.value));

const statusDialogSubmitLabel = computed(() =>
    statusSubmitting.value ? 'Saving...' : claimStatusActionLabel(statusAction.value),
);
const statusDialogSuggestedAction = computed(() =>
    statusClaim.value ? claimWorkflowDefaultAction(statusClaim.value) : null,
);
const statusDialogSuggestedActionLabel = computed(() =>
    statusDialogSuggestedAction.value
        ? formatEnumLabel(statusDialogSuggestedAction.value)
        : null,
);
const statusDialogActionOverrideHint = computed(() => {
    if (!statusDialogSuggestedAction.value) return null;
    if (statusDialogSuggestedAction.value === statusAction.value) return null;
    return `Suggested action is ${statusDialogSuggestedActionLabel.value}. You are applying ${formatEnumLabel(statusAction.value)}.`;
});

const statusDialogActionToneClass = computed(() => {
    switch (claimStatusActionVariant(statusAction.value)) {
        case 'default':
            return 'border-primary/20 bg-primary/5';
        case 'secondary':
            return 'border-secondary/60 bg-secondary/20';
        case 'destructive':
            return 'border-destructive/30 bg-destructive/5';
        default:
            return 'border-border bg-background';
    }
});

const statusDialogSummaryCards = computed(() => {
    const item = statusClaim.value;
    if (!item) return [];

    return [
        {
            title: 'Current step',
            helper: 'Where the claim is before this update.',
            value: claimCurrentStepLabel(item),
            badgeVariant: claimStatusVariant(item.status),
        },
        {
            title: 'This action',
            helper: 'Status update being recorded now.',
            value: claimStatusActionLabel(statusAction.value),
            badgeVariant: claimStatusActionVariant(statusAction.value),
        },
        {
            title: 'After this step',
            helper: 'What becomes the next operational focus.',
            value: claimStatusActionAfterLabel(statusAction.value),
            badgeVariant: 'outline',
        },
    ];
});

const followUpDialogTitle = computed(() => 'Reconciliation follow-up');

const followUpDialogDescription = computed(() =>
    followUpClaim.value?.claimNumber
        ? `${followUpClaim.value.claimNumber} | Keep exception ownership, due date, and recovery notes aligned.`
        : 'Keep exception ownership, due date, and recovery notes aligned.',
);

const followUpDialogSubmitLabel = computed(() =>
    followUpSubmitting.value ? 'Saving...' : followUpStatusActionLabel(followUpStatus.value),
);

const followUpSummaryCards = computed(() => {
    const item = followUpClaim.value;
    if (!item) return [];

    return [
        {
            title: 'Current step',
            helper: 'Where the claim sits right now.',
            value: claimCurrentStepLabel(item),
            badgeVariant: claimStatusVariant(item.status),
        },
        {
            title: 'This update',
            helper: 'Follow-up state being recorded.',
            value: formatEnumLabel(followUpStatus.value || 'pending'),
            badgeVariant: followUpStatusVariant(followUpStatus.value),
        },
        {
            title: 'After this update',
            helper: 'What this follow-up state means next.',
            value: followUpStatusAfterLabel(followUpStatus.value),
            badgeVariant: 'outline',
        },
    ];
});

const detailsAuditSummaryCards = computed(() => {
    const total = detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length;
    const userEvents = detailsAuditLogs.value.filter((log) => log.actorType === 'user').length;
    const systemEvents = detailsAuditLogs.value.filter((log) => log.actorType === 'system').length;
    const latest = detailsAuditLogs.value[0];

    return [
        { id: 'events', title: 'Trail events', value: String(total), helper: 'Visible claim lifecycle and settlement audit rows for the current scope.' },
        { id: 'user', title: 'User actions', value: String(userEvents), helper: 'Manual adjudication, reconciliation, and follow-up changes.' },
        { id: 'system', title: 'System checks', value: String(systemEvents), helper: 'Automated lifecycle, parity, and document logging.' },
        { id: 'latest', title: 'Latest trail event', value: latest ? auditActionDisplayLabel(latest) : 'N/A', helper: latest ? formatDateTime(latest.createdAt) : 'No audit activity loaded.' },
    ];
});

async function loadDetailsAuditLogs() {
    if (!canViewAudit.value || !detailsClaim.value) return;
    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<{
            data: ClaimsAuditLog[];
            meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
        }>('GET', `/claims-insurance/${detailsClaim.value.id}/audit-logs`, {
            query: detailsAuditQuery(),
        });
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = {
            currentPage: response.meta?.currentPage ?? detailsAuditFilters.page,
            lastPage: response.meta?.lastPage ?? 1,
            total: response.meta?.total ?? detailsAuditLogs.value.length,
            perPage: response.meta?.perPage ?? detailsAuditFilters.perPage,
        };
    } catch (error) {
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs();
}

function resetDetailsAuditFilters() {
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAuditLogs();
}

function goToDetailsAuditPage(page: number) {
    detailsAuditFilters.page = Math.max(page, 1);
    void loadDetailsAuditLogs();
}

async function exportDetailsAuditLogsCsv() {
    if (!detailsClaim.value || !canViewAudit.value || detailsAuditExporting.value) {
        return;
    }

    detailsAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/claims-insurance/${detailsClaim.value.id}/audit-logs/export`,
            window.location.origin,
        );
        Object.entries(detailsAuditQuery()).forEach(([key, value]) => {
            if (value === null || value === '') return;
            if (key === 'page' || key === 'perPage') return;
            url.searchParams.set(key, String(value));
        });
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        detailsAuditExporting.value = false;
    }
}

function openClaimPrintPreview(item: any) {
    if (!item?.id) return;

    window.open(`/claims-insurance/${item.id}/print`, '_blank', 'noopener');
}

watch(
    () => createForm.invoiceId.trim(),
    (invoiceId) => {
        if (!invoiceId) {
            resetCreateInvoicePreview();
            syncQueueFiltersToUrl();
            return;
        }

        if (!canReadBillingInvoices.value || !isUuidLike(invoiceId)) {
            createInvoicePreview.value = null;
            createInvoicePreviewError.value = null;
            syncQueueFiltersToUrl();
            return;
        }

        syncQueueFiltersToUrl();
        void loadCreateInvoicePreview(invoiceId);
    },
);

watch(canReadBillingInvoices, (allowed) => {
    if (!allowed) {
        resetCreateInvoicePreview();
        return;
    }

    const invoiceId = createForm.invoiceId.trim();
    if (isUuidLike(invoiceId)) {
        void loadCreateInvoicePreview(invoiceId);
    }
});

onMounted(async () => {
    pageLoading.value = true;
    try {
        await loadPermissions();
        if (canReadBillingInvoices.value && isUuidLike(createForm.invoiceId.trim())) {
            await loadCreateInvoicePreview(createForm.invoiceId.trim());
        }
        await loadQueue();
    } finally {
        pageLoading.value = false;
    }
});
</script>

<template>
    <Head title="Claims & Insurance" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="shield-check" class="size-7 text-primary" />
                        Claims & Insurance
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        {{
                            claimsWorkspaceView === 'create'
                                ? createInvoiceContextLocked
                                    ? 'Create and submit claims from the locked billing handoff without leaving the revenue cycle flow.'
                                    : 'Create and submit claims from billing invoice context without leaving the revenue cycle flow.'
                                : claimsWorkspaceView === 'board'
                                  ? 'Monitor lifecycle pressure, denial patterns, and payer follow-up deadlines without crowding the queue.'
                                  : 'Review claim queue, adjudication actions, and reconciliation follow-up in one place.'
                        }}
                    </p>
                </div>
                <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">
                        {{
                            pageLoading
                                ? 'Loading Access'
                                : canRead || canCreate
                                  ? 'Access Ready'
                                  : 'Access restricted'
                        }}
                    </Badge>
                    <Button variant="outline" size="sm" :disabled="queueLoading" class="gap-1.5" @click="loadQueue()">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ queueLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button
                        v-if="canRead && claimsWorkspaceView !== 'board'"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="openClaimsBoardWorkspace"
                    >
                        <AppIcon name="layout-dashboard" class="size-3.5" />
                        Claims Board
                    </Button>
                    <Button
                        v-else-if="claimsWorkspaceView === 'board' && canRead"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="setClaimsWorkspaceView('queue', { focusSearch: true, scroll: true })"
                    >
                        <AppIcon name="layout-list" class="size-3.5" />
                        Claims Queue
                    </Button>
                    <Button
                        v-if="canCreate && claimsWorkspaceView !== 'create'"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="openCreateClaimWorkspace"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        Create Claim
                    </Button>
                    <Button
                        v-else-if="claimsWorkspaceView === 'create' && canRead"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="setClaimsWorkspaceView('queue', { focusSearch: true, scroll: true })"
                    >
                        <AppIcon name="arrow-left" class="size-3.5" />
                        Claims Queue
                    </Button>
                </div>
            </div>

            <div
                v-if="canRead && claimsWorkspaceView === 'queue'"
                class="rounded-lg border bg-muted/30 px-3 py-2"
            >
                <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                        <Button size="sm" class="h-8 gap-1.5" :variant="searchForm.status === 'draft' ? 'default' : 'outline'" @click="searchForm.status = 'draft'; searchForm.page = 1; loadQueue()">
                            <span class="font-medium">{{ counts.draft }}</span>
                            Draft
                        </Button>
                        <Button size="sm" class="h-8 gap-1.5" :variant="searchForm.status === 'submitted' ? 'default' : 'outline'" @click="searchForm.status = 'submitted'; searchForm.page = 1; loadQueue()">
                            <span class="font-medium">{{ counts.submitted }}</span>
                            Submitted
                        </Button>
                        <Button size="sm" class="h-8 gap-1.5" :variant="searchForm.status === 'adjudicating' ? 'default' : 'outline'" @click="searchForm.status = 'adjudicating'; searchForm.page = 1; loadQueue()">
                            <span class="font-medium">{{ counts.adjudicating }}</span>
                            Adjudicating
                        </Button>
                        <Button size="sm" class="h-8 gap-1.5" :variant="searchForm.status === 'approved' ? 'default' : 'outline'" @click="searchForm.status = 'approved'; searchForm.page = 1; loadQueue()">
                            <span class="font-medium">{{ counts.approved }}</span>
                            Approved
                        </Button>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="!searchForm.status && !searchForm.reconciliationExceptionStatus ? 'default' : 'outline'"
                            @click="searchForm.status = ''; applyExceptionPreset('')"
                        >
                            <AppIcon name="layout-list" class="size-3.5" />
                            All claims
                        </Button>
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="searchForm.reconciliationExceptionStatus === 'open' ? 'default' : 'outline'"
                            @click="applyExceptionPreset('open')"
                        >
                            <AppIcon name="triangle-alert" class="size-3.5" />
                            Open exceptions
                        </Button>
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="searchForm.reconciliationExceptionStatus === 'resolved' ? 'default' : 'outline'"
                            @click="applyExceptionPreset('resolved')"
                        >
                            <AppIcon name="check-check" class="size-3.5" />
                            Resolved
                        </Button>
                    </div>
                </div>
            </div>

            <!-- Errors -->
            <Alert v-if="claimsWorkspaceView === 'queue' && queueError" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Request error
                </AlertTitle>
                <AlertDescription>{{ queueError }}</AlertDescription>
            </Alert>

            <!-- Single column: queue card then create form -->
            <div class="flex min-w-0 flex-col gap-4">

                <!-- Claims Queue card -->
                <Card
                    v-if="canRead && claimsWorkspaceView === 'queue'"
                    class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col"
                >
                    <CardHeader class="shrink-0 gap-2 pb-2">
                        <div class="min-w-0 space-y-1">
                            <CardTitle class="flex items-center gap-2">
                                <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                Claims Queue
                            </CardTitle>
                            <CardDescription>
                                {{ claims.length }} claims on this page &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                            </CardDescription>
                            <div v-if="searchForm.q.trim() || claimsQueueFilterBadgeLabel" class="mt-2 flex flex-wrap items-center gap-2">
                                <Badge v-if="searchForm.q.trim()" variant="secondary">
                                    {{ claimsQueueStateLabel }}
                                </Badge>
                                <Badge v-if="claimsQueueFilterBadgeLabel" variant="outline">
                                    {{ claimsQueueFilterBadgeLabel }}
                                </Badge>
                            </div>
                        </div>
                        <div class="flex w-full flex-col gap-2">
                            <div class="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
                                <div class="relative min-w-0 flex-1">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="claims-q"
                                        v-model="searchForm.q"
                                        placeholder="Search claim number or payer reference"
                                        class="h-9 pl-9"
                                        @keyup.enter="submitSearch"
                                    />
                                </div>
                                <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="hidden h-9 gap-1.5 md:inline-flex"
                                        @click="openQueueFiltersSheet"
                                    >
                                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                                        All filters
                                        <Badge
                                            v-if="claimsActiveFilterCount"
                                            variant="secondary"
                                            class="ml-1 text-[10px]"
                                        >
                                            {{ claimsActiveFilterCount }}
                                        </Badge>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-9 gap-1.5 md:hidden"
                                        @click="openQueueFiltersDrawer"
                                    >
                                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                                        All filters
                                        <Badge
                                            v-if="claimsActiveFilterCount"
                                            variant="secondary"
                                            class="ml-1 text-[10px]"
                                        >
                                            {{ claimsActiveFilterCount }}
                                        </Badge>
                                    </Button>
                                    <Popover>
                                        <PopoverTrigger as-child>
                                            <Button variant="outline" size="sm" class="h-9 gap-1.5">
                                                <AppIcon name="eye" class="size-3.5" />
                                                View
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" class="w-64 space-y-4 p-4">
                                            <div class="space-y-1">
                                                <p class="text-sm font-medium">View</p>
                                                <p class="text-xs text-muted-foreground">
                                                    Adjust page size and row density for the claims queue.
                                                </p>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="claims-per-page-view">Results per page</Label>
                                                <Select :model-value="String(searchForm.perPage)" @update:model-value="searchForm.perPage = Number($event)">
                                                    <SelectTrigger class="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                    <SelectItem value="10">10</SelectItem>
                                                    <SelectItem value="25">25</SelectItem>
                                                    <SelectItem value="50">50</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label>Row density</Label>
                                                <div class="flex flex-wrap gap-2">
                                                    <Button size="sm" :variant="compactQueueRows ? 'outline' : 'default'" class="h-8" @click="setClaimsQueueDensity(false)">
                                                        Comfortable
                                                    </Button>
                                                    <Button size="sm" :variant="compactQueueRows ? 'default' : 'outline'" class="h-8" @click="setClaimsQueueDensity(true)">
                                                        Compact
                                                    </Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div v-if="queueActiveFilterChips.length > 0" class="flex flex-wrap items-center gap-2 border-t pt-2">
                                <Badge v-for="chip in queueActiveFilterChips" :key="`claims-queue-filter-${chip}`" variant="outline">
                                    {{ chip }}
                                </Badge>
                                <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="resetQueueFilters">
                                    Reset
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] p-4" :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                                <div v-if="queueLoading" class="space-y-2">
                                    <div class="h-24 w-full animate-pulse rounded-lg bg-muted" />
                                    <div class="h-24 w-full animate-pulse rounded-lg bg-muted" />
                                    <div class="h-24 w-full animate-pulse rounded-lg bg-muted" />
                                </div>
                                <div
                                    v-else-if="claims.length === 0"
                                    class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                                >
                                    No claims found for the current filters.
                                </div>
                                <div v-else :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                                    <div
                                        v-for="item in claims"
                                        :key="item.id"
                                        class="rounded-lg border transition-colors"
                                        :class="[compactQueueRows ? 'p-2.5' : 'p-3', claimQueueAccentClass(item)]"
                                    >
                                        <div
                                            :class="
                                                compactQueueRows
                                                    ? 'flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between'
                                                    : 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between'
                                            "
                                        >
                                            <div :class="compactQueueRows ? 'space-y-1.5' : 'space-y-2'">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="text-sm font-semibold">{{ item.claimNumber }}</p>
                                                    <Badge :variant="claimStatusVariant(item.status)">{{ formatEnumLabel(item.status) }}</Badge>
                                                    <Badge variant="outline">Recon {{ formatEnumLabel(item.reconciliationStatus || 'pending') }}</Badge>
                                                    <Badge
                                                        v-if="String(item.reconciliationExceptionStatus ?? '') === 'open'"
                                                        variant="destructive"
                                                    >
                                                        Exception open
                                                    </Badge>
                                                </div>
                                                <p class="text-sm font-medium text-foreground">
                                                    {{ item.payerName || 'Payer not recorded' }}
                                                </p>
                                                <div
                                                    v-if="claimQueueMetaItems(item).length"
                                                    class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                                                >
                                                    <span
                                                        v-for="meta in claimQueueMetaItems(item)"
                                                        :key="`${item.id}-${meta}`"
                                                        class="inline-flex items-center gap-1"
                                                    >
                                                        <span class="inline-flex size-1 rounded-full bg-muted-foreground/40"></span>
                                                        {{ meta }}
                                                    </span>
                                                </div>
                                                <div v-if="claimQueueFinancialBadges(item).length" class="flex flex-wrap items-center gap-2">
                                                    <Badge
                                                        v-for="badge in claimQueueFinancialBadges(item)"
                                                        :key="`${item.id}-${badge.label}`"
                                                        :variant="badge.variant"
                                                        class="h-5 px-1.5 text-[10px]"
                                                    >
                                                        {{ badge.label }} {{ badge.value }}
                                                    </Badge>
                                                </div>
                                                <p
                                                    v-if="claimQueuePreview(item)"
                                                    class="line-clamp-1 text-xs text-muted-foreground"
                                                >
                                                    <span class="font-medium text-foreground">
                                                        {{ claimQueuePreview(item)?.label }}:
                                                    </span>
                                                    {{ claimQueuePreview(item)?.text }}
                                                </p>
                                                <div class="rounded-md border px-2.5 py-2 text-xs" :class="claimQueueWorkflowStripClass(item)">
                                                    <div class="grid gap-3 md:grid-cols-2">
                                                        <div class="space-y-1">
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current step</p>
                                                                <Badge
                                                                    :variant="claimQueueWorkflowBadgeVariant(item)"
                                                                    class="h-5 px-1.5 text-[10px]"
                                                                >
                                                                    {{ claimQueueWorkflowBadgeLabel(item) }}
                                                                </Badge>
                                                            </div>
                                                            <p class="text-sm font-medium text-foreground">
                                                                {{ claimCurrentStepLabel(item) }}
                                                            </p>
                                                        </div>
                                                        <div class="space-y-1 border-t pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
                                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Primary action</p>
                                                            <p class="text-sm text-foreground">
                                                                {{ claimNextActionLabel(item) }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                    <span class="inline-flex items-center gap-1">
                                                        <span class="inline-flex size-1 rounded-full bg-muted-foreground/50"></span>
                                                        Next: {{ claimNextActionLabel(item) }}
                                                    </span>
                                                    <span class="inline-flex items-center gap-1">
                                                        <span class="inline-flex size-1 rounded-full bg-muted-foreground/50"></span>
                                                        Then: {{ claimAfterStepLabel(item) }}
                                                    </span>
                                                </div>
                                            </div>
                                            <div
                                                :class="
                                                    compactQueueRows
                                                        ? 'flex flex-col items-stretch gap-1.5 md:flex-row md:flex-wrap md:items-start md:max-w-[360px] md:justify-end'
                                                        : 'flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-start md:max-w-[360px] md:justify-end'
                                                "
                                            >
                                                <Button size="sm" variant="outline" class="w-full sm:w-auto" @click="openDetails(item)">
                                                    {{ claimQueueDetailsActionLabel }}
                                                </Button>
                                                <Button
                                                    v-if="canUpdateStatus && claimQueuePrimaryStatusAction(item)"
                                                    size="sm"
                                                    :variant="claimQueuePrimaryStatusActionVariant(item)"
                                                    class="w-full sm:w-auto"
                                                    @click="openStatusDialog(item, claimQueuePrimaryStatusAction(item))"
                                                >
                                                    {{ claimQueuePrimaryStatusActionLabel(item) }}
                                                </Button>
                                                <Button
                                                    v-if="canUpdateStatus && canOpenFollowUp(item)"
                                                    size="sm"
                                                    :variant="String(item.reconciliationExceptionStatus ?? '') === 'open' ? 'destructive' : 'default'"
                                                    class="w-full sm:w-auto"
                                                    @click="openFollowUpDialog(item)"
                                                >
                                                    Update follow-up
                                                </Button>
                                                <Select>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent> { if (value) openStatusDialog(item, String(value)); }"
                                                    class="w-full md:w-[200px]"
                                                >
                                                    <SelectItem value="">More Status Actions...</SelectItem>
                                                    <SelectItem v-for="option in statusActionOptions" :key="option" :value="option">
                                                        {{ formatEnumLabel(option) }}
                                                    </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                            <p class="text-xs text-muted-foreground">
                                Showing {{ claims.length }} of {{ pagination?.total ?? claims.length }} results &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="!pagination || pagination.currentPage <= 1 || queueLoading"
                                    @click="searchForm.page -= 1; loadQueue()"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="!pagination || pagination.currentPage >= pagination.lastPage || queueLoading"
                                    @click="searchForm.page += 1; loadQueue()"
                                >
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                    Next
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>

                <!-- No read permission -->
                <Card v-else-if="!pageLoading && claimsWorkspaceView === 'queue'" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-5 text-muted-foreground" />
                            Claims Queue
                        </CardTitle>
                        <CardDescription>You do not have permission to view claims.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle class="flex items-center gap-2">
                                <AppIcon name="shield-check" class="size-4" />
                                Read access restricted
                            </AlertTitle>
                            <AlertDescription>
                                Request <code>claims.insurance.read</code> permission to open claims list and queue filters.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <div
                    v-else-if="canRead && claimsWorkspaceView === 'board'"
                    id="claims-insurance-board"
                    class="space-y-4"
                >
                    <Card class="rounded-lg border-sidebar-border/70 bg-muted/20">
                        <CardContent class="flex flex-col gap-2.5 p-4 md:flex-row md:items-start md:justify-between">
                            <div class="space-y-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-sm font-medium">Claims Board</p>
                                    <Badge variant="outline">Current queue scope</Badge>
                                    <Badge variant="outline">{{ counts.total }} total claims</Badge>
                                </div>
                                <p class="text-xs text-muted-foreground">
                                    Keep adjudication pressure, settlement readiness, and follow-up deadlines visible across the current claim scope.
                                </p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Overdue {{ escalationSummary.overdue }}</Badge>
                                <Badge variant="outline">Due Soon {{ escalationSummary.dueSoon }}</Badge>
                                <Badge variant="outline">Open Exceptions {{ escalationSummary.openExceptions }}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card class="rounded-lg border-sidebar-border/70">
                        <CardHeader class="pb-3">
                            <CardTitle class="flex items-center gap-2">
                                <AppIcon name="columns-3" class="size-5 text-muted-foreground" />
                                Claim Lifecycle Kanban
                            </CardTitle>
                            <CardDescription>
                                Claims grouped by lifecycle lane so adjudication and settlement owners can act without leaving the board.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div class="grid gap-3 xl:grid-cols-5">
                                <div v-for="lane in lifecycleBoardColumns" :key="lane.id" class="flex h-full flex-col rounded-lg border bg-muted/20 p-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <p class="text-sm font-medium">{{ lane.label }}</p>
                                            <p class="text-xs text-muted-foreground">{{ lane.total }} in filtered scope</p>
                                        </div>
                                        <Badge variant="outline">{{ lane.total }}</Badge>
                                    </div>
                                    <div class="mt-3 flex-1 space-y-2">
                                        <div v-if="lane.items.length === 0" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                            No current-page claims in this lane.
                                        </div>
                                        <div
                                            v-for="item in lane.items"
                                            :key="`${lane.id}-${item.id}`"
                                            class="rounded-md border p-3"
                                            :class="claimQueueAccentClass(item)"
                                        >
                                            <div class="flex items-start justify-between gap-2">
                                                <div class="min-w-0">
                                                    <p class="truncate text-sm font-medium">{{ item.claimNumber }}</p>
                                                    <p class="truncate text-xs text-muted-foreground">
                                                        {{ item.payerName || 'Payer not recorded' }}
                                                    </p>
                                                </div>
                                                <Badge :variant="claimStatusVariant(item.status)">{{ formatEnumLabel(item.status) }}</Badge>
                                            </div>
                                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                                <Badge
                                                    v-for="badge in claimQueueFinancialBadges(item).slice(0, 2)"
                                                    :key="`${item.id}-board-${badge.label}`"
                                                    :variant="badge.variant"
                                                    class="h-5 px-1.5 text-[10px]"
                                                >
                                                    {{ badge.label }} {{ badge.value }}
                                                </Badge>
                                            </div>
                                            <div class="mt-2 rounded-md border px-2 py-2 text-xs" :class="claimQueueWorkflowStripClass(item)">
                                                <div class="space-y-2">
                                                    <div class="space-y-1">
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current step</p>
                                                            <Badge
                                                                :variant="claimQueueWorkflowBadgeVariant(item)"
                                                                class="h-5 px-1.5 text-[10px]"
                                                            >
                                                                {{ claimQueueWorkflowBadgeLabel(item) }}
                                                            </Badge>
                                                        </div>
                                                        <p class="text-sm font-medium text-foreground">{{ claimCurrentStepLabel(item) }}</p>
                                                    </div>
                                                    <div class="space-y-1 border-t pt-2">
                                                        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Primary action</p>
                                                        <p class="text-xs text-foreground">{{ claimNextActionLabel(item) }}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p
                                                v-if="claimQueuePreview(item)"
                                                class="mt-2 line-clamp-2 text-xs text-muted-foreground"
                                            >
                                                <span class="font-medium text-foreground">{{ claimQueuePreview(item)?.label }}:</span>
                                                {{ claimQueuePreview(item)?.text }}
                                            </p>
                                            <div class="mt-3 flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" class="h-8" @click="openDetails(item)">
                                                    {{ claimQueueDetailsActionLabel }}
                                                </Button>
                                                <Button
                                                    v-if="canUpdateStatus && canOpenFollowUp(item)"
                                                    size="sm"
                                                    class="h-8"
                                                    :variant="String(item.reconciliationExceptionStatus ?? '') === 'open' ? 'destructive' : 'default'"
                                                    @click="openFollowUpDialog(item)"
                                                >
                                                    Update follow-up
                                                </Button>
                                            </div>
                                        </div>
                                </div>
                                    </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.95fr)]">
                        <Card class="rounded-lg border-sidebar-border/70">
                            <CardHeader class="pb-3">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="ban" class="size-5 text-muted-foreground" />
                                    Denial Reason Analytics
                                </CardTitle>
                                <CardDescription>Top denial or partial-approval reasons from the current queue scope.</CardDescription>
                            </CardHeader>
                            <CardContent class="space-y-3">
                                <div v-if="denialReasonRows.rows.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    No denied or partially approved claims in the current scope.
                                </div>
                                <div v-else class="space-y-3">
                                    <div v-for="row in denialReasonRows.rows" :key="row.reason" class="rounded-lg border p-3">
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <p class="text-sm font-medium">{{ row.reason }}</p>
                                                <p class="text-xs text-muted-foreground">{{ row.count }} claim{{ row.count === 1 ? '' : 's' }} in current scope</p>
                                            </div>
                                            <Badge variant="outline">{{ row.ratio }}%</Badge>
                                        </div>
                                        <div class="mt-3 h-2 rounded-full bg-muted">
                                            <div class="h-2 rounded-full bg-primary" :style="{ width: `${row.ratio}%` }" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card class="rounded-lg border-sidebar-border/70">
                            <CardHeader class="pb-3">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="alarm-clock" class="size-5 text-muted-foreground" />
                                    Payer SLA & Escalation Queue
                                </CardTitle>
                                <CardDescription>Claims that need adjudication action, settlement reconciliation, or exception follow-up first.</CardDescription>
                            </CardHeader>
                            <CardContent class="space-y-3">
                                <div class="grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg border p-3 text-sm">
                                        <p class="text-xs text-muted-foreground">Work now</p>
                                        <p class="mt-1 text-lg font-semibold">{{ escalationSummary.overdue }}</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Claims already past payer or follow-up due date.</p>
                                    </div>
                                    <div class="rounded-lg border p-3 text-sm">
                                        <p class="text-xs text-muted-foreground">Due soon</p>
                                        <p class="mt-1 text-lg font-semibold">{{ escalationSummary.dueSoon }}</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Claims that need attention in the next 48 hours.</p>
                                    </div>
                                    <div class="rounded-lg border p-3 text-sm">
                                        <p class="text-xs text-muted-foreground">Exceptions open</p>
                                        <p class="mt-1 text-lg font-semibold">{{ escalationSummary.openExceptions }}</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Reconciliation issues still waiting for owner follow-up.</p>
                                    </div>
                                </div>
                                <div v-if="escalationQueueRows.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    No active claim SLA or exception pressure in the current scope.
                                </div>
                                <div v-else class="space-y-2">
                                    <div
                                        v-for="{ item, snapshot } in escalationQueueRows"
                                        :key="`claims-escalation-${item.id}`"
                                        class="rounded-lg border p-3"
                                        :class="claimQueueAccentClass(item)"
                                    >
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <p class="text-sm font-medium">{{ item.claimNumber }}</p>
                                                <p class="truncate text-xs text-muted-foreground">{{ snapshot.title }} | {{ item.payerName || 'Payer not recorded' }}</p>
                                            </div>
                                            <Badge :variant="snapshot.tone === 'destructive' ? 'destructive' : snapshot.tone === 'warning' ? 'secondary' : 'outline'">
                                                {{ claimSlaBadgeLabel(item) }}
                                            </Badge>
                                        </div>
                                        <div class="mt-2 rounded-md border px-2 py-2 text-xs" :class="claimQueueWorkflowStripClass(item)">
                                            <div class="grid gap-3 md:grid-cols-2">
                                                <div class="space-y-1">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current step</p>
                                                        <Badge
                                                            :variant="claimQueueWorkflowBadgeVariant(item)"
                                                            class="h-5 px-1.5 text-[10px]"
                                                        >
                                                            {{ claimQueueWorkflowBadgeLabel(item) }}
                                                        </Badge>
                                                    </div>
                                                    <p class="text-sm font-medium text-foreground">{{ claimCurrentStepLabel(item) }}</p>
                                                </div>
                                                <div class="space-y-1 border-t pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
                                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Primary action</p>
                                                    <p class="text-sm text-foreground">{{ claimNextActionLabel(item) }}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="mt-2 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                                            <div class="space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-wide">Due at</p>
                                                <p>{{ formatDateTime(snapshot.dueAt?.toISOString() ?? null) }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-wide">Claim total</p>
                                                <p>{{ claimMoneySummary(item) }}</p>
                                            </div>
                                        </div>
                                        <div class="mt-3 flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" class="h-8" @click="openDetails(item)">
                                                {{ claimQueueDetailsActionLabel }}
                                            </Button>
                                            <Button
                                                v-if="canUpdateStatus && canOpenFollowUp(item)"
                                                size="sm"
                                                class="h-8"
                                                :variant="String(item.reconciliationExceptionStatus ?? '') === 'open' ? 'destructive' : 'default'"
                                                @click="openFollowUpDialog(item)"
                                            >
                                                Update follow-up
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card v-else-if="!pageLoading && claimsWorkspaceView === 'board'" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="layout-dashboard" class="size-5 text-muted-foreground" />
                            Claims Board
                        </CardTitle>
                        <CardDescription>You do not have permission to view claims board data.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Board access restricted</AlertTitle>
                            <AlertDescription>
                                Request <code>claims.insurance.read</code> to open lifecycle, denial, and SLA oversight views.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Card v-if="canCreate && claimsWorkspaceView === 'create'" id="create-claims-insurance" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="plus" class="size-5 text-muted-foreground" />
                            Create Claim
                        </CardTitle>
                        <CardDescription>
                            {{ createClaimCardDescription }}
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-6">
                        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                            <div class="space-y-4">
                                <div class="rounded-lg border p-4">
                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p class="text-sm font-medium">{{ createClaimSourceTitle }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">
                                                {{ createClaimSourceDescription }}
                                            </p>
                                        </div>
                                        <div class="flex flex-col items-end gap-2 text-right">
                                            <div class="flex flex-wrap items-center justify-end gap-2">
                                                <Badge :variant="createInvoiceContextLocked ? 'secondary' : createForm.invoiceId.trim() ? 'default' : 'outline'">
                                                    {{
                                                        createInvoiceContextLocked
                                                            ? 'Invoice locked'
                                                            : createForm.invoiceId.trim()
                                                              ? 'Invoice linked'
                                                              : 'Invoice required'
                                                    }}
                                                </Badge>
                                                <Badge :variant="createInvoiceClaimReadinessVariant">
                                                    {{ createInvoiceClaimReadinessLabel }}
                                                </Badge>
                                            </div>
                                            <Button
                                                v-if="createInvoiceContextLocked"
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                class="h-7 px-2 text-xs"
                                                @click="clearCreateInvoiceLock"
                                            >
                                                Open generic intake
                                            </Button>
                                        </div>
                                    </div>
                                    <div class="mt-4 grid gap-3">
                                        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Billing context
                                        </p>
                                        <div
                                            v-if="createInvoiceContextLocked"
                                            class="rounded-md border bg-muted/20 p-3"
                                        >
                                            <div
                                                v-if="createInvoicePreviewLoading"
                                                class="space-y-2"
                                            >
                                                <div class="h-4 w-40 animate-pulse rounded bg-muted" />
                                                <div class="h-16 animate-pulse rounded bg-muted" />
                                            </div>
                                            <Alert
                                                v-else-if="createInvoicePreviewError"
                                                variant="destructive"
                                                class="py-2"
                                            >
                                                <AlertTitle>Billing handoff unavailable</AlertTitle>
                                                <AlertDescription>
                                                    {{ createInvoicePreviewError }}
                                                </AlertDescription>
                                            </Alert>
                                            <Alert
                                                v-else-if="!canReadBillingInvoices"
                                                class="py-2"
                                            >
                                                <AlertTitle>Billing preview restricted</AlertTitle>
                                                <AlertDescription>
                                                    This claim stays locked to invoice {{ createInvoiceSummaryLabel }}, but invoice preview details need <code>billing.invoices.read</code>.
                                                </AlertDescription>
                                            </Alert>
                                            <div v-else class="space-y-3">
                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                    <div class="space-y-1">
                                                        <p class="text-sm font-medium text-foreground">
                                                            {{ createInvoiceSummaryLabel }}
                                                        </p>
                                                        <p class="text-xs text-muted-foreground">
                                                            {{ formatEnumLabel(createInvoicePreview?.status || 'draft') }}
                                                            <span v-if="createInvoicePreview?.patientId">
                                                                | Patient {{ createInvoicePreview.patientId }}
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <Button
                                                        v-if="canReadBillingInvoices && createForm.invoiceId.trim()"
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        class="gap-1.5"
                                                        @click="window.location.assign(claimInvoiceHref(createForm.invoiceId))"
                                                    >
                                                        <AppIcon name="arrow-up-right" class="size-3.5" />
                                                        Open Invoice
                                                    </Button>
                                                </div>

                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="rounded-md border bg-background/80 p-3">
                                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                            Settlement route
                                                        </p>
                                                        <p class="mt-1 text-sm font-medium text-foreground">
                                                            {{ createInvoiceSettlementRouteLabel }}
                                                        </p>
                                                    </div>
                                                    <div class="rounded-md border bg-background/80 p-3">
                                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                            Claim posture
                                                        </p>
                                                        <p class="mt-1 text-sm font-medium text-foreground">
                                                            {{ createInvoiceClaimReadinessLabel }}
                                                        </p>
                                                    </div>
                                                    <div class="rounded-md border bg-background/80 p-3">
                                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                            Expected payer
                                                        </p>
                                                        <p class="mt-1 text-sm font-medium text-foreground">
                                                            {{ claimMoneyWithCurrency(createInvoicePreview?.payerSummary?.expectedPayerAmount, createInvoicePreview) }}
                                                        </p>
                                                    </div>
                                                    <div class="rounded-md border bg-background/80 p-3">
                                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                            Invoice balance
                                                        </p>
                                                        <p class="mt-1 text-sm font-medium text-foreground">
                                                            {{ claimMoneyWithCurrency(createInvoicePreview?.balanceAmount, createInvoicePreview) }}
                                                        </p>
                                                    </div>
                                                </div>

                                                <Alert
                                                    v-if="createInvoicePreview?.claimReadiness?.blockingReasons?.length"
                                                    variant="destructive"
                                                    class="py-2"
                                                >
                                                    <AlertTitle>Claim review needed</AlertTitle>
                                                    <AlertDescription class="space-y-1">
                                                        <p
                                                            v-for="reason in createInvoicePreview.claimReadiness.blockingReasons"
                                                            :key="`claims-create-claim-block-${reason}`"
                                                        >
                                                            {{ reason }}
                                                        </p>
                                                    </AlertDescription>
                                                </Alert>
                                                <Alert
                                                    v-else-if="createInvoicePreview?.claimReadiness?.guidance?.length"
                                                    class="py-2"
                                                >
                                                    <AlertDescription class="space-y-1">
                                                        <p
                                                            v-for="guidance in createInvoicePreview.claimReadiness.guidance"
                                                            :key="`claims-create-claim-guidance-${guidance}`"
                                                        >
                                                            {{ guidance }}
                                                        </p>
                                                    </AlertDescription>
                                                </Alert>
                                                <p v-else class="text-xs text-muted-foreground">
                                                    No claim blockers reported from the billing handoff.
                                                </p>
                                            </div>
                                        </div>

                                        <div v-else class="grid gap-2">
                                            <Label for="claims-create-invoice-id">Billing invoice</Label>
                                            <Input id="claims-create-invoice-id" v-model="createForm.invoiceId" :disabled="createSubmitting" placeholder="Invoice ID from Billing" />
                                            <p class="text-xs text-muted-foreground">
                                                Paste the billing invoice ID to pull payer and settlement context.
                                            </p>
                                            <p v-if="createFieldError('invoiceId')" class="text-xs text-destructive">{{ createFieldError('invoiceId') }}</p>
                                        </div>
                                        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Payer context
                                        </p>
                                        <div class="grid gap-4 sm:grid-cols-2">
                                            <div v-if="createPayerTypeLocked" class="grid gap-2">
                                                <Label>Payer type</Label>
                                                <div class="rounded-md border bg-muted/20 px-3 py-2">
                                                    <p class="text-sm font-medium text-foreground">
                                                        {{ formatEnumLabel(createResolvedInvoicePayerType) }}
                                                    </p>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        Inherited from the locked billing invoice.
                                                    </p>
                                                </div>
                                                <p v-if="createFieldError('payerType')" class="text-xs text-destructive">{{ createFieldError('payerType') }}</p>
                                            </div>
                                            <div v-else class="grid gap-2">
                                                <Label for="claims-create-payer-type">Payer type</Label>
                                                <Select v-model="createForm.payerType">
                                                    <SelectTrigger :disabled="createSubmitting">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                    <SelectItem v-for="item in payerTypeOptions" :key="item" :value="item">{{ formatEnumLabel(item) }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <p v-if="createFieldError('payerType')" class="text-xs text-destructive">{{ createFieldError('payerType') }}</p>
                                            </div>
                                            <div v-if="createPayerNameLocked" class="grid gap-2">
                                                <Label>Payer name</Label>
                                                <div class="rounded-md border bg-muted/20 px-3 py-2">
                                                    <p class="text-sm font-medium text-foreground">
                                                        {{ createResolvedInvoicePayerName }}
                                                    </p>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        Inherited from the locked billing invoice.
                                                    </p>
                                                </div>
                                                <p v-if="createFieldError('payerName')" class="text-xs text-destructive">{{ createFieldError('payerName') }}</p>
                                            </div>
                                            <div v-else class="grid gap-2">
                                                <Label for="claims-create-payer-name">Payer name</Label>
                                                <Input id="claims-create-payer-name" v-model="createForm.payerName" :disabled="createSubmitting" placeholder="NHIF, private insurer, employer..." />
                                                <p v-if="createFieldError('payerName')" class="text-xs text-destructive">{{ createFieldError('payerName') }}</p>
                                            </div>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="claims-create-payer-ref">Payer reference</Label>
                                            <Input id="claims-create-payer-ref" v-model="createForm.payerReference" :disabled="createSubmitting" placeholder="Authorization, scheme, or submission reference" />
                                            <p class="text-xs text-muted-foreground">Leave blank if the payer has not issued a reference yet.</p>
                                            <p v-if="createFieldError('payerReference')" class="text-xs text-destructive">{{ createFieldError('payerReference') }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <div class="rounded-lg border p-4">
                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p class="text-sm font-medium">Submission handoff</p>
                                            <p class="mt-1 text-xs text-muted-foreground">
                                                Record when the claim leaves intake and the scheme notes needed for follow-up.
                                            </p>
                                        </div>
                                        <div class="flex flex-wrap items-center justify-end gap-2 text-right">
                                            <Badge variant="secondary">{{ previewCreateSubmittedAt(createForm.submittedAt) }}</Badge>
                                            <Badge :variant="createForm.payerReference.trim() ? 'outline' : 'secondary'">
                                                {{ createForm.payerReference.trim() ? 'Reference ready' : 'Reference pending' }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="mt-4 grid gap-4">
                                        <div class="grid gap-2">
                                            <Label for="claims-create-submitted-at">Submitted at</Label>
                                            <Input id="claims-create-submitted-at" v-model="createForm.submittedAt" :disabled="createSubmitting" type="datetime-local" />
                                            <p class="text-xs text-muted-foreground">Use payer submission time if it differs from internal approval time.</p>
                                            <p v-if="createFieldError('submittedAt')" class="text-xs text-destructive">{{ createFieldError('submittedAt') }}</p>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="claims-create-notes">Submission notes</Label>
                                            <Textarea id="claims-create-notes" v-model="createForm.notes" :disabled="createSubmitting" rows="4" placeholder="Scheme comments, denial prevention notes, or settlement instructions..." />
                                            <p class="text-xs text-muted-foreground">Keep notes short so they can be surfaced in follow-up queues.</p>
                                            <p v-if="createFieldError('notes')" class="text-xs text-destructive">{{ createFieldError('notes') }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Separator />
                        <div class="flex flex-wrap items-center justify-end gap-2">
                            <Button
                                v-if="hasCreateFeedback"
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                :disabled="createSubmitting"
                                @click="resetCreateMessages"
                            >
                                <AppIcon name="circle-x" class="size-3.5" />
                                Dismiss alerts
                            </Button>
                            <Button :disabled="createSubmitting" class="gap-1.5" @click="submitCreate">
                                <AppIcon name="plus" class="size-3.5" />
                                {{ createSubmitting ? 'Creating...' : 'Create Claim' }}
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            </div>

            <Sheet v-if="canRead && claimsWorkspaceView === 'queue'" :open="advancedFiltersSheetOpen" @update:open="advancedFiltersSheetOpen = $event">
                <SheetContent side="right" variant="action" size="lg">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            All filters
                        </SheetTitle>
                        <SheetDescription>
                            Refine payer and reconciliation state without crowding the claims toolbar.
                        </SheetDescription>
                    </SheetHeader>
                    <div class="grid gap-4 px-4 py-4">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                                {{ searchForm.status ? `Status: ${formatEnumLabel(searchForm.status)}` : 'Status from quick bar' }}
                            </Badge>
                            <Badge variant="outline">
                                {{ searchForm.q.trim() ? `Search: ${searchForm.q.trim()}` : 'Search from toolbar' }}
                            </Badge>
                        </div>
                        <div class="grid gap-4">
                            <div class="grid gap-2">
                                <Label for="claims-filter-payer-sheet">Payer Type</Label>
                                <Select v-model="advancedFiltersDraft.payerType">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All payer types</SelectItem>
                                    <SelectItem v-for="item in payerTypeOptions" :key="`claims-filter-payer-sheet-${item}`" :value="item">
                                        {{ formatEnumLabel(item) }}
                                    </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <Label for="claims-filter-reconciliation-sheet">Reconciliation Status</Label>
                                <Select v-model="advancedFiltersDraft.reconciliationStatus">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All reconciliation states</SelectItem>
                                    <SelectItem v-for="item in reconciliationStatusOptions" :key="`claims-filter-reconciliation-sheet-${item}`" :value="item">
                                        {{ formatEnumLabel(item) }}
                                    </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <Label for="claims-filter-exception-sheet">Exception Status</Label>
                                <Select v-model="advancedFiltersDraft.reconciliationExceptionStatus">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All exception states</SelectItem>
                                    <SelectItem v-for="item in reconciliationExceptionStatusOptions" :key="`claims-filter-exception-sheet-${item}`" :value="item">
                                        {{ formatEnumLabel(item) }}
                                    </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <SheetFooter class="gap-2">
                        <Button variant="outline" @click="resetAdvancedFilters({ closeSheet: true })">
                            Reset
                        </Button>
                        <Button :disabled="queueLoading" @click="applyAdvancedFilters({ closeSheet: true })">
                            {{ queueLoading ? 'Applying...' : 'Apply filters' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Mobile filters drawer -->
            <Drawer v-if="canRead && claimsWorkspaceView === 'queue'" :open="mobileFiltersDrawerOpen" @update:open="mobileFiltersDrawerOpen = $event">
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            All filters
                        </DrawerTitle>
                        <DrawerDescription>
                            Refine payer and reconciliation state while keeping search and status in the main toolbar.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                                {{ searchForm.status ? `Status: ${formatEnumLabel(searchForm.status)}` : 'Status from quick bar' }}
                            </Badge>
                            <Badge variant="outline">
                                {{ searchForm.q.trim() ? `Search: ${searchForm.q.trim()}` : 'Search from toolbar' }}
                            </Badge>
                        </div>
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="claims-filter-payer-mobile">Payer Type</Label>
                                    <Select v-model="advancedFiltersDraft.payerType">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All payer types</SelectItem>
                                        <SelectItem v-for="item in payerTypeOptions" :key="`claims-filter-payer-mobile-${item}`" :value="item">
                                            {{ formatEnumLabel(item) }}
                                        </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="claims-filter-reconciliation-mobile">Reconciliation Status</Label>
                                    <Select v-model="advancedFiltersDraft.reconciliationStatus">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All reconciliation states</SelectItem>
                                        <SelectItem v-for="item in reconciliationStatusOptions" :key="`claims-filter-reconciliation-mobile-${item}`" :value="item">
                                            {{ formatEnumLabel(item) }}
                                        </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="claims-filter-exception-mobile">Exception Status</Label>
                                    <Select v-model="advancedFiltersDraft.reconciliationExceptionStatus">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All exception states</SelectItem>
                                        <SelectItem v-for="item in reconciliationExceptionStatusOptions" :key="`claims-filter-exception-mobile-${item}`" :value="item">
                                            {{ formatEnumLabel(item) }}
                                        </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="queueLoading" class="gap-1.5" @click="applyAdvancedFilters({ closeDrawer: true })">
                            {{ queueLoading ? 'Applying...' : 'Apply filters' }}
                        </Button>
                        <Button variant="outline" @click="resetAdvancedFilters({ closeDrawer: true })">
                            Reset
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    </AppLayout>

    <Dialog v-model:open="statusDialogOpen">
        <DialogContent variant="form" size="2xl">
            <DialogHeader class="shrink-0 border-b px-6 py-4 text-left">
                <DialogTitle>{{ statusDialogTitle }}</DialogTitle>
                <DialogDescription>{{ statusDialogDescription }}</DialogDescription>
            </DialogHeader>
            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div class="rounded-lg border">
                    <section v-if="statusClaim" :class="['space-y-4 p-4', statusDialogActionToneClass]">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{{ statusClaim.claimNumber || 'Claim' }}</Badge>
                            <Badge :variant="claimStatusVariant(statusClaim.status)">{{ formatEnumLabel(statusClaim.status ?? 'draft') }}</Badge>
                            <Badge variant="secondary">{{ claimMoneySummary(statusClaim) }}</Badge>
                        </div>
                        <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <div class="space-y-1">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payer</p>
                                <p class="text-sm font-medium text-foreground">{{ statusClaim.payerName || 'Not recorded' }}</p>
                            </div>
                            <div class="space-y-1">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing invoice</p>
                                <p class="text-sm font-medium text-foreground">{{ statusClaim.invoiceId || 'Not linked' }}</p>
                            </div>
                        </div>
                    </section>

                    <section v-if="statusDialogSummaryCards.length" class="space-y-4 border-t p-4">
                        <div>
                            <p class="text-sm font-medium">Workflow summary</p>
                            <p class="mt-1 text-xs text-muted-foreground">Confirm the current step, this update, and what becomes visible next.</p>
                        </div>
                        <div class="grid gap-4 md:grid-cols-3">
                            <div v-for="card in statusDialogSummaryCards" :key="`claims-status-summary-${card.title}`" class="space-y-1">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <p class="text-sm font-medium text-foreground">{{ card.title }}</p>
                                    <Badge :variant="card.badgeVariant">{{ card.value }}</Badge>
                                </div>
                                <p class="text-xs text-muted-foreground">{{ card.helper }}</p>
                            </div>
                        </div>
                    </section>

                    <section class="space-y-4 border-t p-4">
                        <div>
                            <p class="text-sm font-medium">Status action</p>
                            <p class="mt-1 text-xs text-muted-foreground">Use this update when payer review, adjudication, or settlement posture changes.</p>
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-1 md:col-span-2">
                                <Label>Status action</Label>
                                <Select v-model="statusAction">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem v-for="item in statusActionOptions" :key="item" :value="item">
                                        {{ formatEnumLabel(item) }}
                                    </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p class="text-xs text-muted-foreground">
                                    Switch the action if payer review ended differently from the suggested path.
                                </p>
                                <p
                                    v-if="statusDialogActionOverrideHint"
                                    class="text-xs text-amber-700"
                                >
                                    {{ statusDialogActionOverrideHint }}
                                </p>
                                <p
                                    v-else-if="statusDialogSuggestedActionLabel"
                                    class="text-xs text-muted-foreground"
                                >
                                    Suggested action: {{ statusDialogSuggestedActionLabel }}.
                                </p>
                            </div>
                            <div class="space-y-1 md:col-span-2">
                                <Label>Reason</Label>
                                <Input v-model="statusReason" placeholder="Required for rejected, partial, or cancelled updates" />
                            </div>
                            <div
                                v-if="
                                    statusNeedsDecision() ||
                                    statusNeedsSubmittedAt() ||
                                    statusNeedsAdjudicatedAt() ||
                                    statusNeedsApprovedAmount() ||
                                    statusNeedsRejectedAmount()
                                "
                                class="space-y-3 rounded-lg border bg-muted/20 p-3 md:col-span-2"
                            >
                                <div>
                                    <p class="text-sm font-medium text-foreground">Decision details</p>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        Capture payer decision timing and amounts when needed.
                                    </p>
                                </div>
                                <div class="grid gap-3 md:grid-cols-2">
                                    <div v-if="statusNeedsDecision()" class="space-y-1 md:col-span-2">
                                        <Label>Decision reason</Label>
                                        <Textarea v-model="statusDecisionReason" rows="3" placeholder="Summarize payer decision or shortfall reason" />
                                    </div>
                                    <div v-if="statusNeedsSubmittedAt()" class="space-y-1">
                                        <Label>Submitted at</Label>
                                        <Input v-model="statusSubmittedAt" type="datetime-local" />
                                    </div>
                                    <div v-if="statusNeedsAdjudicatedAt()" class="space-y-1">
                                        <Label>Adjudicated at</Label>
                                        <Input v-model="statusAdjudicatedAt" type="datetime-local" />
                                    </div>
                                    <div v-if="statusNeedsApprovedAmount()" class="space-y-1">
                                        <Label>Approved amount</Label>
                                        <Input v-model="statusApprovedAmount" type="number" min="0" step="0.01" />
                                    </div>
                                    <div v-if="statusNeedsRejectedAmount()" class="space-y-1">
                                        <Label>Rejected amount</Label>
                                        <Input v-model="statusRejectedAmount" type="number" min="0" step="0.01" />
                                    </div>
                                </div>
                            </div>
                            <p v-if="statusError" class="md:col-span-2 text-xs text-destructive">{{ statusError }}</p>
                        </div>
                    </section>
                </div>
            </div>
            <DialogFooter class="shrink-0 border-t px-6 py-4">
                <Button variant="outline" @click="statusDialogOpen = false">Close</Button>
                <Button :disabled="statusSubmitting" @click="submitStatusDialog">{{ statusDialogSubmitLabel }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog v-model:open="followUpDialogOpen">
        <DialogContent variant="form" size="2xl">
            <DialogHeader class="shrink-0 border-b px-6 py-4 text-left">
                <DialogTitle>{{ followUpDialogTitle }}</DialogTitle>
                <DialogDescription>{{ followUpDialogDescription }}</DialogDescription>
            </DialogHeader>
            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div class="rounded-lg border">
                    <section v-if="followUpClaim" class="space-y-4 border-destructive/20 bg-destructive/5 p-4">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{{ followUpClaim.claimNumber || 'Claim' }}</Badge>
                            <Badge :variant="claimStatusVariant(followUpClaim.status)">{{ formatEnumLabel(followUpClaim.status ?? 'n/a') }}</Badge>
                            <Badge variant="destructive">Exception {{ formatEnumLabel(followUpClaim.reconciliationExceptionStatus || 'open') }}</Badge>
                        </div>
                        <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <div class="space-y-1">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payer</p>
                                <p class="text-sm font-medium text-foreground">{{ followUpClaim.payerName || 'Not recorded' }}</p>
                            </div>
                            <div class="space-y-1">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing invoice</p>
                                <p class="text-sm font-medium text-foreground">{{ followUpClaim.invoiceId || 'Not linked' }}</p>
                            </div>
                            <div class="space-y-1 sm:col-span-2">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current note</p>
                                <p class="text-sm text-foreground">{{ followUpClaim.reconciliationFollowUpNote || 'No note recorded yet.' }}</p>
                            </div>
                        </div>
                    </section>

                    <section v-if="followUpSummaryCards.length" class="space-y-4 border-t p-4">
                        <div>
                            <p class="text-sm font-medium">Follow-up summary</p>
                            <p class="mt-1 text-xs text-muted-foreground">Keep exception ownership, due date, and closure intent aligned.</p>
                        </div>
                        <div class="grid gap-4 md:grid-cols-3">
                            <div v-for="card in followUpSummaryCards" :key="`claims-follow-up-summary-${card.title}`" class="space-y-1">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <p class="text-sm font-medium text-foreground">{{ card.title }}</p>
                                    <Badge :variant="card.badgeVariant">{{ card.value }}</Badge>
                                </div>
                                <p class="text-xs text-muted-foreground">{{ card.helper }}</p>
                            </div>
                        </div>
                    </section>

                    <section class="space-y-4 border-t p-4">
                        <div>
                            <p class="text-sm font-medium">Follow-up action</p>
                            <p class="mt-1 text-xs text-muted-foreground">Record owner state, due date, and recovery notes without losing the claim context.</p>
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-1 md:col-span-2">
                                <Label>Follow-up status</Label>
                                <Select v-model="followUpStatus">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem v-for="item in followUpStatusOptions" :key="item" :value="item">
                                        {{ formatEnumLabel(item) }}
                                    </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div v-if="followUpNeedsDueAt()" class="space-y-1 md:col-span-2">
                                <Label>Follow-up due at</Label>
                                <Input v-model="followUpDueAt" type="datetime-local" />
                            </div>
                            <div class="space-y-1 md:col-span-2">
                                <Label>Follow-up note</Label>
                                <Textarea v-model="followUpNote" rows="4" placeholder="Escalation, refund, settlement, or payer recovery notes..." />
                            </div>
                            <p v-if="followUpError" class="md:col-span-2 text-xs text-destructive">{{ followUpError }}</p>
                        </div>
                    </section>
                </div>
            </div>
            <DialogFooter class="shrink-0 border-t px-6 py-4">
                <Button variant="outline" @click="followUpDialogOpen = false">Close</Button>
                <Button :disabled="followUpSubmitting" @click="submitFollowUpDialog">{{ followUpDialogSubmitLabel }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Sheet :open="detailsOpen" @update:open="(open) => { detailsOpen = open; }">
        <SheetContent side="right" variant="workspace">
            <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                <SheetTitle>Claim Details</SheetTitle>
                <SheetDescription>{{ detailsClaim?.claimNumber || 'Review claim lifecycle, settlement, and audit without leaving the queue.' }}</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-4 p-6">
                    <div v-if="detailsLoading" class="space-y-3">
                        <div class="h-24 animate-pulse rounded-lg bg-muted" />
                        <div class="h-32 animate-pulse rounded-lg bg-muted" />
                    </div>
                    <div v-else-if="detailsClaim" class="space-y-4">
                        <Tabs v-model="detailsSheetTab" class="w-full space-y-4">
                            <TabsList class="grid h-auto w-full grid-cols-3">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="workflows">Workflows</TabsTrigger>
                                <TabsTrigger value="audit">Audit</TabsTrigger>
                            </TabsList>
                            <TabsContent value="overview" class="mt-0 space-y-4">
                                <div class="flex flex-wrap items-start justify-between gap-3">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge :variant="claimStatusVariant(detailsClaim.status)">{{ formatEnumLabel(detailsClaim.status ?? 'n/a') }}</Badge>
                                        <Badge variant="outline">{{ detailsClaim.claimNumber }}</Badge>
                                        <Badge variant="secondary">{{ claimMoneySummary(detailsClaim) }}</Badge>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Button
                                            v-if="canUpdateStatus"
                                            size="sm"
                                            @click="openStatusDialog(detailsClaim, detailsWorkflowStatusAction)"
                                        >
                                            {{ detailsWorkflowStatusButtonLabel }}
                                        </Button>
                                        <Button
                                            v-if="canUpdateStatus && canOpenFollowUp(detailsClaim)"
                                            size="sm"
                                            variant="outline"
                                            @click="openFollowUpDialog(detailsClaim)"
                                        >
                                            Update follow-up
                                        </Button>
                                        <Button
                                            v-if="canReadBillingInvoices && detailsClaim.invoiceId"
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="window.location.assign(claimInvoiceHref(detailsClaim.invoiceId))"
                                        >
                                            <AppIcon name="arrow-up-right" class="size-3.5" />
                                            Open Invoice
                                        </Button>
                                        <Button size="sm" variant="outline" @click="openClaimPrintPreview(detailsClaim)">
                                            Print Claim
                                        </Button>
                                    </div>
                                </div>
                                <div class="rounded-lg border">
                                    <section class="space-y-4 p-4">
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p class="text-sm font-medium">Claim handoff</p>
                                                <p class="mt-1 text-xs text-muted-foreground">Billing, payer, and submission context attached to this claim.</p>
                                            </div>
                                            <Badge variant="outline">{{ formatEnumLabel(detailsClaim.payerType || 'n/a') }}</Badge>
                                        </div>
                                        <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing invoice</p>
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="text-sm font-medium text-foreground">{{ detailsClaim.invoiceId || 'Not linked' }}</p>
                                                    <Button
                                                        v-if="canReadBillingInvoices && detailsClaim.invoiceId"
                                                        size="sm"
                                                        variant="ghost"
                                                        class="h-7 px-2 text-xs"
                                                        @click="window.location.assign(claimInvoiceHref(detailsClaim.invoiceId))"
                                                    >
                                                        Open invoice
                                                    </Button>
                                                </div>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payer</p>
                                                <p class="text-sm font-medium text-foreground">{{ detailsClaim.payerName || 'Not recorded' }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</p>
                                                <p class="text-sm font-medium text-foreground">{{ detailsClaim.payerReference || 'Not recorded' }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted</p>
                                                <p class="text-sm font-medium text-foreground">{{ formatDateTime(detailsClaim.submittedAt) }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Adjudicated</p>
                                                <p class="text-sm font-medium text-foreground">{{ formatDateTime(detailsClaim.adjudicatedAt) }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Follow-up due</p>
                                                <p class="text-sm font-medium text-foreground">{{ formatDateTime(detailsClaim.reconciliationFollowUpDueAt) }}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section class="space-y-4 border-t p-4">
                                        <div>
                                            <p class="text-sm font-medium">Workflow focus</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Keep lifecycle, reconciliation, and follow-up visible at first glance.</p>
                                        </div>
                                        <div class="rounded-lg border p-4" :class="detailsFocusCard?.toneClass || 'border-border bg-background'">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ detailsWorkflowHeading }}</p>
                                            <p class="mt-2 text-base font-semibold text-foreground">{{ detailsFocusCard?.title }}</p>
                                            <p class="mt-2 text-sm text-muted-foreground">{{ detailsFocusCard?.description }}</p>
                                            <div v-if="canUpdateStatus" class="mt-4 flex flex-wrap gap-2">
                                                <Button size="sm" @click="openStatusDialog(detailsClaim, detailsWorkflowStatusAction)">
                                                    {{ detailsWorkflowStatusButtonLabel }}
                                                </Button>
                                                <Button
                                                    v-if="canOpenFollowUp(detailsClaim)"
                                                    size="sm"
                                                    variant="outline"
                                                    @click="openFollowUpDialog(detailsClaim)"
                                                >
                                                    Update follow-up
                                                </Button>
                                            </div>
                                        </div>
                                        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                            <div v-for="card in detailsOverviewCards" :key="card.id" class="space-y-1">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <p class="text-sm font-medium text-foreground">{{ card.title }}</p>
                                                    <Badge :variant="card.badgeVariant">{{ card.value }}</Badge>
                                                </div>
                                                <p class="text-xs text-muted-foreground">{{ card.helper }}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section class="space-y-4 border-t p-4">
                                        <div>
                                            <p class="text-sm font-medium">Financial snapshot</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Approved, rejected, settled, and shortfall exposure in one view.</p>
                                        </div>
                                        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                                            <div v-for="card in detailsFinancialSnapshotCards" :key="card.id" class="space-y-1">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <p class="text-sm font-medium text-foreground">{{ card.title }}</p>
                                                    <Badge :variant="card.badgeVariant">{{ card.value }}</Badge>
                                                </div>
                                                <p class="text-xs text-muted-foreground">{{ card.helper }}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section class="space-y-4 border-t p-4">
                                        <div>
                                            <p class="text-sm font-medium">Decision and recovery notes</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Reasoning and recovery instructions captured on this claim.</p>
                                        </div>
                                        <div class="space-y-4 divide-y">
                                            <div class="space-y-1 pb-4">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision reason</p>
                                                <p class="text-sm text-foreground">{{ detailsClaim.decisionReason || detailsClaim.statusReason || 'No decision reason recorded.' }}</p>
                                            </div>
                                            <div class="space-y-1 pt-4">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Follow-up note</p>
                                                <p class="text-sm text-foreground">{{ detailsClaim.reconciliationFollowUpNote || 'No follow-up note recorded.' }}</p>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </TabsContent>
                            <TabsContent value="workflows" class="mt-0 space-y-4">
                                <div class="rounded-lg border">
                                    <section class="space-y-4 p-4" :class="detailsFocusCard?.toneClass || 'border-border bg-background'">
                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div class="min-w-0">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ detailsWorkflowHeading }}</p>
                                                <p class="mt-2 text-lg font-semibold tracking-tight text-foreground">{{ detailsFocusCard?.title }}</p>
                                                <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{{ detailsFocusCard?.description }}</p>
                                            </div>
                                            <div class="flex flex-wrap gap-2 sm:justify-end">
                                                <Button v-if="canUpdateStatus" size="sm" variant="outline" @click="openStatusDialog(detailsClaim, detailsWorkflowStatusAction)">
                                                    {{ detailsWorkflowStatusButtonLabel }}
                                                </Button>
                                                <Button v-if="canUpdateStatus && canOpenFollowUp(detailsClaim)" size="sm" @click="openFollowUpDialog(detailsClaim)">
                                                    Update follow-up
                                                </Button>
                                            </div>
                                        </div>
                                        <div v-if="detailsWorkflowSummaryCards.length" class="grid gap-4 md:grid-cols-3">
                                            <div v-for="card in detailsWorkflowSummaryCards" :key="card.id" class="space-y-1 rounded-lg border bg-background/80 p-3">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <p class="text-sm font-medium text-foreground">{{ card.title }}</p>
                                                    <Badge :variant="card.badgeVariant">{{ card.value }}</Badge>
                                                </div>
                                                <p class="text-xs text-muted-foreground">{{ card.helper }}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section class="space-y-4 border-t p-4">
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p class="text-sm font-medium">Claim timeline</p>
                                                <p class="text-xs text-muted-foreground">Lifecycle events already recorded on this claim.</p>
                                            </div>
                                            <Badge variant="outline">{{ detailsTimelineItems.length }} steps</Badge>
                                        </div>
                                        <div class="space-y-4">
                                            <div v-for="(event, eventIndex) in detailsTimelineItems" :key="event.id" class="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                                                <div class="flex flex-col items-center">
                                                    <span class="mt-1 inline-flex size-3 rounded-full" :class="event.complete ? 'bg-primary' : 'bg-muted-foreground/30'" />
                                                    <span v-if="eventIndex < detailsTimelineItems.length - 1" class="mt-1 h-full min-h-8 w-px bg-border" />
                                                </div>
                                                <div class="space-y-2 rounded-lg border p-3">
                                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                                        <p class="text-sm font-medium">{{ event.title }}</p>
                                                        <Badge :variant="event.complete ? 'default' : 'outline'">{{ event.complete ? formatDateTime(event.at) : 'Pending' }}</Badge>
                                                    </div>
                                                    <p class="text-sm text-muted-foreground">{{ event.description }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </TabsContent>
                            <TabsContent value="audit" class="mt-0 space-y-4">
                                <div class="rounded-lg border">
                                    <section class="space-y-4 p-4">
                                        <div>
                                            <p class="text-sm font-medium">Audit overview</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Review lifecycle, settlement, follow-up, and document activity without leaving the claim.</p>
                                        </div>
                                        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                            <div v-for="card in detailsAuditSummaryCards" :key="card.id" class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ card.title }}</p>
                                                <p class="text-lg font-semibold text-foreground">{{ card.value }}</p>
                                                <p class="text-xs text-muted-foreground">{{ card.helper }}</p>
                                            </div>
                                        </div>
                                    </section>
                                    <section v-if="!canViewAudit" class="border-t p-4">
                                        <Alert variant="destructive">
                                            <AlertTitle>Audit access restricted</AlertTitle>
                                            <AlertDescription>Request <code>claims.insurance.view-audit-logs</code> permission.</AlertDescription>
                                        </Alert>
                                    </section>
                                    <template v-else>
                                        <section class="space-y-4 border-t p-4">
                                            <div class="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <p class="text-sm font-medium">Trail tools</p>
                                                    <p class="mt-1 text-xs text-muted-foreground">Narrow the claim trail to specific actions, actors, or time windows before export.</p>
                                                </div>
                                                <div class="flex flex-wrap gap-2">
                                                    <Button size="sm" variant="outline" @click="detailsAuditFiltersOpen = !detailsAuditFiltersOpen">
                                                        {{ detailsAuditFiltersOpen ? 'Hide trail filters' : 'Show trail filters' }}
                                                    </Button>
                                                    <Button size="sm" variant="outline" :disabled="detailsAuditLoading || detailsAuditExporting" @click="exportDetailsAuditLogsCsv">
                                                        {{ detailsAuditExporting ? 'Preparing...' : 'Export trail CSV' }}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div v-if="detailsAuditFiltersOpen" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                <div class="grid gap-1">
                                                    <Label for="claims-details-audit-q">Action text</Label>
                                                    <Input id="claims-details-audit-q" v-model="detailsAuditFilters.q" placeholder="submitted, reconciliation, follow-up..." />
                                                </div>
                                                <div class="grid gap-1">
                                                    <Label for="claims-details-audit-action">Action</Label>
                                                    <Select v-model="detailsAuditFilters.action">
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="">All actions</SelectItem>
                                                        <SelectItem
                                                            v-for="option in claimsAuditActionOptions"
                                                            :key="`claims-audit-action-${option.value}`"
                                                            :value="option.value"
                                                        >
                                                            {{ option.label }}
                                                        </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-1">
                                                    <Label for="claims-details-audit-actor-type">Actor type</Label>
                                                    <Select v-model="detailsAuditFilters.actorType">
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem v-for="option in auditActorTypeOptions" :key="`claims-audit-actor-type-${option.value || 'all'}`" :value="option.value">{{ option.label }}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-1">
                                                    <Label for="claims-details-audit-actor-id">Actor user ID</Label>
                                                    <Input id="claims-details-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="Optional user ID" />
                                                </div>
                                                <div class="grid gap-1">
                                                    <Label for="claims-details-audit-from">From</Label>
                                                    <Input id="claims-details-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" />
                                                </div>
                                                <div class="grid gap-1">
                                                    <Label for="claims-details-audit-to">To</Label>
                                                    <Input id="claims-details-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" />
                                                </div>
                                                <div class="grid gap-1">
                                                    <Label for="claims-details-audit-per-page">Rows per page</Label>
                                                    <Select :model-value="String(detailsAuditFilters.perPage)" @update:model-value="detailsAuditFilters.perPage = Number($event)">
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="10">10</SelectItem>
                                                        <SelectItem value="20">20</SelectItem>
                                                        <SelectItem value="50">50</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="flex flex-wrap items-end gap-2 xl:col-span-2">
                                                    <Button size="sm" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">{{ detailsAuditLoading ? 'Applying...' : 'Apply filters' }}</Button>
                                                    <Button size="sm" variant="outline" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">Reset filters</Button>
                                                </div>
                                            </div>
                                        </section>
                                        <section class="space-y-4 border-t p-4">
                                            <div class="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <p class="text-sm font-medium">Audit trail</p>
                                                    <p class="mt-1 text-xs text-muted-foreground">Chronological record of claim creation, adjudication, settlement, and recovery handling.</p>
                                                </div>
                                                <Badge variant="outline">{{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} events</Badge>
                                            </div>
                                            <p v-if="detailsAuditLoading" class="text-sm text-muted-foreground">Loading audit trail...</p>
                                            <p v-else-if="detailsAuditError" class="text-sm text-destructive">{{ detailsAuditError }}</p>
                                            <AuditTimelineList
                                                v-else
                                                :logs="detailsAuditLogs"
                                                :format-date-time="formatDateTime"
                                                empty-message="No claim lifecycle or settlement events matched the current filter scope."
                                            />
                                            <div class="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                                                <Button size="sm" variant="outline" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                                <p>Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} | {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} trail events</p>
                                                <Button size="sm" variant="outline" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 0) + 1)">Next</Button>
                                            </div>
                                        </section>
                                    </template>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </ScrollArea>
        </SheetContent>
    </Sheet>
</template>







