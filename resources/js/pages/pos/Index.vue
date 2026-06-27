<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet, apiPost } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Pager<T> = {
    data: T[];
    meta: { total: number; currentPage?: number; lastPage?: number; perPage?: number; [key: string]: unknown };
};

type PosRegister = {
    id: string;
    registerCode: string | null;
    registerName: string | null;
    location: string | null;
    defaultCurrencyCode: string | null;
    status: string | null;
    currentOpenSession: { id: string; sessionNumber: string | null; openedAt: string | null } | null;
};

type PosSession = {
    id: string;
    sessionNumber: string | null;
    status: string | null;
    openedAt: string | null;
    closedAt: string | null;
    openingCashAmount: string | number | null;
    closingCashAmount: string | number | null;
    grossSalesAmount: string | number | null;
    totalDiscountAmount: string | number | null;
    totalTaxAmount: string | number | null;
    saleCount: number | null;
    register: { registerCode: string | null; registerName: string | null } | null;
};

type PosSale = {
    id: string;
    saleNumber: string | null;
    receiptNumber: string | null;
    status: string | null;
    totalAmount: string | number | null;
    currencyCode: string | null;
    changeAmount: string | number | null;
};

type LineItem = {
    clientId: string;
    itemName: string;
    itemCode: string | null;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxAmount: number;
    note: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cashier POS', href: '/pos' }];

const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile money' },
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Other' },
];

const loading = ref(true);
const submitting = ref(false);
const error = ref('');
const successMessage = ref('');
const latestSaleId = ref('');

const registers = ref<PosRegister[]>([]);
const selectedRegisterId = ref('');
const lineItems = ref<LineItem[]>([]);
const paymentMethod = ref('cash');
const amountTendered = ref(0);
const checkoutNote = ref('');
const openSessionDialog = ref(false);
const openingCashAmount = ref(100);
const openingNote = ref('');

const newItem = ref<Omit<LineItem, 'clientId'>>({
    itemName: '',
    itemCode: null,
    quantity: 1,
    unitPrice: 0,
    discountAmount: 0,
    taxAmount: 0,
    note: null,
});

const selectedRegister = computed(() => registers.value.find((r) => r.id === selectedRegisterId.value));
const activeSession = computed(() => selectedRegister.value?.currentOpenSession ?? null);
const lineItemsTotal = computed(() => lineItems.value.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0));
const discountTotal = computed(() => lineItems.value.reduce((sum, i) => sum + i.discountAmount, 0));
const taxTotal = computed(() => lineItems.value.reduce((sum, i) => sum + i.taxAmount, 0));
const totalAmount = computed(() => Math.max(0, lineItemsTotal.value - discountTotal.value + taxTotal.value));
const changeDue = computed(() => Math.max(0, amountTendered.value - totalAmount.value));
const canSubmit = computed(
    () => !submitting.value && selectedRegisterId.value && activeSession.value && lineItems.value.length > 0 && amountTendered.value >= totalAmount.value,
);

function formatCurrency(value: number | string | null | undefined): string {
    const num = Number(value ?? 0);
    return Number.isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clearMessages(): void {
    error.value = '';
    successMessage.value = '';
    latestSaleId.value = '';
}

function addItem(): void {
    if (!newItem.value.itemName.trim() || newItem.value.quantity <= 0 || newItem.value.unitPrice <= 0) return;
    lineItems.value.push({
        clientId: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...newItem.value,
        itemName: newItem.value.itemName.trim(),
    });
    newItem.value = { itemName: '', itemCode: null, quantity: 1, unitPrice: 0, discountAmount: 0, taxAmount: 0, note: null };
}

function removeItem(clientId: string): void {
    lineItems.value = lineItems.value.filter((i) => i.clientId !== clientId);
}

function resetCheckout(): void {
    lineItems.value = [];
    paymentMethod.value = 'cash';
    amountTendered.value = 0;
    checkoutNote.value = '';
}

async function loadRegisters(): Promise<void> {
    try {
        const response = await apiGet<Pager<PosRegister>>('/pos/registers', {
            status: 'active',
            perPage: 50,
            page: 1,
            sortBy: 'registerName',
            sortDir: 'asc',
        });
        registers.value = response.data ?? [];
        const firstWithSession = registers.value.find((r) => r.currentOpenSession);
        if (firstWithSession) selectedRegisterId.value = firstWithSession.id;
        else if (registers.value.length > 0) selectedRegisterId.value = registers.value[0].id;
    } catch (e) {
        error.value = 'Failed to load registers.';
    }
}

async function openSession(): Promise<void> {
    if (!selectedRegisterId.value) return;
    try {
        await apiPost(`/pos/registers/${selectedRegisterId.value}/sessions`, {
            body: { openingCashAmount: openingCashAmount.value, openingNote: openingNote.value.trim() || null },
        });
        await loadRegisters();
        openSessionDialog.value = false;
        notifySuccess('Session opened.');
    } catch (e) {
        notifyError('Failed to open session.');
    }
}

async function submitSale(): Promise<void> {
    clearMessages();
    if (!activeSession.value) {
        error.value = 'No open session on this register. Open a session first.';
        return;
    }

    submitting.value = true;
    try {
        const response = await apiPost<{ data: PosSale }>('/pos/sales', {
            body: {
                registerId: selectedRegisterId.value,
                saleChannel: 'general_retail',
                customerType: 'anonymous',
                lineItems: lineItems.value.map((i) => ({
                    itemType: 'retail_item',
                    itemCode: i.itemCode,
                    itemName: i.itemName,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    discountAmount: i.discountAmount || undefined,
                    taxAmount: i.taxAmount || undefined,
                    notes: i.note,
                })),
                payments: [
                    {
                        paymentMethod: paymentMethod.value,
                        amount: totalAmount.value,
                        paidAt: new Date().toISOString().slice(0, 19).replace('T', ' ') as unknown as string,
                    },
                ],
                notes: checkoutNote.value.trim() || null,
            },
        });

        const sale = response.data;
        successMessage.value = `${sale.saleNumber || 'Sale'} completed`;
        latestSaleId.value = sale.id;
        resetCheckout();
        await loadRegisters();
    } catch (e) {
        error.value = 'Failed to record sale.';
    } finally {
        submitting.value = false;
    }
}

onMounted(async () => {
    await loadRegisters();
    loading.value = false;
});
</script>

<template>
    <Head title="Cashier POS" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-lg font-semibold">Cashier POS</h1>
                    <p class="text-sm text-muted-foreground">Point of sale — cashier counter</p>
                </div>
                <Badge variant="outline">
                    {{ activeSession ? `Session ${activeSession.sessionNumber}` : 'No open session' }}
                </Badge>
            </div>

            <div v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {{ error }}
            </div>

            <div v-if="successMessage" class="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <div class="flex items-center justify-between">
                    <span>{{ successMessage }}</span>
                    <Link v-if="latestSaleId" :href="`/pos/sales/${latestSaleId}/print`" class="underline">Print receipt</Link>
                </div>
            </div>

            <Card>
                <CardContent class="flex flex-wrap items-center gap-4 pt-6">
                    <div class="flex items-center gap-2">
                        <Label class="text-nowrap">Register</Label>
                        <Select v-model="selectedRegisterId">
                            <SelectTrigger class="w-56">
                                <SelectValue placeholder="Select register..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="reg in registers" :key="reg.id" :value="reg.id">
                                    {{ reg.registerName }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Badge v-if="activeSession" variant="secondary">
                        {{ activeSession.sessionNumber }}
                    </Badge>
                    <Button v-else size="sm" variant="outline" @click="openSessionDialog = true">
                        Open session
                    </Button>
                </CardContent>
            </Card>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div class="xl:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Items</CardTitle>
                            <CardDescription>Add line items to the sale</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div class="grid grid-cols-12 gap-2 items-end">
                                <div class="col-span-5">
                                    <Label>Item name</Label>
                                    <Input v-model="newItem.itemName" placeholder="e.g. Water bottle" @keydown.enter="addItem" />
                                </div>
                                <div class="col-span-2">
                                    <Label>Qty</Label>
                                    <Input v-model.number="newItem.quantity" type="number" min="1" />
                                </div>
                                <div class="col-span-3">
                                    <Label>Unit price</Label>
                                    <Input v-model.number="newItem.unitPrice" type="number" min="0" step="0.01" />
                                </div>
                                <div class="col-span-2">
                                    <Button size="sm" class="w-full" :disabled="!newItem.itemName.trim() || newItem.quantity <= 0 || newItem.unitPrice <= 0" @click="addItem">
                                        Add
                                    </Button>
                                </div>
                            </div>

                            <div v-if="lineItems.length > 0" class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="border-b text-left text-muted-foreground">
                                            <th class="pb-2 font-medium">Item</th>
                                            <th class="pb-2 font-medium text-right">Qty</th>
                                            <th class="pb-2 font-medium text-right">Price</th>
                                            <th class="pb-2 font-medium text-right">Total</th>
                                            <th class="pb-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="item in lineItems" :key="item.clientId" class="border-b last:border-0">
                                            <td class="py-2">{{ item.itemName }}</td>
                                            <td class="py-2 text-right">{{ item.quantity }}</td>
                                            <td class="py-2 text-right">{{ formatCurrency(item.unitPrice) }}</td>
                                            <td class="py-2 text-right font-medium">{{ formatCurrency(item.quantity * item.unitPrice) }}</td>
                                            <td class="py-2 text-right">
                                                <Button size="sm" variant="ghost" class="h-7 w-7 p-0" @click="removeItem(item.clientId)">
                                                    &times;
                                                </Button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div v-else class="py-8 text-center text-sm text-muted-foreground">
                                No items added. Use the form above to add items.
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Checkout</CardTitle>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div class="space-y-1">
                                <div class="flex justify-between text-sm">
                                    <span class="text-muted-foreground">Subtotal</span>
                                    <span>{{ formatCurrency(lineItemsTotal) }}</span>
                                </div>
                                <div v-if="discountTotal > 0" class="flex justify-between text-sm">
                                    <span class="text-muted-foreground">Discount</span>
                                    <span class="text-destructive">-{{ formatCurrency(discountTotal) }}</span>
                                </div>
                                <div v-if="taxTotal > 0" class="flex justify-between text-sm">
                                    <span class="text-muted-foreground">Tax</span>
                                    <span>{{ formatCurrency(taxTotal) }}</span>
                                </div>
                                <div class="flex justify-between text-lg font-bold pt-1 border-t">
                                    <span>Total</span>
                                    <span>{{ formatCurrency(totalAmount) }}</span>
                                </div>
                            </div>

                            <div>
                                <Label>Payment method</Label>
                                <Select v-model="paymentMethod">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="m in paymentMethods" :key="m.value" :value="m.value">
                                            {{ m.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Amount tendered</Label>
                                <Input v-model.number="amountTendered" type="number" min="0" step="0.01" placeholder="0.00" />
                            </div>

                            <div v-if="changeDue > 0" class="rounded-lg bg-emerald-50 px-3 py-2 text-center text-lg font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                Change: {{ formatCurrency(changeDue) }}
                            </div>

                            <div>
                                <Label>Note (optional)</Label>
                                <Textarea v-model="checkoutNote" placeholder="Receipt note..." rows="2" />
                            </div>

                            <Button class="w-full" size="lg" :disabled="!canSubmit" @click="submitSale">
                                {{ submitting ? 'Processing...' : 'Complete Sale' }}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    </AppLayout>

    <div v-if="openSessionDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="openSessionDialog = false">
        <Card class="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Open Session</CardTitle>
                <CardDescription>Start a cashier session on {{ selectedRegister?.registerName }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
                <div>
                    <Label>Opening cash amount</Label>
                    <Input v-model.number="openingCashAmount" type="number" min="0" step="0.01" />
                </div>
                <div>
                    <Label>Note (optional)</Label>
                    <Textarea v-model="openingNote" rows="2" />
                </div>
                <Button class="w-full" @click="openSession">Open Session</Button>
            </CardContent>
        </Card>
    </div>
</template>
