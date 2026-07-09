<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { patientChartModuleHref } from '@/composables/patientChart/patientChartModuleHref';
import { useWalkInCheckIn, type WalkInArrivalMode } from '@/composables/reception/useWalkInCheckIn';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePatientSummary } from '@/composables/patientSummary/usePatientSummary';
import { type PatientListItem } from '@/composables/patientsIndex/usePatientList';
import { notifyError, notifySuccess } from '@/lib/notify';
import PatientDirectServiceDialog from './PatientDirectServiceDialog.vue';

/**
 * Phase 5 of reports/patients-index-modernization-plan.md — "Visit
 * Handoff," rebuilt per reports/reception-checkin-architecture-audit.md's
 * finding rather than reviving the legacy 5-mode sheet as-is: OPD/
 * Emergency check-in are one-click actions calling the exact same
 * useWalkInCheckIn/POST /reception/walk-ins path reception/Queue.vue
 * already uses — no intermediate form, matching this codebase's
 * consistently Queue-Centric check-in model (CheckInUseCase advances the
 * appointment to the next queue stage in the same atomic write as
 * check-in itself; there is no "complete a form, then the queue updates"
 * step anywhere in the backend this should imitate). Direct-service
 * creation gets its own small dialog (PatientDirectServiceDialog.vue) —
 * it's a genuinely different, non-queue action that needs real fields.
 * Billing is a plain navigation link, same as ShowV2.vue's Billing tab
 * uses (patientChartModuleHref). "Chart" is deliberately not repeated
 * here — the Patient Summary Popover's "View chart" action already
 * covers it; a second link to the same place would be redundant, not
 * completeness.
 *
 * OPD/emergency are disabled — not just left to fail — when the patient
 * already has an active appointment today (usePatientSummary's
 * activeAppointmentToday, itself the same AppointmentRepositoryInterface::
 * findActiveForPatientOnDate() the backend's own same-day conflict guard
 * uses): letting a click round-trip to the server for an error it could
 * have known about in advance is a worse experience than telling the
 * user up front. Fetched lazily (enabled only while the menu is open),
 * matching this module's "nothing fetches until asked for" convention —
 * and if the same patient's summary was already opened via the Popover,
 * this is a cache hit, not a second request.
 */
const props = defineProps<{
    patient: PatientListItem;
}>();

const emit = defineEmits<{
    checkedIn: [];
}>();

const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();
function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}
const canStartVisit = computed(() => hasAccess('appointments.create') && hasAccess('appointments.update-status'));
const canCreateServiceRequest = computed(() => hasAccess('service.requests.create'));
const canCreateInvoice = computed(() => hasAccess('billing.invoices.create'));
const canShowMenu = computed(() => canStartVisit.value || canCreateServiceRequest.value || canCreateInvoice.value);

const walkIn = useWalkInCheckIn();
const directServiceDialogOpen = ref(false);

const menuOpen = ref(false);
const patientId = computed(() => props.patient.id);
const summary = usePatientSummary(patientId, { enabled: menuOpen });
const activeAppointmentToday = computed(() => summary.data.value?.activeAppointmentToday ?? null);
const activeAppointmentLabel = computed(() => {
    const appointment = activeAppointmentToday.value;
    if (!appointment) return null;
    const scheduledAt = appointment.scheduledAt ? new Date(appointment.scheduledAt) : null;
    const time = scheduledAt && !Number.isNaN(scheduledAt.getTime())
        ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(scheduledAt)
        : null;
    return `Already has an active appointment${appointment.appointmentNumber ? ` (${appointment.appointmentNumber})` : ''}${time ? ` at ${time}` : ''} today.`;
});

async function startVisit(arrivalMode: WalkInArrivalMode): Promise<void> {
    try {
        await walkIn.mutateAsync({
            patientId: props.patient.id,
            arrivalMode,
            reason: arrivalMode === 'emergency' ? 'Emergency — directed to triage by registration' : 'OPD walk-in',
        });
        notifySuccess(
            arrivalMode === 'emergency'
                ? 'Patient is now in the emergency triage queue.'
                : 'OPD walk-in started. Patient is now waiting for nurse triage.',
        );
        emit('checkedIn');
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to start this visit.');
    }
}
</script>

<template>
    <DropdownMenu v-if="canShowMenu" v-model:open="menuOpen">
        <DropdownMenuTrigger as-child>
            <Button size="sm" variant="ghost" class="h-7 gap-1 px-2 text-xs" :disabled="walkIn.isPending.value">
                <AppIcon name="calendar-plus-2" class="size-3.5" />Visit
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-64">
            <template v-if="canStartVisit">
                <p v-if="activeAppointmentLabel" class="px-2 py-1.5 text-xs text-muted-foreground">
                    {{ activeAppointmentLabel }}
                </p>
                <DropdownMenuItem
                    class="cursor-pointer text-sm"
                    :disabled="walkIn.isPending.value || Boolean(activeAppointmentToday)"
                    @select="startVisit('walk_in')"
                >
                    Start OPD walk-in
                </DropdownMenuItem>
                <DropdownMenuItem
                    class="cursor-pointer text-sm"
                    :disabled="walkIn.isPending.value || Boolean(activeAppointmentToday)"
                    @select="startVisit('emergency')"
                >
                    Send to emergency
                </DropdownMenuItem>
            </template>
            <DropdownMenuSeparator v-if="canStartVisit && canCreateServiceRequest" />
            <DropdownMenuItem v-if="canCreateServiceRequest" class="cursor-pointer text-sm" @select="directServiceDialogOpen = true">
                Direct service request…
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="(canStartVisit || canCreateServiceRequest) && canCreateInvoice" />
            <DropdownMenuItem v-if="canCreateInvoice" class="cursor-pointer text-sm" as-child>
                <Link :href="patientChartModuleHref('/billing-invoices', patient.id, null, { includeAppointment: false, includeTabNew: true })">
                    Create invoice
                </Link>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>

    <PatientDirectServiceDialog
        v-model:open="directServiceDialogOpen"
        :patient="patient"
        @created="(requestNumber) => notifySuccess(`Direct service request ${requestNumber ?? ''} created.`)"
    />
</template>
