<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { refDebounced, useDebounceFn, useMediaQuery } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import ListPagination from '@/components/ListPagination.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCashAccount, type CashBillingPayment } from '@/composables/billingCash/useCashAccount';
import { useCashAccountActions } from '@/composables/billingCash/useCashAccountActions';
import { useCashAccounts, type CashAccount } from '@/composables/billingCash/useCashAccounts';
import { useCashAccountsFilters } from '@/composables/billingCash/useCashAccountsFilters';
import { useCashAccountsStatusCounts } from '@/composables/billingCash/useCashAccountsStatusCounts';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

/**
 * V2 rebuild of the Cash Payments walk-in workboard — same V2 architecture
 * as billing/IndexV2.vue (TanStack Query composables in
 * composables/billingCash/*, URL-synced filters, sticky header with stat
 * cards + segmented status Tabs, plain bordered list container, currency-
 * aware formatMoney). The old page (billing/Cash.vue) only listed and
 * created accounts; the backend (routes/billing-phase1.php's cash-patients
 * group) already supports recording charges/payments and converting to an
 * invoice or voiding/refunding an account — none of that had any UI before
 * this rebuild.
 *
 * Header/stat-tile/Tabs-wrapped-sticky-header structure matches
 * encounters/List.vue and billing/List.vue: `<Tabs>` wraps the whole page,
 * title/description on the left, right-aligned Button+Link pairs for
 * cross-module nav (BillingModuleNav's tab-strip removed) plus the page's
 * own actions, and a plain (not custom-pill-styled) TabsList both here and
 * on the account-detail panel's Charges/Payments tabs.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canManage = computed(() => hasAccess('billing.cash-accounts.manage'));

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cash payments', href: '/billing-cash' }];

const PER_PAGE_STORAGE_KEY = 'billing.cash-accounts-per-page.v1';

const filters = useCashAccountsFilters();
const accounts = useCashAccounts(filters);
const statusCounts = useCashAccountsStatusCounts(filters);
const accountRows = computed(() => accounts.data.value?.data ?? []);
const pagination = computed(() => accounts.data.value?.meta ?? null);
const pageLoading = computed(() => accounts.isLoading.value);
const listLoading = computed(() => accounts.isFetching.value);
const listError = computed(() => (accounts.isError.value ? ((accounts.error.value as Error | null)?.message ?? 'Unable to load cash accounts.') : null));

const selectedAccountId = ref<string | null>(null);
const accountDetailQuery = useCashAccount(selectedAccountId);
const selectedAccount = computed(() => accountDetailQuery.data.value?.account ?? null);
const accountCharges = computed(() => accountDetailQuery.data.value?.charges ?? []);
const accountPayments = computed(() => accountDetailQuery.data.value?.payments ?? []);
const accountDetailLoading = computed(() => accountDetailQuery.isLoading.value);

const mobileView = ref<'list' | 'detail'>('list');
const isMobile = useMediaQuery('(max-width: 767px)');
const compactRows = useLocalStorageBoolean('billing.cash-accounts-compact-rows.v1', false);

const actions = useCashAccountActions();

function selectAccount(account: CashAccount): void {
    selectedAccountId.value = account.id;
    if (isMobile.value) mobileView.value = 'detail';
}

function refreshList(): void {
    void accounts.refetch();
    if (selectedAccountId.value) void accountDetailQuery.refetch();
}

/** Decoupled from filters.q so typing doesn't fire a query on every keystroke. */
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

/** Same "remembered filters" URL-sync contract as billing/IndexV2.vue. */
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

function formatMoney(amount: number | null, currencyCode?: string | null): string {
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount ?? 0);
    return `${formatted} ${currencyCode || 'TZS'}`;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

function statusVariant(status: string | null): BadgeVariant {
    switch (status) {
        case 'active':
            return 'default';
        case 'settled':
            return 'secondary';
        case 'suspended':
            return 'destructive';
        default:
            return 'outline';
    }
}

// --- New cash account sheet ---
const newAccountSheetOpen = ref(false);
const newAccountPatientId = ref('');
const newAccountCurrency = ref('TZS');
const newAccountNotes = ref('');
const newAccountSaving = ref(false);

async function createAccount(): Promise<void> {
    if (!newAccountPatientId.value.trim()) return;
    newAccountSaving.value = true;
    try {
        await actions.createAccount.mutateAsync({
            patient_id: newAccountPatientId.value.trim(),
            currency_code: newAccountCurrency.value.trim() || undefined,
            notes: newAccountNotes.value.trim() || undefined,
        });
        notifySuccess('Cash account created.');
        newAccountSheetOpen.value = false;
        newAccountPatientId.value = '';
        newAccountNotes.value = '';
        actions.invalidate(null);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to create cash account.');
    } finally {
        newAccountSaving.value = false;
    }
}

// --- Record charge sheet ---
const chargeSheetOpen = ref(false);
const chargeServiceName = ref('');
const chargeQuantity = ref(1);
const chargeUnitPrice = ref(0);
const chargeDescription = ref('');
const chargeSaving = ref(false);

function openChargeSheet(): void {
    chargeServiceName.value = '';
    chargeQuantity.value = 1;
    chargeUnitPrice.value = 0;
    chargeDescription.value = '';
    chargeSheetOpen.value = true;
}

async function recordCharge(): Promise<void> {
    if (!selectedAccountId.value || !chargeServiceName.value.trim() || chargeUnitPrice.value <= 0) return;
    chargeSaving.value = true;
    try {
        await actions.recordCharge.mutateAsync({
            accountId: selectedAccountId.value,
            serviceName: chargeServiceName.value.trim(),
            quantity: chargeQuantity.value,
            unitPrice: chargeUnitPrice.value,
            description: chargeDescription.value.trim() || undefined,
        });
        notifySuccess('Charge recorded.');
        chargeSheetOpen.value = false;
        actions.invalidate(selectedAccountId.value);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to record charge.');
    } finally {
        chargeSaving.value = false;
    }
}

// --- Record payment sheet ---
const paymentSheetOpen = ref(false);
const paymentAmount = ref(0);
const paymentMethod = ref<'cash' | 'card' | 'mobile_money' | 'check'>('cash');
const paymentReference = ref('');
const paymentSaving = ref(false);

function openPaymentSheet(): void {
    paymentAmount.value = selectedAccount.value?.accountBalance ?? 0;
    paymentMethod.value = 'cash';
    paymentReference.value = '';
    paymentSheetOpen.value = true;
}

async function recordPayment(): Promise<void> {
    if (!selectedAccountId.value || paymentAmount.value <= 0) return;
    paymentSaving.value = true;
    try {
        await actions.recordPayment.mutateAsync({
            accountId: selectedAccountId.value,
            amountPaid: paymentAmount.value,
            paymentMethod: paymentMethod.value,
            paymentReference: paymentReference.value.trim() || undefined,
        });
        notifySuccess('Payment recorded.');
        paymentSheetOpen.value = false;
        actions.invalidate(selectedAccountId.value);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to record payment.');
    } finally {
        paymentSaving.value = false;
    }
}

// --- Convert to invoice (confirm dialog) ---
const convertDialogOpen = ref(false);
const convertSaving = ref(false);

async function confirmConvertToInvoice(): Promise<void> {
    if (!selectedAccountId.value) return;
    convertSaving.value = true;
    try {
        await actions.convertToInvoice.mutateAsync(selectedAccountId.value);
        notifySuccess('Cash account converted to invoice.');
        convertDialogOpen.value = false;
        actions.invalidate(selectedAccountId.value);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to convert to invoice.');
    } finally {
        convertSaving.value = false;
    }
}

// --- Void account (confirm dialog with required reason) ---
const voidDialogOpen = ref(false);
const voidReason = ref('');
const voidSaving = ref(false);

async function confirmVoidAccount(): Promise<void> {
    if (!selectedAccountId.value || voidReason.value.trim() === '') return;
    voidSaving.value = true;
    try {
        await actions.voidAccount.mutateAsync({ accountId: selectedAccountId.value, voidReason: voidReason.value.trim() });
        notifySuccess('Cash account voided.');
        voidDialogOpen.value = false;
        voidReason.value = '';
        actions.invalidate(selectedAccountId.value);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to void account.');
    } finally {
        voidSaving.value = false;
    }
}

// --- Refund a specific payment (dialog with required reason) ---
const refundDialogOpen = ref(false);
const refundTargetPayment = ref<CashBillingPayment | null>(null);
const refundAmount = ref(0);
const refundReason = ref('');
const refundSaving = ref(false);

function openRefundDialog(payment: CashBillingPayment): void {
    refundTargetPayment.value = payment;
    refundAmount.value = payment.amountPaid - (payment.refundedAmount ?? 0);
    refundReason.value = '';
    refundDialogOpen.value = true;
}

async function confirmRefundPayment(): Promise<void> {
    if (!selectedAccountId.value || !refundTargetPayment.value || refundAmount.value <= 0 || refundReason.value.trim() === '') return;
    refundSaving.value = true;
    try {
        await actions.refundPayment.mutateAsync({
            accountId: selectedAccountId.value,
            paymentId: refundTargetPayment.value.id,
            refundAmount: refundAmount.value,
            refundReason: refundReason.value.trim(),
        });
        notifySuccess('Payment refunded.');
        refundDialogOpen.value = false;
        actions.invalidate(selectedAccountId.value);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to refund payment.');
    } finally {
        refundSaving.value = false;
    }
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Cash payments" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <Tabs :model-value="filters.status" class="contents" @update:model-value="setStatus">
                <div class="sticky top-0 z-10 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Cash payments</h1>
                            <p class="text-xs text-muted-foreground">Walk-in cash accounts — charge, collect payment, and convert to invoice.</p>
                        </div>
                        <div class="flex shrink-0 flex-wrap items-center gap-2">
                            <Badge v-if="pagination" variant="secondary">{{ pagination.total }} accounts</Badge>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" as-child>
                                <Link href="/billing">
                                    <AppIcon name="receipt" class="size-3.5" />
                                    Invoices
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" as-child>
                                <Link href="/billing-refunds">
                                    <AppIcon name="undo-2" class="size-3.5" />
                                    Refunds
                                </Link>
                            </Button>
                            <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="newAccountSheetOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                New cash account
                            </Button>
                            <Button variant="ghost" size="sm" class="h-8 w-8 p-0" :disabled="listLoading" title="Refresh" @click="refreshList">
                                <AppIcon :name="listLoading ? 'loader-circle' : 'refresh-cw'" class="size-3.5" :class="listLoading ? 'animate-spin' : ''" />
                            </Button>
                            <Button v-if="hasActiveFilters" size="sm" variant="outline" class="h-8 gap-1.5" @click="clearAllFilters">
                                Clear filters
                            </Button>
                        </div>
                    </div>

                    <div class="mt-3 grid grid-cols-3 gap-2">
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.active ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Settled</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.settled ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Suspended</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.suspended ?? '—' }}</p>
                        </div>
                    </div>

                    <TabsList class="mt-3 flex w-full flex-wrap justify-start gap-1">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.all ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="active" class="inline-flex items-center gap-1.5">
                            Active
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.active ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="settled" class="inline-flex items-center gap-1.5">
                            Settled
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.settled ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="suspended" class="inline-flex items-center gap-1.5">
                            Suspended
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.suspended ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <div class="relative min-w-0 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input v-model="searchInputRaw" placeholder="Search accounts by patient name, MRN, or phone…" class="h-9 pl-9" @keyup.enter="submitSearchNow" />
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
                    <div v-if="listError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                        <div class="flex items-start gap-2.5">
                            <AppIcon name="alert-triangle" class="mt-0.5 size-4 shrink-0 text-destructive" />
                            <div class="min-w-0">
                                <p class="text-sm font-medium text-destructive">Unable to load cash accounts</p>
                                <p class="mt-1 text-xs break-all text-muted-foreground">{{ listError }}</p>
                            </div>
                            <Button variant="ghost" size="sm" class="ml-auto h-7 shrink-0 px-2" @click="refreshList">
                                <AppIcon name="refresh-cw" class="mr-1 size-3" />
                                Retry
                            </Button>
                        </div>
                    </div>

                    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
                        <div class="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
                            <!-- Left: accounts list -->
                        <div
                            class="flex min-h-0 flex-col border-b md:flex md:border-r md:border-b-0"
                            :class="[selectedAccountId ? 'md:w-96' : 'md:flex-1', isMobile && mobileView === 'detail' ? 'hidden' : '']"
                        >
                            <div class="min-h-0 flex-1 overflow-y-auto">
                                <RegistryListSkeleton v-if="pageLoading" :count="5" />
                                <div v-else-if="accountRows.length === 0" class="p-4">
                                    <InventoryEmptyState icon="banknote" title="No cash accounts" description="No walk-in cash accounts match the current filters." />
                                </div>
                                <div v-show="accountRows.length > 0" class="divide-y px-4" :class="{ 'pointer-events-none opacity-40 transition-opacity duration-200': listLoading }">
                                    <RegistryListRow
                                        v-for="account in accountRows"
                                        :key="account.id"
                                        :class="compactRows ? '[&_p]:text-[11px]' : ''"
                                        :flash="selectedAccountId === account.id"
                                        @select="selectAccount(account)"
                                    >
                                        <template #title>
                                            <span class="truncate text-sm font-medium">{{ account.patient.displayName || 'Unnamed patient' }}</span>
                                        </template>
                                        <template #meta>
                                            <p class="truncate text-xs text-muted-foreground">
                                                {{ account.patient.patientNumber || 'No MRN' }}
                                                <span v-if="account.patient.phone"> · {{ account.patient.phone }}</span>
                                            </p>
                                        </template>
                                        <template #badges>
                                            <Badge :variant="statusVariant(account.status)" class="h-5 px-1.5 text-[10px]">{{ formatEnumLabel(account.status || '') }}</Badge>
                                            <Badge v-if="(account.accountBalance ?? 0) > 0" variant="destructive" class="h-5 px-1.5 text-[10px] tabular-nums">
                                                {{ formatMoney(account.accountBalance, account.currencyCode) }}
                                            </Badge>
                                        </template>
                                        <template #actions>
                                            <AppIcon name="chevron-right" class="size-4 text-muted-foreground" />
                                        </template>
                                    </RegistryListRow>
                                </div>
                            </div>

                            <footer v-if="pagination && pagination.lastPage > 1" class="shrink-0 border-t bg-muted/30 px-4 py-2">
                                <ListPagination :current-page="pagination.currentPage" :last-page="pagination.lastPage" :total="pagination.total" item-label="accounts" @update:page="goToPage" />
                            </footer>
                        </div>

                        <!-- Right: account detail -->
                        <div v-if="selectedAccount" class="flex min-h-0 flex-1 flex-col overflow-hidden md:flex" :class="isMobile && mobileView === 'list' ? 'hidden' : ''">
                            <div class="flex items-center justify-between border-b px-4 py-3">
                                <div class="flex items-center gap-2">
                                    <Button v-if="isMobile" variant="ghost" size="sm" class="h-8 w-8 p-0 md:hidden" @click="mobileView = 'list'">
                                        <AppIcon name="chevron-left" class="size-4" />
                                    </Button>
                                    <div>
                                        <h2 class="text-base font-semibold">{{ selectedAccount.patient.displayName || 'Unnamed patient' }}</h2>
                                        <p class="text-xs text-muted-foreground">
                                            {{ selectedAccount.patient.patientNumber || 'No MRN' }}
                                            <span v-if="selectedAccount.patient.phone"> · {{ selectedAccount.patient.phone }}</span>
                                            · <Badge :variant="statusVariant(selectedAccount.status)" class="h-4.5 px-1.5 text-[10px]">{{ formatEnumLabel(selectedAccount.status || '') }}</Badge>
                                        </p>
                                    </div>
                                </div>
                                <div v-if="canManage && selectedAccount.status === 'active'" class="flex items-center gap-2">
                                    <Button size="sm" variant="outline" @click="openChargeSheet">Record Charge</Button>
                                    <Button size="sm" @click="openPaymentSheet">Record Payment</Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger as-child>
                                            <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                                                <AppIcon name="ellipsis-vertical" class="size-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" class="w-56">
                                            <DropdownMenuItem @click="convertDialogOpen = true">
                                                <AppIcon name="receipt" class="size-4" /> Convert to invoice
                                            </DropdownMenuItem>
                                            <DropdownMenuItem class="text-destructive" @click="voidDialogOpen = true">
                                                <AppIcon name="circle-x" class="size-4" /> Void account
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div class="grid grid-cols-3 gap-2 border-b p-4">
                                <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                                    <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Charged</p>
                                    <p class="text-sm font-bold tabular-nums">{{ formatMoney(selectedAccount.totalCharged, selectedAccount.currencyCode) }}</p>
                                </div>
                                <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                                    <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Paid</p>
                                    <p class="text-sm font-bold tabular-nums">{{ formatMoney(selectedAccount.totalPaid, selectedAccount.currencyCode) }}</p>
                                </div>
                                <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                                    <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Balance</p>
                                    <p class="text-sm font-bold text-destructive tabular-nums">{{ formatMoney(selectedAccount.accountBalance, selectedAccount.currencyCode) }}</p>
                                </div>
                            </div>

                            <Tabs default-value="charges" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                                <TabsList class="mx-4 mt-2 flex w-full flex-wrap justify-start gap-1">
                                    <TabsTrigger value="charges" class="inline-flex items-center gap-1.5">
                                        Charges
                                        <Badge v-if="accountCharges.length > 0" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ accountCharges.length }}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="payments" class="inline-flex items-center gap-1.5">
                                        Payments
                                        <Badge v-if="accountPayments.length > 0" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ accountPayments.length }}</Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="charges" class="m-0 flex min-h-0 flex-1 flex-col overflow-auto p-4">
                                    <div v-if="accountDetailLoading" class="space-y-3">
                                        <RegistryListSkeleton :count="3" />
                                    </div>
                                    <div v-else-if="accountCharges.length === 0" class="py-4">
                                        <InventoryEmptyState icon="receipt" title="No charges yet" description="No charges have been recorded on this account." compact />
                                    </div>
                                    <div v-else class="space-y-2">
                                        <div v-for="charge in accountCharges" :key="charge.id" class="rounded-lg border p-3">
                                            <div class="flex items-start justify-between gap-2">
                                                <div>
                                                    <p class="text-sm font-medium">{{ charge.serviceName }}</p>
                                                    <p class="mt-0.5 text-xs text-muted-foreground">
                                                        Qty {{ charge.quantity }} × {{ formatMoney(charge.unitPrice, selectedAccount.currencyCode) }}
                                                        <span v-if="charge.chargeDate"> · {{ charge.chargeDate }}</span>
                                                    </p>
                                                    <p v-if="charge.description" class="mt-0.5 text-xs text-muted-foreground">{{ charge.description }}</p>
                                                </div>
                                                <p class="text-sm font-semibold tabular-nums">{{ formatMoney(charge.chargeAmount, selectedAccount.currencyCode) }}</p>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="payments" class="m-0 flex min-h-0 flex-1 flex-col overflow-auto p-4">
                                    <div v-if="accountDetailLoading" class="space-y-3">
                                        <RegistryListSkeleton :count="3" />
                                    </div>
                                    <div v-else-if="accountPayments.length === 0" class="py-4">
                                        <InventoryEmptyState icon="banknote" title="No payments yet" description="No payments have been recorded on this account." compact />
                                    </div>
                                    <div v-else class="space-y-2">
                                        <div v-for="payment in accountPayments" :key="payment.id" class="rounded-lg border p-3">
                                            <div class="flex items-start justify-between gap-2">
                                                <div>
                                                    <p class="text-sm font-medium">{{ formatEnumLabel(payment.paymentMethod || '') }}</p>
                                                    <p class="mt-0.5 text-xs text-muted-foreground">
                                                        {{ payment.paidAt }}
                                                        <span v-if="payment.receiptNumber"> · Receipt {{ payment.receiptNumber }}</span>
                                                    </p>
                                                    <p v-if="payment.refundedAmount" class="mt-0.5 text-xs text-destructive">
                                                        Refunded {{ formatMoney(payment.refundedAmount, selectedAccount.currencyCode) }}
                                                        <span v-if="payment.refundReason"> — {{ payment.refundReason }}</span>
                                                    </p>
                                                </div>
                                                <div class="text-right">
                                                    <p class="text-sm font-semibold tabular-nums">{{ formatMoney(payment.amountPaid, selectedAccount.currencyCode) }}</p>
                                                    <Button
                                                        v-if="canManage && !payment.refundedAmount"
                                                        variant="ghost"
                                                        size="sm"
                                                        class="mt-1 h-6 px-2 text-[11px] text-destructive"
                                                        @click="openRefundDialog(payment)"
                                                    >
                                                        Refund
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>
            </Tabs>
        </div>

        <!-- New cash account sheet -->
        <Sheet v-model:open="newAccountSheetOpen">
            <SheetContent side="right" variant="form" size="xl">
                <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                    <SheetTitle>New cash account</SheetTitle>
                    <SheetDescription>Open a walk-in patient cash account.</SheetDescription>
                </SheetHeader>
                <div class="flex-1 space-y-4 overflow-y-auto p-4">
                    <PatientLookupField v-model="newAccountPatientId" input-id="ca-patient" label="Patient" required />
                    <div>
                        <Label for="ca-currency">Currency code</Label>
                        <Input id="ca-currency" v-model="newAccountCurrency" class="mt-1" maxlength="3" placeholder="TZS" />
                    </div>
                    <div>
                        <Label for="ca-notes">Notes (optional)</Label>
                        <Textarea id="ca-notes" v-model="newAccountNotes" class="mt-1" rows="3" />
                    </div>
                </div>
                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <Button variant="outline" @click="newAccountSheetOpen = false">Cancel</Button>
                    <Button :disabled="!newAccountPatientId.trim() || newAccountSaving" @click="createAccount">
                        {{ newAccountSaving ? 'Creating…' : 'Create account' }}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- Record charge sheet -->
        <Sheet v-model:open="chargeSheetOpen">
            <SheetContent side="right" variant="form" size="xl">
                <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                    <SheetTitle>Record charge</SheetTitle>
                    <SheetDescription>{{ selectedAccount?.patient.displayName }}</SheetDescription>
                </SheetHeader>
                <div class="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                        <Label for="chg-service">Service name</Label>
                        <Input id="chg-service" v-model="chargeServiceName" class="mt-1" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <Label for="chg-qty">Quantity</Label>
                            <Input id="chg-qty" v-model.number="chargeQuantity" type="number" min="1" class="mt-1" />
                        </div>
                        <div>
                            <Label for="chg-price">Unit price</Label>
                            <Input id="chg-price" v-model.number="chargeUnitPrice" type="number" min="0" step="0.01" class="mt-1" />
                        </div>
                    </div>
                    <div>
                        <Label for="chg-desc">Description (optional)</Label>
                        <Textarea id="chg-desc" v-model="chargeDescription" class="mt-1" rows="2" />
                    </div>
                </div>
                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <Button variant="outline" @click="chargeSheetOpen = false">Cancel</Button>
                    <Button :disabled="!chargeServiceName.trim() || chargeUnitPrice <= 0 || chargeSaving" @click="recordCharge">
                        {{ chargeSaving ? 'Recording…' : 'Record charge' }}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- Record payment sheet -->
        <Sheet v-model:open="paymentSheetOpen">
            <SheetContent side="right" variant="form" size="xl">
                <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                    <SheetTitle>Record payment</SheetTitle>
                    <SheetDescription>{{ selectedAccount?.patient.displayName }} — Balance: {{ formatMoney(selectedAccount?.accountBalance ?? 0, selectedAccount?.currencyCode) }}</SheetDescription>
                </SheetHeader>
                <div class="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                        <Label for="pay-amount">Amount</Label>
                        <Input id="pay-amount" v-model.number="paymentAmount" type="number" min="0.01" step="0.01" class="mt-1" />
                    </div>
                    <div>
                        <Label for="pay-method">Payment method</Label>
                        <Select v-model="paymentMethod">
                            <SelectTrigger id="pay-method" class="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                <SelectItem value="lipa_namba">Lipa Namba</SelectItem>
                                <SelectItem value="check">Check</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label for="pay-reference">Reference (optional)</Label>
                        <Input id="pay-reference" v-model="paymentReference" class="mt-1" placeholder="Receipt number, transaction ID..." />
                    </div>
                </div>
                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <Button variant="outline" @click="paymentSheetOpen = false">Cancel</Button>
                    <Button :disabled="paymentAmount <= 0 || paymentSaving" @click="recordPayment">
                        {{ paymentSaving ? 'Recording…' : 'Record payment' }}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- Convert to invoice confirm dialog -->
        <Dialog v-model:open="convertDialogOpen">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Convert to invoice</DialogTitle>
                    <DialogDescription>
                        This archives the cash account and moves its balance to a billing invoice. The account cannot be modified afterward. This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" @click="convertDialogOpen = false">Cancel</Button>
                    <Button :disabled="convertSaving" @click="confirmConvertToInvoice">
                        {{ convertSaving ? 'Converting…' : 'Convert to invoice' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Void account confirm dialog -->
        <Dialog v-model:open="voidDialogOpen">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Void account</DialogTitle>
                    <DialogDescription>This voids the account. This cannot be undone.</DialogDescription>
                </DialogHeader>
                <div class="space-y-2">
                    <Label for="void-reason">Reason (required)</Label>
                    <Textarea id="void-reason" v-model="voidReason" rows="3" placeholder="Why is this account being voided?" />
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="voidDialogOpen = false">Cancel</Button>
                    <Button variant="destructive" :disabled="voidReason.trim() === '' || voidSaving" @click="confirmVoidAccount">
                        {{ voidSaving ? 'Voiding…' : 'Void account' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Refund payment dialog -->
        <Dialog v-model:open="refundDialogOpen">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Refund payment</DialogTitle>
                    <DialogDescription>
                        Refunding {{ formatEnumLabel(refundTargetPayment?.paymentMethod || '') }} payment of {{ formatMoney(refundTargetPayment?.amountPaid ?? 0, selectedAccount?.currencyCode) }}.
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-4">
                    <div>
                        <Label for="refund-amount">Refund amount</Label>
                        <Input id="refund-amount" v-model.number="refundAmount" type="number" min="0.01" step="0.01" class="mt-1" />
                    </div>
                    <div>
                        <Label for="refund-reason">Reason (required)</Label>
                        <Textarea id="refund-reason" v-model="refundReason" rows="3" placeholder="Why is this payment being refunded?" class="mt-1" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="refundDialogOpen = false">Cancel</Button>
                    <Button variant="destructive" :disabled="refundAmount <= 0 || refundReason.trim() === '' || refundSaving" @click="confirmRefundPayment">
                        {{ refundSaving ? 'Refunding…' : 'Refund payment' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
