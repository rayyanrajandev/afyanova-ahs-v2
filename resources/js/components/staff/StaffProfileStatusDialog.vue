<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { csrfRequestHeaders } from '@/lib/csrf';

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
};

export type StatusEditableStaffProfile = {
    id: string;
    userName: string | null;
    userEmail?: string | null;
    userEmailVerifiedAt?: string | null;
    userEmailVerified?: boolean;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
    statusReason?: string | null;
};

const props = defineProps<{
    open: boolean;
    profile: StatusEditableStaffProfile | null;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'saved', value: StatusEditableStaffProfile): void;
}>();

const saving = ref(false);
const errorMessage = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const form = reactive({
    status: 'active',
    reason: '',
});

const reasonRequired = computed(() => form.status === 'inactive' || form.status === 'suspended');

function staffDisplayName(profile: StatusEditableStaffProfile | null): string {
    const userName = String(profile?.userName ?? '').trim();
    if (userName !== '') return userName;

    const employeeNumber = String(profile?.employeeNumber ?? '').trim();
    if (employeeNumber !== '') return employeeNumber;

    return 'Staff profile';
}

function formatLabel(value: string | null): string {
    return String(value ?? '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase()) || 'Unknown';
}

function linkedUserVerificationVariant(profile: StatusEditableStaffProfile | null): 'outline' | 'secondary' | 'destructive' {
    if (!profile?.userName && !profile?.employeeNumber) return 'outline';
    return profile?.userEmailVerifiedAt ? 'secondary' : 'destructive';
}

function linkedUserVerificationLabel(profile: StatusEditableStaffProfile | null): string {
    return profile?.userEmailVerifiedAt ? 'Email verified' : 'Email unverified';
}

function resetForm(profile: StatusEditableStaffProfile | null): void {
    form.status = String(profile?.status ?? 'active').trim() || 'active';
    form.reason = profile?.statusReason ?? '';
    errorMessage.value = null;
    fieldErrors.value = {};
}

watch(
    () => [props.open, props.profile?.id] as const,
    () => {
        if (props.open) {
            resetForm(props.profile);
        }
    },
    { immediate: true },
);

watch(
    () => form.status,
    (value) => {
        if (value === 'active') {
            form.reason = '';
        }
    },
);

async function saveStatus(): Promise<void> {
    if (!props.profile?.id || saving.value) return;

    if (reasonRequired.value && form.reason.trim() === '') {
        fieldErrors.value = { reason: ['Reason is required for inactive or suspended status.'] };
        return;
    }

    saving.value = true;
    errorMessage.value = null;
    fieldErrors.value = {};

    try {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        };
        Object.assign(headers, csrfRequestHeaders());

        const response = await fetch(`/api/v1/staff/${props.profile.id}/status`, {
            method: 'PATCH',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify({
                status: form.status,
                reason: form.reason.trim() || null,
            }),
        });

        const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse & {
            data?: StatusEditableStaffProfile;
        };

        if (!response.ok) {
            if (response.status === 422 && payload.errors) {
                fieldErrors.value = payload.errors;
            }
            throw new Error(payload.message ?? `${response.status} ${response.statusText}`);
        }

        if (payload.data) {
            emit('saved', payload.data);
        }
        emit('update:open', false);
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : 'Unable to update staff status.';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
        <DialogContent variant="action" size="lg">
            <DialogHeader>
                <DialogTitle>Update Staff Status</DialogTitle>
                <DialogDescription>{{ staffDisplayName(profile) }}</DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div v-if="profile" class="rounded-lg border p-3 text-xs text-muted-foreground">
                    <p>
                        Employee #:
                        <span class="font-medium text-foreground">{{ profile.employeeNumber || 'N/A' }}</span>
                    </p>
                    <p>
                        Job Title:
                        <span class="font-medium text-foreground">{{ profile.jobTitle || 'N/A' }}</span>
                    </p>
                    <p>
                        Department:
                        <span class="font-medium text-foreground">{{ profile.department || 'N/A' }}</span>
                    </p>
                    <p>
                        Current status:
                        <span class="font-medium text-foreground">{{ formatLabel(profile.status) }}</span>
                    </p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                        <Badge :variant="linkedUserVerificationVariant(profile)">{{ linkedUserVerificationLabel(profile) }}</Badge>
                        <span class="text-[11px]">
                            {{ profile.userEmail || 'No linked user email recorded' }}
                        </span>
                    </div>
                </div>

                <div class="grid gap-2">
                    <Label for="staff-status-target">Status</Label>
                    <Select v-model="form.status">
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="fieldErrors.status" class="text-xs text-destructive">{{ fieldErrors.status[0] }}</p>
                </div>

                <div class="grid gap-2">
                    <Label for="staff-status-reason">
                        Reason
                        <span v-if="reasonRequired" class="text-destructive">*</span>
                    </Label>
                    <Textarea
                        id="staff-status-reason"
                        v-model="form.reason"
                        class="min-h-24"
                        :placeholder="reasonRequired ? 'Required reason for this status change' : 'Optional status note'"
                    />
                    <p v-if="fieldErrors.reason" class="text-xs text-destructive">{{ fieldErrors.reason[0] }}</p>
                </div>

                <Alert v-if="errorMessage" variant="destructive">
                    <AlertTitle>Status update failed</AlertTitle>
                    <AlertDescription>{{ errorMessage }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter class="gap-2">
                <Button variant="outline" :disabled="saving" @click="emit('update:open', false)">Cancel</Button>
                <Button :disabled="saving" @click="saveStatus">{{ saving ? 'Saving...' : 'Save Status' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
