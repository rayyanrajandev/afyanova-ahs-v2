<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatEnumLabel } from '@/lib/labels';
import { departmentRequisitionStripeClass } from '@/lib/listRows';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
    <Card v-if="ws.canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

        <!-- Header -->
        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
            <div class="min-w-0">
                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                    <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                    Department Requisitions
                </h3>
                <p class="mt-1 text-xs text-muted-foreground">Internal requests from hospital departments for inventory items.</p>
            </div>
            <Button v-if="ws.canCreateRequest" size="sm" class="h-9 shrink-0 gap-1.5" @click="ws.openCreateRequisitionDialog">
                <AppIcon name="plus" class="size-3.5" />
                New Requisition
            </Button>
        </div>

        <!-- Toolbar -->
        <div class="flex items-center gap-2 border-b px-4 py-3">
            <SearchInput
                id="req-search-q"
                v-model="ws.deptReqSearch.q"
                placeholder="Req # or department…"
                class="min-w-0 flex-1"
                @keyup.enter="ws.deptReqSearch.page = 1; ws.loadDeptRequisitions()"
            />
            <Select :model-value="ws.toSelectValue(ws.deptReqSearch.status)" @update:model-value="ws.deptReqSearch.status = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                <SelectTrigger class="h-9 w-36 text-xs">
                    <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem :value="ws.EMPTY_SELECT_VALUE">All statuses</SelectItem>
                    <SelectItem v-for="s in ws.REQUISITION_STATUSES" :key="s" :value="s">{{ formatEnumLabel(s) }}</SelectItem>
                </SelectContent>
            </Select>
            <Select
                v-if="ws.canSelectAnyRequisitionDepartment"
                :model-value="ws.toSelectValue(ws.deptReqSearch.departmentId)"
                @update:model-value="ws.setDeptReqDepartmentFilter(String($event ?? ws.EMPTY_SELECT_VALUE))"
            >
                <SelectTrigger class="h-9 w-44 text-xs" :disabled="!ws.canSelectAnyRequisitionDepartment">
                    <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem v-if="ws.canSelectAnyRequisitionDepartment" :value="ws.EMPTY_SELECT_VALUE">All departments</SelectItem>
                    <SelectItem v-for="department in ws.requisitionDepartmentOptions" :key="department.id" :value="department.id" :text-value="ws.lookupOptionText(department)">
                        {{ ws.lookupOptionText(department) }}
                    </SelectItem>
                </SelectContent>
            </Select>
            <Button size="sm" variant="outline" class="h-9 gap-1.5 text-xs" @click="ws.deptReqSearch.page = 1; ws.loadDeptRequisitions()">
                <AppIcon name="search" class="size-3.5" />
                Search
            </Button>
            <Button v-if="ws.hasAnyDeptReqFilters" size="sm" variant="ghost" class="h-9 gap-1.5 text-xs text-muted-foreground" @click="ws.resetDeptReqFilters">
                <AppIcon name="x" class="size-3.5" />
                Reset
            </Button>
        </div>

        <!-- Active filter chips -->
        <div v-if="ws.deptReqFilterChips.length" class="flex flex-wrap gap-1.5 border-b px-4 py-2">
            <Badge v-for="chip in ws.deptReqFilterChips" :key="chip" variant="secondary" class="rounded-md text-xs">
                {{ chip }}
            </Badge>
        </div>

        <CardContent class="flex-1 overflow-auto p-0">

            <WorkflowQueueSkeleton v-if="ws.deptReqLoading" :count="5" />

            <!-- Empty state -->
            <div v-else-if="ws.deptRequisitions.length === 0" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                    <AppIcon name="clipboard-list" class="size-5 text-muted-foreground/40" />
                </div>
                <div class="space-y-1">
                    <p class="text-sm font-semibold">No department requisitions found</p>
                    <p class="max-w-xs text-xs text-muted-foreground">
                        {{ ws.hasAnyDeptReqFilters ? 'No requisitions match the current filters.' : 'Department requisitions start the live demand workflow before store issue or procurement.' }}
                    </p>
                </div>
                <div class="flex gap-2">
                    <Button v-if="ws.hasAnyDeptReqFilters" variant="outline" size="sm" class="gap-1.5" @click="ws.resetDeptReqFilters">
                        <AppIcon name="x" class="size-3.5" />
                        Clear filters
                    </Button>
                    <Button v-if="ws.canCreateRequest" size="sm" class="gap-1.5" @click="ws.openCreateRequisitionDialog">
                        <AppIcon name="plus" class="size-3.5" />
                        New requisition
                    </Button>
                </div>
            </div>

            <!-- Requisition rows -->
            <div v-else class="divide-y">
                <WorkflowQueueRow
                    v-for="req in ws.deptRequisitions"
                    :key="req.id"
                    :stripe-class="departmentRequisitionStripeClass(req.status)"
                    stripe-edge="rounded-r-full"
                    inner-class="pl-2"
                    interactive
                    hover-class="hover:bg-muted/20"
                    @activate="ws.openRequisitionDetails(req)"
                >
                    <div class="space-y-1.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-mono text-xs font-bold tracking-tight">{{ req.requisitionNumber }}</span>
                            <Badge
                                v-if="req.priority === 'urgent'"
                                variant="destructive"
                                class="h-4 px-1.5 text-[10px] uppercase tracking-wide"
                            >Urgent</Badge>
                            <Badge
                                v-else-if="req.priority === 'high'"
                                class="h-4 bg-orange-100 px-1.5 text-[10px] uppercase tracking-wide text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                            >High</Badge>
                            <span
                                class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
                                :class="ws.reqStatusBadgeClass(req.status)"
                            >{{ formatEnumLabel(req.status) }}</span>
                            <span class="text-xs text-muted-foreground">{{ req.requestingDepartment }}</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span class="flex items-center gap-1">
                                <AppIcon name="warehouse" class="size-3 opacity-60" />
                                {{ ws.warehouseLabel(req.issuingWarehouseId) ?? req.issuingStore ?? '—' }}
                            </span>
                            <span class="flex items-center gap-1">
                                <AppIcon name="layers" class="size-3 opacity-60" />
                                {{ req.lines?.length ?? 0 }} line{{ (req.lines?.length ?? 0) === 1 ? '' : 's' }}
                            </span>
                            <span v-if="req.neededBy" class="flex items-center gap-1" :class="new Date(req.neededBy) < new Date() && !['issued','cancelled','rejected'].includes(req.status) ? 'font-medium text-red-600 dark:text-red-400' : ''">
                                <AppIcon name="calendar" class="size-3 opacity-60" />
                                Needed {{ ws.formatDateOnly(req.neededBy) }}
                                <span v-if="new Date(req.neededBy) < new Date() && !['issued','cancelled','rejected'].includes(req.status)" class="font-semibold">· Overdue</span>
                            </span>
                            <span class="flex items-center gap-1 opacity-70">
                                <AppIcon name="clock" class="size-3 opacity-60" />
                                {{ ws.formatDateTime(req.createdAt) }}
                            </span>
                        </div>
                    </div>
                    <template #actions>
                        <Button size="sm" variant="ghost" class="h-7 px-2.5 text-xs" @click="ws.openRequisitionDetails(req)">
                            {{ ws.requisitionPrimaryActionLabel(req) }}
                        </Button>
                        <Button v-if="req.status === 'draft'" size="sm" variant="outline" class="h-7 text-xs" @click="ws.updateRequisitionStatus(req.id, 'submitted')">Submit</Button>
                        <Button v-if="req.status === 'submitted' && ws.canManageItems" size="sm" variant="outline" class="h-7 text-xs" @click="ws.updateRequisitionStatus(req.id, 'approved')">Approve</Button>
                        <Button v-if="req.status === 'submitted' && ws.canManageItems" size="sm" variant="destructive" class="h-7 text-xs" @click="ws.updateRequisitionStatus(req.id, 'rejected', { rejectionReason: 'Rejected by store manager' })">Reject</Button>
                        <Button v-if="req.status === 'approved' && ws.canManageItems" size="sm" variant="outline" class="h-7 gap-1.5 text-xs" @click="ws.updateRequisitionStatus(req.id, 'issued')">
                            <AppIcon name="check" class="size-3" />
                            Issue
                        </Button>
                    </template>
                </WorkflowQueueRow>
            </div>

            <!-- Pagination -->
            <footer v-if="ws.deptReqPagination && ws.deptReqPagination.lastPage > 1" class="flex items-center justify-between border-t px-4 py-3">
                <p class="text-xs text-muted-foreground">
                    Page {{ ws.deptReqPagination.currentPage }} of {{ ws.deptReqPagination.lastPage }}{{ ws.deptReqPagination.total != null ? ` · ${ws.deptReqPagination.total} total` : '' }}
                </p>
                <div class="flex items-center gap-1">
                    <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" :disabled="ws.deptReqPagination.currentPage <= 1" @click="ws.deptReqSearch.page = ws.deptReqPagination!.currentPage - 1; ws.loadDeptRequisitions()">
                        <AppIcon name="chevron-left" class="size-3.5" />
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" :disabled="ws.deptReqPagination.currentPage >= ws.deptReqPagination.lastPage" @click="ws.deptReqSearch.page = ws.deptReqPagination!.currentPage + 1; ws.loadDeptRequisitions()">
                        Next
                        <AppIcon name="chevron-right" class="size-3.5" />
                    </Button>
                </div>
            </footer>
        </CardContent>
    </Card>
</template>
