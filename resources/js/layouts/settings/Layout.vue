<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrentUrl } from '@/composables/useCurrentUrl';
import type { AppIconName } from '@/lib/icons';
import { toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import { show } from '@/routes/two-factor';
import { edit as editPassword } from '@/routes/user-password';
import { type NavItem } from '@/types';

type SidebarNavItem = NavItem & {
    iconName: AppIconName;
    hint: string;
};

const sidebarNavItems: SidebarNavItem[] = [
    {
        title: 'Profile',
        href: editProfile(),
        iconName: 'users',
        hint: 'Identity',
    },
    {
        title: 'Password',
        href: editPassword(),
        iconName: 'shield-check',
        hint: 'Security',
    },
    {
        title: 'Two-Factor Auth',
        href: show(),
        iconName: 'alert-triangle',
        hint: 'Access',
    },
    {
        title: 'Appearance',
        href: editAppearance(),
        iconName: 'layout-grid',
        hint: 'Display',
    },
];

const { isCurrentUrl } = useCurrentUrl();
</script>

<template>
    <div class="px-4 py-6">
        <div class="mb-6 rounded-lg border bg-card p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="space-y-1">
                    <h2 class="text-lg font-semibold">Hospital System Settings</h2>
                    <p class="text-sm text-muted-foreground">
                        Manage operator profile, access security, and UI preferences.
                    </p>
                </div>
                <Badge variant="secondary">Account Center</Badge>
            </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside class="rounded-lg border bg-card p-3">
                <nav class="space-y-1" aria-label="Settings Sections">
                    <Button
                        v-for="item in sidebarNavItems"
                        :key="toUrl(item.href)"
                        variant="ghost"
                        :class="[
                            'h-auto w-full justify-start px-3 py-2.5',
                            isCurrentUrl(item.href)
                                ? 'bg-primary/10 text-primary hover:bg-primary/15'
                                : 'text-foreground hover:bg-muted',
                        ]"
                        as-child
                    >
                        <Link :href="item.href" class="flex w-full items-center justify-between gap-2">
                            <span class="flex items-center gap-2">
                                <AppIcon :name="item.iconName" class="size-4" />
                                <span class="text-sm font-medium">{{ item.title }}</span>
                            </span>
                            <span class="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {{ item.hint }}
                            </span>
                        </Link>
                    </Button>
                </nav>
            </aside>

            <section class="rounded-lg border bg-card p-5">
                <div class="space-y-8">
                    <slot />
                </div>
            </section>
        </div>
    </div>
</template>
