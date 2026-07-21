<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateServiceCatalogStatus } from '@/composables/serviceCatalogWorkspace/useUpdateServiceCatalogStatus';
import { tariffLifecycleLabel, tariffWindowLabel, type CatalogItem, type CatalogStatus } from '@/lib/billingServiceCatalog';
import { generateRequestKey } from '@/lib/idempotency';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown } from '@/lib/notify';

const props = defineProps<{
    item: CatalogItem;
    canManage: boolean;
}>();

const emit = defineEmits<{
    updated: [item: CatalogItem];
    openHistory: [];
}>();

const status = ref<CatalogStatus>('active');
const reason = ref('');
const fieldErrors = ref<Record<string, string[]>>({});

function hydrate(item: CatalogItem): void {
    status.value = (item.status ?? 'active') as CatalogStatus;
    reason.value = item.statusReason ?? '';
    fieldErrors.value = {};
}

watch(() => props.item, hydrate, { immediate: true });

const statusSelectValue = computed({
    get: () => status.value,
    set: (value: string) => { status.value = (value === 'inactive' || value === 'retired' ? value : 'active') as CatalogStatus; },
});

const summaryCards = computed(() => [
    { key: 'current', label: 'Current status', value: formatEnumLabel(props.item.status), helper: props.item.statusReason || 'No status reason recorded' },
    { key: 'window', label: 'Active window', value: tariffLifecycleLabel(props.item.effectiveFrom, props.item.effectiveTo), helper: tariffWindowLabel(props.item.effectiveFrom, props.item.effectiveTo) },
    { key: 'next', label: 'Change target', value: formatEnumLabel(status.value || props.item.status || 'active'), helper: reason.value.trim() || 'Add a reason when pausing or retiring a price.' },
]);

const update = useUpdateServiceCatalogStatus();

async function submit(): Promise<void> {
    if (!props.canManage || update.isPending.value) return;

    fieldErrors.value = {};
    const trimmedReason = reason.value.trim();
    if ((status.value === 'inactive' || status.value === 'retired') && !trimmedReason) {
        fieldErrors.value = { reason: ['Reason is required when status is inactive or retired.'] };
        return;
    }

    try {
        const item = await update.mutateAsync({
            itemId: String(props.item.id),
            status: status.value,
            reason: trimmedReason || null,
            idempotencyKey: generateRequestKey('billing-service-catalog-status'),
        });
        emit('updated', item);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: { errors?: Record<string, string[]> } };
        if (apiError.status === 422 && apiError.payload?.errors) {
            fieldErrors.value = apiError.payload.errors;
        } else {
            fieldErrors.value = { reason: [messageFromUnknown(error, 'Unable to update service catalog item status.')] };
        }
    }
}
</script>

<template>
    <div class="space-y-4">
        <div class="rounded-lg border p-3">
            <div class="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p class="text-sm font-medium">Status</p>
                    <p class="text-xs text-muted-foreground">Pause, reactivate, or retire this service price with the right reason trail.</p>
                </div>
                <Button size="sm" variant="outline" @click="emit('openHistory')">Open history</Button>
            </div>
            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div v-for="card in summaryCards" :key="card.key" class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                    <p class="mt-1 text-sm font-semibold">{{ card.value }}</p>
                    <p class="mt-1 text-xs text-muted-foreground">{{ card.helper }}</p>
                </div>
            </div>
        </div>

        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Change status</legend>
            <p class="text-xs text-muted-foreground">Use "Inactive" for temporary hold and "Retired" when this price should no longer be used.</p>
            <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1.5">
                    <Label for="status-target">New status</Label>
                    <Select v-model="statusSelectValue" :disabled="!canManage">
                        <SelectTrigger id="status-target" class="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="space-y-1.5">
                    <Label for="status-reason">Reason</Label>
                    <Textarea id="status-reason" v-model="reason" class="min-h-24" :disabled="!canManage" placeholder="Required for inactive or retired prices" />
                    <p v-if="fieldErrors.reason?.[0]" class="text-xs text-destructive">{{ fieldErrors.reason[0] }}</p>
                </div>
            </div>
        </fieldset>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-xs text-muted-foreground">Use status changes for operational control, not for price edits.</p>
            <Button v-if="canManage" :disabled="update.isPending.value" @click="submit">
                {{ update.isPending.value ? 'Saving...' : 'Save status change' }}
            </Button>
        </div>
    </div>
</template>
