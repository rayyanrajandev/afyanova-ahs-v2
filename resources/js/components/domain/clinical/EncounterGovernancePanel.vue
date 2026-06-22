<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown } from '@/lib/notify';

type EncounterAuditLog = {
    id: string;
    encounterId?: string | null;
    actorId?: number | null;
    action?: string | null;
    actionLabel?: string | null;
    changes?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string | null;
};

type EncounterAuditLogListResponse = {
    data: EncounterAuditLog[];
    meta: {
        currentPage: number;
        lastPage: number;
        perPage: number;
        total: number;
    };
};

const props = defineProps<{
    encounterId: string;
    encounterNumber?: string | null;
    canViewAudit: boolean;
    canOpenChartPacket: boolean;
    printHref: string;
    pdfHref: string;
}>();

const auditLogs = ref<EncounterAuditLog[]>([]);
const auditMeta = ref<EncounterAuditLogListResponse['meta'] | null>(null);
const auditLoading = ref(false);
const auditExporting = ref(false);
const auditError = ref<string | null>(null);
const auditPage = ref(1);

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

const auditEventCount = computed(
    () => auditMeta.value?.total ?? auditLogs.value.length,
);
const chartPacketReady = computed(() => props.canOpenChartPacket);
const encounterLabel = computed(
    () => props.encounterNumber?.trim() || props.encounterId.slice(0, 8),
);

async function loadAuditLogs(page = 1): Promise<void> {
    const encounterId = props.encounterId.trim();
    if (!encounterId || !props.canViewAudit) {
        auditLogs.value = [];
        auditMeta.value = null;
        auditError.value = null;
        return;
    }

    auditLoading.value = true;
    auditError.value = null;

    try {
        const response = await apiRequestJson<EncounterAuditLogListResponse>(
            'GET',
            `/encounters/${encounterId}/audit-logs`,
            {
                query: {
                    page,
                    perPage: 10,
                },
            },
        );
        auditLogs.value = response.data ?? [];
        auditMeta.value = response.meta;
        auditPage.value = page;
    } catch (error) {
        auditLogs.value = [];
        auditMeta.value = null;
        auditError.value = messageFromUnknown(
            error,
            'Unable to load encounter audit logs.',
        );
    } finally {
        auditLoading.value = false;
    }
}

async function exportAuditLogsCsv(): Promise<void> {
    const encounterId = props.encounterId.trim();
    if (!encounterId || auditExporting.value) {
        return;
    }

    auditExporting.value = true;

    try {
        const url = new URL(
            `/api/v1/encounters/${encounterId}/audit-logs/export`,
            window.location.origin,
        );
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        auditExporting.value = false;
    }
}

function openPrintPage(): void {
    if (!chartPacketReady.value) {
        return;
    }

    window.open(props.printHref, '_blank', 'noopener');
}

watch(
    () => [props.encounterId, props.canViewAudit].join('|'),
    () => {
        void loadAuditLogs(1);
    },
    { immediate: true },
);
</script>

<template>
    <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm font-medium">Governance</p>
            <Badge variant="outline" class="text-xs">
                {{ auditEventCount }} audit events
            </Badge>
        </div>

        <div class="flex flex-wrap gap-2">
            <Button
                size="sm"
                variant="outline"
                class="gap-1.5"
                :disabled="!chartPacketReady"
                @click="openPrintPage()"
            >
                <AppIcon name="printer" class="size-3.5" />
                Open chart packet
            </Button>
            <Button
                v-if="chartPacketReady"
                as-child
                size="sm"
                variant="outline"
                class="gap-1.5"
            >
                <a :href="pdfHref" target="_blank" rel="noopener">
                    <AppIcon name="download" class="size-3.5" />
                    Download PDF
                </a>
            </Button>
            <Button
                v-if="canViewAudit"
                size="sm"
                variant="ghost"
                class="gap-1.5"
                :disabled="auditLoading"
                @click="void loadAuditLogs(auditPage)"
            >
                <AppIcon name="refresh-cw" class="size-3.5" />
                Refresh audit
            </Button>
            <Button
                v-if="canViewAudit"
                size="sm"
                variant="ghost"
                class="gap-1.5"
                :disabled="auditLoading || auditExporting"
                @click="void exportAuditLogsCsv()"
            >
                <AppIcon name="file-spreadsheet" class="size-3.5" />
                Export audit CSV
            </Button>
        </div>

        <Alert v-if="!chartPacketReady">
            <AlertTitle>Signed chart packet unavailable</AlertTitle>
            <AlertDescription>
                Finalize the consultation note before printing or downloading the encounter chart packet.
            </AlertDescription>
        </Alert>

        <Alert v-if="!canViewAudit" variant="destructive">
            <AlertTitle>Audit access restricted</AlertTitle>
            <AlertDescription>
                Request <code>medical-records.view-audit-logs</code> permission to review encounter governance events.
            </AlertDescription>
        </Alert>

        <div v-else class="space-y-3 rounded-lg border bg-background p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium">Encounter audit trail</p>
                <p class="text-xs text-muted-foreground">
                    Lifecycle, status, and document export events
                </p>
            </div>

            <Alert v-if="auditError" variant="destructive">
                <AlertTitle>Unable to load audit logs</AlertTitle>
                <AlertDescription>{{ auditError }}</AlertDescription>
            </Alert>

            <div
                v-else-if="auditLoading && auditLogs.length === 0"
                class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
            >
                Loading encounter audit logs...
            </div>

            <AuditTimelineList
                v-else
                :logs="auditLogs"
                :format-date-time="formatDateTime"
                empty-message="No encounter audit events recorded yet."
            />

            <div
                v-if="auditMeta && auditMeta.lastPage > 1"
                class="flex flex-wrap items-center justify-between gap-2 pt-1"
            >
                <p class="text-xs text-muted-foreground">
                    Page {{ auditMeta.currentPage }} of {{ auditMeta.lastPage }}
                </p>
                <div class="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="auditLoading || auditMeta.currentPage <= 1"
                        @click="void loadAuditLogs(auditMeta.currentPage - 1)"
                    >
                        Previous
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="
                            auditLoading || auditMeta.currentPage >= auditMeta.lastPage
                        "
                        @click="void loadAuditLogs(auditMeta.currentPage + 1)"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    </div>
</template>
