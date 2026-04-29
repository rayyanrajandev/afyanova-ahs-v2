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
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
            <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <AppIcon name="receipt" class="size-7 text-primary" />
                Billing Invoices
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
                {{ props.pageDescription }}
            </p>
        </div>
        <div class="flex flex-shrink-0 items-center gap-2">
            <Badge variant="outline">
                {{ props.scopeStatusLabel }}
            </Badge>
            <Button
                variant="outline"
                size="sm"
                class="h-8 gap-1.5"
                as-child
            >
                <Link href="/billing-payment-plans">
                    <AppIcon name="calendar-range" class="size-3.5" />
                    Payment Plans
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
                    Corporate Billing
                </Link>
            </Button>
            <Button
                variant="outline"
                size="sm"
                :disabled="props.listLoading"
                class="gap-1.5"
                @click="$emit('refresh')"
            >
                <AppIcon name="activity" class="size-3.5" />
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
                Billing Board
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
                Billing Queue
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
                Create Invoice
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
                Billing Queue
            </Button>
        </div>
    </div>
</template>
