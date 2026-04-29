<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ref, Transition } from 'vue';
import AppearanceTabs from '@/components/AppearanceTabs.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import UiPreferencesPanel from '@/components/UiPreferencesPanel.vue';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import { show as showTwoFactor } from '@/routes/two-factor';
import { edit as editPassword } from '@/routes/user-password';

type Props = {
    open: boolean;
};

defineProps<Props>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const activeSection = ref<'general' | 'account'>('general');

const accountLinks = [
    {
        href: editProfile,
        icon: 'users' as const,
        title: 'Profile',
        description: 'Update your name and account identity details.',
        badge: null as string | null,
    },
    {
        href: editPassword,
        icon: 'shield-check' as const,
        title: 'Password',
        description: 'Rotate your password and enforce secure access.',
        badge: null as string | null,
    },
    {
        href: showTwoFactor,
        icon: 'alert-triangle' as const,
        title: 'Two-Factor Auth',
        description: 'Enable MFA with authenticator app verification.',
        badge: 'Recommended',
    },
] as const;

const navItems = [
    { key: 'general' as const, icon: 'layout-grid' as const, label: 'General', description: 'Appearance, density & icons' },
    { key: 'account' as const, icon: 'users' as const, label: 'Account', description: 'Profile, password & security' },
];
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="workspace" size="2xl" class="max-h-[88vh]" showCloseButton>
            <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
                <!-- Header -->
                <div class="border-b border-border/60 px-4 py-3">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <DialogTitle class="text-sm font-semibold tracking-tight">Settings</DialogTitle>
                            <DialogDescription class="text-xs text-muted-foreground">
                                Preferences &amp; account
                            </DialogDescription>
                        </div>
                        <Link
                            v-if="activeSection === 'general'"
                            :href="editAppearance()"
                            class="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                            <AppIcon name="arrow-up-right" class="size-3" />
                            All settings
                        </Link>
                    </div>

                    <!-- Section tabs -->
                    <div class="mt-3 inline-flex items-center gap-1 rounded-lg bg-muted/40 p-1">
                        <button
                            v-for="item in navItems"
                            :key="item.key"
                            :class="[
                                'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-all duration-150',
                                activeSection === item.key
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            ]"
                            @click="activeSection = item.key"
                        >
                            <AppIcon
                                :name="item.icon"
                                class="size-4"
                            />
                            {{ item.label }}
                        </button>
                    </div>
                </div>

                <!-- Section sub-header removed for compactness -->

                <!-- Content area -->
                <ScrollArea class="flex-1">
                    <div class="px-4 py-4">
                        <!-- GENERAL SECTION -->
                        <div v-if="activeSection === 'general'" class="space-y-5">
                            <div class="space-y-2">
                                <div>
                                    <p class="text-sm font-semibold text-foreground">Appearance mode</p>
                                    <p class="text-xs text-muted-foreground">Switch between light, dark, or system.</p>
                                </div>
                                <AppearanceTabs />
                            </div>

                            <UiPreferencesPanel />
                        </div>

                        <!-- ACCOUNT SECTION -->
                        <div v-else-if="activeSection === 'account'" class="space-y-1.5">
                            <Link
                                v-for="link in accountLinks"
                                :key="link.title"
                                :href="link.href()"
                                class="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-all duration-150 hover:border-border/60 hover:bg-muted/40"
                            >
                                <div class="flex size-8 flex-shrink-0 items-center justify-center rounded-md bg-muted/50 transition-colors duration-150 group-hover:bg-primary/8">
                                    <AppIcon :name="link.icon" class="size-4 text-muted-foreground transition-colors duration-150 group-hover:text-primary" />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <p class="text-sm font-medium text-foreground">{{ link.title }}</p>
                                        <Badge v-if="link.badge" variant="secondary" class="text-[10px] leading-none">
                                            {{ link.badge }}
                                        </Badge>
                                    </div>
                                    <p class="text-xs text-muted-foreground">{{ link.description }}</p>
                                </div>
                                <AppIcon name="chevron-right" class="size-3.5 shrink-0 text-muted-foreground/30 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                            </Link>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </DialogContent>
    </Dialog>
</template>
