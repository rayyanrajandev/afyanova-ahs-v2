<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { type BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
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
import { Textarea } from '@/components/ui/textarea';
import BillingModuleNav from '@/pages/billing/components/BillingModuleNav.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Write-Offs & Bad Debt', href: '/billing-write-offs' },
];

const showCreateDialog = ref(false);
const invoiceId = ref('');
const patientIdValue = ref('');
const amount = ref(0);
const reason = ref('');
const notes = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

async function submitWriteOff() {
    if (!invoiceId.value || !patientIdValue.value || !amount.value || !reason.value) return;
    submitting.value = true;
    error.value = null;
    try {
        await apiRequestJson('/api/v1/write-offs', {
            method: 'POST',
            body: JSON.stringify({
                billing_invoice_id: invoiceId.value,
                patient_id: patientIdValue.value,
                amount: amount.value,
                reason: reason.value,
                notes: notes.value,
            }),
        });
        notifySuccess('Write-off created successfully.');
        showCreateDialog.value = false;
        invoiceId.value = '';
        patientIdValue.value = '';
        amount.value = 0;
        reason.value = '';
        notes.value = '';
    } catch (e: any) {
        error.value = e?.payload?.message || messageFromUnknown(e);
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <AppLayout :breadcrumbs="breadcrumbs">
        <Head title="Write-Offs & Bad Debt" />
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">

            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                            <AppIcon name="trash-2" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Write-Offs &amp; Bad Debt</h1>
                            <p class="text-xs text-muted-foreground">Uncollectible balance write-off approvals</p>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button @click="showCreateDialog = true">
                            <AppIcon name="plus" class="size-4" />
                            New Write-Off
                        </Button>
                    </div>
                </div>
            </section>

            <BillingModuleNav />

            <Card>
                <CardContent>
                    <div class="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                        <AppIcon name="file-text" class="size-10 opacity-40" />
                        <p>Click <strong>New Write-Off</strong> to create a write-off request for an uncollectible balance.</p>
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
                            <Input v-model="patientIdValue" placeholder="patient_id" />
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
                        <Button :disabled="submitting || !invoiceId || !patientIdValue || !amount || !reason" @click="submitWriteOff">
                            {{ submitting ? 'Submitting...' : 'Submit' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
