<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted, ref, watch } from 'vue';
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
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

type Invoice = {
    id: string;
    invoiceNumber: string | null;
    patientId: string | null;
    patientName: string | null;
    totalAmount: number | null;
    balanceAmount: number | null;
    currencyCode: string | null;
    status: string | null;
};

const invoices = ref<Invoice[]>([]);
const loading = ref(false);
const showDialog = ref(false);
const selectedInvoice = ref<Invoice | null>(null);
const adjustmentType = ref('credit');
const adjustmentAmount = ref(0);
const adjustmentReason = ref('');
const submitting = ref(false);
const searchQuery = ref('');
const error = ref<string | null>(null);
const success = ref<string | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchInvoices() {
    loading.value = true;
    error.value = null;
    try {
        const params = new URLSearchParams();
        if (searchQuery.value) params.set('query', searchQuery.value);
        params.set('perPage', '20');
        const res = await apiRequestJson(`/api/v1/billing-invoices?${params.toString()}`);
        invoices.value = res.data ?? [];
    } catch (e) {
        error.value = 'Failed to load invoices.';
    } finally {
        loading.value = false;
    }
}

function onSearchInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchInvoices, 300);
}

async function submitAdjustment() {
    if (!selectedInvoice.value?.id || !adjustmentAmount.value || !adjustmentReason.value) return;
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
        showDialog.value = false;
        resetForm();
        await fetchInvoices();
    } catch (e: any) {
        error.value = e?.payload?.message || messageFromUnknown(e);
    } finally {
        submitting.value = false;
    }
}

function resetForm() {
    selectedInvoice.value = null;
    adjustmentType.value = 'credit';
    adjustmentAmount.value = 0;
    adjustmentReason.value = '';
}

function openDialog(inv: Invoice) {
    selectedInvoice.value = inv;
    showDialog.value = true;
}

watch(adjustmentAmount, () => {
    error.value = null;
});

onMounted(fetchInvoices);
</script>

<template>
    <AppLayout>
        <Head title="Invoice Adjustments" />
        <div class="px-6 pt-2">
            <BillingOperationTabs />
        </div>
        <div class="space-y-6 p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">Invoice Adjustments</h1>
                    <p class="text-muted-foreground text-sm">Credit notes, debit notes, and balance corrections</p>
                </div>
            </div>

            <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</div>

            <div class="flex items-center gap-4">
                <Input v-model="searchQuery" placeholder="Search by invoice number or patient..." class="max-w-sm" @input="onSearchInput" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>Select an invoice to add a credit or debit adjustment</CardDescription>
                </CardHeader>
                <CardContent>
                    <div v-if="loading" class="text-muted-foreground py-8 text-center">Loading...</div>
                    <div v-else-if="invoices.length === 0" class="text-muted-foreground py-8 text-center">No invoices found</div>
                    <div v-else class="space-y-2">
                        <div v-for="inv in invoices" :key="inv.id" class="flex items-center justify-between rounded-lg border p-4">
                            <div class="space-y-1">
                                <div class="font-medium">{{ inv.invoiceNumber }}</div>
                                <div class="text-muted-foreground text-sm">{{ inv.patientName || inv.patientId }}</div>
                                <div class="text-muted-foreground text-sm">
                                    Total: {{ inv.totalAmount }} {{ inv.currencyCode }}
                                    <span class="ml-2">Balance: <span class="font-semibold">{{ inv.balanceAmount }}</span></span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <Badge :variant="inv.status === 'paid' ? 'success' : inv.status === 'draft' ? 'secondary' : 'default'">
                                    {{ inv.status }}
                                </Badge>
                                <Button size="sm" @click="openDialog(inv)">Add Adjustment</Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog v-model:open="showDialog">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Adjustment</DialogTitle>
                        <DialogDescription>
                            Invoice: {{ selectedInvoice?.invoiceNumber }} &mdash; Balance: {{ selectedInvoice?.balanceAmount }} {{ selectedInvoice?.currencyCode }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="space-y-4">
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
                            <Input v-model.number="adjustmentAmount" type="number" step="0.01" min="0.01" />
                        </div>
                        <div class="space-y-2">
                            <Label>Reason</Label>
                            <Textarea v-model="adjustmentReason" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="showDialog = false">Cancel</Button>
                        <Button :disabled="submitting || !adjustmentAmount || !adjustmentReason" @click="submitAdjustment">
                            {{ submitting ? 'Submitting...' : 'Submit' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
