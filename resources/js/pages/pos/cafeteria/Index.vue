<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet, apiPost } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type CafeteriaMenuItem = {
    id: string;
    itemCode: string | null;
    itemName: string | null;
    category: string | null;
    unitLabel: string | null;
    unitPrice: string | number | null;
    status: string | null;
};

type PosRegister = {
    id: string;
    registerName: string | null;
    currentOpenSession: { id: string; sessionNumber: string | null } | null;
};

type BasketItem = {
    menuItemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
};

type PosSale = {
    id: string;
    saleNumber: string | null;
    receiptNumber: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cafeteria POS', href: '/pos/cafeteria' }];

const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile money' },
    { value: 'card', label: 'Card' },
];

const loading = ref(true);
const submitting = ref(false);
const error = ref('');
const successMessage = ref('');
const latestSale = ref<PosSale | null>(null);
const menuItems = ref<CafeteriaMenuItem[]>([]);
const menuSearch = ref('');
const selectedCategory = ref('all');
const basket = ref<BasketItem[]>([]);
const paymentMethod = ref('cash');

const categories = computed(() => {
    const cats = new Set(menuItems.value.map((i) => i.category).filter(Boolean));
    return ['all', ...Array.from(cats)] as string[];
});

const filteredMenuItems = computed(() => {
    return menuItems.value.filter((i) => {
        if (selectedCategory.value !== 'all' && i.category !== selectedCategory.value) return false;
        if (menuSearch.value.trim()) {
            const q = menuSearch.value.toLowerCase();
            if (!i.itemName?.toLowerCase().includes(q) && !i.itemCode?.toLowerCase().includes(q)) return false;
        }
        return true;
    });
});

const basketTotal = computed(() => basket.value.reduce((s, i) => s + i.quantity * i.unitPrice, 0));

function formatCurrency(value: number | string | null | undefined): string {
    const num = Number(value ?? 0);
    return Number.isNaN(num) ? '0.00' : num.toFixed(2);
}

function addToBasket(item: CafeteriaMenuItem): void {
    const existing = basket.value.find((b) => b.menuItemId === item.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        basket.value.push({
            menuItemId: item.id,
            itemName: item.itemName ?? 'Unknown',
            quantity: 1,
            unitPrice: Number(item.unitPrice ?? 0),
        });
    }
}

function removeFromBasket(menuItemId: string): void {
    basket.value = basket.value.filter((b) => b.menuItemId !== menuItemId);
}

function updateQuantity(menuItemId: string, qty: number): void {
    const item = basket.value.find((b) => b.menuItemId === menuItemId);
    if (item) {
        if (qty <= 0) removeFromBasket(menuItemId);
        else item.quantity = qty;
    }
}

async function submitSale(): Promise<void> {
    error.value = '';
    successMessage.value = '';
    latestSale.value = null;

    if (basket.value.length === 0) {
        error.value = 'Add at least one item to the basket.';
        return;
    }
    if (paymentMethod.value === '') {
        error.value = 'Select a payment method.';
        return;
    }

    submitting.value = true;
    try {
        const response = await apiPost<{ data: PosSale }>('/pos/cafeteria/sales', {
            body: {
                registerId: null,
                customerName: null,
                items: basket.value.map((b) => ({ menuItemId: b.menuItemId, quantity: b.quantity })),
                payments: [{ paymentMethod: paymentMethod.value, amount: basketTotal.value }],
            },
        });
        latestSale.value = response.data;
        successMessage.value = `${response.data.saleNumber || 'Sale'} completed`;
        basket.value = [];
        notifySuccess('Cafeteria sale completed.');
    } catch (e) {
        error.value = 'Failed to record sale.';
    } finally {
        submitting.value = false;
    }
}

onMounted(async () => {
    try {
        const response = await apiGet<{ data: CafeteriaMenuItem[] }>('/pos/cafeteria/catalog', {
            status: 'active',
            perPage: 200,
            page: 1,
        });
        menuItems.value = response.data ?? [];
    } catch (e) {
        error.value = 'Failed to load cafeteria menu.';
    }
    loading.value = false;
});
</script>

<template>
    <Head title="Cafeteria POS" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-lg font-semibold">Cafeteria POS</h1>
                    <p class="text-sm text-muted-foreground">Cafeteria counter sales</p>
                </div>
                <Badge variant="outline">{{ menuItems.length }} menu items</Badge>
            </div>

            <div v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ error }}</div>

            <div v-if="successMessage && latestSale" class="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <div class="flex items-center justify-between">
                    <span>{{ successMessage }}</span>
                    <Link :href="`/pos/sales/${latestSale.id}/print`" class="underline">Print receipt</Link>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div class="xl:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Menu</CardTitle>
                            <CardDescription>Select items to add to the sale</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div class="flex gap-2">
                                <div class="flex-1">
                                    <Input v-model="menuSearch" placeholder="Search menu..." />
                                </div>
                                <Select v-model="selectedCategory">
                                    <SelectTrigger class="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="cat in categories" :key="cat" :value="cat">
                                            {{ cat === 'all' ? 'All categories' : cat }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div v-if="loading" class="py-8 text-center text-sm text-muted-foreground">Loading menu...</div>
                            <div v-else-if="filteredMenuItems.length === 0" class="py-8 text-center text-sm text-muted-foreground">No menu items found.</div>
                            <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                <button
                                    v-for="item in filteredMenuItems"
                                    :key="item.id"
                                    class="flex flex-col items-center gap-1 rounded-lg border p-3 text-center text-sm transition-colors hover:bg-accent"
                                    @click="addToBasket(item)"
                                >
                                    <span class="font-medium">{{ item.itemName }}</span>
                                    <span class="text-muted-foreground">{{ formatCurrency(item.unitPrice) }}</span>
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Basket</CardTitle>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div v-if="basket.length === 0" class="py-8 text-center text-sm text-muted-foreground">Basket is empty.</div>
                            <div v-else class="space-y-2">
                                <div v-for="item in basket" :key="item.menuItemId" class="flex items-center gap-2 rounded-lg border p-2 text-sm">
                                    <div class="flex-1 min-w-0">
                                        <div class="truncate font-medium">{{ item.itemName }}</div>
                                        <div class="text-muted-foreground">{{ formatCurrency(item.unitPrice) }} each</div>
                                    </div>
                                    <Input v-model.number="item.quantity" type="number" min="0" class="w-16 h-8 text-xs" @update:model-value="updateQuantity(item.menuItemId, item.quantity)" />
                                    <div class="w-16 text-right font-medium">{{ formatCurrency(item.quantity * item.unitPrice) }}</div>
                                    <Button size="sm" variant="ghost" class="h-7 w-7 p-0" @click="removeFromBasket(item.menuItemId)">&times;</Button>
                                </div>
                            </div>

                            <div class="flex justify-between text-lg font-bold border-t pt-2">
                                <span>Total</span>
                                <span>{{ formatCurrency(basketTotal) }}</span>
                            </div>

                            <div>
                                <Label>Payment method</Label>
                                <Select v-model="paymentMethod">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="m in paymentMethods" :key="m.value" :value="m.value">{{ m.label }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button class="w-full" :disabled="basket.length === 0 || submitting" @click="submitSale">
                                {{ submitting ? 'Processing...' : 'Complete Sale' }}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
