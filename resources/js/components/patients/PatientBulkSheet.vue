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
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import {
    type ParsedPatientImportRow,
    type PatientImportPreviewRow,
    PATIENTS_BULK_MAX_IMPORT_ROWS,
    parsePatientsCsv,
    patientImportPreviewStats,
    isPatientImportPreviewFailure,
} from '@/lib/patientsBulk';

type BulkPanel = 'import' | 'export';
type ImportStep = 'prepare' | 'upload' | 'review' | 'complete';
type PreviewFilter = 'all' | 'ready' | 'issues';

type ImportApiResult = {
    dry_run: boolean;
    requested_count: number;
    created_count: number;
    updated_count: number;
    failed_count: number;
    results: Array<{
        rowNumber: number;
        outcome: string;
        patientId: string | null;
        errors: string[];
    }>;
};

const props = defineProps<{
    open: boolean;
    canExport: boolean;
    canImport: boolean;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    completed: [];
}>();

const activePanel = ref<BulkPanel>('export');
const importStep = ref<ImportStep>('prepare');
const importFileName = ref('');
const importRows = ref<ParsedPatientImportRow[]>([]);
const importPreview = ref<PatientImportPreviewRow[]>([]);
const importError = ref<string | null>(null);
const importBusy = ref(false);
const exportBusy = ref(false);
const previewFilter = ref<PreviewFilter>('all');
const importDragActive = ref(false);
const lastApplyCounts = ref({ created: 0, updated: 0, failed: 0 });

const hasImportRows = computed(() => importRows.value.length > 0);
const previewStats = computed(() => patientImportPreviewStats(importPreview.value));
const filteredPreviewRows = computed(() => {
    if (previewFilter.value === 'issues') {
        return importPreview.value.filter((row) => isPatientImportPreviewFailure(row.outcome));
    }
    if (previewFilter.value === 'ready') {
        return importPreview.value.filter((row) => !isPatientImportPreviewFailure(row.outcome));
    }
    return importPreview.value;
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
    () => props.canImport && importPreview.value.length > 0 && previewStats.value.failed === 0 && !importBusy.value,
);
const reviewHasBlockingErrors = computed(() => importPreview.value.length > 0 && previewStats.value.failed > 0);

watch(
    () => props.open,
    (open) => {
        if (!open) {
            return;
        }
        activePanel.value = props.canImport ? 'import' : 'export';
        resetImportFlow();
    },
);

function resetImportFlow(): void {
    importStep.value = 'prepare';
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
        await downloadCsv('/patients/import-template', {}, 'patients-import-template.csv');
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
        importRows.value = parsePatientsCsv(text);
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

function rowDisplayName(rowNumber: number): string {
    const row = importRows.value.find((entry) => entry.rowNumber === rowNumber);
    if (!row) return '';
    return [row.values.first_name, row.values.last_name].filter(Boolean).join(' ');
}

async function runImport(dryRun: boolean): Promise<boolean> {
    if (!hasImportRows.value || importBusy.value) {
        return false;
    }

    importBusy.value = true;
    importError.value = null;

    try {
        const response = await apiRequestJson<{ data: ImportApiResult }>('POST', '/patients/bulk-import', {
            body: {
                dryRun,
                rows: importRows.value,
            },
        });

        const result = response.data;
        importPreview.value = (result.results ?? []).map((row) => ({
            rowNumber: row.rowNumber,
            patientId: row.patientId,
            name: rowDisplayName(row.rowNumber),
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
        notifySuccess(`Restore complete: ${lastApplyCounts.value.created} created, ${lastApplyCounts.value.updated} updated.`);
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

async function exportAll(): Promise<void> {
    if (exportBusy.value) {
        return;
    }

    try {
        await downloadCsv('/patients/export/csv', {}, 'patients-backup.csv');
        notifySuccess('Patients exported.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export patients CSV.'));
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
                        <AppIcon name="archive" class="size-4" />
                    </span>
                    <span class="min-w-0">
                        <span class="block truncate">Backup &amp; restore</span>
                        <span class="block text-xs font-normal text-muted-foreground">Patients</span>
                    </span>
                </SheetTitle>
                <SheetDescription class="text-xs leading-relaxed">
                    Export the full patient registry as CSV for backup, or restore from a previously exported file. Restoring
                    reproduces the exact same records (same patient number, status, and ID) rather than registering new ones.
                </SheetDescription>
            </SheetHeader>

            <div class="shrink-0 border-b px-4 py-3">
                <div
                    class="grid gap-2"
                    :class="canImport ? 'grid-cols-2' : 'grid-cols-1'"
                    role="tablist"
                    aria-label="Backup workspace mode"
                >
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
                        <span class="mt-0.5 text-[11px] text-muted-foreground">Download every patient</span>
                    </button>
                    <button
                        v-if="canImport"
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
                            Restore CSV
                        </span>
                        <span class="mt-0.5 text-[11px] text-muted-foreground">Upload, review, apply</span>
                    </button>
                </div>
            </div>

            <ScrollArea class="min-h-0 flex-1">
                <div v-if="canImport && activePanel === 'import'" class="space-y-4 px-4 py-4">
                    <nav aria-label="Restore progress" class="flex flex-wrap items-center gap-2">
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
                            <legend class="px-1 text-sm font-medium">Need a template?</legend>
                            <p class="text-xs text-muted-foreground">
                                Download an empty template with the exact column headers, or upload a CSV you exported from this
                                page previously.
                            </p>
                            <Button variant="outline" size="sm" class="h-9 gap-2" @click="downloadTemplate">
                                <AppIcon name="file-text" class="size-4" />
                                Download template
                            </Button>
                        </fieldset>

                        <p class="text-xs text-muted-foreground">
                            Maximum {{ PATIENTS_BULK_MAX_IMPORT_ROWS }} data rows per file. Rows with an existing <code>id</code>
                            update that patient in place; rows without one create a new patient.
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
                                class="hidden grid-cols-[3rem_minmax(0,1fr)_6rem] gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid"
                            >
                                <span>Row</span>
                                <span>Patient</span>
                                <span>Outcome</span>
                            </div>
                            <div class="max-h-[min(24rem,50vh)] overflow-y-auto divide-y">
                                <div
                                    v-for="row in filteredPreviewRows"
                                    :key="`preview-row-${row.rowNumber}`"
                                    class="grid gap-1 px-3 py-2.5 sm:grid-cols-[3rem_minmax(0,1fr)_6rem] sm:items-start sm:gap-2"
                                >
                                    <span class="text-[11px] tabular-nums text-muted-foreground">{{ row.rowNumber }}</span>
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-medium">{{ row.name || '—' }}</p>
                                        <p v-if="row.errors.length" class="mt-0.5 text-[11px] text-destructive">
                                            {{ row.errors.join(' · ') }}
                                        </p>
                                    </div>
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
                            <AlertTitle>Restore applied</AlertTitle>
                            <AlertDescription>
                                {{ lastApplyCounts.created }} created and {{ lastApplyCounts.updated }} updated.
                                <span v-if="lastApplyCounts.failed > 0"> {{ lastApplyCounts.failed }} row(s) could not be saved.</span>
                            </AlertDescription>
                        </Alert>
                        <Button variant="outline" size="sm" class="h-9 gap-2" @click="resetImportFlow">
                            <AppIcon name="package" class="size-4" />
                            Restore another file
                        </Button>
                    </div>

                    <Alert v-if="importError" variant="destructive">
                        <AlertTitle>Something went wrong</AlertTitle>
                        <AlertDescription>{{ importError }}</AlertDescription>
                    </Alert>
                </div>

                <div v-else class="space-y-4 px-4 py-4">
                    <button
                        type="button"
                        class="flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30 disabled:opacity-50"
                        :disabled="exportBusy || !canExport"
                        @click="exportAll"
                    >
                        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <AppIcon name="file-text" class="size-5" />
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="block text-sm font-semibold">Export all patients</span>
                            <span class="mt-0.5 block text-xs text-muted-foreground">
                                Download every patient in this facility as a CSV backup, including patient number and status.
                            </span>
                        </span>
                        <AppIcon name="chevron-right" class="size-4 shrink-0 text-muted-foreground" />
                    </button>

                    <Alert v-if="!canExport" variant="destructive">
                        <AlertTitle>Access required</AlertTitle>
                        <AlertDescription>Exporting patients requires <code>patients.export</code>.</AlertDescription>
                    </Alert>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" size="sm" class="h-9 w-full sm:w-auto" @click="closeSheet">Close</Button>

                <div v-if="canImport && activePanel === 'import'" class="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
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
                            {{ importBusy ? 'Applying...' : 'Apply restore' }}
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
