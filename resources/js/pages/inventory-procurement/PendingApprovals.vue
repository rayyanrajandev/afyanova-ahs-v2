<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { usePage } from '@inertiajs/vue3';
import { onMounted, ref } from 'vue';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ApprovalDecisionSheet from '@/components/inventory/ApprovalDecisionSheet.vue';
import SodWarningBanner from '@/components/inventory/SodWarningBanner.vue';
import TimeoutCountdown from '@/components/inventory/TimeoutCountdown.vue';
import FacilityWorkspacePageHeader from '@/components/layout/FacilityWorkspacePageHeader.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/AppLayout.vue';
import { fetchPendingApprovals, type ApprovalInstance } from '@/lib/approvalApiClient';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError } from '@/lib/notify';

const user = computed(() => (usePage().props.auth as any)?.user);

const breadcrumbs = [
    { title: 'Home', href: '/' },
    { title: 'Inventory', href: '/inventory-procurement' },
    { title: 'Pending Approvals' },
];

const approvals = ref<ApprovalInstance[]>([]);
const loading = ref(true);
const search = ref('');
const selectedApproval = ref<ApprovalInstance | null>(null);
const sheetOpen = ref(false);

const filteredApprovals = computed(() => {
    if (!search.value.trim()) return approvals.value;
    const q = search.value.toLowerCase();
    return approvals.value.filter(a =>
        a.requisition_number.toLowerCase().includes(q) ||
        a.requesting_department.toLowerCase().includes(q)
    );
});

async function loadApprovals(): Promise<void> {
    loading.value = true;
    try {
        approvals.value = await fetchPendingApprovals();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load pending approvals.'));
    } finally {
        loading.value = false;
    }
}

function openDecisionSheet(approval: ApprovalInstance): void {
    selectedApproval.value = approval;
    sheetOpen.value = true;
}

function closeDecisionSheet(): void {
    selectedApproval.value = null;
    sheetOpen.value = false;
}

onMounted(() => {
    loadApprovals();
});

function statusBadgeClass(status: string): string {
    switch (status) {
        case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
        case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
        case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
        case 'recalled': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-200';
    }
}
</script>

<template>
    <Head title="Pending Approvals" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <FacilityWorkspacePageHeader
                title="Pending Approvals"
                description="Review and act on requisitions awaiting your approval."
            >
                <template #actions>
                    <Button variant="outline" size="sm" class="gap-1.5" @click="loadApprovals">
                        <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        Refresh
                    </Button>
                </template>
            </FacilityWorkspacePageHeader>

            <Card class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">
                <div class="flex items-center gap-2 border-b px-4 py-3">
                    <SearchInput
                        v-model="search"
                        placeholder="Search by requisition or department…"
                        class="min-w-0 flex-1"
                    />
                    <div class="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        {{ filteredApprovals.length }} pending
                    </div>
                </div>

                <CardContent class="flex-1 overflow-auto p-0">
                    <WorkflowQueueSkeleton v-if="loading" :count="5" />

                    <div v-else-if="filteredApprovals.length === 0" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                        <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                            <svg class="size-5 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                        <div class="space-y-1">
                            <p class="text-sm font-semibold">No pending approvals</p>
                            <p class="max-w-xs text-xs text-muted-foreground">All requisitions have been reviewed. Check back later for new approvals.</p>
                        </div>
                    </div>

                    <div v-else class="divide-y">
                        <div
                            v-for="approval in filteredApprovals"
                            :key="approval.id"
                            class="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/20 cursor-pointer"
                            @click="openDecisionSheet(approval)"
                        >
                            <div class="min-w-0 flex-1 space-y-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-mono text-xs font-bold tracking-tight">{{ approval.requisition_number }}</span>
                                    <span class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold" :class="statusBadgeClass(approval.workflow_status)">{{ formatEnumLabel(approval.workflow_status) }}</span>
                                </div>
                                <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                    <span class="flex items-center gap-1">
                                        <AppIcon name="layers" class="size-3 opacity-60" />
                                        Step {{ approval.current_step }} of {{ approval.total_steps }}
                                    </span>
                                    <span class="flex items-center gap-1">
                                        <AppIcon name="clock" class="size-3 opacity-60" />
                                        {{ approval.requesting_department }}
                                    </span>
                                    <TimeoutCountdown :timeout-at="null" />
                                </div>
                            </div>
                            <div class="flex shrink-0 gap-1">
                                <Button size="sm" variant="outline" class="h-7 text-xs" @click.stop="openDecisionSheet(approval)">Review</Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <ApprovalDecisionSheet
            :approval="selectedApproval"
            :open="sheetOpen"
            @close="closeDecisionSheet"
            @decision-made="loadApprovals"
        />
    </AppLayout>
</template>
