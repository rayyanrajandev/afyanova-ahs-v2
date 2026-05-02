<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { apiGet, apiPatch } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';

export type WalkInServiceRequestRow = {
    id: string;
    requestNumber: string;
    patientId: string;
    priority: string;
    status: string;
    notes: string | null;
    requestedAt: string | null;
};

type PatientLookupResponse = {
    data: {
        id: string;
        patientNumber?: string | null;
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
    };
};

const props = withDefaults(
    defineProps<{
        serviceType: 'laboratory' | 'pharmacy' | 'radiology' | 'theatre_procedure';
        /** User has service.requests.update-status */
        enabled: boolean;
        panelTitle: string;
        acknowledgeButtonLabel?: string;
        successMessage?: string;
    }>(),
    {
        acknowledgeButtonLabel: 'Acknowledge & start order',
        successMessage: 'Walk-in acknowledged. Patient is now in progress.',
    },
);

const emit = defineEmits<{
    acknowledged: [{ patientId: string; requestId: string }];
}>();

const loading = ref(false);
const loadError = ref<string | null>(null);
const requests = ref<WalkInServiceRequestRow[]>([]);
const acknowledgingId = ref<string | null>(null);
const patientNames = ref<Record<string, string>>({});
const pendingPatientLookups = new Set<string>();

function displayNameFromPatient(row: PatientLookupResponse['data']): string {
    const name = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim();
    if (name !== '') {
        return name;
    }

    return row.patientNumber?.trim() || row.id;
}

async function hydratePatientName(patientId: string): Promise<void> {
    const id = patientId.trim();
    if (!id || patientNames.value[id] || pendingPatientLookups.has(id)) {
        return;
    }

    pendingPatientLookups.add(id);
    try {
        const response = await apiGet<PatientLookupResponse>(`/patients/${encodeURIComponent(id)}`);
        patientNames.value = {
            ...patientNames.value,
            [id]: displayNameFromPatient(response.data),
        };
    } catch {
        patientNames.value = { ...patientNames.value, [id]: id };
    } finally {
        pendingPatientLookups.delete(id);
    }
}

async function reload(): Promise<void> {
    if (!props.enabled) {
        requests.value = [];
        loadError.value = null;
        loading.value = false;
        return;
    }

    if (loading.value) {
        return;
    }

    loading.value = true;
    loadError.value = null;

    try {
        const result = await apiGet<{ data: WalkInServiceRequestRow[] }>('/service-requests', {
            serviceType: props.serviceType,
            status: 'pending',
            perPage: 50,
        });

        requests.value = result.data ?? [];

        for (const req of requests.value) {
            if (req.patientId) {
                void hydratePatientName(req.patientId);
            }
        }
    } catch {
        loadError.value = 'Could not load walk-in requests.';
        requests.value = [];
    } finally {
        loading.value = false;
    }
}

async function acknowledge(requestId: string, patientId: string): Promise<void> {
    if (acknowledgingId.value !== null) return;

    acknowledgingId.value = requestId;
    try {
        await apiPatch(`/service-requests/${encodeURIComponent(requestId)}/status`, {
            body: { status: 'in_progress' },
        });
        requests.value = requests.value.filter((r) => r.id !== requestId);
        notifySuccess(props.successMessage);
        emit('acknowledged', { patientId, requestId });
    } catch {
        notifyError('Could not acknowledge walk-in request. Please try again.');
    } finally {
        acknowledgingId.value = null;
    }
}

const visible = (): boolean =>
    props.enabled && (loading.value || requests.value.length > 0 || loadError.value !== null);

watch(
    () => props.enabled,
    (enabled) => {
        if (enabled) {
            void reload();
            return;
        }

        requests.value = [];
        loadError.value = null;
    },
);

watch(
    () => props.serviceType,
    () => {
        void reload();
    },
);

onMounted(() => {
    if (props.enabled) {
        void reload();
    }
});

defineExpose({ reload });
</script>

<template>
    <div
        v-if="visible()"
        class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
    >
        <div class="mb-2 flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
                <AppIcon name="users" class="size-4" />
                {{ panelTitle }}
            </span>
            <span
                v-if="requests.length > 0"
                class="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-800 dark:text-amber-200"
            >
                {{ requests.length }}
            </span>
        </div>

        <div v-if="loading" class="py-1 text-xs text-amber-700 dark:text-amber-400">Loading walk-in requests…</div>
        <div v-else-if="loadError" class="py-1 text-xs text-red-600 dark:text-red-400">{{ loadError }}</div>
        <ul v-else class="flex flex-col gap-1.5">
            <li
                v-for="req in requests"
                :key="req.id"
                class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-100 bg-white px-3 py-2 dark:border-amber-900 dark:bg-zinc-900"
            >
                <div class="flex min-w-0 flex-col gap-0.5">
                    <span class="truncate text-sm font-medium text-foreground">
                        {{ patientNames[req.patientId] ?? req.patientId }}
                    </span>
                    <span class="text-xs text-muted-foreground">
                        {{ req.requestNumber }}
                        <span
                            v-if="req.priority === 'urgent'"
                            class="ml-1 inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        >
                            Urgent
                        </span>
                    </span>
                    <span v-if="req.notes" class="max-w-xs truncate text-xs italic text-muted-foreground">{{ req.notes }}</span>
                </div>

                <Button
                    size="sm"
                    class="shrink-0 bg-amber-600 text-white hover:bg-amber-700"
                    :disabled="acknowledgingId === req.id"
                    @click="acknowledge(req.id, req.patientId)"
                >
                    <AppIcon
                        v-if="acknowledgingId === req.id"
                        name="refresh-cw"
                        class="mr-1 size-3.5 animate-spin"
                    />
                    {{ acknowledgeButtonLabel }}
                </Button>
            </li>
        </ul>
    </div>
</template>
