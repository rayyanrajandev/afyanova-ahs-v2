<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col">
            <div class="flex min-h-0 flex-1 flex-col p-0">
                <WorkflowQueueSkeleton v-if="ws.claimLinkLoading" :count="4" />
                <div
                    v-else-if="ws.claimLinks.length === 0"
                    class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                >
                    <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                        <AppIcon name="receipt" class="size-5 text-muted-foreground/40" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-semibold">No dispensing claim links found</p>
                        <p class="max-w-xs text-xs text-muted-foreground">Claim links appear when dispensed stock is connected to payer, invoice, NHIF, or reimbursement workflows.</p>
                    </div>
                    <Button size="sm" class="mt-1 h-8 gap-1.5 rounded-lg text-xs" @click="ws.createClaimLinkDialogOpen = true">
                        <AppIcon name="plus" class="size-3.5" />
                        Link Dispensing
                    </Button>
                </div>
                <div v-else-if="ws.claimLinks.length > 0" class="divide-y">
                    <WorkflowQueueRow
                        v-for="link in ws.claimLinks"
                        :key="link.id"
                        :stripe-class="ws.claimStatusBadgeClass(link.claim_status).includes('red') ? 'bg-destructive' : ws.claimStatusBadgeClass(link.claim_status).includes('green') ? 'bg-green-500' : ws.claimStatusBadgeClass(link.claim_status).includes('blue') ? 'bg-blue-500' : 'bg-muted-foreground/30'"
                    >
                        <div class="min-w-0 space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="font-mono text-sm font-semibold">{{ link.nhif_code || link.id }}</p>
                                <Badge :class="ws.claimStatusBadgeClass(link.claim_status)">{{ ws.formatEnumLabel(link.claim_status) }}</Badge>
                            </div>
                            <p class="text-xs text-muted-foreground">
                                {{ link.payer_name || link.payer_type || 'No payer recorded' }}
                                <span>&middot;</span>
                                Qty {{ ws.formatAmount(link.quantity_dispensed) }} {{ link.unit || '' }}
                                <span>&middot;</span>
                                Item {{ link.item_id?.substring(0, 8) || 'N/A' }}
                                <span>&middot;</span>
                                Patient {{ link.patient_id?.substring(0, 8) || 'N/A' }}
                                <span>&middot;</span>
                                {{ link.created_at?.substring(0, 10) || 'N/A' }}
                            </p>
                        </div>
                        <template #actions>
                            <Badge variant="outline" class="h-7 rounded-lg px-2 text-[11px]">
                                {{ link.payer_type || 'payer' }}
                            </Badge>
                            <Button
                                v-if="link.item_id"
                                size="sm"
                                variant="outline"
                                class="h-7 rounded-lg px-2.5 text-xs"
                                @click="ws.openItemDetails({ id: link.item_id })"
                            >
                                View item
                            </Button>
                        </template>
                    </WorkflowQueueRow>
                </div>
                <footer v-if="ws.claimLinkPagination && ws.claimLinkPagination.lastPage > 1" class="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
                    <span>Page {{ ws.claimLinkPagination.currentPage }} of {{ ws.claimLinkPagination.lastPage }}{{ ws.claimLinkPagination.total != null ? ` (${ws.claimLinkPagination.total} total)` : '' }}</span>
                    <div class="flex gap-1">
                        <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="ws.claimLinkPagination.currentPage <= 1" @click="ws.claimLinkSearch.page = ws.claimLinkPagination!.currentPage - 1; ws.loadClaimLinks()">Prev</Button>
                        <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="ws.claimLinkPagination.currentPage >= ws.claimLinkPagination.lastPage" @click="ws.claimLinkSearch.page = ws.claimLinkPagination!.currentPage + 1; ws.loadClaimLinks()">Next</Button>
                    </div>
                </footer>
            </div>
    </div>
</template>


