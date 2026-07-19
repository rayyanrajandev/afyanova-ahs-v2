<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted, onUnmounted, ref } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { notifyError } from '@/lib/notify';

const report = ref<any>(null);
const loading = ref(false);
const asOfDate = ref(new Date().toISOString().split('T')[0]);
const currencyCode = ref('TZS');
const departmentFilter = ref('');

/**
 * GetBillingAgingReportUseCase pulls every open invoice unbounded and
 * buckets it in PHP — fine for the on-screen summary above, but a full CSV
 * export of it runs as a queued job instead of in-request (see
 * GenerateBillingReportExportJob). This polls the job to completion, then
 * opens its download URL.
 */
const exporting = ref(false);
const exportError = ref<string | null>(null);
let exportPollTimer: ReturnType<typeof setInterval> | null = null;

function stopExportPoll(): void {
    if (exportPollTimer !== null) {
        clearInterval(exportPollTimer);
        exportPollTimer = null;
    }
}

async function exportReportAsCsv(): Promise<void> {
    if (exporting.value) return;

    exporting.value = true;
    exportError.value = null;

    try {
        const created = await apiRequestJson<{ data: { id: string; status: string } }>(
            'POST',
            '/aging-report/export-jobs',
            {
                body: {
                    asOfDate: asOfDate.value || null,
                    currencyCode: currencyCode.value || null,
                    departmentFilter: departmentFilter.value || null,
                },
            },
        );

        const jobId = created.data.id;

        exportPollTimer = setInterval(async () => {
            try {
                const polled = await apiRequestJson<{
                    data: { status: string; downloadUrl: string | null; errorMessage: string | null };
                }>('GET', `/aging-report/export-jobs/${jobId}`);

                if (polled.data.status === 'completed' && polled.data.downloadUrl) {
                    stopExportPoll();
                    exporting.value = false;
                    window.location.href = polled.data.downloadUrl;
                } else if (polled.data.status === 'failed') {
                    stopExportPoll();
                    exporting.value = false;
                    exportError.value = polled.data.errorMessage || 'Unable to generate the report export.';
                    notifyError(exportError.value);
                }
            } catch (error) {
                stopExportPoll();
                exporting.value = false;
                notifyError(error instanceof Error ? error.message : 'Unable to check export status.');
            }
        }, 2000);
    } catch (error) {
        exporting.value = false;
        notifyError(error instanceof Error ? error.message : 'Unable to start the report export.');
    }
}

onUnmounted(stopExportPoll);

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
                <Button variant="outline" :disabled="exporting" @click="exportReportAsCsv">
                    {{ exporting ? 'Preparing export…' : 'Export as CSV' }}
                </Button>
            </div>
            <p v-if="exportError" class="text-sm text-destructive">{{ exportError }}</p>

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
