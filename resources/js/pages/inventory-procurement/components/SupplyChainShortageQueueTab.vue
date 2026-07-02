<script setup lang="ts">
import { Transition } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import { shortageReadinessStripeClass } from '@/lib/listRows';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
    <div v-if="ws.canRead" class="flex min-h-0 flex-1 flex-col">

        <!-- Replenishment flash banner -->
        <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="-translate-y-2 opacity-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-to-class="-translate-y-2 opacity-0"
        >
            <div
                v-if="ws.shortageQueueReplenishmentBanner && ws.shortageQueueReplenishmentBanner.pendingLineCount > 0"
                class="flex items-center gap-3 rounded-lg border border-green-300/60 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 shadow-sm dark:border-green-800/50 dark:from-green-950/40 dark:to-emerald-950/40"
            >
                <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/60">
                    <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                </span>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-green-900 dark:text-green-100">Stock received</p>
                    <p class="text-xs text-green-700 dark:text-green-300">
                        {{ ws.shortageQueueReplenishmentBanner.pendingLineCount }}
                        shortage line{{ ws.shortageQueueReplenishmentBanner.pendingLineCount === 1 ? '' : 's' }} may now be fulfillable — check the queue below.
                    </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                    <Button
                        size="sm"
                        class="h-7 gap-1.5 bg-green-600 text-xs text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                        @click="ws.shortageQueueReplenishmentBanner = null; ws.shortageQueueFilters.readiness = 'ready'; ws.shortageQueueFilters.page = 1; ws.loadShortageQueue()"
                    >
                        <AppIcon name="arrow-right" class="size-3" />
                        Show ready
                    </Button>
                    <button
                        class="rounded-md p-1 text-green-600 opacity-60 transition-opacity hover:opacity-100 dark:text-green-400"
                        @click="ws.shortageQueueReplenishmentBanner = null"
                    >
                        <AppIcon name="x" class="size-3.5" />
                    </button>
                </div>
            </div>
        </Transition>

        <WorkflowQueueSkeleton v-if="ws.shortageQueueLoading" :count="4" />

        <!-- Error state -->
        <div v-else-if="ws.shortageQueueError" class="px-6 py-8">
            <div class="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
                <div class="flex items-start gap-3">
                    <AppIcon name="alert-circle" class="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div>
                        <p class="text-sm font-semibold text-destructive">Failed to load shortage queue</p>
                        <p class="mt-0.5 text-xs text-destructive/80">{{ ws.shortageQueueError }}</p>
                        <Button
                            size="sm"
                            variant="outline"
                            class="mt-3 h-7 gap-1.5 text-xs"
                            @click="ws.shortageQueueFilters.page = 1; ws.loadShortageQueue()"
                        >
                            <AppIcon name="refresh-cw" class="size-3" />
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="ws.shortageQueueItems.length === 0" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                <AppIcon
                    :name="ws.shortageQueueFilters.readiness === 'ready' ? 'check-circle' : ws.shortageQueueFilters.readiness === 'waiting' ? 'clock' : 'package'"
                    class="size-5 text-muted-foreground/40"
                />
            </div>
            <div class="space-y-1">
                <p class="text-sm font-semibold text-foreground">
                    <template v-if="ws.shortageQueueFilters.readiness === 'ready'">No items are ready to issue</template>
                    <template v-else-if="ws.shortageQueueFilters.readiness === 'waiting'">Nothing waiting for stock</template>
                    <template v-else>Shortage queue is clear</template>
                </p>
                <p class="max-w-xs text-xs text-muted-foreground">
                    <template v-if="ws.shortageQueueFilters.readiness === 'ready'">
                        Stock for pending lines hasn't arrived yet. Switch to <button class="font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400" @click="ws.shortageQueueFilters.readiness = 'waiting'; ws.loadShortageQueue()">Waiting</button> to see what's outstanding.
                    </template>
                    <template v-else-if="ws.shortageQueueFilters.readiness === 'waiting'">
                        All pending lines have sufficient stock available.
                    </template>
                    <template v-else>
                        All partially issued requisitions have been fulfilled, or none exist yet.
                    </template>
                </p>
            </div>
        </div>

        <!-- Requisition cards -->
        <div v-else class="divide-y">
            <WorkflowQueueRow
                v-for="req in ws.shortageQueueItems"
                :key="req.id"
                :stripe-class="shortageReadinessStripeClass(req.readyLineCount ?? 0, req.waitingLineCount ?? 0)"
                stripe-edge="rounded-r-full"
                inner-class="pl-2"
                interactive
                hover-class="hover:bg-muted/20"
                @activate="ws.openRequisitionDetails(req)"
            >
                <div class="space-y-2">
                        <!-- Row 1: number + priority + department -->
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-mono text-xs font-bold tracking-tight">{{ req.requisitionNumber ?? '—' }}</span>
                            <Badge
                                v-if="req.priority === 'urgent'"
                                variant="destructive"
                                class="h-4 px-1.5 text-[10px] uppercase tracking-wide"
                            >Urgent</Badge>
                            <Badge
                                v-else-if="req.priority === 'high'"
                                class="h-4 bg-orange-100 px-1.5 text-[10px] uppercase tracking-wide text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                            >High</Badge>
                            <span class="text-xs text-muted-foreground">{{ req.requestingDepartment ?? '—' }}</span>
                            <span
                                v-if="req.neededBy"
                                class="flex items-center gap-1 text-[11px]"
                                :class="new Date(req.neededBy) < new Date() ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'"
                            >
                                <AppIcon name="calendar" class="size-3" />
                                {{ String(req.neededBy).split('T')[0] }}
                                <span v-if="new Date(req.neededBy) < new Date()" class="font-semibold">· Overdue</span>
                            </span>
                        </div>

                        <!-- Row 2: pending lines and shortage actions -->
                        <div class="grid gap-1">
                            <div
                                v-for="line in req.pendingLines"
                                :key="line.id"
                                class="min-w-0 rounded-lg border bg-background/70 px-2.5 py-1.5 text-[11px] transition-colors group-hover:border-border/80"
                                :class="line.canIssueNow ? 'border-green-200/70 dark:border-green-900/50' : 'border-amber-200/70 dark:border-amber-900/50'"
                            >
                                <div class="flex min-w-0 items-center justify-between gap-2">
                                    <div class="flex min-w-0 items-center gap-2">
                                        <div class="flex min-w-0 items-center gap-1.5">
                                            <span
                                                class="size-1.5 shrink-0 rounded-full"
                                                :class="line.canIssueNow ? 'bg-green-500' : 'bg-amber-500'"
                                            ></span>
                                            <span class="min-w-0 truncate font-medium text-foreground">{{ line.itemName ?? line.itemCode ?? line.itemId }}</span>
                                        </div>
                                        <span
                                            class="shrink-0 rounded-md px-1.5 py-0.5 font-medium"
                                            :class="line.canIssueNow
                                                ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'"
                                        >
                                            {{ ws.formatAmount(line.pendingQuantity) }} {{ line.unit ?? '' }}
                                        </span>
                                    </div>
                                    <div class="flex shrink-0 items-center gap-1.5">
                                        <Badge
                                            v-if="ws.shortageLineProcurementRequest(line)"
                                            variant="outline"
                                            class="max-w-40 rounded-lg px-1.5 py-0.5 text-[10px] font-normal"
                                        >
                                            <span class="truncate">
                                                {{ ws.shortageLineProcurementRequest(line).requestNumber ?? 'PRQ' }}
                                                · {{ formatEnumLabel(ws.shortageLineProcurementRequest(line).status ?? 'n/a') }}
                                            </span>
                                        </Badge>
                                        <Button
                                            v-if="!line.canIssueNow && ws.canCreateProcurementFromRequisitionLine(line, req)"
                                            size="sm"
                                            variant="ghost"
                                            class="h-6 rounded-lg px-2 text-[11px] text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50"
                                            @click.stop="ws.openProcurementFromQueueShortage(req, line)"
                                        >
                                            Procure
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Row 3: readiness progress bar -->
                        <div v-if="(req.readyLineCount ?? 0) + (req.waitingLineCount ?? 0) > 0" class="flex items-center gap-2">
                            <div class="h-1.5 w-24 overflow-hidden rounded-full bg-muted/60">
                                <div
                                    class="h-full rounded-full bg-green-500 transition-all"
                                    :style="`width: ${Math.round((req.readyLineCount / ((req.readyLineCount ?? 0) + (req.waitingLineCount ?? 0))) * 100)}%`"
                                ></div>
                            </div>
                            <span class="text-[11px] text-muted-foreground">
                                {{ req.readyLineCount ?? 0 }} of {{ (req.readyLineCount ?? 0) + (req.waitingLineCount ?? 0) }} lines ready
                            </span>
                        </div>
                </div>
                <template #trailing>
                    <div class="flex flex-col items-end gap-2 pt-0.5">
                        <div
                            class="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            :class="req.readyLineCount > 0 && req.waitingLineCount === 0
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                : req.readyLineCount > 0
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                    : 'bg-muted text-muted-foreground'"
                        >
                            <span
                                class="size-1.5 rounded-full"
                                :class="req.readyLineCount > 0 && req.waitingLineCount === 0
                                    ? 'bg-green-500'
                                    : req.readyLineCount > 0
                                        ? 'bg-amber-500'
                                        : 'bg-muted-foreground/50'"
                            ></span>
                            <template v-if="req.readyLineCount > 0 && req.waitingLineCount === 0">All ready</template>
                            <template v-else-if="req.readyLineCount > 0">Partial</template>
                            <template v-else>Waiting</template>
                        </div>
                        <Button
                            size="sm"
                            :variant="req.readyLineCount > 0 ? 'default' : 'outline'"
                            class="h-7 gap-1.5 text-xs"
                            @click="ws.openRequisitionDetails(req)"
                        >
                            <AppIcon v-if="req.readyLineCount > 0" name="arrow-right" class="size-3" />
                            {{ req.readyLineCount > 0 ? 'Issue now' : 'View' }}
                        </Button>
                    </div>
                </template>
            </WorkflowQueueRow>
        </div>

        <!-- Pagination -->
        <footer v-if="ws.shortageQueueMeta && ws.shortageQueueMeta.lastPage > 1" class="flex items-center justify-between border-t px-4 py-3">
            <p class="text-xs text-muted-foreground">
                Page {{ ws.shortageQueueMeta.currentPage }} of {{ ws.shortageQueueMeta.lastPage }}
            </p>
            <div class="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5 text-xs"
                    :disabled="ws.shortageQueueMeta.currentPage <= 1"
                    @click="ws.shortageQueueFilters.page = ws.shortageQueueMeta!.currentPage - 1; ws.loadShortageQueue()"
                >
                    <AppIcon name="chevron-left" class="size-3.5" />
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5 text-xs"
                    :disabled="ws.shortageQueueMeta.currentPage >= ws.shortageQueueMeta.lastPage"
                    @click="ws.shortageQueueFilters.page = ws.shortageQueueMeta!.currentPage + 1; ws.loadShortageQueue()"
                >
                    Next
                    <AppIcon name="chevron-right" class="size-3.5" />
                </Button>
            </div>
        </footer>
    </div>
</template>


