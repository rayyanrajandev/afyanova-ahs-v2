<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted, ref } from 'vue';
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

const writeOffs = ref<any[]>([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const invoiceId = ref('');
const patientId = ref('');
const amount = ref(0);
const reason = ref('');
const notes = ref('');
const submitting = ref(false);
const statusFilter = ref('all');
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const statusColors: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'destructive',
    processed: 'default',
};

async function fetchWriteOffs() {
    loading.value = true;
    error.value = null;
    try {
        const params = new URLSearchParams();
        if (statusFilter.value !== 'all') params.set('status', statusFilter.value);
        params.set('perPage', '20');
        const res = await apiRequestJson(`/api/v1/write-offs?${params.toString()}`);
        writeOffs.value = res.data ?? [];
    } catch (e) {
        error.value = 'Failed to load write-offs.';
    } finally {
        loading.value = false;
    }
}

async function submitWriteOff() {
    if (!invoiceId.value || !patientId.value || !amount.value || !reason.value) return;
    submitting.value = true;
    error.value = null;
    success.value = null;
    try {
        await apiRequestJson('/api/v1/write-offs', {
            method: 'POST',
            body: JSON.stringify({
                billing_invoice_id: invoiceId.value,
                patient_id: patientId.value,
                amount: amount.value,
                reason: reason.value,
                notes: notes.value,
            }),
        });
        success.value = 'Write-off created successfully.';
        showCreateDialog.value = false;
        invoiceId.value = '';
        patientId.value = '';
        amount.value = 0;
        reason.value = '';
        notes.value = '';
        await fetchWriteOffs();
    } catch (e: any) {
        error.value = e?.payload?.message || 'Failed to create write-off.';
    } finally {
        submitting.value = false;
    }
}

async function approveWriteOff(id: string, newStatus: string) {
    error.value = null;
    success.value = null;
    try {
        await apiRequestJson(`/api/v1/write-offs/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ status: newStatus }),
        });
        success.value = `Write-off ${newStatus}.`;
        await fetchWriteOffs();
    } catch (e: any) {
        error.value = e?.payload?.message || 'Failed to update write-off.';
    }
}

onMounted(fetchWriteOffs);
</script>

<template>
    <AppLayout>
        <Head title="Write-Offs & Bad Debt" />
        <div class="px-6 pt-2">
            <BillingOperationTabs />
        </div>
        <div class="space-y-6 p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">Write-Offs & Bad Debt</h1>
                    <p class="text-muted-foreground text-sm">Uncollectible balance write-off approvals</p>
                </div>
                <Button @click="showCreateDialog = true">New Write-Off</Button>
            </div>

            <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</div>
            <div v-if="success" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{{ success }}</div>

            <div class="flex items-center gap-4">
                <Select v-model="statusFilter" @update:model-value="fetchWriteOffs">
                    <SelectTrigger class="w-40">
                        <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="processed">Processed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Write-Offs</CardTitle>
                    <CardDescription>Manage bad debt write-off requests</CardDescription>
                </CardHeader>
                <CardContent>
                    <div v-if="loading" class="text-muted-foreground py-8 text-center">Loading...</div>
                    <div v-else-if="writeOffs.length === 0" class="text-muted-foreground py-8 text-center">No write-offs found</div>
                    <div v-else class="space-y-2">
                        <div v-for="wo in writeOffs" :key="wo.id" class="flex items-center justify-between rounded-lg border p-4">
                            <div class="space-y-1">
                                <div class="font-medium">Invoice: {{ wo.billingInvoiceId }}</div>
                                <div class="text-muted-foreground text-sm">Patient: {{ wo.patientId }}</div>
                                <div class="text-sm">Amount: <span class="font-semibold">{{ wo.amount }}</span></div>
                                <div class="text-muted-foreground text-sm">Reason: {{ wo.reason }}</div>
                            </div>
                            <div class="flex items-center gap-2">
                                <Badge :variant="statusColors[wo.status] || 'default'">{{ wo.status }}</Badge>
                                <Button v-if="wo.status === 'pending'" size="sm" variant="outline" @click="approveWriteOff(wo.id, 'approved')">Approve</Button>
                                <Button v-if="wo.status === 'pending'" size="sm" variant="destructive" @click="approveWriteOff(wo.id, 'rejected')">Reject</Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog v-model:open="showCreateDialog">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Write-Off</DialogTitle>
                        <DialogDescription>Create a bad debt write-off request</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <Label>Invoice ID</Label>
                            <Input v-model="invoiceId" placeholder="billing_invoice_id" />
                        </div>
                        <div class="space-y-2">
                            <Label>Patient ID</Label>
                            <Input v-model="patientId" placeholder="patient_id" />
                        </div>
                        <div class="space-y-2">
                            <Label>Amount</Label>
                            <Input v-model.number="amount" type="number" step="0.01" min="0.01" />
                        </div>
                        <div class="space-y-2">
                            <Label>Reason</Label>
                            <Textarea v-model="reason" />
                        </div>
                        <div class="space-y-2">
                            <Label>Notes (optional)</Label>
                            <Textarea v-model="notes" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="showCreateDialog = false">Cancel</Button>
                        <Button :disabled="submitting || !invoiceId || !patientId || !amount || !reason" @click="submitWriteOff">
                            {{ submitting ? 'Submitting...' : 'Submit' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
