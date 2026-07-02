<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import BillingModuleNav from '@/pages/billing/components/BillingModuleNav.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Invoices', href: '/billing-invoices' },
    { title: 'Write-offs', href: '/billing-write-offs' },
];

const invoiceId = ref('');
const amount = ref<number | null>(null);
const reason = ref('');
const notes = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

async function submit() {
    if (!invoiceId.value.trim() || !amount.value || !reason.value.trim()) return;

    submitting.value = true;
    error.value = null;

    try {
        await apiRequestJson('/api/v1/write-offs', {
            method: 'POST',
            body: JSON.stringify({
                invoiceId: invoiceId.value.trim(),
                amount: amount.value,
                reason: reason.value.trim(),
                notes: notes.value.trim() || null,
            }),
        });
        notifySuccess('Write-off request submitted.');
        invoiceId.value = '';
        amount.value = null;
        reason.value = '';
        notes.value = '';
    } catch (err) {
        error.value = messageFromUnknown(err, 'Unable to submit write-off request.');
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Head title="Write-offs" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                            <AppIcon name="trash-2" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Write-offs</h1>
                            <p class="text-xs text-muted-foreground">Create a bad debt write-off request against an invoice.</p>
                        </div>
                    </div>
                </div>
            </section>

            <BillingModuleNav />

            <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                <CardHeader>
                    <CardTitle>New write-off</CardTitle>
                    <CardDescription>Submit an uncollectible balance for write-off approval.</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {{ error }}
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-2">
                            <Label for="wo-invoice">Invoice ID</Label>
                            <Input id="wo-invoice" v-model="invoiceId" placeholder="Enter invoice ID" />
                        </div>
                        <div class="space-y-2">
                            <Label for="wo-amount">Amount</Label>
                            <Input id="wo-amount" v-model.number="amount" type="number" placeholder="0.00" min="0" step="0.01" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="wo-reason">Reason</Label>
                        <Input id="wo-reason" v-model="reason" placeholder="e.g. Patient deceased, disputed charges" />
                    </div>

                    <div class="space-y-2">
                        <Label for="wo-notes">Notes</Label>
                        <Textarea id="wo-notes" v-model="notes" placeholder="Additional context for the finance team..." rows="3" />
                    </div>

                    <Button class="w-full sm:w-auto" :disabled="submitting" @click="submit">
                        <AppIcon name="plus" class="size-3.5" />
                        {{ submitting ? 'Submitting...' : 'Submit write-off request' }}
                    </Button>
                </CardContent>
            </Card>
        </div>
    </AppLayout>
</template>
