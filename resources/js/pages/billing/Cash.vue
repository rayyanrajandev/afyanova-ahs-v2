<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import BillingModuleNav from '@/pages/billing/components/BillingModuleNav.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Invoices', href: '/billing' },
    { title: 'Cash payments', href: '/billing-cash' },
];

interface CashAccount {
    id: string;
    display_name: string | null;
    patient_number: string | null;
    status: string;
    currency_code: string | null;
    balance: number | null;
    created_at: string | null;
}

const accounts = ref<CashAccount[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref('');
const page = ref(1);
const perPage = ref(25);
const totalPages = ref(1);
const total = ref(0);

const sheetOpen = ref(false);
const newPatientId = ref('');
const newPatientNumber = ref('');
const newPatientName = ref('');
const newPhone = ref('');
const submitting = ref(false);
const sheetError = ref<string | null>(null);

async function loadAccounts() {
    loading.value = true;
    error.value = null;

    try {
        const response = await apiRequestJson<{ data: CashAccount[]; meta?: { currentPage: number; lastPage: number; total: number } }>(
            'GET',
            '/cash-patients',
            { query: { q: search.value || null, page: page.value, perPage: perPage.value } },
        );
        accounts.value = response.data ?? [];
        totalPages.value = response.meta?.lastPage ?? 1;
        total.value = response.meta?.total ?? 0;
    } catch (err) {
        error.value = messageFromUnknown(err, 'Unable to load cash accounts.');
    } finally {
        loading.value = false;
    }
}

async function createAccount() {
    if (!newPatientId.value.trim()) return;

    submitting.value = true;
    sheetError.value = null;

    try {
        await apiRequestJson('/cash-patients', {
            method: 'POST',
            body: JSON.stringify({
                patientId: newPatientId.value.trim(),
                patientNumber: newPatientNumber.value.trim() || null,
                displayName: newPatientName.value.trim() || null,
                phone: newPhone.value.trim() || null,
            }),
        });
        notifySuccess('Cash account created.');
        sheetOpen.value = false;
        newPatientId.value = '';
        newPatientNumber.value = '';
        newPatientName.value = '';
        newPhone.value = '';
        await loadAccounts();
    } catch (err) {
        sheetError.value = messageFromUnknown(err, 'Unable to create cash account.');
    } finally {
        submitting.value = false;
    }
}

function prevPage() { if (page.value > 1) { page.value--; loadAccounts(); } }
function nextPage() { if (page.value < totalPages.value) { page.value++; loadAccounts(); } }

onMounted(() => loadAccounts());

const statusVariant = (s: string) => {
    switch (s) {
        case 'active': return 'default';
        case 'closed': return 'secondary';
        case 'voided': return 'destructive';
        default: return 'outline';
    }
};
</script>

<template>
    <Head title="Cash payments" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                            <AppIcon name="banknote" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Cash payments</h1>
                            <p class="text-xs text-muted-foreground">Walk-in cashier workboard: open accounts, post charges, and collect payments.</p>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button size="sm" class="h-8 gap-1.5" @click="sheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            New cash account
                        </Button>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="loading" @click="loadAccounts">
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
                    <Input v-model="search" class="h-9 pl-9 text-xs" placeholder="Search accounts..." @keydown.enter="page = 1; loadAccounts()" />
                </div>
            </div>

            <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle class="text-sm font-medium">
                        {{ loading ? 'Loading...' : `${total} cash accounts` }}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div v-if="!loading && accounts.length === 0" class="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                        <AppIcon name="banknote" class="size-10 opacity-40" />
                        <p>No cash accounts found.</p>
                        <p class="text-xs">Click <strong>New cash account</strong> to open a walk-in patient account.</p>
                    </div>

                    <div v-else class="divide-y">
                        <div v-for="account in accounts" :key="account.id" class="flex items-center justify-between gap-4 py-3">
                            <div class="min-w-0">
                                <p class="text-sm font-medium">{{ account.display_name || 'Unnamed patient' }}</p>
                                <p class="text-xs text-muted-foreground">MRN {{ account.patient_number }} · Created {{ account.created_at }}</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <Badge :variant="statusVariant(account.status)">{{ account.status }}</Badge>
                                <span class="text-sm font-medium tabular-nums">{{ account.currency_code ?? 'TZS' }} {{ account.balance ?? '0.00' }}</span>
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
                            <AppIcon name="banknote" class="size-5 text-muted-foreground" />
                            New cash account
                        </SheetTitle>
                        <SheetDescription>Open a walk-in patient cash account.</SheetDescription>
                    </SheetHeader>

                    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div v-if="sheetError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {{ sheetError }}
                        </div>

                        <div class="space-y-2">
                            <Label for="ca-patient-id">Patient ID</Label>
                            <Input id="ca-patient-id" v-model="newPatientId" placeholder="Enter patient ID" />
                        </div>

                        <div class="grid gap-4 sm:grid-cols-2">
                            <div class="space-y-2">
                                <Label for="ca-patient-number">Patient Number (MRN)</Label>
                                <Input id="ca-patient-number" v-model="newPatientNumber" placeholder="Optional" />
                            </div>
                            <div class="space-y-2">
                                <Label for="ca-phone">Phone</Label>
                                <Input id="ca-phone" v-model="newPhone" placeholder="Optional" />
                            </div>
                        </div>

                        <div class="space-y-2">
                            <Label for="ca-name">Display Name</Label>
                            <Input id="ca-name" v-model="newPatientName" placeholder="Optional" />
                        </div>
                    </div>

                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button variant="outline" @click="sheetOpen = false">Cancel</Button>
                        <Button :disabled="submitting" @click="createAccount">
                            {{ submitting ? 'Creating...' : 'Create account' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    </AppLayout>
</template>
