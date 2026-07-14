<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { useAppointmentReferrals, type AppointmentReferral } from '@/composables/clinician/useAppointmentReferrals';
import { useCreateAppointmentReferral, type CreateAppointmentReferralPayload } from '@/composables/clinician/useCreateAppointmentReferral';
import {
    useUpdateAppointmentReferralStatus,
    type AppointmentReferralStatusTarget,
} from '@/composables/clinician/useUpdateAppointmentReferralStatus';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';

/**
 * Phase 5 of reports/appointments-scheduling-workspace-modernization-plan.md
 * — extracted from appointments/Index.vue's referrals tab + create/status
 * dialogs (Index.vue:670-693, 1354-1407, 3733-4032, 7667-7819, 8465-8615),
 * not rewritten from scratch. Deliberately scoped down from the legacy
 * ~830-line footprint:
 * - The referral-notes sub-feature (linking referrals to /medical-records
 *   entries, its own medical.records.read/create gate) is a separate,
 *   cross-module concern bolted onto the same tab in the legacy page —
 *   left out; nothing here depends on it.
 * - sourceAdmissionId discharge-prefill logic is appointment-details-only
 *   context, not applicable to a queue-page sheet.
 * - The "referral network" facility-browse endpoint was never wired into
 *   the legacy UI either (confirmed by grep) — free-text target facility
 *   code/name fields are exactly what the legacy version already ships,
 *   not a scope reduction.
 *
 * Two view modes in one sheet (list, create) rather than a separate create
 * dialog layered on top — avoids stacking a Dialog over a Sheet, which this
 * codebase has had real z-index/overlay problems with before (fix(ui):
 * Select/DropdownMenu rendering behind Dialog's overlay, this session).
 * The one nested Dialog here (reason collection for reject/cancel) sits on
 * top of the Sheet only, never on top of another Dialog.
 */
const props = defineProps<{
    appointmentId: string | null;
    appointmentNumber: string | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const appointmentIdRef = computed(() => props.appointmentId);
const referrals = useAppointmentReferrals(appointmentIdRef);
const clinicianDirectory = useClinicianDirectory();

const viewMode = ref<'list' | 'create'>('list');

watch(open, (isOpen) => {
    if (!isOpen) return;
    viewMode.value = 'list';
});

// --- List view --------------------------------------------------------------

const referralList = computed<AppointmentReferral[]>(() => referrals.data.value?.data ?? []);

const pipelineSummary = computed(() => {
    const list = referralList.value;
    return {
        active: list.filter((r) => ['requested', 'accepted', 'in_progress'].includes(r.status ?? '')).length,
        done: list.filter((r) => r.status === 'completed').length,
        stopped: list.filter((r) => ['rejected', 'cancelled'].includes(r.status ?? '')).length,
    };
});

function referralStatusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'accepted':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'rejected':
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function referralPriorityVariant(priority: string | null): 'default' | 'outline' | 'destructive' {
    if (priority === 'critical') return 'destructive';
    if (priority === 'urgent') return 'default';
    return 'outline';
}

function referralStatusLabel(status: string | null): string {
    switch (status) {
        case 'requested':
            return 'Requested';
        case 'accepted':
            return 'Accepted';
        case 'in_progress':
            return 'In progress';
        case 'completed':
            return 'Completed';
        case 'rejected':
            return 'Rejected';
        case 'cancelled':
            return 'Cancelled';
        default:
            return status ?? 'Unknown';
    }
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

type ReferralTransition = { target: AppointmentReferralStatusTarget; label: string; needsReason: boolean; destructive: boolean };

/**
 * Matches the legacy page's own per-status button gating exactly
 * (Index.vue:7809-7813): requested -> accepted/rejected/cancelled,
 * accepted -> in_progress/cancelled, in_progress -> completed/cancelled.
 * completed/rejected/cancelled are terminal — no buttons.
 */
function availableTransitions(status: string | null): ReferralTransition[] {
    switch (status) {
        case 'requested':
            return [
                { target: 'accepted', label: 'Accept', needsReason: false, destructive: false },
                { target: 'rejected', label: 'Reject', needsReason: true, destructive: true },
                { target: 'cancelled', label: 'Cancel referral', needsReason: true, destructive: true },
            ];
        case 'accepted':
            return [
                { target: 'in_progress', label: 'Start handoff', needsReason: false, destructive: false },
                { target: 'cancelled', label: 'Cancel referral', needsReason: true, destructive: true },
            ];
        case 'in_progress':
            return [
                { target: 'completed', label: 'Complete referral', needsReason: false, destructive: false },
                { target: 'cancelled', label: 'Cancel referral', needsReason: true, destructive: true },
            ];
        default:
            return [];
    }
}

const updateStatus = useUpdateAppointmentReferralStatus();

async function applyTransition(referral: AppointmentReferral, transition: ReferralTransition): Promise<void> {
    if (transition.needsReason) {
        reasonDialogTarget.value = { referral, transition };
        reasonDialogReason.value = '';
        reasonDialogOpen.value = true;
        return;
    }

    if (!props.appointmentId) return;
    try {
        await updateStatus.mutateAsync({ appointmentId: props.appointmentId, referralId: referral.id, status: transition.target });
        notifySuccess(`Referral ${transition.label.toLowerCase()}d.`);
        await referrals.refetch();
    } catch (error) {
        submitError.value = messageFromUnknown(error, 'Unable to update this referral.');
    }
}

// --- Reason dialog (reject / cancel) -----------------------------------------

const reasonDialogOpen = ref(false);
const reasonDialogTarget = ref<{ referral: AppointmentReferral; transition: ReferralTransition } | null>(null);
const reasonDialogReason = ref('');
const reasonDialogError = ref<string | null>(null);

const canSubmitReason = computed(() => reasonDialogReason.value.trim() !== '' && !updateStatus.isPending.value);

async function submitReasonDialog(): Promise<void> {
    if (!reasonDialogTarget.value || !props.appointmentId) return;
    reasonDialogError.value = null;

    try {
        await updateStatus.mutateAsync({
            appointmentId: props.appointmentId,
            referralId: reasonDialogTarget.value.referral.id,
            status: reasonDialogTarget.value.transition.target,
            reason: reasonDialogReason.value.trim(),
        });
        notifySuccess(`Referral ${reasonDialogTarget.value.transition.label.toLowerCase()}d.`);
        reasonDialogOpen.value = false;
        await referrals.refetch();
    } catch (error) {
        reasonDialogError.value = messageFromUnknown(error, 'Unable to update this referral.');
    }
}

// --- Create view --------------------------------------------------------------

const referralType = ref<'internal' | 'external'>('internal');
const priority = ref<'routine' | 'urgent' | 'critical'>('routine');
const targetDepartment = ref('');
const targetFacilityCode = ref('');
const targetFacilityName = ref('');
const targetClinicianUserId = ref('');
const referralReason = ref('');
const clinicalNotes = ref('');
const handoffNotes = ref('');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const clinicianOptions = computed(() =>
    (clinicianDirectory.data.value ?? [])
        .filter((c) => c.userId !== null)
        .map((c) => ({ value: String(c.userId), label: c.userName ?? `Clinician #${c.userId}` })),
);

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

function openCreateView(): void {
    referralType.value = 'internal';
    priority.value = 'routine';
    targetDepartment.value = '';
    targetFacilityCode.value = '';
    targetFacilityName.value = '';
    targetClinicianUserId.value = '';
    referralReason.value = '';
    clinicalNotes.value = '';
    handoffNotes.value = '';
    submitError.value = null;
    fieldErrors.value = {};
    viewMode.value = 'create';
}

const create = useCreateAppointmentReferral();

async function submitCreate(): Promise<void> {
    if (!props.appointmentId) return;
    submitError.value = null;
    fieldErrors.value = {};

    const payload: CreateAppointmentReferralPayload = {
        referralType: referralType.value,
        priority: priority.value,
        targetDepartment: targetDepartment.value.trim() || null,
        targetFacilityCode: targetFacilityCode.value.trim() || null,
        targetFacilityName: targetFacilityName.value.trim() || null,
        targetClinicianUserId: targetClinicianUserId.value ? Number(targetClinicianUserId.value) : null,
        referralReason: referralReason.value.trim() || null,
        clinicalNotes: clinicalNotes.value.trim() || null,
        handoffNotes: handoffNotes.value.trim() || null,
    };

    try {
        await create.mutateAsync({ appointmentId: props.appointmentId, payload });
        notifySuccess('Referral requested.');
        viewMode.value = 'list';
        await referrals.refetch();
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to request this referral.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>{{ viewMode === 'create' ? 'Request referral' : 'Referrals' }}</SheetTitle>
                <SheetDescription>
                    {{ appointmentNumber || '' }} —
                    {{ viewMode === 'create' ? 'Create the receiving-team handoff for this visit.' : 'Each row is one referral for this visit.' }}
                </SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <template v-if="viewMode === 'list'">
                    <div v-if="referrals.isPending.value" class="space-y-2">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="referrals.isError.value" variant="destructive">
                        <AlertTitle>Unable to load referrals</AlertTitle>
                        <AlertDescription>{{ referrals.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <template v-else>
                        <div v-if="referralList.length > 0" class="grid grid-cols-3 gap-2">
                            <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active</p>
                                <p class="text-sm font-bold tabular-nums">{{ pipelineSummary.active }}</p>
                            </div>
                            <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Done</p>
                                <p class="text-sm font-bold tabular-nums">{{ pipelineSummary.done }}</p>
                            </div>
                            <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Stopped</p>
                                <p class="text-sm font-bold tabular-nums">{{ pipelineSummary.stopped }}</p>
                            </div>
                        </div>

                        <div
                            v-if="referralList.length === 0"
                            class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                        >
                            No referrals yet for this visit.
                        </div>

                        <ul v-else class="space-y-2">
                            <li v-for="referral in referralList" :key="referral.id" class="space-y-2 rounded-lg border bg-card p-3 shadow-sm">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-mono text-xs text-muted-foreground">{{ referral.referralNumber || 'Referral' }}</span>
                                    <Badge :variant="referralStatusVariant(referral.status)">{{ referralStatusLabel(referral.status) }}</Badge>
                                    <Badge :variant="referralPriorityVariant(referral.priority)">{{ referral.priority || 'routine' }}</Badge>
                                </div>

                                <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                    <p class="text-muted-foreground">
                                        Destination
                                        <span class="block font-medium text-foreground">
                                            {{ referral.targetDepartment || referral.targetFacilityName || 'Pending' }}
                                        </span>
                                    </p>
                                    <p class="text-muted-foreground">
                                        Type
                                        <span class="block font-medium text-foreground capitalize">{{ referral.referralType || '—' }}</span>
                                    </p>
                                    <p class="text-muted-foreground">
                                        Requested
                                        <span class="block font-medium text-foreground">
                                            {{ formatDateTime(referral.requestedAt || referral.createdAt) }}
                                        </span>
                                    </p>
                                    <p v-if="referral.completedAt" class="text-muted-foreground">
                                        Completed
                                        <span class="block font-medium text-foreground">{{ formatDateTime(referral.completedAt) }}</span>
                                    </p>
                                </div>

                                <p v-if="referral.referralReason" class="text-xs text-muted-foreground">{{ referral.referralReason }}</p>

                                <div v-if="availableTransitions(referral.status).length > 0" class="flex flex-wrap items-center gap-1 pt-1">
                                    <Button
                                        v-for="transition in availableTransitions(referral.status)"
                                        :key="transition.target"
                                        size="sm"
                                        :variant="transition.destructive ? 'ghost' : 'outline'"
                                        :class="['h-7 px-2 text-xs', transition.destructive ? 'text-destructive hover:text-destructive' : '']"
                                        :disabled="updateStatus.isPending.value"
                                        @click="applyTransition(referral, transition)"
                                    >
                                        {{ transition.label }}
                                    </Button>
                                </div>
                            </li>
                        </ul>
                    </template>
                </template>

                <template v-else>
                    <Alert v-if="submitError" variant="destructive">
                        <AlertTitle>Unable to request this referral</AlertTitle>
                        <AlertDescription>{{ submitError }}</AlertDescription>
                    </Alert>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <Label for="referral-create-type">Referral type</Label>
                            <Select v-model="referralType">
                                <SelectTrigger id="referral-create-type" class="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="internal">Internal</SelectItem>
                                    <SelectItem value="external">External</SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError('referralType')" class="text-sm text-destructive">{{ fieldError('referralType') }}</p>
                        </div>
                        <div class="space-y-1.5">
                            <Label for="referral-create-priority">Priority</Label>
                            <Select v-model="priority">
                                <SelectTrigger id="referral-create-priority" class="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="routine">Routine</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError('priority')" class="text-sm text-destructive">{{ fieldError('priority') }}</p>
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <Label for="referral-create-department">Target department</Label>
                        <Input id="referral-create-department" v-model="targetDepartment" placeholder="Receiving clinic or department" />
                        <p v-if="fieldError('targetDepartment')" class="text-sm text-destructive">{{ fieldError('targetDepartment') }}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <Label for="referral-create-facility-code">Target facility code</Label>
                            <Input id="referral-create-facility-code" v-model="targetFacilityCode" placeholder="Optional facility code" />
                        </div>
                        <div class="space-y-1.5">
                            <Label for="referral-create-facility-name">Target facility name</Label>
                            <Input id="referral-create-facility-name" v-model="targetFacilityName" placeholder="Optional receiving facility name" />
                        </div>
                    </div>

                    <SearchableSelectField
                        v-model="targetClinicianUserId"
                        input-id="referral-create-clinician"
                        label="Target clinician (optional)"
                        :options="clinicianOptions"
                        placeholder="Select the receiving clinician"
                        :error-message="fieldError('targetClinicianUserId')"
                    />

                    <div class="space-y-1.5">
                        <Label for="referral-create-reason">Referral reason</Label>
                        <Input id="referral-create-reason" v-model="referralReason" placeholder="Why the patient is being referred" maxlength="255" />
                        <p v-if="fieldError('referralReason')" class="text-sm text-destructive">{{ fieldError('referralReason') }}</p>
                    </div>

                    <div class="space-y-1.5">
                        <Label for="referral-create-clinical-notes">Clinical handoff notes</Label>
                        <Textarea
                            id="referral-create-clinical-notes"
                            v-model="clinicalNotes"
                            rows="4"
                            maxlength="5000"
                            placeholder="Summarize the clinical context for the receiving team."
                        />
                    </div>

                    <div class="space-y-1.5">
                        <Label for="referral-create-handoff-notes">Operational notes</Label>
                        <Textarea
                            id="referral-create-handoff-notes"
                            v-model="handoffNotes"
                            rows="3"
                            maxlength="5000"
                            placeholder="Add transport, communication, or scheduling notes."
                        />
                    </div>
                </template>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <template v-if="viewMode === 'list'">
                    <Button variant="outline" @click="open = false">Close</Button>
                    <Button @click="openCreateView">New referral</Button>
                </template>
                <template v-else>
                    <Button variant="outline" @click="viewMode = 'list'">Back</Button>
                    <Button :disabled="create.isPending.value" @click="submitCreate">
                        {{ create.isPending.value ? 'Requesting…' : 'Request referral' }}
                    </Button>
                </template>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Dialog :open="reasonDialogOpen" @update:open="(value) => (reasonDialogOpen = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>{{ reasonDialogTarget?.transition.label }} referral</DialogTitle>
                <DialogDescription>
                    {{ reasonDialogTarget?.referral.referralNumber || '' }} — A reason is required.
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="referral-reason-dialog-reason">Reason</Label>
                    <Textarea id="referral-reason-dialog-reason" v-model="reasonDialogReason" rows="3" maxlength="255" />
                </div>

                <Alert v-if="reasonDialogError" variant="destructive">
                    <AlertTitle>Unable to update this referral</AlertTitle>
                    <AlertDescription>{{ reasonDialogError }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="reasonDialogOpen = false">Close</Button>
                <Button variant="destructive" :disabled="!canSubmitReason" @click="submitReasonDialog">
                    {{ updateStatus.isPending.value ? 'Saving…' : reasonDialogTarget?.transition.label }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
