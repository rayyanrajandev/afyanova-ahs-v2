<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { type BreadcrumbItem } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import BillingOperationTabs from '@/pages/billing-invoices/components/BillingOperationTabs.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';

type Invoice = {
    id: string;
    invoiceNumber: string | null;
    patientName: string | null;
    totalAmount: number | null;
    balanceAmount: number | null;
    currencyCode: string | null;
    status: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Invoice Adjustments', href: '/billing-adjustments' },
];

const showCreateDialog = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const invoiceSearchQuery = ref('');
const invoiceSearchResults = ref<Invoice[]>([]);
const searchingInvoice = ref(false);

const adjustmentType = ref('credit');
const adjustmentAmount = ref(0);
const adjustmentReason = ref('');
const selectedInvoice = ref<Invoice | null>(null);

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const canSubmit = computed(() =>
    selectedInvoice.value &&
    Number(adjustmentAmount.value) > 0 &&
    adjustmentReason.value.trim().length > 0,
);

async function searchInvoices() {
    const q = invoiceSearchQuery.value.trim();
    if (!q) {
        invoiceSearchResults.value = [];
        return;
    }
    searchingInvoice.value = true;
    try {
        const params = new URLSearchParams();
        params.set('query', q);
        params.set('perPage', '10');
        const res = await apiRequestJson(`/api/v1/billing-invoices?${params.toString()}`);
        invoiceSearchResults.value = res.data ?? [];
    } catch {
        invoiceSearchResults.value = [];
    } finally {
        searchingInvoice.value = false;
    }
}

function onSearchInput() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(searchInvoices, 300);
}

function selectInvoice(inv: Invoice) {
    selectedInvoice.value = inv;
}

function clearSelection() {
    selectedInvoice.value = null;
    invoiceSearchQuery.value = '';
    invoiceSearchResults.value = [];
}

function openCreateDialog() {
    clearSelection();
    adjustmentType.value = 'credit';
    adjustmentAmount.value = 0;
    adjustmentReason.value = '';
    error.value = null;
    success.value = null;
    showCreateDialog.value = true;
}

async function submitAdjustment() {
    if (!selectedInvoice.value?.id || !canSubmit.value) return;
    submitting.value = true;
    error.value = null;
    success.value = null;
    try {
        await apiRequestJson(`/api/v1/invoices/${selectedInvoice.value.id}/adjustments`, {
            method: 'POST',
            body: JSON.stringify({
                type: adjustmentType.value,
                amount: adjustmentAmount.value,
                reason: adjustmentReason.value,
            }),
        });
        notifySuccess('Adjustment added successfully.');
        showCreateDialog.value = false;
        clearSelection();
    } catch (e: any) {
        error.value = e?.payload?.message || messageFromUnknown(e, 'Failed to add adjustment.');
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <AppLayout :breadcrumbs="breadcrumbs">
        <Head title="Invoice Adjustments" />
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">

            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                            <AppIcon name="receipt" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Invoice Adjustments</h1>
                            <p class="text-xs text-muted-foreground">Credit notes, debit notes, and balance corrections</p>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button @click="openCreateDialog">
                            <AppIcon name="plus" class="size-4" />
                            New Adjustment
                        </Button>
                    </div>
                </div>
            </section>

            <BillingOperationTabs />

            <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</div>

            <Card>
                <CardHeader>
                    <CardTitle>Invoice Adjustments</CardTitle>
                    <CardDescription>Create a credit or debit note against an invoice</CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                        <AppIcon name="receipt" class="size-10 opacity-40" />
                        <p>Click <strong>New Adjustment</strong> to search for an invoice and add a credit or debit note.</p>
                    </div>
                </CardContent>
            </Card>

            <Dialog v-model:open="showCreateDialog">
                <DialogContent class="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Adjustment</DialogTitle>
                        <DialogDescription>
                            {{ selectedInvoice ? `Invoice: ${selectedInvoice.invoiceNumber}` : 'Search for an invoice to adjust' }}
                        </DialogDescription>
                    </DialogHeader>

                    <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</div>

                    <div class="space-y-4">
                        <!-- Invoice search -->
                        <div v-if="!selectedInvoice" class="space-y-2">
                            <Label>Search invoice</Label>
                            <Input v-model="invoiceSearchQuery" placeholder="Invoice number or patient name..." @input="onSearchInput" />
                            <div v-if="searchingInvoice" class="text-sm text-muted-foreground">Searching...</div>
                            <div v-else-if="invoiceSearchResults.length > 0" class="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-1">
                                <button
                                    v-for="inv in invoiceSearchResults"
                                    :key="inv.id"
                                    class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                                    @click="selectInvoice(inv)"
                                >
                                    <div>
                                        <span class="font-medium">{{ inv.invoiceNumber }}</span>
                                        <span class="ml-2 text-muted-foreground">{{ inv.patientName }}</span>
                                    </div>
                                    <span class="text-xs text-muted-foreground">
                                        Balance: {{ inv.balanceAmount }} {{ inv.currencyCode }}
                                    </span>
                                </button>
                            </div>
                            <div v-else-if="invoiceSearchQuery.trim() && !searchingInvoice" class="text-sm text-muted-foreground">No invoices found.</div>
                        </div>

                        <!-- Selected invoice -->
                        <div v-else class="rounded-lg border bg-muted/20 p-3">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium">{{ selectedInvoice.invoiceNumber }}</p>
                                    <p class="text-xs text-muted-foreground">{{ selectedInvoice.patientName }}</p>
                                </div>
                                <div class="text-right text-sm">
                                    <div class="text-muted-foreground">Balance</div>
                                    <div class="font-semibold">{{ selectedInvoice.balanceAmount }} {{ selectedInvoice.currencyCode }}</div>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" class="mt-2 h-6 text-xs" @click="clearSelection">Change invoice</Button>
                        </div>

                        <!-- Adjustment form -->
                        <div v-if="selectedInvoice" class="space-y-4">
                            <div class="space-y-2">
                                <Label>Type</Label>
                                <Select v-model="adjustmentType">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="credit">Credit Note &mdash; Reduce Balance</SelectItem>
                                        <SelectItem value="debit">Debit Note &mdash; Increase Balance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="space-y-2">
                                <Label>Amount</Label>
                                <Input v-model.number="adjustmentAmount" type="number" step="0.01" min="0.01" placeholder="0.00" />
                            </div>
                            <div class="space-y-2">
                                <Label>Reason</Label>
                                <Textarea v-model="adjustmentReason" placeholder="Reason for this adjustment" />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" @click="showCreateDialog = false">Cancel</Button>
                        <Button :disabled="submitting || !canSubmit" @click="submitAdjustment">
                            {{ submitting ? 'Submitting...' : 'Submit Adjustment' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
