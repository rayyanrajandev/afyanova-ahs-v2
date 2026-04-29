<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { csrfRequestHeaders } from '@/lib/csrf';
import type { SearchableSelectOption } from '@/lib/patientLocations';

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
};

type DepartmentRecord = {
    id: string | null;
    code: string | null;
    name: string | null;
    serviceType?: string | null;
};

type DepartmentListResponse = {
    data: Array<DepartmentRecord | DepartmentOption>;
};

type DepartmentOption = SearchableSelectOption;

export type EditableStaffProfile = {
    id: string;
    userId: number | null;
    userName: string | null;
    userEmail?: string | null;
    userEmailVerifiedAt?: string | null;
    userEmailVerified?: boolean;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    professionalLicenseNumber: string | null;
    licenseType: string | null;
    phoneExtension: string | null;
    employmentType: string | null;
    status: string | null;
    statusReason?: string | null;
};

const props = defineProps<{
    open: boolean;
    profile: EditableStaffProfile | null;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'saved', value: EditableStaffProfile): void;
}>();

const saving = ref(false);
const errorMessage = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const departmentOptions = ref<DepartmentOption[]>([]);
const departmentOptionsLoading = ref(false);
const departmentsLoaded = ref(false);

const form = reactive({
    department: '',
    jobTitle: '',
    professionalLicenseNumber: '',
    licenseType: '',
    phoneExtension: '',
    employmentType: 'full_time',
});

function resetForm(profile: EditableStaffProfile | null): void {
    form.department = profile?.department ?? '';
    form.jobTitle = profile?.jobTitle ?? '';
    form.professionalLicenseNumber = profile?.professionalLicenseNumber ?? '';
    form.licenseType = profile?.licenseType ?? '';
    form.phoneExtension = profile?.phoneExtension ?? '';
    form.employmentType = (profile?.employmentType as typeof form.employmentType) || 'full_time';
    errorMessage.value = null;
    fieldErrors.value = {};
}

function uniqueDepartmentOptions(options: DepartmentOption[]): DepartmentOption[] {
    const seen = new Set<string>();

    return options.filter((option) => {
        const key = option.value.trim().toLowerCase();
        if (key === '' || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function departmentOptionLabel(row: DepartmentRecord): string {
    const code = String(row.code ?? '').trim();
    const name = String(row.name ?? '').trim();

    if (code !== '' && name !== '') return `${code} - ${name}`;
    return name || code || 'Unnamed department';
}

function currentDepartmentOptions(): DepartmentOption[] {
    const value = form.department.trim();
    if (value === '') return departmentOptions.value;

    const exists = departmentOptions.value.some((option) => option.value.trim().toLowerCase() === value.toLowerCase());
    if (exists) return departmentOptions.value;

    return [
        {
            value,
            label: `${value} (Current)`,
            group: 'Legacy / uncategorized',
            description: 'Existing staff department value not yet linked to the department registry.',
            keywords: ['legacy'],
        },
        ...departmentOptions.value,
    ];
}

async function loadDepartmentOptions(): Promise<void> {
    if (departmentsLoaded.value || departmentOptionsLoading.value) return;

    departmentOptionsLoading.value = true;
    try {
        const response = await fetch('/api/v1/staff/department-options', {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        if (!response.ok) throw new Error(String(response.status));

        const payload = (await response.json().catch(() => ({}))) as DepartmentListResponse;
        departmentOptions.value = uniqueDepartmentOptions(
            (payload.data ?? [])
                .map((row) => {
                    if ('value' in row && 'label' in row) {
                        const value = String(row.value ?? '').trim();
                        const label = String(row.label ?? '').trim();
                        if (value === '') return null;

                        return {
                            value,
                            label: label || value,
                            group:
                                typeof row.group === 'string' && row.group.trim()
                                    ? row.group.trim()
                                    : null,
                            description:
                                typeof row.description === 'string' && row.description.trim()
                                    ? row.description.trim()
                                    : null,
                            keywords: Array.isArray(row.keywords)
                                ? row.keywords
                                      .map((keyword) => String(keyword).trim())
                                      .filter((keyword) => keyword.length > 0)
                                : undefined,
                        } satisfies DepartmentOption;
                    }

                    const name = String(row.name ?? '').trim();
                    if (name === '') return null;

                    return {
                        value: name,
                        label: departmentOptionLabel(row),
                        group:
                            typeof row.serviceType === 'string' && row.serviceType.trim()
                                ? row.serviceType.trim()
                                : null,
                        description:
                            typeof row.serviceType === 'string' && row.serviceType.trim()
                                ? `Category: ${row.serviceType.trim()}`
                                : null,
                        keywords: [row.code, row.serviceType]
                            .map((value) => String(value ?? '').trim())
                            .filter((value) => value.length > 0),
                    } satisfies DepartmentOption;
                })
                .filter((row): row is DepartmentOption => row !== null),
        );
    } catch {
        departmentOptions.value = [];
    } finally {
        departmentsLoaded.value = true;
        departmentOptionsLoading.value = false;
    }
}

watch(
    () => [props.open, props.profile?.id] as const,
    () => {
        if (props.open) {
            resetForm(props.profile);
            void loadDepartmentOptions();
        }
    },
    { immediate: true },
);

function closeDialog(): void {
    if (saving.value) return;
    emit('update:open', false);
}

function staffDisplayName(profile: EditableStaffProfile | null): string {
    const userName = String(profile?.userName ?? '').trim();
    if (userName !== '') return userName;

    const employeeNumber = String(profile?.employeeNumber ?? '').trim();
    if (employeeNumber !== '') return employeeNumber;

    return 'Staff profile';
}

function linkedUserVerificationVariant(profile: EditableStaffProfile | null): 'outline' | 'secondary' | 'destructive' {
    if (!profile?.userId) return 'outline';
    return profile.userEmailVerifiedAt ? 'secondary' : 'destructive';
}

function linkedUserVerificationLabel(profile: EditableStaffProfile | null): string {
    if (!profile?.userId) return 'No linked user';
    return profile.userEmailVerifiedAt ? 'Email verified' : 'Email unverified';
}

async function saveProfile(): Promise<void> {
    if (!props.profile?.id || saving.value) return;

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

        const response = await fetch(`/api/v1/staff/${props.profile.id}`, {
            method: 'PATCH',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify({
                department: form.department.trim(),
                jobTitle: form.jobTitle.trim(),
                professionalLicenseNumber: form.professionalLicenseNumber.trim() || null,
                licenseType: form.licenseType.trim() || null,
                phoneExtension: form.phoneExtension.trim() || null,
                employmentType: form.employmentType,
            }),
        });

        const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse & {
            data?: EditableStaffProfile;
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
        errorMessage.value = error instanceof Error ? error.message : 'Unable to update staff profile.';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
        <DialogContent size="2xl">
            <DialogHeader>
                <DialogTitle>Edit Staff Profile</DialogTitle>
                <DialogDescription>
                    {{ staffDisplayName(profile) }}{{ profile?.employeeNumber ? ` - ${profile.employeeNumber}` : '' }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2 md:grid-cols-2">
                <div class="grid gap-2">
                    <SearchableSelectField
                        input-id="staff-edit-department"
                        v-model="form.department"
                        label="Department"
                        :options="currentDepartmentOptions()"
                        placeholder="Select department"
                        search-placeholder="Search departments or categories"
                        helper-text="Departments are grouped by category from the registry. Legacy values remain selectable until they are cleaned up."
                        :error-message="fieldErrors.department?.[0] ?? null"
                        :disabled="saving || departmentOptionsLoading"
                        :allow-custom-value="true"
                    />
                </div>
                <div class="grid gap-2">
                    <Label>Linked User</Label>
                    <div class="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="font-medium">{{ profile?.userName || 'Unlinked user' }}</div>
                            <Badge :variant="linkedUserVerificationVariant(profile)">{{ linkedUserVerificationLabel(profile) }}</Badge>
                        </div>
                        <div class="mt-1 text-xs text-muted-foreground">
                            {{
                                profile?.userId != null
                                    ? `User ID ${profile.userId}${profile?.userEmail ? ` · ${profile.userEmail}` : ''}`
                                    : 'No linked user recorded'
                            }}
                        </div>
                        <p v-if="profile?.userId && !profile?.userEmailVerifiedAt" class="mt-2 text-xs text-amber-700">
                            Sensitive credentialing and privileging actions remain blocked until the linked user completes the invite or reset flow.
                        </p>
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="staff-edit-job-title">Staff Position / Job Title</Label>
                    <Input id="staff-edit-job-title" v-model="form.jobTitle" placeholder="Registration Officer, Theatre Nurse, Medical Officer" />
                    <p class="text-xs text-muted-foreground">Organizational staff post on the staff profile. Facility posting is managed under Platform Users. Professional title is managed in Credentialing.</p>
                    <p v-if="fieldErrors.jobTitle" class="text-xs text-destructive">{{ fieldErrors.jobTitle[0] }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="staff-edit-employment-type">Employment Type</Label>
                    <Select v-model="form.employmentType">
                        <SelectTrigger class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="full_time">Full time</SelectItem>
                        <SelectItem value="part_time">Part time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="locum">Locum</SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="fieldErrors.employmentType" class="text-xs text-destructive">{{ fieldErrors.employmentType[0] }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="staff-edit-license-number">Professional License Number</Label>
                    <Input id="staff-edit-license-number" v-model="form.professionalLicenseNumber" />
                    <p v-if="fieldErrors.professionalLicenseNumber" class="text-xs text-destructive">{{ fieldErrors.professionalLicenseNumber[0] }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="staff-edit-license-type">License Type</Label>
                    <Input id="staff-edit-license-type" v-model="form.licenseType" />
                    <p v-if="fieldErrors.licenseType" class="text-xs text-destructive">{{ fieldErrors.licenseType[0] }}</p>
                </div>
                <div class="grid gap-2 md:col-span-2">
                    <Label for="staff-edit-phone-extension">Phone Extension</Label>
                    <Input id="staff-edit-phone-extension" v-model="form.phoneExtension" />
                    <p v-if="fieldErrors.phoneExtension" class="text-xs text-destructive">{{ fieldErrors.phoneExtension[0] }}</p>
                </div>
            </div>

            <Alert v-if="errorMessage" variant="destructive">
                <AlertTitle>Update failed</AlertTitle>
                <AlertDescription>{{ errorMessage }}</AlertDescription>
            </Alert>

            <DialogFooter class="gap-2">
                <Button variant="outline" :disabled="saving" @click="closeDialog">Cancel</Button>
                <Button :disabled="saving" @click="saveProfile">{{ saving ? 'Saving...' : 'Save Changes' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
