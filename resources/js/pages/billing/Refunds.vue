<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import BillingModuleNav from '@/pages/billing/components/BillingModuleNav.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Invoices', href: '/billing-invoices' },
    { title: 'Refunds', href: '/billing-refunds' },
];

interface RefundRecord {
    id: string;
    invoice_id: string;
    invoice_number: string | null;
    amount: number;
    currency_code: string | null;
    reason: string | null;
    status: string;
    created_at: string | null;
}

const refunds = ref<RefundRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref('');
const page = ref(1);
const perPage = ref(25);
const totalPages = ref(1);
const total = ref(0);

const sheetOpen = ref(false);
const newInvoiceId = ref('');
const newAmount = ref<number | null>(null);
const newReason = ref('');
const submitting = ref(false);
const sheetError = ref<string | null>(null);

async function load() {
    loading.value = true;
    error.value = null;

    try {
        const response = await apiRequestJson<{ data: RefundRecord[]; meta?: { currentPage: number; lastPage: number; total: number } }>(
            'GET',
            '/billing-refunds',
            { query: { q: search.value || null, page: page.value, perPage: perPage.value } },
        );
        refunds.value = response.data ?? [];
        totalPages.value = response.meta?.lastPage ?? 1;
        total.value = response.meta?.total ?? 0;
    } catch (err) {
        error.value = messageFromUnknown(err, 'Unable to load refunds.');
    } finally {
        loading.value = false;
    }
}

async function createRefund() {
    if (!newInvoiceId.value.trim() || !newAmount.value || !newReason.value.trim()) return;

    submitting.value = true;
    sheetError.value = null;

    try {
        await apiRequestJson('/billing-refunds', {
            method: 'POST',
            body: JSON.stringify({
                invoiceId: newInvoiceId.value.trim(),
                amount: newAmount.value,
                reason: newReason.value.trim(),
            }),
        });
        notifySuccess('Refund request submitted.');
        sheetOpen.value = false;
        newInvoiceId.value = '';
        newAmount.value = null;
        newReason.value = '';
        await load();
    } catch (err) {
        sheetError.value = messageFromUnknown(err, 'Unable to create refund.');
    } finally {
        submitting.value = false;
    }
}

function prevPage() { if (page.value > 1) { page.value--; load(); } }
function nextPage() { if (page.value < totalPages.value) { page.value++; load(); } }

onMounted(() => load());

const statusVariant = (s: string) => {
    switch (s) {
        case 'approved': return 'default';
        case 'processed': return 'default';
        case 'pending': return 'outline';
        case 'rejected': return 'destructive';
        default: return 'secondary';
    }
};
</script>

<template>
    <Head title="Refunds" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                            <AppIcon name="undo-2" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Refunds</h1>
                            <p class="text-xs text-muted-foreground">Finance workboard for refund control: request, approve, and process payouts.</p>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button size="sm" class="h-8 gap-1.5" @click="sheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            New refund
                        </Button>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="loading" @click="load">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Refresh
                        </Button>
                    </div>
                </div>
            </section>

            <BillingModuleNav />

            <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</div>

            <div class="flex items-center gap-2">
                <div class="relative min-w-0 flex-1 lg:max-w-sm">
                    <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input v-model="search" class="h-9 pl-9 text-xs" placeholder="Search refunds..." @keydown.enter="page = 1; load()" />
                </div>
            </div>

            <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle class="text-sm font-medium">
                        {{ loading ? 'Loading...' : `${total} refunds` }}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div v-if="!loading && refunds.length === 0" class="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                        <AppIcon name="undo-2" class="size-10 opacity-40" />
                        <p>No refund requests found.</p>
                        <p class="text-xs">Click <strong>New refund</strong> to create a refund request.</p>
                    </div>

                    <div v-else class="divide-y">
                        <div v-for="refund in refunds" :key="refund.id" class="flex items-center justify-between gap-4 py-3">
                            <div class="min-w-0">
                                <p class="text-sm font-medium">{{ refund.invoice_number || refund.invoice_id }}</p>
                                <p class="text-xs text-muted-foreground">{{ refund.reason }} · {{ refund.created_at }}</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <Badge :variant="statusVariant(refund.status)">{{ refund.status }}</Badge>
                                <span class="text-sm font-medium tabular-nums">{{ refund.currency_code ?? 'TZS' }} {{ refund.amount }}</span>
                            </div>
                        </div>
                    </div>

                    <div v-if="totalPages > 1" class="mt-4 flex items-center justify-between">
                        <Button variant="outline" size="sm" :disabled="page <= 1" @click="prevPage">Previous</Button>
                        <span class="text-xs text-muted-foreground">Page {{ page }} of {{ totalPages }}</span>
                        <Button variant="outline" size="sm" :disabled="page >= totalPages" @click="nextPage">Next</Button>
                    </div>
                </CardContent>
            </Card>

            <Sheet v-model:open="sheetOpen">
                <SheetContent side="right" variant="form" size="2xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="undo-2" class="size-5 text-muted-foreground" />
                            New refund
                        </SheetTitle>
                        <SheetDescription>Create a refund request against an invoice.</SheetDescription>
                    </SheetHeader>

                    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div v-if="sheetError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {{ sheetError }}
                        </div>

                        <div class="grid gap-4 sm:grid-cols-2">
                            <div class="space-y-2">
                                <Label for="rf-invoice-id">Invoice ID</Label>
                                <Input id="rf-invoice-id" v-model="newInvoiceId" placeholder="Enter invoice ID" />
                            </div>
                            <div class="space-y-2">
                                <Label for="rf-amount">Amount</Label>
                                <Input id="rf-amount" v-model.number="newAmount" type="number" placeholder="0.00" min="0" step="0.01" />
                            </div>
                        </div>

                        <div class="space-y-2">
                            <Label for="rf-reason">Reason</Label>
                            <Textarea id="rf-reason" v-model="newReason" placeholder="Why is this refund being requested?" rows="3" />
                        </div>
                    </div>

                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button variant="outline" @click="sheetOpen = false">Cancel</Button>
                        <Button :disabled="submitting" @click="createRefund">
                            {{ submitting ? 'Submitting...' : 'Submit refund' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    </AppLayout>
</template>
