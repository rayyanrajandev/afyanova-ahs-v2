<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import EncounterInlineOrderPanel from '@/components/domain/clinical/encounter-orders/EncounterInlineOrderPanel.vue';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
    encounterInlineOrderModeLabel,
    encounterInlineOrderTypeLabel,
    type EncounterInlineOrderLinkageContext,
    type EncounterInlineOrderType,
    type EncounterOrderContext,
} from '@/lib/encounterInlineOrders';

const props = defineProps<{
    open: boolean;
    orderType: EncounterInlineOrderType | null;
    linkage: EncounterInlineOrderLinkageContext | null;
    context: EncounterOrderContext;
}>();

const emit = defineEmits<{
    close: [];
    created: [type: EncounterInlineOrderType];
}>();

const panelRef = useTemplateRef<InstanceType<typeof EncounterInlineOrderPanel>>('panel');

const title = computed(() => {
    if (!props.orderType) return 'New order';
    const label = encounterInlineOrderTypeLabel(props.orderType);
    const mode = props.linkage ? ` — ${encounterInlineOrderModeLabel(props.linkage.mode)}` : '';
    return `New ${label}${mode}`;
});

const description = computed(() => {
    if (props.linkage?.mode === 'reorder') return `Replacement linked to ${props.linkage.sourceLabel}.`;
    if (props.linkage?.mode === 'add_on') return `Add-on linked to ${props.linkage.sourceLabel}.`;
    return 'Order is linked to this encounter. Duplicate checks run before placement.';
});

const canSubmit = computed(() => panelRef.value?.canSubmit ?? false);
const submitLoading = computed(() => panelRef.value?.submitLoading ?? false);

function handleSubmit(): void {
    panelRef.value?.submitOrder();
}
</script>

<template>
    <Sheet :open="open && orderType !== null" @update:open="(value) => { if (!value) emit('close'); }">
        <SheetContent
            side="right"
            variant="form"
            size="2xl"
            @open-auto-focus="(event: Event) => event.preventDefault()"
        >
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>{{ title }}</SheetTitle>
                <SheetDescription>{{ description }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <EncounterInlineOrderPanel
                    v-if="orderType"
                    ref="panel"
                    :order-type="orderType"
                    :linkage="linkage"
                    :context="context"
                    @close="emit('close')"
                    @created="emit('created', $event)"
                />
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="emit('close')">Cancel</Button>
                <Button :disabled="!canSubmit" @click="handleSubmit">
                    <AppIcon
                        :name="submitLoading ? 'loader-circle' : 'plus'"
                        class="size-3.5"
                        :class="{ 'animate-spin': submitLoading }"
                    />
                    {{ submitLoading ? 'Placing order…' : 'Place order' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
