<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type InventoryBarcodeItem, useInventoryBarcodeLookup } from '@/composables/useInventoryBarcodeLookup';
import { formatEnumLabel } from '@/lib/labels';

const props = withDefaults(
    defineProps<{
        inputId?: string;
        label?: string;
        helperText?: string;
        disabled?: boolean;
    }>(),
    {
        inputId: 'inventory-barcode-scan',
        label: 'Scan barcode',
        helperText: 'Scan with a handheld reader or type the code and press Enter.',
        disabled: false,
    },
);

const emit = defineEmits<{
    resolved: [item: InventoryBarcodeItem];
    cleared: [];
}>();

const { barcodeInput, loading, error, result, lookup, onEnter, reset } = useInventoryBarcodeLookup();

async function applyLookup(): Promise<void> {
    const item = await lookup();
    if (item) {
        emit('resolved', item);
    }
}

function clear(): void {
    reset();
    emit('cleared');
}
</script>

<template>
    <div class="grid gap-2 rounded-lg border border-dashed bg-muted/15 p-3">
        <div class="flex items-center gap-2">
            <AppIcon name="search" class="size-4 text-muted-foreground" />
            <Label :for="props.inputId" class="text-sm font-medium">{{ props.label }}</Label>
        </div>
        <p v-if="props.helperText" class="text-xs text-muted-foreground">{{ props.helperText }}</p>
        <div class="flex gap-2">
            <Input
                :id="props.inputId"
                v-model="barcodeInput"
                :disabled="props.disabled || loading"
                placeholder="Scan or type barcode…"
                class="font-mono text-sm"
                autocomplete="off"
                @keydown="onEnter"
            />
            <Button type="button" variant="secondary" :disabled="props.disabled || loading || !barcodeInput.trim()" @click="applyLookup">
                {{ loading ? '…' : 'Find' }}
            </Button>
            <Button v-if="result || barcodeInput" type="button" variant="ghost" :disabled="loading" @click="clear">
                Clear
            </Button>
        </div>
        <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <Card v-if="result" class="bg-background shadow-none">
            <CardContent class="grid gap-1.5 p-3 text-sm">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-medium">{{ result.itemName }}</span>
                    <Badge variant="outline">{{ result.itemCode }}</Badge>
                </div>
                <p class="text-xs text-muted-foreground">
                    On hand {{ result.currentStock ?? 0 }} {{ result.unit ?? 'units' }}
                    <template v-if="result.category"> · {{ formatEnumLabel(result.category) }}</template>
                </p>
            </CardContent>
        </Card>
    </div>
</template>
