<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
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
import { Textarea } from '@/components/ui/textarea';
import BillingOperationTabs from '@/pages/billing-invoices/components/BillingOperationTabs.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { generateRequestKey } from '@/lib/idempotency';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

type DailyCloseRecord = {
    id: string;
    closedAt: string;
    totalRevenue: number;
    netRevenue: number;
    status: string;
};

type DailyCloseForm = {
    openedAt: string;
    closedAt: string;
    totalCash: number;
    totalCard: number;
    totalMpesa: number;
    totalOther: number;
    totalRefunds: number;
    notes: string;
};

const closes = ref<DailyCloseRecord[]>([]);
const loading = ref(false);
const showDialog = ref(false);
const submitting = ref(false);

const form = ref<DailyCloseForm>({
    openedAt: new Date(Date.now() - 28800000).toISOString().slice(0, 16),
    closedAt: new Date().toISOString().slice(0, 16),
    totalCash: 0,
    totalCard: 0,
    totalMpesa: 0,
    totalOther: 0,
    totalRefunds: 0,
    notes: '',
});

const requestKey = ref(generateRequestKey('daily-close-create'));

const error = ref<string | null>(null);
const success = ref<string | null>(null);

const netRevenue = computed(() => {
    const net = form.value.totalCash + form.value.totalCard + form.value.totalMpesa + form.value.totalOther - form.value.totalRefunds;
    return Math.max(0, net);
});

const validationError = computed(() => {
    const opened = new Date(form.value.openedAt);
    const closed = new Date(form.value.closedAt);
    if (closed <= opened) return 'Close time must be after open time.';
    const total = form.value.totalCash + form.value.totalCard + form.value.totalMpesa + form.value.totalOther;
    if (total <= 0 && form.value.totalRefunds <= 0) return 'Enter at least one payment amount.';
    return null;
});

async function fetchCloses() {
    loading.value = true;
    error.value = null;
    try {
        const res = await apiRequestJson('/api/v1/daily-closes?perPage=20');
        closes.value = res.data ?? [];
    } catch (e) {
        error.value = 'Failed to load daily closes.';
    } finally {
        loading.value = false;
    }
}

async function submitClose() {
    if (validationError.value) return;
    submitting.value = true;
    error.value = null;
    success.value = null;
    try {
        await apiRequestJson('/api/v1/daily-closes', {
            method: 'POST',
            body: JSON.stringify({
                closed_at: form.value.closedAt,
                opened_at: form.value.openedAt,
                total_cash_amount: form.value.totalCash,
                total_card_amount: form.value.totalCard,
                total_mpesa_amount: form.value.totalMpesa,
                total_other_amount: form.value.totalOther,
                total_refunds: form.value.totalRefunds,
                notes: form.value.notes,
                idempotencyKey: requestKey.value,
            }),
        });
        notifySuccess('Daily close created successfully.');
        showDialog.value = false;
        requestKey.value = generateRequestKey('daily-close-create');
        await fetchCloses();
    } catch (e: any) {
        error.value = e?.payload?.message || messageFromUnknown(e);
    } finally {
        submitting.value = false;
    }
}

onMounted(fetchCloses);
</script>

<template>
    <AppLayout>
        <Head title="Daily Revenue Close" />
        <div class="px-6 pt-2">
            <BillingOperationTabs />
        </div>
        <div class="space-y-6 p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">Daily Revenue Close</h1>
                    <p class="text-muted-foreground text-sm">Cashier settlement and revenue reconciliation</p>
                </div>
                <Button @click="showDialog = true">New Close</Button>
            </div>

            <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</div>

            <Card>
                <CardHeader>
                    <CardTitle>Close Records</CardTitle>
                    <CardDescription>Daily revenue close entries</CardDescription>
                </CardHeader>
                <CardContent>
                    <div v-if="loading" class="text-muted-foreground py-8 text-center">Loading...</div>
                    <div v-else-if="closes.length === 0" class="text-muted-foreground py-8 text-center">No daily close records found</div>
                    <div v-else class="space-y-2">
                        <div v-for="c in closes" :key="c.id" class="flex items-center justify-between rounded-lg border p-4">
                            <div class="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                    <div class="text-muted-foreground">Date</div>
                                    <div class="font-medium">{{ new Date(c.closedAt).toLocaleDateString() }}</div>
                                </div>
                                <div>
                                    <div class="text-muted-foreground">Revenue</div>
                                    <div class="font-medium">{{ c.totalRevenue?.toLocaleString() }}</div>
                                </div>
                                <div>
                                    <div class="text-muted-foreground">Net</div>
                                    <div class="font-medium">{{ c.netRevenue?.toLocaleString() }}</div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Badge :variant="c.status === 'verified' ? 'success' : c.status === 'submitted' ? 'secondary' : c.status === 'draft' ? 'secondary' : 'default'">
                                        {{ c.status }}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog v-model:open="showDialog">
                <DialogContent class="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Daily Close</DialogTitle>
                        <DialogDescription>Record cashier shift settlement</DialogDescription>
                    </DialogHeader>
                    <div v-if="validationError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ validationError }}</div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Opened At</Label>
                            <Input v-model="form.openedAt" type="datetime-local" />
                        </div>
                        <div class="space-y-2">
                            <Label>Closed At</Label>
                            <Input v-model="form.closedAt" type="datetime-local" />
                        </div>
                        <div class="space-y-2">
                            <Label>Cash Amount</Label>
                            <Input v-model.number="form.totalCash" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>Card Amount</Label>
                            <Input v-model.number="form.totalCard" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>M-Pesa Amount</Label>
                            <Input v-model.number="form.totalMpesa" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>Other Amount</Label>
                            <Input v-model.number="form.totalOther" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>Refunds</Label>
                            <Input v-model.number="form.totalRefunds" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>Net Revenue</Label>
                            <Input :model-value="netRevenue.toFixed(2)" disabled />
                        </div>
                        <div class="col-span-2 space-y-2">
                            <Label>Notes</Label>
                            <Textarea v-model="form.notes" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="showDialog = false">Cancel</Button>
                        <Button :disabled="submitting || !!validationError" @click="submitClose">
                            {{ submitting ? 'Submitting...' : 'Create Close' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
