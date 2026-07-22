<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import {
    formatMoney,
    tariffLifecycleLabel,
    tariffWindowLabel,
    type CatalogItem,
} from '@/lib/billingServiceCatalog';

defineProps<{
    item: CatalogItem;
    canManage: boolean;
}>();

const emit = defineEmits<{
    openNewVersion: [];
}>();

function boolLabel(value: boolean | null): string {
    if (value === null) return 'Not set';
    return value ? 'Yes' : 'No';
}
</script>

<template>
    <div class="space-y-4">
        <div class="rounded-lg border p-3">
            <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="text-sm font-medium">Current price</p>
                    <p class="text-xs text-muted-foreground">
                        Read-only — price, tax, and lifecycle changes always go through a new version so the change stays
                        auditable. Use "Create new version" for any update, including corrections.
                    </p>
                </div>
                <Button v-if="canManage" size="sm" class="gap-1.5" @click="emit('openNewVersion')">
                    <AppIcon name="plus" class="size-3.5" />
                    Create new version
                </Button>
            </div>

            <div class="rounded-lg border bg-primary/5 px-4 py-3.5">
                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Base price</p>
                <p class="mt-0.5 text-2xl font-bold tracking-tight text-primary">{{ formatMoney(item.basePrice, item.currencyCode) }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{{ tariffWindowLabel(item.effectiveFrom, item.effectiveTo) }}</span>
                    <span>·</span>
                    <span>{{ tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo) }}</span>
                </div>
            </div>

            <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Tax rate</p>
                    <p class="mt-1 text-sm font-semibold">{{ item.taxRatePercent ? `${item.taxRatePercent}%` : 'Not set' }}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Taxable</p>
                    <p class="mt-1 text-sm font-semibold">{{ boolLabel(item.isTaxable) }}</p>
                </div>
            </div>

            <div v-if="item.description" class="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Description</p>
                <p class="mt-1 text-sm">{{ item.description }}</p>
            </div>
        </div>
    </div>
</template>
