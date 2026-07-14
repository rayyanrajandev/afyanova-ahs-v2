<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AuditLogSheet from '@/components/shared/AuditLogSheet.vue';
import EmergencyTransferCreateSheet from './EmergencyTransferCreateSheet.vue';
import EmergencyTransferStatusDialog, {
    type EmergencyTransferStatusTargetRequest,
} from './EmergencyTransferStatusDialog.vue';
import { useEmergencyTransfers, type EmergencyTransfer } from '@/composables/emergency/useEmergencyTransfers';
import { useEmergencyTransferAuditLog } from '@/composables/emergency/useEmergencyTransferAuditLog';
import {
    useUpdateEmergencyTransferStatus,
    type EmergencyTransferStatusTarget,
} from '@/composables/emergency/useUpdateEmergencyTransferStatus';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { notifyError } from '@/lib/notify';

/**
 * P0b — lives inside a case row's expanded Collapsible content
 * (emergency/Queue.vue), so its own setup() only runs while that row is
 * expanded: useEmergencyTransfers only fetches while this component is
 * mounted, no manual `enabled` flag needed. Low-risk forward transitions
 * (accept/start transport/complete) fire as one-click chip actions with no
 * dialog; cancel/reject open EmergencyTransferStatusDialog.vue since they
 * need a mandatory reason.
 */
const props = defineProps<{
    caseId: string;
    canManage: boolean;
}>();

const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();
const canViewAuditLogs = computed(() => isFacilitySuperAdmin.value || hasPermission('emergency.triage.view-transfer-audit-logs'));

const transfers = useEmergencyTransfers(props.caseId);
const update = useUpdateEmergencyTransferStatus();
const queryClient = useQueryClient();

const createSheetOpen = ref(false);
const statusDialogOpen = ref(false);
const statusDialogTarget = ref<EmergencyTransferStatusTargetRequest | null>(null);
const statusDialogAction = ref<EmergencyTransferStatusTarget | null>(null);
const oneClickPendingId = ref<string | null>(null);

const auditSheetOpen = ref(false);
const auditSheetTransferId = ref<string | null>(null);
const auditSheetTransferNumber = ref<string | null>(null);
const transferAuditLog = useEmergencyTransferAuditLog(props.caseId, auditSheetTransferId);

function openAuditSheet(transfer: EmergencyTransfer): void {
    auditSheetTransferId.value = transfer.id;
    auditSheetTransferNumber.value = transfer.transferNumber;
    auditSheetOpen.value = true;
}

async function invalidateTransfers(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['emergency-transfers', props.caseId] });
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'requested':
            return 'outline';
        case 'accepted':
        case 'in_transit':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
        case 'rejected':
            return 'destructive';
        default:
            return 'outline';
    }
}

type OneClickTransition = { target: 'accepted' | 'in_transit' | 'completed'; label: string };
function oneClickTransitions(status: string | null): OneClickTransition[] {
    switch (status) {
        case 'requested':
            return [{ target: 'accepted', label: 'Accept' }];
        case 'accepted':
            return [{ target: 'in_transit', label: 'Start transport' }];
        case 'in_transit':
            return [{ target: 'completed', label: 'Complete' }];
        default:
            return [];
    }
}

function canCancelOrReject(status: string | null): boolean {
    return status === 'requested' || status === 'accepted' || status === 'in_transit';
}

async function applyOneClickTransition(transfer: EmergencyTransfer, target: 'accepted' | 'in_transit' | 'completed'): Promise<void> {
    oneClickPendingId.value = transfer.id;
    try {
        await update.mutateAsync({ caseId: props.caseId, transferId: transfer.id, status: target });
        await invalidateTransfers();
    } catch (error) {
        const apiError = error as { payload?: { message?: string } };
        notifyError(apiError.payload?.message ?? 'Unable to update this transfer.');
    } finally {
        oneClickPendingId.value = null;
    }
}

function openStatusDialog(transfer: EmergencyTransfer, action: EmergencyTransferStatusTarget): void {
    statusDialogTarget.value = { caseId: props.caseId, transferId: transfer.id, transferNumber: transfer.transferNumber };
    statusDialogAction.value = action;
    statusDialogOpen.value = true;
}

async function onStatusUpdated(): Promise<void> {
    await invalidateTransfers();
}

async function onTransferCreated(): Promise<void> {
    await invalidateTransfers();
}

const transferList = computed(() => transfers.data.value?.data ?? []);
</script>

<template>
    <div class="space-y-2">
        <div class="flex items-center justify-between">
            <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Transfers</p>
            <Button v-if="canManage" size="sm" variant="outline" class="h-6 gap-1 px-2 text-[11px]" @click="createSheetOpen = true">
                <AppIcon name="plus" class="size-3" />
                New transfer
            </Button>
        </div>

        <Skeleton v-if="transfers.isPending.value" class="h-10 w-full" />
        <p v-else-if="transfers.isError.value" class="text-xs text-destructive">Unable to load transfers.</p>
        <p v-else-if="transferList.length === 0" class="text-xs text-muted-foreground">No transfers for this case.</p>

        <ul v-else class="space-y-1.5">
            <li
                v-for="transfer in transferList"
                :key="transfer.id"
                class="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5"
            >
                <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge :variant="statusVariant(transfer.status)" class="text-[10px]">{{ transfer.status || 'unknown' }}</Badge>
                    <span class="truncate text-xs text-foreground">{{ transfer.destinationLocation || transfer.destinationFacilityName || 'No destination' }}</span>
                    <span class="text-[11px] text-muted-foreground">({{ transfer.priority || 'routine' }})</span>
                </div>

                <div v-if="canManage" class="flex shrink-0 items-center gap-1">
                    <Button
                        v-for="transition in oneClickTransitions(transfer.status)"
                        :key="transition.target"
                        size="sm"
                        variant="outline"
                        class="h-6 px-2 text-[11px]"
                        :disabled="oneClickPendingId === transfer.id"
                        @click="applyOneClickTransition(transfer, transition.target)"
                    >
                        {{ oneClickPendingId === transfer.id ? 'Saving…' : transition.label }}
                    </Button>
                    <Button
                        v-if="canCancelOrReject(transfer.status)"
                        size="sm"
                        variant="ghost"
                        class="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                        @click="openStatusDialog(transfer, 'cancelled')"
                    >
                        Cancel
                    </Button>
                </div>
                <Button
                    v-if="canViewAuditLogs"
                    size="sm"
                    variant="ghost"
                    class="h-6 shrink-0 gap-1 px-2 text-[11px] text-muted-foreground"
                    @click="openAuditSheet(transfer)"
                >
                    <AppIcon name="clock" class="size-3" />
                    Activity
                </Button>
            </li>
        </ul>

        <EmergencyTransferCreateSheet v-model:open="createSheetOpen" :case-id="caseId" @created="onTransferCreated" />
        <EmergencyTransferStatusDialog
            v-model:open="statusDialogOpen"
            :target="statusDialogTarget"
            :action="statusDialogAction"
            @updated="onStatusUpdated"
        />
        <AuditLogSheet
            v-model:open="auditSheetOpen"
            title="Transfer activity"
            :subtitle="auditSheetTransferNumber ?? ''"
            :audit="transferAuditLog"
        />
    </div>
</template>
