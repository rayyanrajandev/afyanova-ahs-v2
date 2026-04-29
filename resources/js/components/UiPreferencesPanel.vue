<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { useUiPreferences } from '@/composables/useUiPreferences';
import type { IconPack, UiScalePreset, UiThemePreset } from '@/types';

const {
    iconPack,
    themePreset,
    uiScale,
    updateIconPack,
    updateThemePreset,
    updateUiScale,
} = useUiPreferences();

const scaleOptions: {
    value: UiScalePreset;
    shortLabel: string;
    label: string;
    percent: string;
    badge?: string;
    stackClass: string;
}[] = [
    { value: 'ultra-compact', shortLabel: 'XXS', label: 'Ultra compact', percent: '75%', stackClass: 'gap-0.5' },
    { value: 'extra-compact', shortLabel: 'XS', label: 'Extra compact', percent: '80%', stackClass: 'gap-1' },
    { value: 'compact', shortLabel: 'S', label: 'Compact', percent: '90%', stackClass: 'gap-1.5' },
    { value: 'comfortable', shortLabel: 'M', label: 'Comfortable', percent: '100%', badge: 'Default', stackClass: 'gap-2' },
    { value: 'spacious', shortLabel: 'L', label: 'Spacious', percent: '112%', stackClass: 'gap-2.5' },
];

const themeOptions: { value: UiThemePreset; label: string; description: string; swatch: string; swatchDark: string }[] = [
    { value: 'yaru', label: 'Hospital Blue', description: 'Neutral and familiar for most teams.', swatch: 'bg-[hsl(213,90%,48%)]', swatchDark: 'dark:bg-[hsl(213,92%,58%)]' },
    { value: 'clinic', label: 'Clinical Teal', description: 'Fresh but still restrained for day-to-day use.', swatch: 'bg-[hsl(180,58%,44%)]', swatchDark: 'dark:bg-[hsl(174,62%,52%)]' },
    { value: 'emerald', label: 'Emerald', description: 'Calmer high-contrast accent for focused workflows.', swatch: 'bg-[hsl(155,66%,38%)]', swatchDark: 'dark:bg-[hsl(155,70%,50%)]' },
];

const iconPackOptions: { value: IconPack; label: string; description: string; previewIcon: string }[] = [
    { value: 'lucide', label: 'Lucide', description: 'Cleaner lines and lower visual noise.', previewIcon: 'layout-grid' },
    { value: 'huge', label: 'HugeIcons', description: 'Bolder shapes with more visual presence.', previewIcon: 'layout-grid' },
];
</script>

<template>
    <div class="space-y-5">
        <!-- Workspace Density -->
        <section class="space-y-2.5">
            <div>
                <p class="text-sm font-semibold text-foreground">Workspace density</p>
                <p class="text-xs text-muted-foreground">Choose how much fits on screen.</p>
            </div>

            <div class="flex flex-wrap gap-1.5">
                <button
                    v-for="option in scaleOptions"
                    :key="option.value"
                    :class="[
                        'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-all duration-150',
                        uiScale === option.value
                            ? 'border-primary bg-primary/8 text-primary shadow-sm'
                            : 'border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground',
                    ]"
                    @click="updateUiScale(option.value)"
                >
                    <span class="text-[10px] font-bold tabular-nums opacity-60">{{ option.shortLabel }}</span>
                    {{ option.label }}
                    <span
                        v-if="option.badge"
                        class="rounded-full bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground"
                    >
                        &#x2713;
                    </span>
                </button>
            </div>
        </section>

        <!-- Accent Theme -->
        <section class="space-y-2.5 border-t border-border/40 pt-4">
            <div>
                <p class="text-sm font-semibold text-foreground">Accent theme</p>
                <p class="text-xs text-muted-foreground">Primary color for actions and focus states.</p>
            </div>

            <div class="flex flex-wrap gap-2">
                <button
                    v-for="option in themeOptions"
                    :key="option.value"
                    :class="[
                        'group flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-all duration-150',
                        themePreset === option.value
                            ? 'border-primary bg-primary/8 text-foreground shadow-sm'
                            : 'border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground',
                    ]"
                    @click="updateThemePreset(option.value)"
                >
                    <span
                        :class="[
                            'size-4 shrink-0 rounded-full shadow-inner transition-transform duration-150',
                            option.swatch,
                            option.swatchDark,
                            themePreset === option.value ? 'ring-2 ring-primary/30 ring-offset-1 ring-offset-card' : 'group-hover:scale-110',
                        ]"
                    />
                    {{ option.label }}
                </button>
            </div>
        </section>

        <!-- Icon Style -->
        <section class="space-y-2.5 border-t border-border/40 pt-4">
            <div>
                <p class="text-sm font-semibold text-foreground">Icon style</p>
                <p class="text-xs text-muted-foreground">Lighter lines or bolder shapes.</p>
            </div>

            <div class="inline-flex items-center gap-1 rounded-lg bg-muted/40 p-1">
                <button
                    v-for="option in iconPackOptions"
                    :key="option.value"
                    :class="[
                        'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-all duration-150',
                        iconPack === option.value
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                    ]"
                    @click="updateIconPack(option.value)"
                >
                    <AppIcon :name="option.previewIcon" class="size-4" />
                    {{ option.label }}
                </button>
            </div>
        </section>
    </div>
</template>
