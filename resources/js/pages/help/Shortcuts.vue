<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';
import {
    appNavCatalog,
    generalHelpTips,
    helpDocLinks,
    helpKeyboardShortcuts,
    helpTipsBySection,
    navSectionIcons,
    navSectionLabels,
    navSectionOrder,
    type NavSectionKey,
} from '@/config/appNavCatalog';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    filterSidebarNavCatalogItems,
    hasAnyPermissionMatchingPrefixes,
} from '@/lib/routeAccess';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Help & Shortcuts', href: '/help/shortcuts' },
];

const {
    permissionNames,
    sessionRoleCodes,
    hasUniversalAdminAccess,
    facilityEntitlementNames,
    isPlatformSuperAdmin,
    isFacilitySuperAdmin,
    scope,
} = usePlatformAccess();

const resolvedPermissionNames = computed(() => permissionNames.value ?? []);

const visibleNavItems = computed(() =>
    filterSidebarNavCatalogItems(
        appNavCatalog,
        resolvedPermissionNames.value,
        hasUniversalAdminAccess.value,
        facilityEntitlementNames.value,
    ),
);

const visibleSectionKeys = computed(() => {
    const keys = new Set<NavSectionKey>();
    for (const item of visibleNavItems.value) {
        keys.add(item.section);
    }
    return keys;
});

const visiblePageGroups = computed(() =>
    navSectionOrder
        .filter((key) => visibleSectionKeys.value.has(key))
        .map((key) => ({
            key,
            label: navSectionLabels[key],
            icon: navSectionIcons[key],
            pages: visibleNavItems.value
                .filter((item) => item.section === key)
                .map((item) => ({
                    title: item.title,
                    href: item.href,
                    note: item.helpNote ?? '',
                })),
        }))
        .filter((group) => group.pages.length > 0),
);

type TipGroup = { label: string; tips: string[] };

const visibleTipGroups = computed<TipGroup[]>(() => {
    const groups: TipGroup[] = [
        {
            label: 'General',
            tips: generalHelpTips,
        },
    ];

    for (const key of navSectionOrder) {
        if (!visibleSectionKeys.value.has(key)) {
            continue;
        }

        groups.push({
            label: navSectionLabels[key],
            tips: helpTipsBySection[key],
        });
    }

    return groups;
});

const visibleKeyboardShortcuts = computed(() =>
    helpKeyboardShortcuts.filter((item) =>
        hasAnyPermissionMatchingPrefixes(
            resolvedPermissionNames.value,
            item.permissionPrefixes,
            hasUniversalAdminAccess.value,
        ),
    ),
);

const visibleDocLinks = computed(() =>
    helpDocLinks.filter((link) =>
        hasAnyPermissionMatchingPrefixes(
            resolvedPermissionNames.value,
            link.permissionPrefixes,
            hasUniversalAdminAccess.value,
        ),
    ),
);

const roleTier = computed<'platform_super_admin' | 'facility_admin' | 'standard'>(() => {
    if (isPlatformSuperAdmin.value) return 'platform_super_admin';
    if (isFacilitySuperAdmin.value) return 'facility_admin';
    return 'standard';
});

const roleTierLabel = computed(() => {
    if (roleTier.value === 'platform_super_admin') return 'Platform Super Admin';
    if (roleTier.value === 'facility_admin') return 'Facility Admin';
    return 'Standard User';
});

const roleTierBadgeClass = computed(() => {
    if (roleTier.value === 'platform_super_admin')
        return 'border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/50';
    if (roleTier.value === 'facility_admin')
        return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    return '';
});
</script>

<template>
    <Head title="Help & Shortcuts" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20"
                        >
                            <AppIcon name="book-open" class="size-5 text-primary" />
                        </div>
                        <div class="min-w-0">
                            <h1 class="text-base font-semibold leading-tight tracking-tight text-foreground">
                                Help & Shortcuts
                            </h1>
                            <p class="mt-0.5 truncate text-xs text-muted-foreground">
                                <span v-if="scope?.facility?.name">{{ scope.facility.name }}</span>
                                <span
                                    v-if="scope?.facility?.name && scope?.tenant?.name"
                                    class="mx-1 opacity-40"
                                    >·</span
                                >
                                <span v-if="scope?.tenant?.name">{{ scope.tenant.name }}</span>
                                <span v-if="!scope?.facility?.name && !scope?.tenant?.name">
                                    Keyboard shortcuts, workflow tips, and screen navigation
                                </span>
                            </p>
                        </div>
                    </div>

                    <div class="flex shrink-0 flex-wrap items-center gap-2">
                        <Badge variant="outline" class="rounded-lg text-xs" :class="roleTierBadgeClass">
                            {{ roleTierLabel }}
                        </Badge>
                        <Badge
                            v-for="code in sessionRoleCodes.slice(0, 3)"
                            :key="code"
                            variant="outline"
                            class="rounded-lg font-mono text-[10px] text-muted-foreground"
                        >
                            {{ code }}
                        </Badge>
                        <Badge
                            v-if="sessionRoleCodes.length > 3"
                            variant="outline"
                            class="rounded-lg text-[10px] text-muted-foreground"
                        >
                            +{{ sessionRoleCodes.length - 3 }} more
                        </Badge>
                    </div>
                </div>
            </section>

            <Card class="rounded-lg border-sidebar-border/70 border-dashed bg-muted/20">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Service plan & navigation</CardTitle>
                    <CardDescription>
                        Quick links and tips below use the same permission and subscription rules as the
                        sidebar. Modules hidden by your facility plan will not appear here even when your
                        role grants access. Ask a facility administrator to review the subscription plan if
                        something expected is missing.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Card
                v-if="visibleDocLinks.length > 0"
                class="rounded-lg border-sidebar-border/70"
            >
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Documentation & contracts</CardTitle>
                    <CardDescription>
                        Workflow contracts for modules you can access (open in new tab).
                    </CardDescription>
                </CardHeader>
                <CardContent class="flex flex-wrap gap-2 pt-0">
                    <Button
                        v-for="doc in visibleDocLinks"
                        :key="doc.href"
                        size="sm"
                        variant="outline"
                        as-child
                    >
                        <Link :href="doc.href" target="_blank">{{ doc.label }}</Link>
                    </Button>
                </CardContent>
            </Card>

            <div
                v-if="visibleKeyboardShortcuts.length > 0 || visibleTipGroups.length > 0"
                class="grid gap-4 xl:grid-cols-[1.05fr_1fr]"
            >
                <Card
                    v-if="visibleKeyboardShortcuts.length > 0"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader class="pb-2">
                        <CardTitle class="text-base">Keyboard & command palette</CardTitle>
                        <CardDescription>
                            Fast navigation and queue setup when you have OPD or queue module access.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3 pt-0">
                        <div
                            v-for="item in visibleKeyboardShortcuts"
                            :key="item.action"
                            class="rounded-lg border p-3"
                        >
                            <div
                                class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <p class="text-sm font-medium">{{ item.action }}</p>
                                <div class="flex flex-wrap items-center gap-1">
                                    <template
                                        v-for="(key, index) in item.keys"
                                        :key="`${item.action}-${key}-${index}`"
                                    >
                                        <Kbd>{{ key }}</Kbd>
                                        <span
                                            v-if="index < item.keys.length - 1 && item.keys.length > 1"
                                            class="text-xs text-muted-foreground"
                                        >
                                            +
                                        </span>
                                    </template>
                                </div>
                            </div>
                            <p v-if="item.notes" class="mt-2 text-xs text-muted-foreground">
                                {{ item.notes }}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70">
                    <CardHeader class="pb-2">
                        <CardTitle class="text-base">Workflow tips</CardTitle>
                        <CardDescription>
                            Matched to modules you can open — same rules as the sidebar.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-5 pt-0">
                        <div v-for="group in visibleTipGroups" :key="group.label">
                            <p
                                class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                            >
                                {{ group.label }}
                            </p>
                            <div class="space-y-2">
                                <div
                                    v-for="tip in group.tips"
                                    :key="tip"
                                    class="rounded-lg border bg-muted/30 p-3 text-sm"
                                >
                                    {{ tip }}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card class="rounded-lg border-sidebar-border/70">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Quick links</CardTitle>
                    <CardDescription>
                        Same modules and groups as the sidebar, filtered by your permissions and service
                        plan.
                    </CardDescription>
                </CardHeader>

                <CardContent v-if="visiblePageGroups.length" class="space-y-7 pt-0">
                    <div v-for="group in visiblePageGroups" :key="group.key">
                        <div class="mb-3 flex items-center gap-2">
                            <div
                                class="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted"
                            >
                                <AppIcon :name="group.icon" class="size-3.5 text-muted-foreground" />
                            </div>
                            <p
                                class="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                            >
                                {{ group.label }}
                            </p>
                            <div class="h-px flex-1 bg-border" />
                        </div>

                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <div
                                v-for="page in group.pages"
                                :key="page.href"
                                class="rounded-lg border p-3 transition-colors hover:bg-muted/30"
                            >
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-medium">{{ page.title }}</p>
                                        <p v-if="page.note" class="mt-1 text-xs text-muted-foreground">
                                            {{ page.note }}
                                        </p>
                                    </div>
                                    <Button size="sm" variant="outline" as-child class="shrink-0">
                                        <Link :href="page.href">Open</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>

                <CardContent v-else class="pt-0">
                    <div class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                        <div
                            class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25"
                        >
                            <AppIcon name="circle-x" class="size-5 text-muted-foreground/40" />
                        </div>
                        <div>
                            <p class="text-sm font-medium text-muted-foreground">
                                No quick links available
                            </p>
                            <p class="mt-0.5 text-xs text-muted-foreground/70">
                                No workflow screens are accessible with your current permissions and service
                                plan.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </AppLayout>
</template>
