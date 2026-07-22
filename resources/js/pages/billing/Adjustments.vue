<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import BillingModuleNav from '@/pages/billing/components/BillingModuleNav.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Invoices', href: '/billing' },
    { title: 'Adjustments', href: '/billing-adjustments' },
];

const sheetOpen = ref(false);
const invoiceId = ref('');
const type = ref<'credit' | 'debit'>('credit');
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
        await apiRequestJson(`/api/v1/invoices/${invoiceId.value.trim()}/adjustments`, {
            method: 'POST',
            body: JSON.stringify({
                type: type.value,
                amount: amount.value,
                reason: reason.value.trim(),
                notes: notes.value.trim() || null,
            }),
        });
        notifySuccess(`${type.value === 'credit' ? 'Credit' : 'Debit'} note added.`);
        sheetOpen.value = false;
        invoiceId.value = '';
        amount.value = null;
        reason.value = '';
        notes.value = '';
    } catch (err) {
        error.value = messageFromUnknown(err, 'Unable to add adjustment.');
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Head title="Adjustments" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                            <AppIcon name="scale" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Adjustments</h1>
                            <p class="text-xs text-muted-foreground">Credit notes, debit notes, and balance corrections.</p>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button size="sm" class="h-8 gap-1.5" @click="sheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            New adjustment
                        </Button>
                    </div>
                </div>
            </section>

            <BillingModuleNav />

            <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                <CardContent>
                    <div class="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                        <AppIcon name="scale" class="size-10 opacity-40" />
                        <p>Click <strong>New adjustment</strong> to add a credit or debit note to an invoice.</p>
                    </div>
                </CardContent>
            </Card>

            <Sheet v-model:open="sheetOpen">
                <SheetContent side="right" variant="form" size="2xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="scale" class="size-5 text-muted-foreground" />
                            New adjustment
                        </SheetTitle>
                        <SheetDescription>Add a credit or debit note to an existing invoice.</SheetDescription>
                    </SheetHeader>

                    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {{ error }}
                        </div>

                        <div class="grid gap-4 sm:grid-cols-3">
                            <div class="space-y-2">
                                <Label for="adj-invoice">Invoice ID</Label>
                                <Input id="adj-invoice" v-model="invoiceId" placeholder="Enter invoice ID" />
                            </div>
                            <div class="space-y-2">
                                <Label for="adj-type">Type</Label>
                                <Select v-model="type">
                                    <SelectTrigger id="adj-type">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="credit">Credit note</SelectItem>
                                        <SelectItem value="debit">Debit note</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="space-y-2">
                                <Label for="adj-amount">Amount</Label>
                                <Input id="adj-amount" v-model.number="amount" type="number" placeholder="0.00" min="0" step="0.01" />
                            </div>
                        </div>

                        <div class="space-y-2">
                            <Label for="adj-reason">Reason</Label>
                            <Input id="adj-reason" v-model="reason" placeholder="e.g. Overcharge correction, missing service" />
                        </div>

                        <div class="space-y-2">
                            <Label for="adj-notes">Notes</Label>
                            <Textarea id="adj-notes" v-model="notes" placeholder="Additional details..." rows="3" />
                        </div>
                    </div>

                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button variant="outline" @click="sheetOpen = false">Cancel</Button>
                        <Button :disabled="submitting" @click="submit">
                            {{ submitting ? 'Submitting...' : 'Submit adjustment' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    </AppLayout>
</template>
