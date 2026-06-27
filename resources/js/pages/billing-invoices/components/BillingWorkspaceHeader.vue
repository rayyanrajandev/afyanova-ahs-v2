<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';

const props = defineProps({
    pageLoading: { type: Boolean, required: true },
    listLoading: { type: Boolean, required: true },
    pageDescription: { type: String, required: true },
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
                    <h1 class="text-base font-semibold tracking-tight md:text-lg">Billing invoices</h1>
                    <p class="text-xs text-muted-foreground">
                        {{ props.pageDescription }}
                    </p>
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
