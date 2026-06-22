<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiGetBlob, apiRequestJson } from '@/lib/apiClient';
import {
    CLINICAL_CATALOG_BULK_MAX_IMPORT_ROWS,
    type ClinicalCatalogBulkKey,
    type ClinicalCatalogImportPreviewRow,
    importPreviewStats,
    isImportPreviewFailure,
    parseClinicalCatalogCsv,
} from '@/lib/clinicalCatalogBulk';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

type ImportMode = 'create' | 'upsert';
type BulkPanel = 'import' | 'export';
type ImportStep = 'prepare' | 'upload' | 'review' | 'complete';
type PreviewFilter = 'all' | 'ready' | 'issues';

type ImportApiResult = {
    dry_run: boolean;
    mode: ImportMode;
    requested_count: number;
    created_count: number;
    updated_count: number;
    failed_count: number;
    validation_errors: string[];
    results: Array<{
        rowNumber: number;
        code: string;
        outcome: string;
        errors: string[];
    }>;
};

const props = defineProps<{
    open: boolean;
    catalogKey: ClinicalCatalogBulkKey;
    apiBase: string;
    catalogLabel: string;
    canManage: boolean;
    listFilters: {
        q: string;
        status: string;
        category: string;
    };
    selectedItemIds: string[];
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    completed: [];
}>();

const activePanel = ref<BulkPanel>('import');
const importStep = ref<ImportStep>('prepare');
const importMode = ref<ImportMode>('upsert');
const importFileName = ref('');
const importRows = ref<Array<{ rowNumber: number; values: Record<string, string> }>>([]);
const importPreview = ref<ClinicalCatalogImportPreviewRow[]>([]);
const importError = ref<string | null>(null);
const importBusy = ref(false);
const exportBusy = ref(false);
const previewFilter = ref<PreviewFilter>('all');
const importDragActive = ref(false);
const lastApplyCounts = ref({ created: 0, updated: 0, failed: 0 });

const hasImportRows = computed(() => importRows.value.length > 0);
const selectedExportCount = computed(() => props.selectedItemIds.length);
const previewStats = computed(() => importPreviewStats(importPreview.value));
const filteredPreviewRows = computed(() => {
    if (previewFilter.value === 'issues') {
        return importPreview.value.filter((row) => isImportPreviewFailure(row.outcome));
    }
    if (previewFilter.value === 'ready') {
        return importPreview.value.filter((row) => !isImportPreviewFailure(row.outcome));
    }
    return importPreview.value;
});

const exportFilterChips = computed(() => {
    const chips: string[] = [];
    if (props.listFilters.q.trim()) {
        chips.push(`Search “${props.listFilters.q.trim()}”`);
    }
    if (props.listFilters.status) {
        chips.push(formatEnumLabel(props.listFilters.status));
    }
    if (props.listFilters.category.trim()) {
        chips.push(`Category ${props.listFilters.category.trim()}`);
    }
    return chips;
});

const importSteps = computed(() => {
    const steps: Array<{ key: ImportStep; label: string; number: number }> = [
        { key: 'prepare', label: 'Prepare', number: 1 },
        { key: 'upload', label: 'Upload', number: 2 },
        { key: 'review', label: 'Review', number: 3 },
    ];
    if (importStep.value === 'complete') {
        return [...steps, { key: 'complete' as const, label: 'Done', number: 4 }];
    }
    return steps;
});

const canAdvanceFromUpload = computed(() => hasImportRows.value && !importBusy.value);
const canApplyImport = computed(
    () => props.canManage && importPreview.value.length > 0 && previewStats.value.failed === 0 && !importBusy.value,
);
const reviewHasBlockingErrors = computed(() => importPreview.value.length > 0 && previewStats.value.failed > 0);

watch(
    () => props.open,
    (open) => {
        if (!open) {
            return;
        }
        activePanel.value = props.canManage ? 'import' : 'export';
        resetImportFlow();
    },
);

function resetImportFlow(): void {
    importStep.value = 'prepare';
    importMode.value = 'upsert';
    importFileName.value = '';
    importRows.value = [];
    importPreview.value = [];
    importError.value = null;
    previewFilter.value = 'all';
    importDragActive.value = false;
    lastApplyCounts.value = { created: 0, updated: 0, failed: 0 };
}

function closeSheet(): void {
    emit('update:open', false);
}

function goToImportStep(step: ImportStep): void {
    importStep.value = step;
    if (step !== 'review' && step !== 'complete') {
        importError.value = null;
    }
}

async function downloadTemplate(): Promise<void> {
    try {
        await downloadCsv(`${props.apiBase}/import-template`, {}, `clinical-catalog-${props.catalogKey}-template.csv`);
        notifySuccess('Template downloaded.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to download import template.'));
    }
}

async function downloadCsv(path: string, query: Record<string, string | string[]>, fallbackName: string): Promise<void> {
    exportBusy.value = true;
    try {
        const { blob, filename } = await apiGetBlob(path, { query });
        triggerDownload(blob, filename ?? fallbackName);
    } finally {
        exportBusy.value = false;
    }
}

function triggerDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
}

async function ingestCsvFile(file: File): Promise<void> {
    importError.value = null;
    importPreview.value = [];
    previewFilter.value = 'all';

    try {
        const text = await file.text();
        importRows.value = parseClinicalCatalogCsv(text, props.catalogKey);
        importFileName.value = file.name;
        if (importRows.value.length === 0) {
            importError.value = 'The file has column headers but no data rows.';
        } else {
            goToImportStep('upload');
        }
    } catch (error) {
        importRows.value = [];
        importFileName.value = '';
        importError.value = messageFromUnknown(error, 'Unable to parse CSV file.');
    }
}

async function onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
        await ingestCsvFile(file);
    }
}

function onImportDragOver(event: DragEvent): void {
    event.preventDefault();
    importDragActive.value = true;
}

function onImportDragLeave(): void {
    importDragActive.value = false;
}

async function onImportDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    importDragActive.value = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
        return;
    }
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
        importError.value = 'Please upload a CSV file.';
        return;
    }
    await ingestCsvFile(file);
}

async function runImport(dryRun: boolean): Promise<boolean> {
    if (!hasImportRows.value || importBusy.value) {
        return false;
    }

    importBusy.value = true;
    importError.value = null;

    try {
        const response = await apiRequestJson<{ data: ImportApiResult }>('POST', `${props.apiBase}/bulk-import`, {
            body: {
                dryRun,
                mode: importMode.value,
                rows: importRows.value,
            },
        });

        const result = response.data;
        importPreview.value = (result.results ?? []).map((row) => ({
            rowNumber: row.rowNumber,
            code: row.code,
            name: importRows.value.find((entry) => entry.rowNumber === row.rowNumber)?.values.name ?? '',
            status: importRows.value.find((entry) => entry.rowNumber === row.rowNumber)?.values.status ?? '',
            outcome: row.outcome,
            errors: row.errors ?? [],
        }));
        goToImportStep('review');

        if (dryRun) {
            return true;
        }

        lastApplyCounts.value = {
            created: result.created_count ?? 0,
            updated: result.updated_count ?? 0,
            failed: result.failed_count ?? 0,
        };
        importStep.value = 'complete';
        notifySuccess(`Import complete: ${lastApplyCounts.value.created} created, ${lastApplyCounts.value.updated} updated.`);
        emit('completed');
        return true;
    } catch (error) {
        importError.value = messageFromUnknown(error, dryRun ? 'Validation failed.' : 'Import failed.');
        notifyError(importError.value);
        return false;
    } finally {
        importBusy.value = false;
    }
}

async function validateAndReview(): Promise<void> {
    await runImport(true);
}

async function applyImport(): Promise<void> {
    if (reviewHasBlockingErrors.value) {
        importError.value = 'Fix or remove rows with errors before applying.';
        return;
    }
    await runImport(false);
}

function clearUploadedFile(): void {
    importFileName.value = '';
    importRows.value = [];
    importPreview.value = [];
    importError.value = null;
    previewFilter.value = 'all';
    goToImportStep('upload');
}

async function exportList(scope: 'filtered' | 'selected'): Promise<void> {
    if (exportBusy.value) {
        return;
    }

    const query: Record<string, string | string[]> = {};
    if (scope === 'filtered') {
        if (props.listFilters.q.trim()) query.q = props.listFilters.q.trim();
        if (props.listFilters.status) query.status = props.listFilters.status;
        if (props.listFilters.category.trim()) query.category = props.listFilters.category.trim();
    } else if (props.selectedItemIds.length === 0) {
        notifyError('Select rows on the list first, then export selection.');
        return;
    } else {
        query.itemIds = props.selectedItemIds;
    }

    try {
        await downloadCsv(`${props.apiBase}/export`, query, `clinical-catalog-${props.catalogKey}.csv`);
        notifySuccess(scope === 'selected' ? 'Selected rows exported.' : 'Filtered catalog exported.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export catalog CSV.'));
    }
}

function outcomeLabel(outcome: string): string {
    return outcome.replace(/_/g, ' ');
}

function outcomeVariant(outcome: string): 'outline' | 'secondary' | 'destructive' {
    if (outcome === 'failed') return 'destructive';
    if (outcome === 'created' || outcome === 'updated' || outcome === 'would_create' || outcome === 'would_update') {
        return 'secondary';
    }
    return 'outline';
}

function isStepComplete(stepKey: ImportStep): boolean {
    const order: ImportStep[] = ['prepare', 'upload', 'review', 'complete'];
    return order.indexOf(importStep.value) > order.indexOf(stepKey);
}

function isStepCurrent(stepKey: ImportStep): boolean {
    return importStep.value === stepKey;
}
</script>

<template>
    <Sheet :open="open" @update:open="emit('update:open', $event)">
        <SheetContent side="right" variant="workspace" size="3xl" class="flex h-full min-h-0 flex-col gap-0 p-0">
            <SheetHeader class="shrink-0 border-b px-4 py-4 pr-12">
                <SheetTitle class="flex items-center gap-2 text-base">
                    <span
                        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                        aria-hidden="true"
                    >
                        <AppIcon name="layout-grid" class="size-4" />
                    </span>
                    <span class="min-w-0">
                        <span class="block truncate">Bulk workspace</span>
                        <span class="block text-xs font-normal text-muted-foreground">{{ catalogLabel }}</span>
                    </span>
                </SheetTitle>
                <SheetDescription class="text-xs leading-relaxed">
                    Import definitions from CSV with validation, or export the current list. Use row checkboxes on the registry for bulk status changes.
                </SheetDescription>
            </SheetHeader>

            <div class="shrink-0 border-b px-4 py-3">
                <div
                    class="grid gap-2"
                    :class="canManage ? 'grid-cols-2' : 'grid-cols-1'"
                    role="tablist"
                    aria-label="Bulk workspace mode"
                >
                    <button
                        v-if="canManage"
                        type="button"
                        role="tab"
                        :aria-selected="activePanel === 'import'"
                        class="flex min-h-11 flex-col items-start justify-center rounded-lg border-2 px-3 py-2 text-left transition-colors"
                        :class="
                            activePanel === 'import'
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border bg-background hover:bg-accent/50'
                        "
                        @click="activePanel = 'import'"
                    >
                        <span class="flex items-center gap-1.5 text-sm font-semibold">
                            <AppIcon name="package" class="size-3.5" />
                            Import CSV
                        </span>
                        <span class="mt-0.5 text-[11px] text-muted-foreground">Template, upload, review, apply</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        :aria-selected="activePanel === 'export'"
                        class="flex min-h-11 flex-col items-start justify-center rounded-lg border-2 px-3 py-2 text-left transition-colors"
                        :class="
                            activePanel === 'export'
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border bg-background hover:bg-accent/50'
                        "
                        @click="activePanel = 'export'"
                    >
                        <span class="flex items-center gap-1.5 text-sm font-semibold">
                            <AppIcon name="file-text" class="size-3.5" />
                            Export CSV
                        </span>
                        <span class="mt-0.5 text-[11px] text-muted-foreground">Filtered list or selected rows</span>
                    </button>
                </div>
            </div>

            <ScrollArea class="min-h-0 flex-1">
                <div v-if="canManage && activePanel === 'import'" class="space-y-4 px-4 py-4">
                    <nav aria-label="Import progress" class="flex flex-wrap items-center gap-2">
                        <template v-for="(step, index) in importSteps" :key="step.key">
                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    class="flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                                    :class="
                                        isStepCurrent(step.key)
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : isStepComplete(step.key)
                                              ? 'border-primary/30 bg-primary/10 text-primary'
                                              : 'border-border bg-muted/40 text-muted-foreground'
                                    "
                                    :disabled="step.key === 'complete' && importStep !== 'complete'"
                                    @click="
                                        step.key === 'prepare'
                                            ? goToImportStep('prepare')
                                            : step.key === 'upload' && (hasImportRows || importFileName)
                                              ? goToImportStep('upload')
                                              : step.key === 'review' && importPreview.length
                                                ? goToImportStep('review')
                                                : undefined
                                    "
                                >
                                    <span
                                        class="flex size-5 items-center justify-center rounded-full text-[10px]"
                                        :class="isStepCurrent(step.key) ? 'bg-primary-foreground/20' : 'bg-background/80'"
                                    >
                                        {{ step.number }}
                                    </span>
                                    {{ step.label }}
                                </button>
                                <AppIcon
                                    v-if="index < importSteps.length - 1"
                                    name="chevron-right"
                                    class="size-3.5 text-muted-foreground"
                                    aria-hidden="true"
                                />
                            </div>
                        </template>
                    </nav>

                    <div v-if="importStep === 'prepare'" class="space-y-4">
                        <fieldset class="space-y-3 rounded-lg border p-4">
                            <legend class="px-1 text-sm font-medium">1. Download domain template</legend>
                            <p class="text-xs text-muted-foreground">
                                Headers match {{ catalogLabel.toLowerCase() }} fields (including standards and workflow metadata). Fill the template in Excel or Google Sheets, then save as CSV.
                            </p>
                            <Button variant="outline" size="sm" class="h-9 gap-2" @click="downloadTemplate">
                                <AppIcon name="file-text" class="size-4" />
                                Download {{ catalogLabel }} template
                            </Button>
                        </fieldset>

                        <fieldset class="space-y-3 rounded-lg border p-4">
                            <legend class="px-1 text-sm font-medium">2. Choose import behavior</legend>
                            <div class="grid gap-2 sm:grid-cols-2">
                                <button
                                    type="button"
                                    class="rounded-lg border-2 p-3 text-left transition-colors"
                                    :class="
                                        importMode === 'upsert'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:border-primary/30 hover:bg-accent/40'
                                    "
                                    @click="importMode = 'upsert'"
                                >
                                    <p class="text-sm font-semibold">Create or update</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Match existing rows by code and update them; new codes are created.</p>
                                </button>
                                <button
                                    type="button"
                                    class="rounded-lg border-2 p-3 text-left transition-colors"
                                    :class="
                                        importMode === 'create'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:border-primary/30 hover:bg-accent/40'
                                    "
                                    @click="importMode = 'create'"
                                >
                                    <p class="text-sm font-semibold">Create only</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Skip rows whose code already exists in this facility scope.</p>
                                </button>
                            </div>
                        </fieldset>

                        <p class="text-xs text-muted-foreground">
                            Maximum {{ CLINICAL_CATALOG_BULK_MAX_IMPORT_ROWS }} data rows per file.
                        </p>
                    </div>

                    <div v-else-if="importStep === 'upload'" class="space-y-4">
                        <div
                            class="relative rounded-xl border-2 border-dashed p-8 text-center transition-colors"
                            :class="
                                importDragActive
                                    ? 'border-primary bg-primary/5'
                                    : hasImportRows
                                      ? 'border-primary/40 bg-primary/[0.03]'
                                      : 'border-border bg-muted/20'
                            "
                            @dragover="onImportDragOver"
                            @dragleave="onImportDragLeave"
                            @drop="onImportDrop"
                        >
                            <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                                <AppIcon :name="hasImportRows ? 'file-text' : 'package'" class="size-5 text-primary" />
                            </div>
                            <p class="mt-3 text-sm font-medium">
                                {{ hasImportRows ? 'File ready for validation' : 'Drop CSV here or browse' }}
                            </p>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{ importFileName || 'Accepted format: .csv with template headers' }}
                            </p>
                            <div class="mt-4 flex flex-wrap justify-center gap-2">
                                <Label class="inline-flex cursor-pointer">
                                    <Button variant="secondary" size="sm" class="h-9 gap-2" as-child>
                                        <span>
                                            <AppIcon name="folder" class="size-4" />
                                            Browse file
                                        </span>
                                    </Button>
                                    <input type="file" accept=".csv,text/csv" class="sr-only" @change="onImportFileSelected" />
                                </Label>
                                <Button
                                    v-if="hasImportRows"
                                    variant="outline"
                                    size="sm"
                                    class="h-9"
                                    :disabled="importBusy"
                                    @click="clearUploadedFile"
                                >
                                    Remove file
                                </Button>
                            </div>
                        </div>

                        <div v-if="hasImportRows" class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                            <Badge variant="secondary" class="text-[10px]">{{ importRows.length }} rows</Badge>
                            <span class="text-muted-foreground">{{ importMode === 'upsert' ? 'Upsert mode' : 'Create-only mode' }}</span>
                        </div>
                    </div>

                    <div v-else-if="importStep === 'review'" class="space-y-4">
                        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div class="rounded-lg border bg-card px-3 py-2">
                                <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Rows</p>
                                <p class="text-lg font-semibold tabular-nums">{{ previewStats.total }}</p>
                            </div>
                            <div class="rounded-lg border bg-card px-3 py-2">
                                <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Create</p>
                                <p class="text-lg font-semibold tabular-nums text-emerald-600">{{ previewStats.create }}</p>
                            </div>
                            <div class="rounded-lg border bg-card px-3 py-2">
                                <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Update</p>
                                <p class="text-lg font-semibold tabular-nums text-sky-600">{{ previewStats.update }}</p>
                            </div>
                            <div class="rounded-lg border bg-card px-3 py-2">
                                <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Errors</p>
                                <p class="text-lg font-semibold tabular-nums text-destructive">{{ previewStats.failed }}</p>
                            </div>
                        </div>

                        <div class="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                                :class="previewFilter === 'all' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent'"
                                @click="previewFilter = 'all'"
                            >
                                All ({{ previewStats.total }})
                            </button>
                            <button
                                type="button"
                                class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                                :class="previewFilter === 'ready' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent'"
                                @click="previewFilter = 'ready'"
                            >
                                Ready ({{ previewStats.ready }})
                            </button>
                            <button
                                type="button"
                                class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                                :class="previewFilter === 'issues' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent'"
                                @click="previewFilter = 'issues'"
                            >
                                Issues ({{ previewStats.failed }})
                            </button>
                        </div>

                        <Alert v-if="reviewHasBlockingErrors" variant="destructive">
                            <AlertTitle>Fix issues before applying</AlertTitle>
                            <AlertDescription>
                                {{ previewStats.failed }} row(s) failed validation. Filter by Issues, correct the CSV, and upload again.
                            </AlertDescription>
                        </Alert>

                        <div class="overflow-hidden rounded-lg border">
                            <div
                                class="hidden grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)_6rem] gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid"
                            >
                                <span>Row</span>
                                <span>Code</span>
                                <span>Name</span>
                                <span>Outcome</span>
                            </div>
                            <div class="max-h-[min(24rem,50vh)] overflow-y-auto divide-y">
                                <div
                                    v-for="row in filteredPreviewRows"
                                    :key="`preview-row-${row.rowNumber}`"
                                    class="grid gap-1 px-3 py-2.5 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)_6rem] sm:items-start sm:gap-2"
                                >
                                    <span class="text-[11px] tabular-nums text-muted-foreground">{{ row.rowNumber }}</span>
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-medium">{{ row.code || '—' }}</p>
                                        <p v-if="row.errors.length" class="mt-0.5 text-[11px] text-destructive">
                                            {{ row.errors.join(' · ') }}
                                        </p>
                                    </div>
                                    <p class="truncate text-xs text-muted-foreground sm:text-sm">{{ row.name || '—' }}</p>
                                    <Badge :variant="outcomeVariant(row.outcome)" class="w-fit shrink-0 text-[10px] capitalize">
                                        {{ outcomeLabel(row.outcome) }}
                                    </Badge>
                                </div>
                                <p v-if="filteredPreviewRows.length === 0" class="px-3 py-6 text-center text-xs text-muted-foreground">
                                    No rows in this filter.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div v-else-if="importStep === 'complete'" class="space-y-4">
                        <Alert class="border-emerald-500/30 bg-emerald-500/5">
                            <AppIcon name="circle-check-big" class="size-4 text-emerald-600" />
                            <AlertTitle>Import applied</AlertTitle>
                            <AlertDescription>
                                {{ lastApplyCounts.created }} created and {{ lastApplyCounts.updated }} updated in {{ catalogLabel }}.
                                <span v-if="lastApplyCounts.failed > 0"> {{ lastApplyCounts.failed }} row(s) could not be saved.</span>
                            </AlertDescription>
                        </Alert>
                        <Button variant="outline" size="sm" class="h-9 gap-2" @click="resetImportFlow">
                            <AppIcon name="package" class="size-4" />
                            Import another file
                        </Button>
                    </div>

                    <Alert v-if="importError" variant="destructive">
                        <AlertTitle>Something went wrong</AlertTitle>
                        <AlertDescription>{{ importError }}</AlertDescription>
                    </Alert>
                </div>

                <div v-else class="space-y-4 px-4 py-4">
                    <div class="rounded-lg border bg-muted/20 p-4">
                        <p class="text-sm font-medium">Current list filters</p>
                        <p class="mt-1 text-xs text-muted-foreground">Export filtered uses the same scope as the registry list behind this sheet.</p>
                        <div v-if="exportFilterChips.length" class="mt-3 flex flex-wrap gap-1.5">
                            <Badge v-for="chip in exportFilterChips" :key="chip" variant="outline" class="text-[10px] font-normal">
                                {{ chip }}
                            </Badge>
                        </div>
                        <p v-else class="mt-2 text-xs text-muted-foreground">No filters applied — all {{ catalogLabel.toLowerCase() }} in scope will export.</p>
                    </div>

                    <button
                        type="button"
                        class="flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30 disabled:opacity-50"
                        :disabled="exportBusy"
                        @click="exportList('filtered')"
                    >
                        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <AppIcon name="file-text" class="size-5" />
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="block text-sm font-semibold">Export filtered catalog</span>
                            <span class="mt-0.5 block text-xs text-muted-foreground">
                                Download every row matching the active search and status filters.
                            </span>
                        </span>
                        <AppIcon name="chevron-right" class="size-4 shrink-0 text-muted-foreground" />
                    </button>

                    <button
                        type="button"
                        class="flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30 disabled:opacity-50"
                        :disabled="exportBusy || selectedExportCount === 0"
                        @click="exportList('selected')"
                    >
                        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                            <AppIcon name="check-circle" class="size-5" />
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="flex flex-wrap items-center gap-2">
                                <span class="text-sm font-semibold">Export selected rows</span>
                                <Badge variant="secondary" class="h-5 px-1.5 text-[10px] tabular-nums">{{ selectedExportCount }}</Badge>
                            </span>
                            <span class="mt-0.5 block text-xs text-muted-foreground">
                                Use checkboxes on the registry list, then export only those definitions.
                            </span>
                        </span>
                        <AppIcon name="chevron-right" class="size-4 shrink-0 text-muted-foreground" />
                    </button>

                    <p v-if="selectedExportCount === 0" class="text-center text-xs text-muted-foreground">
                        Tip: close this sheet, select rows on the list, and reopen Export.
                    </p>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" size="sm" class="h-9 w-full sm:w-auto" @click="closeSheet">Close</Button>

                <div v-if="canManage && activePanel === 'import'" class="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                    <template v-if="importStep === 'prepare'">
                        <Button size="sm" class="h-9 gap-1.5" @click="goToImportStep('upload')">
                            Continue to upload
                            <AppIcon name="arrow-right" class="size-3.5" />
                        </Button>
                    </template>
                    <template v-else-if="importStep === 'upload'">
                        <Button variant="outline" size="sm" class="h-9" @click="goToImportStep('prepare')">Back</Button>
                        <Button
                            size="sm"
                            class="h-9 gap-1.5"
                            :disabled="!canAdvanceFromUpload"
                            @click="validateAndReview"
                        >
                            <AppIcon name="search" class="size-3.5" />
                            {{ importBusy ? 'Validating...' : 'Validate & review' }}
                        </Button>
                    </template>
                    <template v-else-if="importStep === 'review'">
                        <Button variant="outline" size="sm" class="h-9" :disabled="importBusy" @click="goToImportStep('upload')">
                            Back
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-9"
                            :disabled="!canAdvanceFromUpload || importBusy"
                            @click="validateAndReview"
                        >
                            Re-validate
                        </Button>
                        <Button size="sm" class="h-9 gap-1.5" :disabled="!canApplyImport" @click="applyImport">
                            <AppIcon name="check-circle" class="size-3.5" />
                            {{ importBusy ? 'Applying...' : 'Apply import' }}
                        </Button>
                    </template>
                    <template v-else-if="importStep === 'complete'">
                        <Button size="sm" class="h-9" @click="closeSheet">Done</Button>
                    </template>
                </div>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
