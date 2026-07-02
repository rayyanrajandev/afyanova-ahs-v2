<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatEnumLabel } from '@/lib/labels';
import { procurementRequestStripeClass } from '@/lib/listRows';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
    <div v-if="ws.canRead" class="flex min-h-0 flex-1 flex-col">

                        <!-- Active filter chips -->
                        <div v-if="ws.hasAnyProcurementFilters" class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
                            <span class="text-[11px] text-muted-foreground">Filters:</span>
                            <button
                                v-for="chip in ws.procurementFilterChips"
                                :key="chip"
                                class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                                @click="ws.resetProcurementFilters()"
                            >
                                {{ chip }} <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="ws.resetProcurementFilters()">Clear all</button>
                        </div>

                        <WorkflowQueueSkeleton v-if="ws.loading" :count="6" />

                        <!-- Empty state -->
                        <div
                            v-else-if="ws.procurementRequests.length === 0"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="clipboard-list" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div>
                                <p class="text-sm font-medium text-muted-foreground">
                                    {{ ws.hasAnyProcurementFilters ? 'No requests match the current filters' : 'No procurement requests yet' }}
                                </p>
                                <p class="mt-0.5 text-xs text-muted-foreground/70">
                                    {{ ws.hasAnyProcurementFilters ? 'Try adjusting or clearing your filters.' : 'Create requests after stock demand or low-stock need is identified.' }}
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <Button v-if="ws.hasAnyProcurementFilters" variant="outline" size="sm" class="h-8 rounded-lg text-xs" @click="ws.resetProcurementFilters()">
                                    Clear filters
                                </Button>
                                <Button v-if="ws.canCreateRequest" size="sm" class="h-8 gap-1.5 rounded-lg text-xs" :disabled="!ws.canLaunchProcurementRequest" @click="ws.openCreateProcurementDialog">
                                    <AppIcon name="plus" class="size-3.5" />
                                    Create request
                                </Button>
                            </div>
                        </div>

                        <!-- Request rows -->
                        <div v-else class="divide-y">
                            <WorkflowQueueRow
                                v-for="request in ws.procurementRequests"
                                :key="request.id"
                                :stripe-class="procurementRequestStripeClass(request.status)"
                                :flash="ws.flashedRequestId === request.id"
                            >
                                <div class="min-w-0 space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="text-sm font-semibold">{{ request.requestNumber }}</p>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="request.status === 'draft' ? 'bg-muted text-muted-foreground ring-border' : request.status === 'pending_approval' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30' : request.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/30' : request.status === 'ordered' ? 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/30' : request.status === 'received' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30' : request.status === 'rejected' ? 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/30' : 'bg-muted text-muted-foreground ring-border'"
                                        >
                                            {{ formatEnumLabel(request.status) }}
                                        </span>
                                        <span v-if="request.sourceDepartmentRequisitionId" class="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-900/30 dark:text-sky-400 dark:ring-sky-500/30">
                                            Dept shortage
                                        </span>
                                    </div>
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span>{{ request.itemName || request.itemId }}</span>
                                        <span>&middot;</span>
                                        <span>Qty: <strong class="text-foreground">{{ request.requestedQuantity }}</strong></span>
                                        <span v-if="request.supplierName || ws.supplierLabel(request.supplierId)">&middot; {{ request.supplierName || ws.supplierLabel(request.supplierId) }}</span>
                                        <span v-if="request.neededBy">&middot; Needed {{ request.neededBy }}</span>
                                        <span v-if="request.unitCostEstimate">&middot; Unit {{ ws.formatAmount(request.unitCostEstimate) }}</span>
                                        <span v-if="request.totalCostEstimate">&middot; Total est {{ ws.formatAmount(request.totalCostEstimate) }}</span>
                                        <span v-if="request.sourceDepartmentRequisitionId" class="text-muted-foreground/70">&middot; {{ ws.procurementSourceLabel(request) }}</span>
                                    </div>
                                </div>
                                <template #actions>
                                    <Button size="sm" variant="outline" class="h-7 rounded-lg px-2.5 text-xs" @click="ws.openDetails(request)">
                                        Details
                                    </Button>
                                    <Button
                                        v-if="request.sourceDepartmentRequisitionId && request.status !== 'received'"
                                        size="sm"
                                        variant="outline"
                                        class="h-7 rounded-lg px-2.5 text-xs"
                                        :disabled="ws.sourceRequisitionOpeningId === String(request.id)"
                                        @click="ws.openSourceRequisitionFromProcurement(request)"
                                    >
                                        {{ ws.sourceRequisitionOpeningId === String(request.id) ? 'Opening...' : 'Source Req.' }}
                                    </Button>
                                    <template v-if="ws.canUpdateRequestStatus">
                                        <Button
                                            v-if="ws.procurementPrimaryAction(request)"
                                            size="sm"
                                            class="h-7 rounded-lg px-2.5 text-xs"
                                            :disabled="ws.sourceRequisitionOpeningId === String(request.id)"
                                            @click="ws.procurementPrimaryAction(request)!.handler()"
                                        >
                                            {{ ws.procurementPrimaryAction(request)!.label }}
                                        </Button>
                                        <DropdownMenu v-if="ws.procurementOverflowActions(request).length">
                                            <DropdownMenuTrigger as-child>
                                                <Button size="sm" variant="outline" class="h-7 rounded-lg px-2 text-xs">
                                                    <AppIcon name="ellipsis-vertical" class="size-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    v-for="act in ws.procurementOverflowActions(request)"
                                                    :key="act.label"
                                                    @click="act.handler()"
                                                >
                                                    {{ act.label }}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </template>
                                </template>
                            </WorkflowQueueRow>
                        </div>

                        <!-- Footer pagination -->
                        <footer class="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5">
                            <p class="text-xs text-muted-foreground">
                                {{ ws.procurementRequests.length }} of {{ ws.procurementPagination?.total ?? ws.procurementRequests.length }} &middot; Page {{ ws.procurementPagination?.currentPage ?? 1 }}/{{ ws.procurementPagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs"
                                    :disabled="!ws.procurementPagination || ws.procurementPagination.currentPage <= 1 || ws.loading"
                                    @click="ws.procurementSearch.page -= 1; ws.loadProcurementRequests()"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Prev
                                </Button>
                                <template v-for="pg in ws.procurementPages" :key="typeof pg === 'number' ? `pp-${pg}` : `pp-e-${Math.random()}`">
                                    <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                    <Button
                                        v-else size="sm"
                                        :variant="pg === (ws.procurementPagination?.currentPage ?? 1) ? 'default' : 'outline'"
                                        class="h-8 w-8 rounded-lg p-0 text-xs"
                                        :disabled="ws.loading"
                                        @click="ws.goToProcurementPage(pg as number)"
                                    >
                                        {{ pg }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs"
                                    :disabled="!ws.procurementPagination || ws.procurementPagination.currentPage >= ws.procurementPagination.lastPage || ws.loading"
                                    @click="ws.procurementSearch.page += 1; ws.loadProcurementRequests()"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
    </div>
</template>


