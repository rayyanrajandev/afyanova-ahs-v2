<script setup lang="ts">
import EncounterInlineOrderPanel from '@/components/domain/clinical/encounter-orders/EncounterInlineOrderPanel.vue';
import { Sheet, SheetContent } from '@/components/ui/sheet';
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
    <Sheet :open="open && orderType !== null" @update:open="(value) => { if (!value) emit('close'); }">
        <SheetContent
            side="right"
            variant="form"
            size="xl"
            show-close-button
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
        </SheetContent>
    </Sheet>
</template>
