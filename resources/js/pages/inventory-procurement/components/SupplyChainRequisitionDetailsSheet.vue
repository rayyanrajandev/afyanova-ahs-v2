<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatEnumLabel } from '@/lib/labels';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
<Sheet
        :open="ws.requisitionDetailsOpen"
        @update:open="ws.onRequisitionDetailsOpenChange"
    >
        <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="clipboard-list" class="size-5 text-muted-foreground" />
                    {{ ws.selectedRequisition?.status === 'submitted' ? 'Review Department Requisition' : 'Department Requisition Details' }}
                </SheetTitle>
                <SheetDescription>
                    {{ ws.selectedRequisition?.requisitionNumber ?? 'Requisition' }}
                </SheetDescription>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                <div v-if="ws.selectedRequisition" class="grid gap-4 px-4 py-4">
                    <div class="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-2">
                        <div class="min-w-0">
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Department</p>
                            <p class="mt-1 truncate text-sm font-semibold">{{ ws.selectedRequisition.requestingDepartment ?? 'Not recorded' }}</p>
                        </div>
                        <div class="min-w-0">
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Issuing warehouse</p>
                            <p class="mt-1 truncate text-sm font-semibold">
                                {{ ws.warehouseLabel(ws.selectedRequisition.issuingWarehouseId) ?? ws.selectedRequisition.issuingStore ?? 'Not assigned' }}
                            </p>
                        </div>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Priority</p>
                            <p class="mt-1 text-sm font-semibold">{{ formatEnumLabel(ws.selectedRequisition.priority ?? 'normal') }}</p>
                        </div>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Needed by</p>
                            <p class="mt-1 text-sm font-semibold">{{ ws.formatDateOnly(ws.selectedRequisition.neededBy) }}</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                        <div class="min-w-0">
                            <p class="text-sm font-semibold">Workflow status</p>
                            <p class="text-xs text-muted-foreground">
                                {{ ws.requisitionStatusHelper(ws.selectedRequisition.status) }}
                            </p>
                        </div>
                        <Badge :class="ws.reqStatusBadgeClass(ws.selectedRequisition.status)" class="shrink-0">
                            {{ formatEnumLabel(ws.selectedRequisition.status ?? 'draft') }}
                        </Badge>
                    </div>

                    <div class="rounded-lg border">
                        <div class="border-b px-3 py-2">
                            <p class="text-sm font-semibold">Requested ws.items</p>
                            <p class="text-xs text-muted-foreground">Review quantities before approval or issue.</p>
                        </div>
                        <div class="divide-y">
                            <div
                                v-for="line in ws.selectedRequisition.lines ?? []"
                                :key="line.id ?? line.itemId"
                                class="grid min-w-0 gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_6.5rem_8rem_8rem]"
                            >
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-semibold">{{ ws.requisitionLineItemLabel(line) }}</p>
                                    <p class="truncate text-xs text-muted-foreground">
                                        <template v-if="line.itemCategory">{{ formatEnumLabel(line.itemCategory) }}</template>
                                        <template v-if="line.itemSubcategory"> / {{ formatEnumLabel(line.itemSubcategory) }}</template>
                                        <template v-if="line.notes"> · {{ line.notes }}</template>
                                    </p>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-[11px] text-muted-foreground">Requested</p>
                                    <p class="truncate text-sm font-semibold tabular-nums">{{ ws.formatAmount(line.requestedQuantity) }} {{ line.unit }}</p>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-[11px] text-muted-foreground">Approved</p>
                                    <Input
                                        v-if="ws.selectedRequisition.status === 'submitted'"
                                        v-model="ws.requisitionLineDecisionDraft(line).approvedQuantity"
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        class="mt-1 h-8 text-sm"
                                    />
                                    <p v-else class="text-sm font-semibold tabular-nums">{{ line.approvedQuantity == null ? '—' : ws.formatAmount(line.approvedQuantity) }}</p>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-[11px] text-muted-foreground">Issued</p>
                                    <Input
                                        v-if="['approved', 'partially_issued'].includes(ws.selectedRequisition.status)"
                                        v-model="ws.requisitionLineDecisionDraft(line).issuedQuantity"
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        class="mt-1 h-8 text-sm"
                                    />
                                    <p v-else class="text-sm font-semibold tabular-nums">{{ line.issuedQuantity == null ? '—' : ws.formatAmount(line.issuedQuantity) }}</p>
                                    <p
                                        v-if="['approved', 'partially_issued'].includes(ws.selectedRequisition.status)"
                                        class="mt-1 text-[11px]"
                                        :class="ws.requisitionLineIssueProblem(line) ? 'text-destructive' : 'text-muted-foreground'"
                                    >
                                        Available {{ ws.formatAmount(ws.requisitionLineAvailableStock(line)) }}
                                    </p>
                                    <p
                                        v-if="['approved', 'partially_issued'].includes(ws.selectedRequisition.status) && ws.requisitionLineShortageSummary(line)"
                                        class="mt-1 text-[11px] text-amber-700 dark:text-amber-300"
                                    >
                                        Short {{ ws.formatAmount(ws.requisitionApprovedDecisionQuantity(line) - ws.requisitionIssuedDecisionQuantity(line)) }}
                                    </p>
                                </div>
                                <div
                                    v-if="ws.canCreateProcurementFromRequisitionLine(line) || ws.shortageLineProcurementRequest(line)"
                                    class="flex min-w-0 flex-wrap items-center gap-2 lg:col-span-4 lg:justify-end"
                                >
                                    <Button
                                        v-if="ws.canCreateProcurementFromRequisitionLine(line)"
                                        size="sm"
                                        variant="outline"
                                        class="h-7 max-w-full gap-1.5 rounded-lg px-2 text-[11px]"
                                        @click="ws.openProcurementFromRequisitionShortage(line)"
                                    >
                                        <AppIcon name="plus" class="size-3" />
                                        Procure shortage
                                    </Button>
                                    <Badge
                                        v-else-if="ws.shortageLineProcurementRequest(line)"
                                        variant="outline"
                                        class="max-w-full justify-start rounded-lg px-2 py-1 text-[11px] font-normal"
                                    >
                                        <span class="truncate">
                                            Procurement {{ ws.shortageLineProcurementRequest(line).requestNumber ?? 'request' }}
                                            &middot; {{ formatEnumLabel(ws.shortageLineProcurementRequest(line).status ?? 'n/a') }}
                                        </span>
                                    </Badge>
                                </div>
                            </div>
                            <div v-if="!ws.selectedRequisition.lines?.length" class="px-3 py-6 text-center text-sm text-muted-foreground">
                                No item lines recorded.
                            </div>
                        </div>
                    </div>

                    <Alert v-if="ws.selectedRequisitionIssueBlockingProblems.length > 0" variant="destructive">
                        <AlertTitle>Issue cannot be confirmed yet</AlertTitle>
                        <AlertDescription>
                            <ul class="mt-1 list-disc space-y-1 pl-4">
                                <li v-for="problem in ws.selectedRequisitionIssueBlockingProblems" :key="problem">
                                    {{ problem }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Alert
                        v-else-if="ws.selectedRequisitionHasAnyAdditionalIssue && ws.selectedRequisitionIssueShortageSummaries.length > 0"
                        class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
                    >
                        <AlertTitle>Partial issue will be recorded</AlertTitle>
                        <AlertDescription>
                            <p>Available stock will be issued now. The remaining quantities stay visible for procurement or later fulfillment.</p>
                            <ul class="mt-2 list-disc space-y-1 pl-4">
                                <li v-for="summary in ws.selectedRequisitionIssueShortageSummaries" :key="summary">
                                    {{ summary }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Alert
                        v-else-if="ws.selectedRequisitionIssueUnavailableReason"
                        class="border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100"
                    >
                        <AlertTitle>Waiting for stock replenishment</AlertTitle>
                        <AlertDescription>
                            <p>{{ ws.selectedRequisitionIssueUnavailableReason }} Keep this requisition partially issued until procurement or stock transfer replenishes the shortage.</p>
                            <ul v-if="ws.selectedRequisitionIssueShortageSummaries.length > 0" class="mt-2 list-disc space-y-1 pl-4">
                                <li v-for="summary in ws.selectedRequisitionIssueShortageSummaries" :key="summary">
                                    {{ summary }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <div v-if="ws.selectedRequisition.notes || ws.selectedRequisition.rejectionReason" class="grid gap-3">
                        <div v-if="ws.selectedRequisition.notes" class="rounded-lg border bg-background p-3">
                            <p class="text-sm font-semibold">Notes</p>
                            <p class="mt-1 text-sm text-muted-foreground">{{ ws.selectedRequisition.notes }}</p>
                        </div>
                        <div v-if="ws.selectedRequisition.rejectionReason" class="rounded-lg border bg-background p-3">
                            <p class="text-sm font-semibold">Rejection reason</p>
                            <p class="mt-1 text-sm text-muted-foreground">{{ ws.selectedRequisition.rejectionReason }}</p>
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.requisitionDetailsOpen = false">Close</Button>
                <Button
                    v-if="ws.selectedRequisition?.status === 'draft'"
                    variant="outline"
                    :disabled="ws.requisitionStatusSubmitting"
                    @click="ws.updateRequisitionStatus(ws.selectedRequisition.id, 'submitted')"
                >
                    {{ ws.requisitionStatusSubmitting ? 'Saving...' : 'Submit' }}
                </Button>
                <Button
                    v-if="ws.selectedRequisition?.status === 'submitted' && ws.canManageItems"
                    variant="destructive"
                    :disabled="ws.requisitionStatusSubmitting"
                    @click="ws.updateRequisitionStatus(ws.selectedRequisition.id, 'rejected', { rejectionReason: 'Rejected by store manager' })"
                >
                    Reject
                </Button>
                <Button
                    v-if="ws.selectedRequisition?.status === 'submitted' && ws.canManageItems"
                    :disabled="ws.requisitionStatusSubmitting"
                    @click="ws.updateRequisitionStatus(ws.selectedRequisition.id, 'approved')"
                >
                    {{ ws.requisitionStatusSubmitting ? 'Saving...' : 'Approve' }}
                </Button>
                <Button
                    v-if="['approved', 'partially_issued'].includes(ws.selectedRequisition?.status) && ws.canManageItems"
                    :disabled="ws.requisitionStatusSubmitting"
                    :variant="ws.selectedRequisitionIssueBlockedReason || ws.selectedRequisitionIssueUnavailableReason ? 'outline' : 'default'"
                    :title="ws.selectedRequisitionIssueBlockedReason || ws.selectedRequisitionIssueUnavailableReason || ''"
                    @click="ws.confirmSelectedRequisitionIssue"
                >
                    <template v-if="ws.requisitionStatusSubmitting">Saving...</template>
                    <template v-else>{{ ws.selectedRequisitionIssueTargetStatus === 'partially_issued' ? 'Confirm Partial Issue' : 'Confirm Issue' }}</template>
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>


