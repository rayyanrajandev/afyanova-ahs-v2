<script setup lang="ts">
import EncounterInlineOrderPanel from '@/components/domain/clinical/encounter-orders/EncounterInlineOrderPanel.vue';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type {
    EncounterInlineOrderLinkageContext,
    EncounterInlineOrderType,
    EncounterOrderContext,
} from '@/lib/encounterInlineOrders';

defineProps<{
    open: boolean;
    orderType: EncounterInlineOrderType | null;
    linkage: EncounterInlineOrderLinkageContext | null;
    context: EncounterOrderContext;
}>();

const emit = defineEmits<{
    close: [];
    created: [type: EncounterInlineOrderType];
}>();
</script>

<template>
    <Dialog :open="open && orderType !== null" @update:open="(value) => { if (!value) emit('close'); }">
        <DialogContent
            variant="form"
            size="xl"
            @escape-key-down="emit('close')"
        >
            <EncounterInlineOrderPanel
                v-if="orderType"
                :order-type="orderType"
                :linkage="linkage"
                :context="context"
                @close="emit('close')"
                @created="emit('created', $event)"
            />
        </DialogContent>
    </Dialog>
</template>
