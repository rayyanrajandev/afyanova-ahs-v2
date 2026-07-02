<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
const importFileInput = ref<HTMLInputElement | null>(null);

function downloadTemplate() {
    window.open('/api/v1/inventory-procurement/items/import-template', '_blank');
}
</script>

<template>
<Sheet :open="ws.importItemsCsvDialogOpen as boolean" @update:open="(open: boolean) => { if (!open) (ws.closeImportItemsCsvDialog as () => void)(); }">
    <SheetContent side="right" variant="form" size="xl">
        <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
            <SheetTitle class="flex items-center gap-2">
                <AppIcon name="file-text" class="size-5 text-muted-foreground" />
                Import Inventory Items
            </SheetTitle>
            <SheetDescription>Upload a CSV file to bulk-create inventory items. The file must follow the inventory item import template.</SheetDescription>
        </SheetHeader>
        <div class="flex min-h-0 flex-1 flex-col gap-4 p-6">
            <div v-if="!(ws.importItemsCsvFile as any)" class="flex flex-col items-center gap-4">
                <div
                    class="flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-muted/20"
                    @click="importFileInput?.click()"
                >
                    <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
                        <AppIcon name="file-text" class="size-6 text-primary" />
                    </div>
                    <div>
                        <p class="text-sm font-medium">Click to choose a CSV file</p>
                        <p class="mt-1 text-xs text-muted-foreground">.csv files up to 10MB</p>
                    </div>
                    <input
                        :key="`import-csv-${ws.importItemsCsvInputKey as any}`"
                        ref="importFileInput"
                        type="file"
                        accept=".csv,text/csv"
                        class="sr-only"
                        @change="(e: Event) => { const target = e.target as HTMLInputElement | null; (ws as any).importItemsCsvFile = target?.files?.[0] ?? null; (ws as any).importItemsCsvResult = null; }"
                    />
                </div>
                <Button variant="link" class="h-auto p-0 text-xs" @click="downloadTemplate">
                    Download import template (CSV)
                </Button>
            </div>
            <div v-else class="flex flex-col gap-4">
                <div class="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                    <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                        <AppIcon name="file-text" class="size-5 text-primary" />
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium truncate">{{ (ws.importItemsCsvFile as any)?.name }}</p>
                        <p class="text-xs text-muted-foreground">{{ ((ws.importItemsCsvFile as any)?.size / 1024).toFixed(1) }} KB</p>
                    </div>
                    <Button variant="ghost" size="sm" class="h-8 w-8 p-0 shrink-0" :disabled="ws.importItemsCsvSubmitting as any" @click="(ws as any).importItemsCsvFile = null; (ws as any).importItemsCsvResult = null; (ws as any).importItemsCsvInputKey++">
                        <AppIcon name="x" class="size-4" />
                    </Button>
                </div>

                <Alert v-if="ws.importItemsCsvResult as any" :variant="(ws.importItemsCsvResult as any)?.failed > 0 ? 'destructive' : 'default'">
                    <AlertTitle>{{ (ws.importItemsCsvResult as any)?.successful }} imported{{ (ws.importItemsCsvResult as any)?.failed > 0 ? `, ${(ws.importItemsCsvResult as any)?.failed} failed` : '' }}</AlertTitle>
                    <AlertDescription v-if="(ws.importItemsCsvResult as any)?.errors" class="whitespace-pre-wrap font-mono text-xs">{{ (ws.importItemsCsvResult as any)?.errors }}</AlertDescription>
                </Alert>
            </div>
        </div>
        <SheetFooter class="gap-2 border-t px-6 py-4">
            <Button variant="outline" :disabled="ws.importItemsCsvSubmitting as any" @click="(ws.closeImportItemsCsvDialog as () => void)()">
                Cancel
            </Button>
            <Button
                class="gap-1.5"
                :disabled="!(ws.importItemsCsvFile as any) || (ws.importItemsCsvSubmitting as any)"
                @click="(ws.submitImportItemsCsv as () => Promise<void>)()"
            >
                <AppIcon name="file-text" class="size-3.5" />
                {{ (ws.importItemsCsvSubmitting as any) ? 'Importing…' : 'Import Items' }}
            </Button>
        </SheetFooter>
    </SheetContent>
</Sheet>
</template>

