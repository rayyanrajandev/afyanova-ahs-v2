<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 0 (foundation) of reports/patients-index-modernization-plan.md.
 * Deliberately minimal — no list, no composables yet. This shell exists to
 * establish, and be reviewed independently of, the two structural fixes the
 * audit (reports/patients-index-audit.md §2-3) found in the legacy page
 * before any feature logic is built on top of them:
 *
 * - Permission checks are computed() over usePlatformAccess(), not one-time
 *   ref() snapshots — this page has none of the legacy page's ~20 frozen
 *   permission refs to migrate, so getting the pattern right here first
 *   means every later phase inherits it correctly from the start.
 * - No redundant GET /auth/me/permissions call: usePlatformAccess() derives
 *   everything from shared Inertia page props already present, same as
 *   ShowV2.vue/IndexV2.vue (medical records).
 *
 * <Head> title, in-page access gate, and the sticky-header-inside-a-
 * bounded-scroll-container pattern all match ShowV2.vue/WorkspaceV2.vue —
 * checked directly, not assumed, per this session's own correction to
 * patient-flow/Board.vue and reception/Queue.vue.
 *
 * Route is unlinked (reports/patients-index-modernization-plan.md §3.3):
 * not in appNavCatalog.ts, and /patients keeps rendering the legacy page
 * until Phase 6 explicitly cuts over. Reachable only by visiting
 * /patients/v2 directly.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canReadPatients = computed(() => hasAccess('patients.read'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Patients', href: '/patients/v2' },
]);

// Same bounded-scroll-container pattern as ShowV2.vue/WorkspaceV2.vue/
// patient-flow/Board.vue/reception/Queue.vue.
const scrollContainerRef = useTemplateRef<HTMLDivElement>('scrollContainer');
const scrollContainerHeight = ref('98dvh');

function updateScrollContainerHeight(): void {
    const el = scrollContainerRef.value;
    if (!el) return;
    scrollContainerHeight.value = `calc(98dvh - ${el.getBoundingClientRect().top}px)`;
}

onMounted(() => {
    updateScrollContainerHeight();
    window.addEventListener('resize', updateScrollContainerHeight);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', updateScrollContainerHeight);
});
</script>

<template>
    <Head title="Patients" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <h1 class="text-lg font-bold tracking-tight md:text-xl">Patients</h1>
                <p class="text-xs text-muted-foreground">Rebuild in progress — see reports/patients-index-modernization-plan.md.</p>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canReadPatients" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing patients requires <code>patients.read</code>.</AlertDescription>
                </Alert>

                <Alert v-else>
                    <AlertTitle>Foundation phase only</AlertTitle>
                    <AlertDescription>
                        The patient list, registration, visit handoff, and details sheet ship in later phases of this
                        rebuild. Use <code>/patients</code> for the working page in the meantime.
                    </AlertDescription>
                </Alert>
            </div>
        </div>
    </AppLayout>
</template>
