<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import PosFilterBar from '@/components/pos/PosFilterBar.vue';
import PosFilterField from '@/components/pos/PosFilterField.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders, refreshCsrfToken } from '@/lib/csrf';
import { type AppIconName } from '@/lib/icons';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/dashboard' },
    { label: 'POS', href: '/pos' },
    { label: 'Frontdesk Quick', href: '/pos/frontdesk-quick' },
];

type SourceKind = 'laboratory_order' | 'pharmacy_prescription' | 'radiology_order' | 'procedure';

type FrontdeskCandidate = {
    id: string;
    sourceKind: SourceKind | null;
    orderNumber: string | null;
    patientId: string | null;
    patientNumber: string | null;
    patientName: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    unit: string | null;
    sourceStatus: string | null;
    orderedAt: string | null;
    performedAt: string | null;
    currencyCode: string | null;
    unitPrice: string | number | null;
    lineTotal: string | number | null;
    pricingStatus: string | null;
    alreadyInvoiced: boolean;
    alreadySettled: boolean;
};

type BasketItem = {
    clientId: string;
    orderId: string;
    sourceKind: SourceKind;
    orderNumber: string | null;
    patientId: string;
    patientNumber: string | null;
    patientName: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    lineTotal: number;
    currencyCode: string | null;
    note: string | null;
};

type PaymentEntry = {
    clientId: string;
    paymentMethod: string;
    amount: string;
    paymentReference: string;
    note: string;
};

type PosSale = {
    id: string;
    saleNumber: string | null;
    receiptNumber: string | null;
    totalAmount: string | number | null;
    currencyCode: string | null;
    status: string | null;
    saleChannel: string | null;
    soldAt: string | null;
    lineItems?: Array<unknown>;
    payments?: Array<unknown>;
};

type PatientLookupSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone?: string | null;
};

const SOURCE_KIND_LABELS: Record<SourceKind, { label: string; icon: AppIconName }> = {
    laboratory_order: { label: 'Lab Tests', icon: 'flask-conical' },
    pharmacy_prescription: { label: 'Pharmacy', icon: 'pill' },
    radiology_order: { label: 'Radiology', icon: 'scan-line' },
    procedure: { label: 'Procedures', icon: 'syringe' },
};

const loading = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const latestSaleId = ref<string | null>(null);

const selectedPatient = ref<PatientLookupSummary | null>(null);
const candidates = ref<FrontdeskCandidate[]>([]);
const activeKindFilter = ref<SourceKind | 'all'>('all');
const searchQuery = ref('');
const basketPatient = ref<PatientLookupSummary | null>(null);
const basketItems = ref<BasketItem[]>([]);
const basketNote = ref('');
const createInvoice = ref(false);
const payments = ref<PaymentEntry[]>([createPaymentEntry()]);

const filteredCandidates = computed(() => {
    const items = candidates.value.filter((c) => {
        if (activeKindFilter.value !== 'all' && c.sourceKind !== activeKindFilter.value) return false;
        if (searchQuery.value.trim()) {
            const q = searchQuery.value.toLowerCase();
            const nameMatch = c.patientName?.toLowerCase().includes(q);
            const orderMatch = c.orderNumber?.toLowerCase().includes(q);
            const serviceMatch = c.serviceName?.toLowerCase().includes(q);
            const numberMatch = c.patientNumber?.toLowerCase().includes(q);
            if (!nameMatch && !orderMatch && !serviceMatch && !numberMatch) return false;
        }
        return true;
    });
    return items;
});

const availableKinds = computed(() => {
    const kinds = new Set(candidates.value.map((c) => c.sourceKind).filter((k): k is SourceKind => k !== null));
    return Array.from(kinds);
});

const basketTotal = computed(() =>
    basketItems.value.reduce((sum, item) => sum + item.lineTotal, 0),
);

const basketCurrency = computed(() =>
    basketItems.value.length > 0 ? basketItems.value[0].currencyCode || 'TZS' : 'TZS',
);

async function loadCandidates(): Promise<void> {
    if (!selectedPatient.value) return;
    loading.value = true;
    error.value = null;
    try {
        const response = await apiRequest<{ data: FrontdeskCandidate[]; meta: { total: number } }>('GET', '/pos/frontdesk-quick/candidates', {
            query: { patientId: selectedPatient.value.id },
        });
        candidates.value = response.data;
    } catch (err) {
        error.value = messageFromError(err, 'Failed to load pending orders.');
    } finally {
        loading.value = false;
    }
}

function addToBasket(candidate: FrontdeskCandidate): void {
    if (!candidate.patientId) return;
    const isFirst = basketItems.value.length === 0;
    if (isFirst) {
        basketPatient.value = {
            id: candidate.patientId,
            patientNumber: candidate.patientNumber,
            firstName: candidate.patientName?.split(' ').slice(0, -1).join(' ') || candidate.patientName || null,
            lastName: candidate.patientName?.split(' ').slice(-1)[0] || null,
            middleName: null,
        };
    }
    if (basketPatient.value?.id !== candidate.patientId) {
        error.value = 'All items must belong to the same patient. Clear the basket to switch patients.';
        return;
    }
    const kind = candidate.sourceKind;
    if (!kind) return;
    const exists = basketItems.value.some((item) => item.orderId === candidate.id && item.sourceKind === kind);
    if (exists) return;
    basketItems.value.push({
        clientId: `${candidate.id}-${Date.now()}`,
        orderId: candidate.id,
        sourceKind: kind,
        orderNumber: candidate.orderNumber,
        patientId: candidate.patientId,
        patientNumber: candidate.patientNumber,
        patientName: candidate.patientName,
        serviceCode: candidate.serviceCode,
        serviceName: candidate.serviceName,
        lineTotal: Number(candidate.lineTotal ?? candidate.unitPrice ?? 0),
        currencyCode: candidate.currencyCode,
        note: null,
    });
}

function removeFromBasket(clientId: string): void {
    basketItems.value = basketItems.value.filter((item) => item.clientId !== clientId);
    if (basketItems.value.length === 0) {
        basketPatient.value = null;
    }
}

function clearBasket(): void {
    basketItems.value = [];
    basketPatient.value = null;
    basketNote.value = '';
    createInvoice.value = false;
    payments.value = [createPaymentEntry()];
}

function onPatientSelected(patient: PatientLookupSummary): void {
    selectedPatient.value = patient;
    candidates.value = [];
    activeKindFilter.value = 'all';
    searchQuery.value = '';
    clearBasket();
    loadCandidates();
}

function createPaymentEntry(method = 'cash', amount = ''): PaymentEntry {
    return {
        clientId: `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        paymentMethod: method,
        amount,
        paymentReference: '',
        note: '',
    };
}

function addPaymentEntry(): void {
    payments.value = [...payments.value, createPaymentEntry()];
}

function removePaymentEntry(clientId: string): void {
    if (payments.value.length === 1) {
        payments.value = [createPaymentEntry()];
        return;
    }
    payments.value = payments.value.filter((p) => p.clientId !== clientId);
}

function normalizePayments(entries: PaymentEntry[]): Array<{ paymentMethod: string; amount: number; paymentReference: string | null; paidAt: string | null; note: string | null }> | null {
    const total = basketTotal.value;
    if (total <= 0) {
        error.value = 'Basket is empty. Add items before checkout.';
        return null;
    }
    if (entries.length === 0) {
        error.value = 'Add at least one payment entry.';
        return null;
    }
    const normalized = entries.map((entry, index) => {
        const amount = Number(entry.amount || 0);
        if (!entry.paymentMethod) {
            error.value = `Select a payment method for payment ${index + 1}.`;
            return null;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            error.value = `Enter a valid amount for payment ${index + 1}.`;
            return null;
        }
        return {
            paymentMethod: entry.paymentMethod,
            amount: roundMoney(amount),
            paymentReference: entry.paymentReference.trim() || null,
            paidAt: new Date().toISOString().replace(/\.\d{3}/, '').replace('T', ' ').slice(0, 19),
            note: entry.note.trim() || null,
        };
    });
    if (normalized.some((e) => e === null)) return null;
    const payments = normalized.filter((e): e is NonNullable<typeof e> => e !== null);
    const totalEntered = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));
    const nonCashTotal = roundMoney(payments.reduce((sum, p) => sum + (p.paymentMethod === 'cash' ? 0 : p.amount), 0));
    const cashTotal = roundMoney(totalEntered - nonCashTotal);
    if (totalEntered + 0.001 < total) {
        error.value = 'Payments do not cover the total.';
        return null;
    }
    if (nonCashTotal > total + 0.001) {
        error.value = 'Non-cash payments cannot exceed the total.';
        return null;
    }
    if (totalEntered > total + 0.001 && cashTotal <= 0) {
        error.value = 'Only cash can exceed the total for change handling.';
        return null;
    }
    return payments;
}

async function checkout(): Promise<void> {
    error.value = null;
    success.value = null;
    if (basketItems.value.length === 0) {
        error.value = 'Add at least one item to the basket.';
        return;
    }
    const payments = normalizePayments(payments.value);
    if (!payments) return;
    submitting.value = true;
    try {
        const response = await apiRequest<{ data: PosSale }>('POST', '/pos/frontdesk-quick/sales', {
            body: {
                registerId: null,
                currencyCode: basketCurrency.value,
                notes: basketNote.value.trim() || null,
                createInvoice: createInvoice.value,
                items: basketItems.value.map((item) => ({
                    kind: item.sourceKind,
                    orderId: item.orderId,
                    note: item.note,
                })),
                payments,
            },
        });
        latestSaleId.value = response.data.id;
        success.value = [
            response.data.saleNumber || 'Sale recorded',
            response.data.receiptNumber ? `Receipt ${response.data.receiptNumber}` : null,
            createInvoice.value ? 'Invoice created' : null,
        ].filter(Boolean).join(' / ');
        clearBasket();
        await loadCandidates();
    } catch (err) {
        error.value = messageFromError(err, 'Failed to record sale.');
    } finally {
        submitting.value = false;
    }
}

function formatCurrency(amount: string | number | null | undefined, currencyCode = 'TZS'): string {
    const numericAmount = Number(amount ?? 0);
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode || 'TZS', maximumFractionDigits: 2 }).format(numericAmount);
    } catch {
        return `${currencyCode || 'TZS'} ${numericAmount.toFixed(2)}`;
    }
}

function roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function messageFromError(err: unknown, fallback: string): string {
    const error = err as { payload?: { message?: string }; message?: string };
    return error.payload?.message || error.message || fallback;
}

async function apiRequest<T>(method: 'GET' | 'POST', path: string, options: { query?: Record<string, string | number | null | undefined>; body?: Record<string, unknown> } = {}): Promise<T> {
    const headers: Record<string, string> = { ...csrfRequestHeaders(), Accept: 'application/json' };
    const url = new URL(path, window.location.origin);
    if (options.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
        });
    }
    const response = await fetch(url.toString(), {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload.message || `Request failed with status ${response.status}`);
        (error as Record<string, unknown>).payload = payload;
        throw error;
    }
    return response.json();
}

function kindIcon(kind: SourceKind | null): AppIconName {
    if (!kind) return 'receipt';
    return SOURCE_KIND_LABELS[kind]?.icon || 'receipt';
}

function kindLabel(kind: SourceKind | null): string {
    if (!kind) return 'Other';
    return SOURCE_KIND_LABELS[kind]?.label || 'Other';
}

function statusVariant(status: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (status === 'completed' || status === 'dispensed' || status === 'performed') return 'default';
    if (status === 'cancelled') return 'destructive';
    return 'secondary';
}
</script>

<template>
    <Head title="Frontdesk Quick POS" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex flex-col gap-6 p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">Frontdesk Quick POS</h1>
                    <p class="text-sm text-muted-foreground">
                        Collect payment for lab, pharmacy, radiology, and procedure orders at the cashier counter.
                    </p>
                </div>
            </div>

            <div class="grid gap-6 xl:grid-cols-3">
                <!-- Left column: Patient search + pending orders -->
                <div class="space-y-4 xl:col-span-2">
                    <!-- Patient selection -->
                    <Card class="border-sidebar-border/70 rounded-lg">
                        <CardHeader class="pb-3">
                            <CardTitle class="flex items-center gap-2 text-base">
                                <AppIcon name="user" class="size-5 text-sky-600 dark:text-sky-400" />
                                1. Select patient
                            </CardTitle>
                            <CardDescription>
                                Search by patient name, MRN, or phone to see pending orders.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <PatientLookupField
                                @selected="onPatientSelected"
                                :reset-after-select="false"
                                placeholder="Search patient name, MRN, or phone..."
                            />
                        </CardContent>
                    </Card>

                    <!-- Pending orders -->
                    <Card
                        v-if="selectedPatient"
                        class="border-sidebar-border/70 rounded-lg"
                    >
                        <CardHeader class="pb-3">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <CardTitle class="flex items-center gap-2 text-base">
                                        <AppIcon name="clipboard-list" class="size-5 text-sky-600 dark:text-sky-400" />
                                        2. Pending orders
                                    </CardTitle>
                                    <CardDescription>
                                        Select orders to charge for patient
                                        <span class="font-medium">{{ selectedPatient.firstName }} {{ selectedPatient.lastName }}</span>
                                        <span v-if="selectedPatient.patientNumber" class="text-muted-foreground"> ({{ selectedPatient.patientNumber }})</span>.
                                    </CardDescription>
                                </div>
                                <Badge v-if="candidates.length > 0" variant="secondary">{{ candidates.length }} pending</Badge>
                            </div>
                        </CardHeader>
                        <CardContent class="space-y-4 pt-0">
                            <div v-if="loading" class="flex items-center justify-center py-8 text-sm text-muted-foreground">
                                Loading pending orders...
                            </div>
                            <div v-else-if="candidates.length === 0" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                <AppIcon name="inbox" class="mx-auto mb-2 size-8 opacity-50" />
                                No pending orders found for this patient.
                            </div>
                            <template v-else>
                                <PosFilterBar>
                                    <PosFilterField :xl-span="4">
                                        <Label for="fq-search">Search orders</Label>
                                        <Input id="fq-search" v-model="searchQuery" placeholder="Order #, service name, or patient..." />
                                    </PosFilterField>
                                    <PosFilterField :xl-span="3">
                                        <Label for="fq-kind">Type</Label>
                                        <Select v-model="activeKindFilter">
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All types</SelectItem>
                                                <SelectItem v-for="kind in availableKinds" :key="kind" :value="kind">
                                                    {{ kindLabel(kind) }}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </PosFilterField>
                                    <PosFilterField :xl-span="5">
                                        <Label class="text-transparent">Placeholder</Label>
                                        <div class="flex h-10 items-center text-xs text-muted-foreground">
                                            {{ filteredCandidates.length }} order{{ filteredCandidates.length === 1 ? '' : 's' }} shown
                                        </div>
                                    </PosFilterField>
                                </PosFilterBar>

                                <ScrollArea class="max-h-[400px]">
                                    <div class="space-y-2">
                                        <div
                                            v-for="candidate in filteredCandidates"
                                            :key="candidate.id"
                                            class="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                        >
                                            <AppIcon :name="kindIcon(candidate.sourceKind)" class="mt-1 size-4 shrink-0 text-muted-foreground" />
                                            <div class="min-w-0 flex-1">
                                                <div class="flex items-center gap-2">
                                                    <span class="truncate text-sm font-medium">{{ candidate.serviceName || 'Unknown' }}</span>
                                                    <Badge variant="outline" class="shrink-0 text-[10px]">{{ kindLabel(candidate.sourceKind) }}</Badge>
                                                    <Badge v-if="candidate.sourceStatus" :variant="statusVariant(candidate.sourceStatus)" class="shrink-0 text-[10px]">
                                                        {{ candidate.sourceStatus }}
                                                    </Badge>
                                                </div>
                                                <div class="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                                    <span v-if="candidate.orderNumber">#{{ candidate.orderNumber }}</span>
                                                    <span v-if="candidate.orderedAt">Ordered {{ candidate.orderedAt }}</span>
                                                    <span v-if="candidate.unit">Unit: {{ candidate.unit }}</span>
                                                </div>
                                                <div class="mt-1 flex items-center gap-3 text-sm">
                                                    <span class="font-medium">{{ formatCurrency(candidate.lineTotal ?? candidate.unitPrice, candidate.currencyCode ?? 'TZS') }}</span>
                                                    <span v-if="candidate.alreadyInvoiced" class="text-xs text-amber-600 dark:text-amber-400">Already invoiced</span>
                                                    <span v-else-if="candidate.alreadySettled" class="text-xs text-emerald-600 dark:text-emerald-400">Already paid</span>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="shrink-0"
                                                :disabled="candidate.alreadyInvoiced || candidate.alreadySettled"
                                                @click="addToBasket(candidate)"
                                            >
                                                <AppIcon name="plus" class="mr-1 size-3.5" />
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </template>
                        </CardContent>
                    </Card>
                </div>

                <!-- Right column: Basket + Checkout -->
                <div class="space-y-4">
                    <Card class="border-sidebar-border/70 rounded-lg">
                        <CardHeader class="pb-3">
                            <div class="flex items-center justify-between">
                                <CardTitle class="flex items-center gap-2 text-base">
                                    <AppIcon name="shopping-cart" class="size-5" />
                                    3. Charge basket
                                </CardTitle>
                                <Badge v-if="basketItems.length > 0" variant="secondary">{{ basketItems.length }} item{{ basketItems.length === 1 ? '' : 's' }}</Badge>
                            </div>
                            <CardDescription>
                                Review items and take payment.
                            </CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4 pt-0">
                            <div v-if="basketItems.length === 0" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                <AppIcon name="shopping-cart" class="mx-auto mb-2 size-8 opacity-50" />
                                Basket empty. Add orders from the list.
                            </div>
                            <template v-else>
                                <div
                                    v-if="basketPatient"
                                    class="rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm dark:border-sky-900 dark:bg-sky-950/40"
                                >
                                    <p class="font-medium text-sky-950 dark:text-sky-100">
                                        Patient: {{ basketPatient.firstName }} {{ basketPatient.lastName }}
                                    </p>
                                    <p v-if="basketPatient.patientNumber" class="text-xs text-sky-800 dark:text-sky-200">{{ basketPatient.patientNumber }}</p>
                                </div>

                                <ScrollArea class="max-h-[250px]">
                                    <div class="space-y-2">
                                        <div
                                            v-for="item in basketItems"
                                            :key="item.clientId"
                                            class="flex items-start gap-2 rounded-lg border p-2.5"
                                        >
                                            <AppIcon :name="kindIcon(item.sourceKind)" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                            <div class="min-w-0 flex-1">
                                                <p class="truncate text-sm font-medium">{{ item.serviceName || 'Item' }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ kindLabel(item.sourceKind) }}
                                                    <span v-if="item.orderNumber"> · #{{ item.orderNumber }}</span>
                                                </p>
                                                <p class="text-sm font-medium">{{ formatCurrency(item.lineTotal, item.currencyCode ?? 'TZS') }}</p>
                                            </div>
                                            <Button size="icon" variant="ghost" class="size-6 shrink-0" @click="removeFromBasket(item.clientId)">
                                                <AppIcon name="x" class="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </ScrollArea>

                                <Separator />

                                <!-- Totals -->
                                <div class="space-y-1 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-muted-foreground">Total due</span>
                                        <span class="font-semibold">{{ formatCurrency(basketTotal, basketCurrency) }}</span>
                                    </div>
                                </div>

                                <!-- Create invoice toggle -->
                                <div class="flex items-center justify-between rounded-lg border p-3">
                                    <div class="space-y-0.5">
                                        <Label for="create-invoice" class="text-sm font-medium">Create invoice</Label>
                                        <p class="text-xs text-muted-foreground">
                                            Generate a billing invoice for insurance claims.
                                        </p>
                                    </div>
                                    <Switch id="create-invoice" v-model="createInvoice" />
                                </div>

                                <!-- Note -->
                                <div class="space-y-1.5">
                                    <Label for="basket-note">Receipt note (optional)</Label>
                                    <Textarea id="basket-note" v-model="basketNote" rows="2" placeholder="e.g. collected at front desk" />
                                </div>

                                <!-- Payments -->
                                <div class="space-y-2">
                                    <Label class="text-sm font-medium">Payments</Label>
                                    <div
                                        v-for="(payment, index) in payments"
                                        :key="payment.clientId"
                                        class="flex items-start gap-2 rounded-lg border p-2"
                                    >
                                        <div class="flex-1 space-y-2">
                                            <Select v-model="payment.paymentMethod">
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cash">Cash</SelectItem>
                                                    <SelectItem value="card">Card</SelectItem>
                                                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                                    <SelectItem value="check">Check</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                v-model="payment.amount"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="Amount"
                                            />
                                            <Input
                                                v-model="payment.paymentReference"
                                                placeholder="Reference (optional)"
                                            />
                                        </div>
                                        <Button size="icon" variant="ghost" class="size-6 shrink-0" @click="removePaymentEntry(payment.clientId)">
                                            <AppIcon name="x" class="size-3.5" />
                                        </Button>
                                    </div>
                                    <Button size="sm" variant="outline" class="w-full" @click="addPaymentEntry">
                                        <AppIcon name="plus" class="mr-1 size-3.5" />
                                        Add payment
                                    </Button>
                                </div>

                                <Button
                                    class="w-full"
                                    size="lg"
                                    :disabled="submitting || basketItems.length === 0"
                                    @click="checkout"
                                >
                                    <AppIcon name="receipt" class="mr-2 size-4" />
                                    {{ submitting ? 'Processing...' : createInvoice ? 'Charge & Create Invoice' : 'Charge & Print Receipt' }}
                                </Button>
                            </template>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <!-- Error / Success -->
            <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {{ error }}
            </div>
            <div v-if="success" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <div class="flex items-center gap-2">
                    <AppIcon name="check-circle" class="size-4 text-emerald-600" />
                    <span>{{ success }}</span>
                </div>
                <div v-if="latestSaleId" class="mt-2">
                    <Link :href="`/pos/sales/${latestSaleId}/print`" class="text-sm font-medium text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200">
                        <AppIcon name="printer" class="mr-1 inline size-3.5" />
                        Print receipt
                    </Link>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
