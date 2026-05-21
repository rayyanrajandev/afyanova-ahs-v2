<script setup lang="ts">
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EncounterCloseReadiness } from '@/lib/encounterCloseReadiness';

const props = defineProps<{
    readiness: EncounterCloseReadiness | null;
    billingHref: string;
    canCreateBilling: boolean;
}>();

const billingSummary = computed(() => props.readiness?.billingSummary ?? null);
const pendingCount = computed(() => billingSummary.value?.pendingCandidates ?? 0);
const invoicedCount = computed(() => billingSummary.value?.alreadyInvoiced ?? 0);
</script>

<template>
    <div class="space-y-3 rounded-lg border bg-muted/10 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-1">
                <p class="text-sm font-medium">Billing and charge capture</p>
                <p class="text-xs text-muted-foreground">
                    Completed encounter services that still need invoice capture appear here.
                </p>
            </div>
            <Badge variant="outline" class="text-[11px]">
                {{ pendingCount }} pending
            </Badge>
        </div>

        <div class="grid gap-2 sm:grid-cols-3">
            <div class="rounded-md border bg-background px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Pending capture</p>
                <p class="text-lg font-semibold">{{ pendingCount }}</p>
            </div>
            <div class="rounded-md border bg-background px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Already invoiced</p>
                <p class="text-lg font-semibold">{{ invoicedCount }}</p>
            </div>
            <div class="rounded-md border bg-background px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Currency</p>
                <p class="text-lg font-semibold">{{ billingSummary?.currencyCode ?? '—' }}</p>
            </div>
        </div>

        <Alert v-if="pendingCount > 0">
            <AlertTitle>Unbilled services detected</AlertTitle>
            <AlertDescription>
                Capture charges before close-out, or acknowledge the billing warning when closing the encounter.
            </AlertDescription>
        </Alert>

        <div class="flex flex-wrap gap-2">
            <Button
                v-if="canCreateBilling"
                as-child
                size="sm"
                variant="outline"
            >
                <Link :href="billingHref" class="gap-1.5">
                    <AppIcon name="file-text" class="size-3.5" />
                    Open billing invoice
                </Link>
            </Button>
        </div>
    </div>
</template>
