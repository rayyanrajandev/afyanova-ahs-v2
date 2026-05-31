<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const props = defineProps({
    pageLoading: { type: Boolean, required: true },
    listLoading: { type: Boolean, required: true },
    pageDescription: { type: String, required: true },
    scopeStatusLabel: { type: String, required: true },
    facilityName: { type: String, default: '' },
    tenantName: { type: String, default: '' },
    scopeUnresolved: { type: Boolean, default: false },
    billingWorkspaceView: { type: String, required: true },
    canReadBillingFinancialControls: { type: Boolean, required: true },
    canReadBillingInvoices: { type: Boolean, required: true },
    canReadBillingPayerContracts: { type: Boolean, required: true },
    canCreateBillingInvoices: { type: Boolean, required: true },
});

defineEmits<{
    (event: 'refresh'): void;
    (event: 'open-board'): void;
    (event: 'open-queue'): void;
    (event: 'open-create'): void;
}>();
</script>

<template>
    <section class="rounded-lg border border-border bg-card shadow-sm">
        <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
            <div class="flex min-w-0 items-center gap-3">
                <div
                    class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                    aria-hidden="true"
                >
                    <AppIcon name="receipt" class="size-5" />
                </div>
                <div class="min-w-0 space-y-0.5">
                    <div class="flex flex-wrap items-center gap-2">
                        <h1 class="text-base font-semibold tracking-tight md:text-lg">Billing invoices</h1>
                        <Badge
                            v-if="props.scopeUnresolved"
                            variant="destructive"
                            class="h-5 px-1.5 text-[10px] font-medium"
                        >
                            Scope unresolved
                        </Badge>
                        <Badge
                            v-else-if="!props.pageLoading"
                            variant="outline"
                            class="h-5 px-1.5 text-[10px] font-medium"
                        >
                            {{ props.scopeStatusLabel }}
                        </Badge>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        {{ props.pageDescription }}
                    </p>
                    <div
                        v-if="props.facilityName || props.tenantName"
                        class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground"
                    >
                        <span v-if="props.facilityName" class="inline-flex items-center gap-1">
                            <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                            <span class="font-medium text-foreground">{{ props.facilityName }}</span>
                        </span>
                        <span
                            v-if="props.facilityName && props.tenantName"
                            class="select-none text-border"
                            aria-hidden="true"
                        >
                            ·
                        </span>
                        <span v-if="props.tenantName">{{ props.tenantName }}</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5"
                    as-child
                >
                    <Link href="/billing-payment-plans">
                        <AppIcon name="calendar-range" class="size-3.5" />
                        Payment plans
                    </Link>
                </Button>
                <Button
                    v-if="props.canReadBillingPayerContracts"
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5"
                    as-child
                >
                    <Link href="/billing-corporate">
                        <AppIcon name="building-2" class="size-3.5" />
                        Corporate billing
                    </Link>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5"
                    :disabled="props.listLoading"
                    @click="$emit('refresh')"
                >
                    <AppIcon name="refresh-cw" class="size-3.5" />
                    {{ props.listLoading ? 'Refreshing...' : 'Refresh' }}
                </Button>
                <Button
                    v-if="
                        props.canReadBillingFinancialControls &&
                        props.billingWorkspaceView !== 'board'
                    "
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5"
                    @click="$emit('open-board')"
                >
                    <AppIcon name="layout-dashboard" class="size-3.5" />
                    Billing board
                </Button>
                <Button
                    v-else-if="
                        props.billingWorkspaceView === 'board' &&
                        props.canReadBillingInvoices
                    "
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5"
                    @click="$emit('open-queue')"
                >
                    <AppIcon name="list" class="size-3.5" />
                    Invoice queue
                </Button>
                <Button
                    v-if="
                        props.canCreateBillingInvoices &&
                        props.billingWorkspaceView !== 'create'
                    "
                    size="sm"
                    class="h-8 gap-1.5"
                    @click="$emit('open-create')"
                >
                    <AppIcon name="plus" class="size-3.5" />
                    Create invoice
                </Button>
                <Button
                    v-else-if="
                        props.billingWorkspaceView === 'create' &&
                        props.canReadBillingInvoices
                    "
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5"
                    @click="$emit('open-queue')"
                >
                    <AppIcon name="arrow-left" class="size-3.5" />
                    Back to queue
                </Button>
            </div>
        </div>
    </section>
</template>
