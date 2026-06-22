<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiRequestJson } from '@/lib/apiClient';
import { csrfRequestHeaders } from '@/lib/csrf';
import { messageFromUnknown } from '@/lib/notify';
import type { SharedPlatformContext } from '@/types/platform';

type EncounterClinicalDocument = {
    id: string;
    encounterId?: string | null;
    documentType?: string | null;
    title?: string | null;
    description?: string | null;
    originalFilename?: string | null;
    mimeType?: string | null;
    fileSizeBytes?: number | null;
    status?: string | null;
    statusReason?: string | null;
    createdAt?: string | null;
};

type DocumentListResponse = {
    data: EncounterClinicalDocument[];
    meta: {
        currentPage: number;
        lastPage: number;
        perPage: number;
        total: number;
    };
};

const DOCUMENT_TYPE_OPTIONS = [
    { value: 'referral_letter', label: 'Referral letter' },
    { value: 'lab_result', label: 'Lab result' },
    { value: 'imaging_report', label: 'Imaging report' },
    { value: 'consent_form', label: 'Consent form' },
    { value: 'external_record', label: 'External record' },
    { value: 'other', label: 'Other' },
] as const;

const props = defineProps<{
    encounterId: string;
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
}>();

const page = usePage<{ platform: SharedPlatformContext }>();

const documents = ref<EncounterClinicalDocument[]>([]);
const listMeta = ref<DocumentListResponse['meta'] | null>(null);
const listLoading = ref(false);
const listError = ref<string | null>(null);
const listPage = ref(1);

const uploadForm = ref({
    documentType: 'other',
    title: '',
    description: '',
});
const uploadFile = ref<File | null>(null);
const uploadLoading = ref(false);
const uploadErrors = ref<Record<string, string[]>>({});
const actionMessage = ref<string | null>(null);
const archivingId = ref<string | null>(null);

const documentUploadMaxBytes = computed(() => {
    const candidate = Number(page.props.platform?.uploadLimits?.documentMaxBytes ?? 0);
    return Number.isFinite(candidate) && candidate > 0 ? candidate : 20 * 1024 * 1024;
});
const documentUploadMaxLabel = computed(() => {
    const label = String(page.props.platform?.uploadLimits?.documentMaxLabel ?? '').trim();
    return label !== '' ? label : '20MB';
});
const activeDocumentCount = computed(
    () => documents.value.filter((document) => (document.status ?? 'active') === 'active').length,
);
const documentTypeLabel = (value: string | null | undefined): string => {
    const normalized = String(value ?? '').trim();
    const match = DOCUMENT_TYPE_OPTIONS.find((option) => option.value === normalized);
    if (match) return match.label;
    if (!normalized) return 'Document';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatFileSize(bytes: number | null | undefined): string {
    const size = Number(bytes ?? 0);
    if (!Number.isFinite(size) || size <= 0) return '—';
    if (size >= 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (size >= 1024) {
        return `${Math.round(size / 1024)} KB`;
    }
    return `${size} B`;
}

function downloadHref(documentId: string): string {
    return `/api/v1/encounters/${props.encounterId.trim()}/clinical-documents/${documentId}/download`;
}

async function loadDocuments(pageNumber = 1): Promise<void> {
    const encounterId = props.encounterId.trim();
    if (!encounterId || !props.canRead) {
        documents.value = [];
        listMeta.value = null;
        listError.value = null;
        return;
    }

    listLoading.value = true;
    listError.value = null;

    try {
        const response = await apiRequestJson<DocumentListResponse>(
            'GET',
            `/encounters/${encounterId}/clinical-documents`,
            {
                query: {
                    page: pageNumber,
                    perPage: 10,
                    status: 'active',
                    sortBy: 'createdAt',
                    sortDir: 'desc',
                },
            },
        );
        documents.value = response.data ?? [];
        listMeta.value = response.meta;
        listPage.value = pageNumber;
    } catch (error) {
        documents.value = [];
        listMeta.value = null;
        listError.value = messageFromUnknown(error, 'Unable to load encounter attachments.');
    } finally {
        listLoading.value = false;
    }
}

function onUploadFileChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    uploadFile.value = target?.files?.[0] ?? null;
}

function resetUploadForm(): void {
    uploadForm.value = {
        documentType: 'other',
        title: '',
        description: '',
    };
    uploadFile.value = null;
    uploadErrors.value = {};
}

async function submitUpload(): Promise<void> {
    const encounterId = props.encounterId.trim();
    if (!encounterId || !props.canCreate || uploadLoading.value) {
        return;
    }

    const file = uploadFile.value;
    if (!file) {
        uploadErrors.value = { file: ['Please choose a file to upload.'] };
        return;
    }

    if (file.size > documentUploadMaxBytes.value) {
        uploadErrors.value = {
            file: [`This environment currently allows files up to ${documentUploadMaxLabel.value}.`],
        };
        return;
    }

    const title = uploadForm.value.title.trim();
    if (title === '') {
        uploadErrors.value = { title: ['Title is required.'] };
        return;
    }

    uploadLoading.value = true;
    uploadErrors.value = {};
    actionMessage.value = null;

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', uploadForm.value.documentType);
        formData.append('title', title);
        if (uploadForm.value.description.trim() !== '') {
            formData.append('description', uploadForm.value.description.trim());
        }

        const url = new URL(
            `/api/v1/encounters/${encounterId}/clinical-documents`,
            window.location.origin,
        );
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        };
        Object.assign(headers, csrfRequestHeaders());

        const response = await fetch(url.toString(), {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: formData,
        });
        const payload = (await response.json().catch(() => ({}))) as {
            message?: string;
            errors?: Record<string, string[]>;
            data?: EncounterClinicalDocument;
        };

        if (!response.ok) {
            if (response.status === 422 && payload.errors) {
                uploadErrors.value = payload.errors;
                return;
            }
            throw new Error(payload.message ?? `${response.status} ${response.statusText}`);
        }

        actionMessage.value = `Uploaded ${payload.data?.title ?? 'attachment'} successfully.`;
        resetUploadForm();
        await loadDocuments(1);
    } catch (error) {
        listError.value = messageFromUnknown(error, 'Unable to upload attachment.');
    } finally {
        uploadLoading.value = false;
    }
}

async function archiveDocument(document: EncounterClinicalDocument): Promise<void> {
    const encounterId = props.encounterId.trim();
    if (!encounterId || !props.canUpdate || archivingId.value) {
        return;
    }

    const reason = window.prompt('Reason for archiving this attachment (required):')?.trim() ?? '';
    if (reason === '') {
        return;
    }

    archivingId.value = document.id;
    actionMessage.value = null;

    try {
        await apiRequestJson(
            'PATCH',
            `/encounters/${encounterId}/clinical-documents/${document.id}/status`,
            {
                body: {
                    status: 'archived',
                    reason,
                },
            },
        );
        actionMessage.value = `Archived ${document.title ?? 'attachment'}.`;
        await loadDocuments(listPage.value);
    } catch (error) {
        listError.value = messageFromUnknown(error, 'Unable to archive attachment.');
    } finally {
        archivingId.value = null;
    }
}

watch(
    () => [props.encounterId, props.canRead] as const,
    () => {
        void loadDocuments(1);
    },
    { immediate: true },
);
</script>

<template>
    <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-end gap-3">
            <Badge variant="outline" class="text-xs">
                {{ activeDocumentCount }} active
            </Badge>
        </div>

        <Alert v-if="actionMessage">
            <AlertTitle>Attachment saved</AlertTitle>
            <AlertDescription>{{ actionMessage }}</AlertDescription>
        </Alert>

        <Alert v-if="listError" variant="destructive">
            <AlertTitle>Attachment error</AlertTitle>
            <AlertDescription>{{ listError }}</AlertDescription>
        </Alert>

        <div
            v-if="canCreate"
            class="space-y-3 rounded-md border bg-muted/10 p-4"
        >
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upload attachment</p>
            <div class="grid gap-3 sm:grid-cols-2">
                <div class="space-y-1.5">
                    <Label for="encounter-document-type">Document type</Label>
                    <Select v-model="uploadForm.documentType">
                        <SelectTrigger id="encounter-document-type" class="w-full">
                            <SelectValue placeholder="Choose type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="option in DOCUMENT_TYPE_OPTIONS"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="space-y-1.5">
                    <Label for="encounter-document-title">Title</Label>
                    <Input
                        id="encounter-document-title"
                        v-model="uploadForm.title"
                        placeholder="e.g. Outside lab report"
                    />
                    <p v-if="uploadErrors.title?.[0]" class="text-xs text-destructive">
                        {{ uploadErrors.title[0] }}
                    </p>
                </div>
            </div>
            <div class="space-y-1.5">
                <Label for="encounter-document-description">Description (optional)</Label>
                <Textarea
                    id="encounter-document-description"
                    v-model="uploadForm.description"
                    rows="2"
                    placeholder="Brief context for this file"
                />
            </div>
            <div class="space-y-1.5">
                <Label for="encounter-document-file">File</Label>
                <Input
                    id="encounter-document-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt,application/pdf,image/jpeg,image/png"
                    @change="onUploadFileChange"
                />
                <p class="text-[11px] text-muted-foreground">
                    PDF, images, Word, or plain text up to {{ documentUploadMaxLabel }}.
                </p>
                <p v-if="uploadErrors.file?.[0]" class="text-xs text-destructive">
                    {{ uploadErrors.file[0] }}
                </p>
            </div>
            <Button
                size="sm"
                :disabled="uploadLoading"
                @click="submitUpload"
            >
                <AppIcon name="upload" class="mr-1.5 size-3.5" />
                {{ uploadLoading ? 'Uploading…' : 'Upload attachment' }}
            </Button>
        </div>

        <div v-if="canRead" class="space-y-2">
            <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Active attachments
                </p>
                <Button
                    size="sm"
                    variant="ghost"
                    class="h-7 px-2 text-xs"
                    :disabled="listLoading"
                    @click="loadDocuments(listPage)"
                >
                    <AppIcon name="refresh-cw" class="mr-1 size-3" />
                    Refresh
                </Button>
            </div>

            <div
                v-if="listLoading && documents.length === 0"
                class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
            >
                Loading attachments…
            </div>

            <div
                v-else-if="documents.length === 0"
                class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
            >
                No attachments uploaded for this encounter yet.
            </div>

            <div v-else class="space-y-2">
                <div
                    v-for="document in documents"
                    :key="document.id"
                    class="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-background px-3 py-2.5"
                >
                    <div class="min-w-0 space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <p class="truncate text-sm font-medium">{{ document.title || 'Untitled attachment' }}</p>
                            <Badge variant="secondary" class="text-[10px]">
                                {{ documentTypeLabel(document.documentType) }}
                            </Badge>
                        </div>
                        <p class="truncate text-xs text-muted-foreground">
                            {{ document.originalFilename || 'Unknown file' }}
                            · {{ formatFileSize(document.fileSizeBytes) }}
                            · {{ formatDateTime(document.createdAt) }}
                        </p>
                        <p
                            v-if="document.description"
                            class="text-xs text-muted-foreground"
                        >
                            {{ document.description }}
                        </p>
                    </div>
                    <div class="flex shrink-0 flex-wrap gap-1.5">
                        <Button
                            as-child
                            size="sm"
                            variant="outline"
                        >
                            <a
                                :href="downloadHref(document.id)"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="gap-1.5"
                            >
                                <AppIcon name="download" class="size-3.5" />
                                Download
                            </a>
                        </Button>
                        <Button
                            v-if="canUpdate"
                            size="sm"
                            variant="ghost"
                            class="text-destructive hover:text-destructive"
                            :disabled="archivingId === document.id"
                            @click="archiveDocument(document)"
                        >
                            Archive
                        </Button>
                    </div>
                </div>
            </div>

            <div
                v-if="listMeta && listMeta.lastPage > 1"
                class="flex items-center justify-between gap-2 pt-1"
            >
                <p class="text-[11px] text-muted-foreground">
                    Page {{ listMeta.currentPage }} of {{ listMeta.lastPage }}
                </p>
                <div class="flex gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-7 px-2 text-xs"
                        :disabled="listLoading || listPage <= 1"
                        @click="loadDocuments(listPage - 1)"
                    >
                        Previous
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-7 px-2 text-xs"
                        :disabled="listLoading || listPage >= listMeta.lastPage"
                        @click="loadDocuments(listPage + 1)"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    </div>
</template>
