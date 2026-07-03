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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';

const report = ref<any>(null);
const loading = ref(false);
const asOfDate = ref(new Date().toISOString().split('T')[0]);
const currencyCode = ref('TZS');
const departmentFilter = ref('');

const bucketColors: Record<string, string> = {
    current: 'bg-green-50 border-green-200',
    '31_60': 'bg-yellow-50 border-yellow-200',
    '61_90': 'bg-orange-50 border-orange-200',
    '90_plus': 'bg-red-50 border-red-200',
};

async function fetchReport() {
    loading.value = true;
    try {
        const params = new URLSearchParams();
        if (asOfDate.value) params.set('asOfDate', asOfDate.value);
        if (currencyCode.value) params.set('currencyCode', currencyCode.value);
        if (departmentFilter.value) params.set('departmentFilter', departmentFilter.value);
        const res = await apiRequestJson(`/api/v1/aging-report?${params.toString()}`);
        report.value = res.data ?? null;
    } catch (e) {
        console.error('Failed to fetch aging report', e);
    } finally {
        loading.value = false;
    }
}

onMounted(fetchReport);
</script>

<template>
    <AppLayout>
        <Head title="AR Aging Report" />
        <div class="space-y-6 p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight">Accounts Receivable Aging</h1>
                    <p class="text-muted-foreground text-sm">Aged accounts receivable balances by bucket</p>
                </div>
            </div>

            <div class="flex flex-wrap items-end gap-4">
                <div class="space-y-2">
                    <Label>As of Date</Label>
                    <Input v-model="asOfDate" type="date" />
                </div>
                <div class="space-y-2">
                    <Label>Currency</Label>
                    <Select v-model="currencyCode">
                        <SelectTrigger class="w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TZS">TZS</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="space-y-2">
                    <Label>Department</Label>
                    <Input v-model="departmentFilter" placeholder="Filter by department" class="w-48" />
                </div>
                <Button @click="fetchReport" :disabled="loading">{{ loading ? 'Loading...' : 'Run Report' }}</Button>
            </div>

            <div v-if="loading" class="text-muted-foreground py-8 text-center">Loading report...</div>

            <template v-if="report && !loading">
                <div class="grid grid-cols-4 gap-4">
                    <Card v-for="bucket in report.buckets" :key="bucket.key" :class="bucketColors[bucket.key] || ''">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-lg">{{ bucket.label }}</CardTitle>
                            <CardDescription>{{ bucket.count }} invoices</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div class="text-2xl font-bold">{{ bucket.totalBalance.toLocaleString() }}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Total Outstanding</CardTitle>
                        <CardDescription>{{ report.totals.count }} invoices with total balance of {{ report.totals.totalBalance.toLocaleString() }}</CardDescription>
                    </CardHeader>
                </Card>

                <div v-for="bucket in report.buckets" :key="bucket.key" class="mt-4">
                    <Collapsible v-if="bucket.invoices.length > 0">
                        <CollapsibleTrigger as-child>
                            <Button variant="outline" class="w-full justify-start">
                                {{ bucket.label }} - {{ bucket.count }} invoices ({{ bucket.totalBalance.toLocaleString() }})
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent class="mt-2 space-y-1">
                            <div v-for="inv in bucket.invoices" :key="inv.id" class="flex items-center justify-between rounded border p-3 text-sm">
                                <div>
                                    <span class="font-medium">{{ inv.invoiceNumber }}</span>
                                    <span class="text-muted-foreground ml-2">{{ inv.ageDays }} days</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span>{{ inv.balanceAmount.toLocaleString() }} {{ inv.currencyCode }}</span>
                                    <Badge :variant="inv.status === 'overdue' ? 'destructive' : 'default'">{{ inv.status }}</Badge>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </template>
        </div>
    </AppLayout>
</template>
