<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
    <div class="mt-0 flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <AppIcon name="receipt" class="size-4 text-muted-foreground" />
                </span>
                <div class="min-w-0">
                    <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Claim Links</p>
                    <p class="text-xl font-bold leading-tight tabular-nums">{{ ws.claimLinkPagination?.total ?? ws.claimLinks.length }}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-blue-200/70 bg-blue-50/50 px-4 py-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                    <AppIcon name="activity" class="size-4 text-blue-600 dark:text-blue-400" />
                </span>
                <div class="min-w-0">
                    <p class="text-[11px] font-medium uppercase tracking-wider text-blue-700/70 dark:text-blue-400/70">Submitted</p>
                    <p class="text-xl font-bold leading-tight tabular-nums text-blue-700 dark:text-blue-300">{{ ws.claimLinks.filter((link) => link.claim_status === 'submitted').length }}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-green-200/70 bg-green-50/50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                    <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                </span>
                <div class="min-w-0">
                    <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Accepted</p>
                    <p class="text-xl font-bold leading-tight tabular-nums text-green-700 dark:text-green-300">{{ ws.claimLinks.filter((link) => ['accepted', 'approved', 'paid'].includes(link.claim_status)).length }}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 shadow-sm">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                    <AppIcon name="alert-triangle" class="size-4 text-destructive" />
                </span>
                <div class="min-w-0">
                    <p class="text-[11px] font-medium uppercase tracking-wider text-destructive/80">Rejected</p>
                    <p class="text-xl font-bold leading-tight tabular-nums text-destructive">{{ ws.claimLinks.filter((link) => ['rejected', 'failed'].includes(link.claim_status)).length }}</p>
                </div>
            </div>
        </div>

        <Card class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">
            <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                <div class="min-w-0">
                    <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                        <AppIcon name="receipt" class="size-4 text-muted-foreground" />
                        Dispensing Claim Links
                    </h3>
                    <p class="mt-1 text-xs text-muted-foreground">Connect dispensed stock to payer claims, NHIF references, invoice traceability, and reimbursement follow-up.</p>
                </div>
                <Button size="sm" class="h-9 shrink-0 gap-1.5 rounded-lg text-xs" @click="ws.createClaimLinkDialogOpen = true">
                    <AppIcon name="plus" class="size-3.5" />
                    Link Dispensing
                </Button>
            </div>

            <div class="flex items-center gap-2 border-b px-4 py-3">
                <SearchInput
                    v-model="ws.claimLinkSearch.q"
                    placeholder="Search NHIF code, payer..."
                    class="min-w-0 flex-1 text-xs"
                    @keyup.enter="ws.claimLinkSearch.page = 1; ws.loadClaimLinks()"
                />
                <Select :model-value="ws.toSelectValue(ws.claimLinkSearch.claimStatus)" @update:model-value="val => { ws.claimLinkSearch.claimStatus = ws.fromSelectValue(String(val ?? ws.EMPTY_SELECT_VALUE)); ws.claimLinkSearch.page = 1; ws.loadClaimLinks() }">
                    <SelectTrigger class="h-9 w-44 rounded-lg text-xs">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">All statuses</SelectItem>
                        <SelectItem v-for="s in ws.CLAIM_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground" @click="ws.claimLinkSearch.page = 1; ws.loadClaimLinks()">
                    <AppIcon name="refresh-cw" class="size-3.5" />
                    Refresh
                </Button>
            </div>

            <CardContent class="flex min-h-0 flex-1 flex-col p-0">
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
            </CardContent>
        </Card>
    </div>
</template>
