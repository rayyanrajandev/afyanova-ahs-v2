<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBulkUpdateServiceCatalogStatus } from '@/composables/serviceCatalogIndex/useBulkUpdateServiceCatalogStatus';
import type { CatalogStatus } from '@/lib/billingServiceCatalog';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';

const props = defineProps<{
    itemIds: string[];
    targetStatus: CatalogStatus;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [count: number];
}>();

const reason = ref('');
const submitError = ref<string | null>(null);
const bulkUpdate = useBulkUpdateServiceCatalogStatus();

watch(open, (isOpen) => {
    if (!isOpen) return;
    reason.value = '';
    submitError.value = null;
});

const title = computed(() => {
    if (props.targetStatus === 'retired') return 'Retire selected billable services';
    if (props.targetStatus === 'inactive') return 'Deactivate selected billable services';
    return 'Activate selected billable services';
});

async function submit(): Promise<void> {
    if (bulkUpdate.isPending.value || props.itemIds.length === 0) return;

    submitError.value = null;
    try {
        const response = await bulkUpdate.mutateAsync({
            itemIds: props.itemIds,
            status: props.targetStatus,
            reason: reason.value.trim() || null,
        });
        notifySuccess(`Updated ${response.meta.updated} billable service${response.meta.updated === 1 ? '' : 's'}.`);
        emit('updated', response.meta.updated);
        open.value = false;
    } catch (error) {
        submitError.value = messageFromUnknown(error, 'Unable to apply bulk status change.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent variant="action" size="md">
            <DialogHeader>
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription>
                    Applies to {{ itemIds.length }} selected billable service{{ itemIds.length === 1 ? '' : 's' }}. Add a short reason for audit traceability.
                </DialogDescription>
            </DialogHeader>
            <div class="grid gap-2">
                <Label for="billing-bulk-status-reason">Reason</Label>
                <Textarea
                    id="billing-bulk-status-reason"
                    v-model="reason"
                    class="min-h-20"
                    :placeholder="targetStatus === 'active' ? 'Optional activation note' : 'Required reason for deactivation or retirement'"
                />
            </div>
            <Alert v-if="submitError" variant="destructive">
                <AlertTitle>Bulk status issue</AlertTitle>
                <AlertDescription>{{ submitError }}</AlertDescription>
            </Alert>
            <DialogFooter class="gap-2">
                <Button variant="outline" :disabled="bulkUpdate.isPending.value" @click="open = false">Cancel</Button>
                <Button :disabled="bulkUpdate.isPending.value" @click="submit">
                    {{ bulkUpdate.isPending.value ? 'Applying...' : 'Apply status' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
