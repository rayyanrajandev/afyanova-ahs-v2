<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import SupplyChainTaskShell from '@/pages/inventory-procurement/components/SupplyChainTaskShell.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryMasterLookups } from '@/composables/useInventoryMasterLookups';
import { useInventoryProcurementAccess } from '@/composables/useInventoryProcurementAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { INVENTORY_PROCUREMENT_HOME_PATH, inventoryWorkspaceHref } from '@/lib/inventoryProcurement';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { message?: string; errors?: Record<string, string[]> } };
type LookupItem = {
    id: string;
    itemName?: string | null;
    unit?: string | null;
    currentStock?: number | string | null;
    category?: string | null;
};
type DepartmentRequisition = Record<string, unknown>;

const EMPTY_SELECT = '__empty__';
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Issue stock', href: '/inventory-procurement/issue' },
];

const { canRead, canCreateMovement, loadPermissions } = useInventoryProcurementAccess();
const { warehouses, departments, loadLookups, lookupLabel } = useInventoryMasterLookups();

const itemId = ref('');
const selectedItem = ref<LookupItem | null>(null);
const pendingRequisitions = ref<DepartmentRequisition[]>([]);
const requisitionsLoading = ref(false);

const submitting = ref(false);
const formError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const issueForm = reactive({
    quantity: '',
    sourceWarehouseId: '',
    destinationDepartmentId: '',
    reason: '',
    notes: '',
    occurredAt: '',
});

function toSelect(value: string): string {
    return value.trim() === '' ? EMPTY_SELECT : value;
}

function fromSelect(value: string): string {
    return value === EMPTY_SELECT ? '' : value;
}

function fieldError(key: string): string | null {
    return fieldErrors.value[key]?.[0] ?? null;
}

const canSubmit = computed(() => (
    canCreateMovement.value
    && itemId.value.trim() !== ''
    && issueForm.quantity.trim() !== ''
    && issueForm.reason.trim() !== ''
));

const unitLabel = computed(() => {
    const unit = selectedItem.value?.unit;
    return typeof unit === 'string' && unit.trim() ? unit.trim() : 'units';
});

async function loadPendingRequisitions(): Promise<void> {
    requisitionsLoading.value = true;
    try {
        const response = await apiRequestJson<{ data: DepartmentRequisition[] }>('GET', '/inventory-procurement/department-requisitions', {
            query: { status: 'approved', perPage: 15 },
        });
        pendingRequisitions.value = response.data ?? [];
    } catch {
        pendingRequisitions.value = [];
    } finally {
        requisitionsLoading.value = false;
    }
}

function onItemSelected(item: LookupItem | null): void {
    selectedItem.value = item;
}

async function submitIssue(): Promise<void> {
    if (!canSubmit.value || submitting.value) {
        return;
    }

    submitting.value = true;
    formError.value = null;
    fieldErrors.value = {};

    try {
        await apiRequestJson('POST', '/inventory-procurement/stock-movements', {
            body: {
                itemId: itemId.value.trim(),
                movementType: 'issue',
                sourceWarehouseId: issueForm.sourceWarehouseId.trim() || null,
                destinationDepartmentId: issueForm.destinationDepartmentId.trim() || null,
                quantity: Number(issueForm.quantity),
                reason: issueForm.reason.trim(),
                notes: issueForm.notes.trim() || null,
                occurredAt: issueForm.occurredAt || null,
            },
        });
        notifySuccess('Stock issued from store.');
        itemId.value = '';
        selectedItem.value = null;
        issueForm.quantity = '';
        issueForm.reason = '';
        issueForm.notes = '';
        issueForm.occurredAt = '';
    } catch (error) {
        const apiError = error as ApiError;
        fieldErrors.value = apiError.payload?.errors ?? {};
        formError.value = messageFromUnknown(error, 'Unable to issue stock.');
        notifyError(formError.value);
    } finally {
        submitting.value = false;
    }
}

onMounted(async () => {
    await loadPermissions();
    if (!canRead.value) {
        return;
    }

    await Promise.all([loadLookups(), loadPendingRequisitions()]);
});
</script>

<template>
    <Head title="Issue stock" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 p-4 md:p-6">
            <Alert v-if="!canRead" variant="destructive">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription>You do not have permission to issue stock.</AlertDescription>
            </Alert>

            <div v-else class="grid gap-4 xl:grid-cols-3">
                <div class="xl:col-span-2">
                    <SupplyChainTaskShell
                        title="Issue to department"
                        description="Remove stock from the central store for ward use, procedures, or direct patient care."
                        icon="package"
                        :breadcrumbs="breadcrumbs"
                    >
                        <div v-if="!canCreateMovement" class="text-sm text-muted-foreground">
                            Stock movement permission is required to issue items.
                        </div>
                        <div v-else class="space-y-4">
                            <InventoryItemLookupField
                                v-model="itemId"
                                input-id="issue-item"
                                label="Store item *"
                                browse-on-focus
                                @selected="onItemSelected"
                            />

                            <Card v-if="selectedItem">
                                <CardHeader class="pb-2">
                                    <CardTitle class="text-base">{{ selectedItem.itemName }}</CardTitle>
                                    <CardDescription>
                                        On hand: {{ selectedItem.currentStock ?? 0 }} {{ unitLabel }}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent class="grid gap-4 sm:grid-cols-2">
                                    <div class="grid gap-1.5">
                                        <Label>Issue quantity *</Label>
                                        <Input v-model="issueForm.quantity" type="number" min="0.001" step="0.001" />
                                        <p v-if="fieldError('quantity')" class="text-xs text-destructive">{{ fieldError('quantity') }}</p>
                                    </div>
                                    <div class="grid gap-1.5">
                                        <Label>Issued from warehouse</Label>
                                        <Select
                                            :model-value="toSelect(issueForm.sourceWarehouseId)"
                                            @update:model-value="issueForm.sourceWarehouseId = fromSelect(String($event))"
                                        >
                                            <SelectTrigger class="w-full"><SelectValue placeholder="Central store" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem :value="EMPTY_SELECT">Select warehouse</SelectItem>
                                                <SelectItem v-for="w in warehouses" :key="w.id" :value="w.id">{{ lookupLabel(warehouses, w.id) }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-1.5 sm:col-span-2">
                                        <Label>Issued to department *</Label>
                                        <Select
                                            :model-value="toSelect(issueForm.destinationDepartmentId)"
                                            @update:model-value="issueForm.destinationDepartmentId = fromSelect(String($event))"
                                        >
                                            <SelectTrigger class="w-full"><SelectValue placeholder="Ward or unit" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem :value="EMPTY_SELECT">Select department</SelectItem>
                                                <SelectItem v-for="d in departments" :key="d.id" :value="d.id">{{ lookupLabel(departments, d.id) }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p v-if="fieldError('destinationDepartmentId')" class="text-xs text-destructive">{{ fieldError('destinationDepartmentId') }}</p>
                                    </div>
                                    <div class="grid gap-1.5 sm:col-span-2">
                                        <Label>Reason *</Label>
                                        <Input v-model="issueForm.reason" placeholder="Ward issue, procedure use, emergency…" />
                                        <p v-if="fieldError('reason')" class="text-xs text-destructive">{{ fieldError('reason') }}</p>
                                    </div>
                                    <div class="grid gap-1.5 sm:col-span-2">
                                        <Label>Notes</Label>
                                        <Textarea v-model="issueForm.notes" class="min-h-14" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Alert v-if="formError" variant="destructive">
                                <AlertDescription>{{ formError }}</AlertDescription>
                            </Alert>

                            <Button class="gap-1.5" :disabled="submitting || !canSubmit" @click="submitIssue">
                                <AppIcon name="check-circle" class="size-4" />
                                {{ submitting ? 'Issuing…' : 'Confirm issue' }}
                            </Button>
                        </div>
                    </SupplyChainTaskShell>
                </div>

                <Card class="h-fit rounded-lg shadow-sm">
                    <CardHeader class="pb-2">
                        <CardTitle class="text-base">Ward requisitions</CardTitle>
                        <CardDescription>Approved requests — fulfill in the full workspace for line-level control.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-2">
                        <div v-if="requisitionsLoading" class="space-y-2">
                            <Skeleton v-for="n in 4" :key="n" class="h-12 w-full" />
                        </div>
                        <p v-else-if="pendingRequisitions.length === 0" class="text-sm text-muted-foreground">
                            No approved requisitions in the first page of results.
                        </p>
                        <div v-else class="space-y-2">
                            <div
                                v-for="req in pendingRequisitions"
                                :key="String(req.id)"
                                class="rounded-md border px-3 py-2 text-sm"
                            >
                                <div class="flex items-center justify-between gap-2">
                                    <span class="font-medium">{{ req.requisitionNumber ?? 'Requisition' }}</span>
                                    <Badge variant="outline">{{ formatEnumLabel(String(req.status ?? '')) }}</Badge>
                                </div>
                                <p class="text-xs text-muted-foreground">{{ req.requestingDepartment ?? 'Department' }}</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" class="mt-2 w-full" as-child>
                            <Link :href="inventoryWorkspaceHref({ section: 'requisitions' })">Open requisitions workspace</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    </AppLayout>
</template>
