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
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';

const closes = ref<any[]>([]);
const loading = ref(false);
const showDialog = ref(false);
const submitting = ref(false);
const closedAt = ref(new Date().toISOString().slice(0, 16));
const openedAt = ref(new Date(Date.now() - 28800000).toISOString().slice(0, 16));
const totalCash = ref(0);
const totalCard = ref(0);
const totalMpesa = ref(0);
const totalOther = ref(0);
const totalRefunds = ref(0);
const closeNotes = ref('');
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const statusColors: Record<string, string> = {
    draft: 'secondary',
    submitted: 'warning',
    verified: 'success',
};

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

function calcNet() {
    const cash = Number(totalCash.value) || 0;
    const card = Number(totalCard.value) || 0;
    const mpesa = Number(totalMpesa.value) || 0;
    const other = Number(totalOther.value) || 0;
    const refunds = Number(totalRefunds.value) || 0;
    return (cash + card + mpesa + other - refunds).toFixed(2);
}

async function submitClose() {
    submitting.value = true;
    error.value = null;
    success.value = null;
    try {
        await apiRequestJson('/api/v1/daily-closes', {
            method: 'POST',
            body: JSON.stringify({
                closed_at: closedAt.value,
                opened_at: openedAt.value,
                total_cash_amount: Number(totalCash.value) || 0,
                total_card_amount: Number(totalCard.value) || 0,
                total_mpesa_amount: Number(totalMpesa.value) || 0,
                total_other_amount: Number(totalOther.value) || 0,
                total_refunds: Number(totalRefunds.value) || 0,
                notes: closeNotes.value,
            }),
        });
        success.value = 'Daily close created successfully.';
        showDialog.value = false;
        await fetchCloses();
    } catch (e: any) {
        error.value = e?.payload?.message || 'Failed to create close.';
    } finally {
        submitting.value = false;
    }
}

onMounted(fetchCloses);
</script>

<template>
    <AppLayout>
        <Head title="Daily Revenue Close" />
        <div class="space-y-6 p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">Daily Revenue Close</h1>
                    <p class="text-muted-foreground text-sm">Cashier settlement and revenue reconciliation</p>
                </div>
                <Button @click="showDialog = true">New Close</Button>
            </div>

            <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</div>
            <div v-if="success" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{{ success }}</div>

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
                                    <Badge :variant="statusColors[c.status] || 'default'">{{ c.status }}</Badge>
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
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Opened At</Label>
                            <Input v-model="openedAt" type="datetime-local" />
                        </div>
                        <div class="space-y-2">
                            <Label>Closed At</Label>
                            <Input v-model="closedAt" type="datetime-local" />
                        </div>
                        <div class="space-y-2">
                            <Label>Cash Amount</Label>
                            <Input v-model.number="totalCash" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>Card Amount</Label>
                            <Input v-model.number="totalCard" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>M-Pesa Amount</Label>
                            <Input v-model.number="totalMpesa" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>Other Amount</Label>
                            <Input v-model.number="totalOther" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>Refunds</Label>
                            <Input v-model.number="totalRefunds" type="number" step="0.01" min="0" />
                        </div>
                        <div class="space-y-2">
                            <Label>Net Revenue</Label>
                            <Input :model-value="calcNet()" disabled />
                        </div>
                        <div class="col-span-2 space-y-2">
                            <Label>Notes</Label>
                            <Textarea v-model="closeNotes" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="showDialog = false">Cancel</Button>
                        <Button :disabled="submitting" @click="submitClose">
                            {{ submitting ? 'Submitting...' : 'Create Close' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
