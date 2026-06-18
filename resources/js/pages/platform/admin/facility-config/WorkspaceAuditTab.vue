<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type AuditLog = {
    id: string; action: string | null; actionLabel?: string | null; createdAt: string | null;
    actorId: number | null; actorType?: 'system' | 'user' | null; actor?: { displayName?: string | null } | null;
    changes?: Record<string, unknown>;
};
type VError = { message?: string; errors?: Record<string, string[]> };

const props = withDefaults(defineProps<{
    facilityId: string | null;
    canViewAudit: boolean;
}>(), {
    facilityId: null,
    canViewAudit: false,
});

const SELECT_ALL_VALUE = '__all__';

const auditLoading = ref(false);
const auditExporting = ref(false);
const auditError = ref<string | null>(null);
const audit = ref<AuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });

function toApiDateTime(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

function fmt(v: string | null): string {
    if (!v) return 'N/A';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function actorLabel(l: AuditLog): string {
    return l.actor?.displayName?.trim() || (l.actorType === 'system' ? 'System' : l.actorId !== null ? `User #${l.actorId}` : 'Unknown actor');
}

function splitSubscriptionDateTime(value: string): { date: string; time: string } {
    const normalized = value.trim().replace(' ', 'T');
    const [date = '', rawTime = ''] = normalized.split('T');
    const time = rawTime.match(/^(\d{2}):(\d{2})/)?.[0] ?? '';
    return { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', time };
}

function datePartFromDateTimeInput(value: string): string {
    return splitSubscriptionDateTime(value).date;
}

function timePartFromDateTimeInput(value: string): string {
    return splitSubscriptionDateTime(value).time;
}

function mergeDateAndTimeInput(datePart: string, timePart: string, fallbackTime: string): string {
    const date = datePart.trim();
    if (!date) return '';
    const time = timePart.trim() || fallbackTime;
    return `${date}T${time}`;
}

async function api<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
    return apiRequestJson<T>(method, path, options);
}

async function loadAudit(pageNo = 1): Promise<void> {
    if (!props.canViewAudit || !props.facilityId) return;
    auditLoading.value = true;
    auditError.value = null;
    auditFilters.page = pageNo;
    try {
        const r = await api<{ data: AuditLog[]; meta: Pagination }>('GET', `/platform/admin/facilities/${props.facilityId}/audit-logs`, {
            query: {
                q: auditFilters.q.trim() || null,
                action: auditFilters.action.trim() || null,
                actorType: auditFilters.actorType || null,
                actorId: auditFilters.actorId.trim() || null,
                from: toApiDateTime(auditFilters.from),
                to: toApiDateTime(auditFilters.to),
                perPage: auditFilters.perPage,
                page: pageNo,
            },
        });
        audit.value = r.data ?? [];
        auditMeta.value = r.meta ?? null;
    } catch (e) {
        auditError.value = messageFromUnknown(e, 'Unable to load audit logs.');
        audit.value = [];
        auditMeta.value = null;
    } finally {
        auditLoading.value = false;
    }
}

function resetAuditFilters(): void {
    Object.assign(auditFilters, { q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
    void loadAudit(1);
}

async function exportAudit(): Promise<void> {
    if (!props.canViewAudit || auditExporting.value || !props.facilityId) return;
    auditExporting.value = true;
    try {
        const url = new URL(`/api/v1/platform/admin/facilities/${props.facilityId}/audit-logs/export`, window.location.origin);
        const q = {
            q: auditFilters.q.trim() || null,
            action: auditFilters.action.trim() || null,
            actorType: auditFilters.actorType || null,
            actorId: auditFilters.actorId.trim() || null,
            from: toApiDateTime(auditFilters.from),
            to: toApiDateTime(auditFilters.to),
        };
        Object.entries(q).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
        const h: Record<string, string> = { Accept: 'text/csv,application/json', 'X-Requested-With': 'XMLHttpRequest' };
        const t = csrfToken();
        if (t) h['X-CSRF-TOKEN'] = t;
        const res = await fetch(url.toString(), { method: 'GET', credentials: 'same-origin', headers: h });
        if (!res.ok) {
            const p = (await res.json().catch(() => ({}))) as VError;
            throw new Error(p.message ?? `${res.status} ${res.statusText}`);
        }
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') ?? '';
        const m = cd.match(/filename="?([^";]+)"?/i);
        const name = m?.[1] ?? `facility-audit-${props.facilityId}.csv`;
        const obj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = obj;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(obj);
        notifySuccess('Audit CSV prepared.');
    } catch (e) {
        notifyError(messageFromUnknown(e, 'Unable to export audit CSV.'));
    } finally {
        auditExporting.value = false;
    }
}

watch(() => props.facilityId, (id) => {
    if (id && props.canViewAudit) {
        void loadAudit(1);
    }
}, { immediate: true });
</script>

<template>
    <div v-if="!facilityId" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Select a facility to view its audit trail.
    </div>
    <div v-else class="grid gap-4">
        <fieldset class="grid gap-4 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Audit Trail</legend>
            <div class="space-y-1">
                <p class="text-sm font-medium">Facility change history</p>
                <p class="max-w-2xl text-xs text-muted-foreground">Review configuration, ownership, status, and policy changes for this facility.</p>
            </div>

            <div class="grid gap-4 rounded-lg border bg-muted/10 p-3">
                <FormFieldShell input-id="details-audit-search" label="Text search" :reserve-message-space="false">
                    <Input id="details-audit-search" v-model="auditFilters.q" placeholder="created, owner updated, status..." />
                </FormFieldShell>

                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <FormFieldShell input-id="details-audit-action" label="Action">
                        <Input id="details-audit-action" v-model="auditFilters.action" placeholder="status.updated" />
                    </FormFieldShell>
                    <FormFieldShell input-id="details-audit-actor-type" label="Actor type">
                        <Select v-model="auditFilters.actorType">
                            <SelectTrigger id="details-audit-actor-type" class="w-full"><SelectValue placeholder="All actors" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="SELECT_ALL_VALUE">All actors</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <FormFieldShell input-id="details-audit-actor-id" label="Actor ID">
                        <Input id="details-audit-actor-id" v-model="auditFilters.actorId" inputmode="numeric" placeholder="User ID" />
                    </FormFieldShell>
                    <FormFieldShell input-id="details-audit-per-page" label="Rows">
                        <Select v-model="auditFilters.perPage">
                            <SelectTrigger id="details-audit-per-page" class="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="10">10 rows</SelectItem>
                                <SelectItem :value="20">20 rows</SelectItem>
                                <SelectItem :value="50">50 rows</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                </div>

                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SingleDatePopoverField input-id="details-audit-from-date" label="From date" :model-value="datePartFromDateTimeInput(auditFilters.from)" @update:model-value="(value) => { auditFilters.from = mergeDateAndTimeInput(value, timePartFromDateTimeInput(auditFilters.from), '00:00'); }" />
                    <TimePopoverField input-id="details-audit-from-time" label="From time" :model-value="timePartFromDateTimeInput(auditFilters.from)" :disabled="!datePartFromDateTimeInput(auditFilters.from)" @update:model-value="(value) => { auditFilters.from = mergeDateAndTimeInput(datePartFromDateTimeInput(auditFilters.from), value, '00:00'); }" />
                    <SingleDatePopoverField input-id="details-audit-to-date" label="To date" :model-value="datePartFromDateTimeInput(auditFilters.to)" @update:model-value="(value) => { auditFilters.to = mergeDateAndTimeInput(value, timePartFromDateTimeInput(auditFilters.to), '23:59'); }" />
                    <TimePopoverField input-id="details-audit-to-time" label="To time" :model-value="timePartFromDateTimeInput(auditFilters.to)" :disabled="!datePartFromDateTimeInput(auditFilters.to)" @update:model-value="(value) => { auditFilters.to = mergeDateAndTimeInput(datePartFromDateTimeInput(auditFilters.to), value, '23:59'); }" />
                </div>
            </div>

            <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-xs text-muted-foreground">Export respects the current audit filters.</p>
                <div class="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="auditLoading" @click="resetAuditFilters">
                        <AppIcon name="refresh-cw" class="size-3.5" />
                        Reset
                    </Button>
                    <Button size="sm" class="gap-1.5" :disabled="auditLoading" @click="loadAudit(1)">
                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                        {{ auditLoading ? 'Applying...' : 'Apply filters' }}
                    </Button>
                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="auditExporting" @click="exportAudit">
                        <AppIcon name="download" class="size-3.5" />
                        {{ auditExporting ? 'Preparing...' : 'Export CSV' }}
                    </Button>
                </div>
            </div>

            <Alert v-if="auditError" variant="destructive">
                <AlertTitle>Audit load issue</AlertTitle>
                <AlertDescription>{{ auditError }}</AlertDescription>
            </Alert>
            <div v-else-if="auditLoading" class="space-y-2">
                <Skeleton class="h-10 w-full" />
                <Skeleton class="h-10 w-full" />
            </div>
            <div v-else-if="audit.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No audit logs found.
            </div>
            <div v-else class="space-y-2">
                <div v-for="log in audit" :key="log.id" class="rounded-md border p-3 text-sm">
                    <p class="font-medium">{{ log.actionLabel || log.action || 'event' }}</p>
                    <p class="text-xs text-muted-foreground">{{ fmt(log.createdAt) }} | {{ actorLabel(log) }}</p>
                </div>
            </div>
            <div class="flex items-center justify-between border-t pt-2">
                <Button variant="outline" size="sm" :disabled="auditLoading || (auditMeta?.currentPage ?? 1) <= 1" @click="loadAudit((auditMeta?.currentPage ?? 1) - 1)">Previous</Button>
                <p class="text-xs text-muted-foreground">Page {{ auditMeta?.currentPage ?? 1 }} of {{ auditMeta?.lastPage ?? 1 }}</p>
                <Button variant="outline" size="sm" :disabled="auditLoading || !auditMeta || auditMeta.currentPage >= auditMeta.lastPage" @click="loadAudit((auditMeta?.currentPage ?? 1) + 1)">Next</Button>
            </div>
        </fieldset>
    </div>
</template>