<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const commandActions = [
    {
        icon: 'flask-conical',
        label: 'Lab order',
        description: 'Tests and specimens',
    },
    {
        icon: 'pill',
        label: 'Pharmacy',
        description: 'Meds and safety',
    },
    {
        icon: 'activity',
        label: 'Imaging',
        description: 'Studies and reports',
    },
    {
        icon: 'scissors',
        label: 'Theatre',
        description: 'Procedures',
    },
    {
        icon: 'receipt',
        label: 'Billing',
        description: 'Charges',
    },
];

const careStreams = [
    {
        icon: 'flask-conical',
        label: 'Laboratory',
        description: 'Specimens, results, add-ons',
    },
    {
        icon: 'pill',
        label: 'Pharmacy',
        description: 'Dispensing and medication safety',
    },
    {
        icon: 'activity',
        label: 'Imaging',
        description: 'Studies, reports, and follow-up',
    },
    {
        icon: 'scissors',
        label: 'Theatre',
        description: 'Procedures and readiness',
    },
];

defineProps<{
    compact?: boolean;
}>();
</script>

<template>
    <div
        :class="[
            'space-y-4',
            compact ? 'px-3 pb-4 pt-3' : 'px-4 pb-5 pt-4 md:px-6 md:pb-6',
        ]"
    >
        <section
            :class="[
                'rounded-lg border bg-card shadow-sm',
                compact ? 'space-y-3 p-3' : 'space-y-4 p-4',
            ]"
        >
            <div
                :class="[
                    'flex flex-col gap-3',
                    compact ? '' : 'lg:flex-row lg:items-start lg:justify-between',
                ]"
            >
                <div class="min-w-0 space-y-1">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Order command center
                    </p>
                    <h3
                        v-if="!compact"
                        class="text-sm font-semibold text-foreground"
                    >
                        Place, track, and act on orders in this visit
                    </h3>
                    <p
                        v-if="!compact"
                        class="text-xs leading-5 text-muted-foreground"
                    >
                        Order actions stay in the encounter context so note, results, and billing remain connected.
                    </p>
                </div>
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    <Skeleton class="h-6 w-20 rounded-full" />
                    <Skeleton class="h-6 w-28 rounded-full" />
                </div>
            </div>

            <div
                :class="[
                    'grid gap-2',
                    compact
                        ? 'grid-cols-2'
                        : 'sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]',
                ]"
            >
                <Button
                    v-for="action in commandActions"
                    :key="action.label"
                    variant="outline"
                    :class="[
                        'h-auto justify-start text-left',
                        compact ? 'min-h-11 gap-2 px-2 py-2' : 'min-h-14 gap-3 px-3 py-3',
                    ]"
                    disabled
                >
                    <span
                        :class="[
                            'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                            compact ? 'size-7' : 'size-8',
                        ]"
                    >
                        <AppIcon :name="action.icon" class="size-4" />
                    </span>
                    <span class="min-w-0">
                        <span class="block text-sm font-medium">{{ action.label }}</span>
                        <span
                            v-if="!compact"
                            class="block text-[11px] font-normal text-muted-foreground"
                        >
                            {{ action.description }}
                        </span>
                    </span>
                    <Skeleton
                        v-if="action.label !== 'Billing'"
                        class="ml-auto h-5 w-7 shrink-0 rounded-full"
                    />
                </Button>
            </div>

            <p
                v-if="!compact"
                class="text-[11px] leading-5 text-muted-foreground"
            >
                Lab, pharmacy, and imaging open inline. Duplicate checks and medication safety run before placement.
            </p>
        </section>

        <section class="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
            <div
                :class="[
                    'flex flex-col gap-2',
                    compact ? '' : 'md:flex-row md:items-start md:justify-between',
                ]"
            >
                <div class="space-y-1">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Active orders &amp; results
                    </p>
                    <p class="text-xs leading-5 text-muted-foreground">
                        Track linked order status, results, reorders, add-ons, and safe cancellation in one stream.
                    </p>
                </div>
                <Skeleton class="h-6 w-36 rounded-full" />
            </div>

            <div
                :class="[
                    'grid gap-2',
                    compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4',
                ]"
            >
                <div
                    v-for="stream in careStreams"
                    :key="`active-orders-skeleton-${stream.label}`"
                    :class="[
                        'rounded-lg border bg-background',
                        compact ? 'p-2.5' : 'p-3',
                    ]"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex min-w-0 items-center gap-2">
                            <span
                                :class="[
                                    'flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
                                    compact ? 'size-7' : 'size-8',
                                ]"
                            >
                                <AppIcon :name="stream.icon" class="size-4" />
                            </span>
                            <span class="truncate text-sm font-medium text-foreground">
                                {{ stream.label }}
                            </span>
                        </div>
                        <Badge
                            v-if="!compact"
                            variant="outline"
                            class="h-5 px-2 text-[10px]"
                        >
                            Loading
                        </Badge>
                    </div>
                    <div class="mt-4 space-y-2">
                        <Skeleton class="h-4 w-4/5 rounded" />
                        <Skeleton
                            v-if="!compact"
                            class="h-4 w-2/3 rounded"
                        />
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>
