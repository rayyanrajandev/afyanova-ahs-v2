<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { useUiPreferences } from '@/composables/useUiPreferences';
import type {
    IconPack,
    UiFontFamily,
    UiRadiusPreset,
    UiScalePreset,
    UiThemeBase,
    UiThemePreset,
} from '@/types';

const {
    iconPack,
    themePreset,
    themeBase,
    fontFamily,
    uiScale,
    borderRadius,
    updateIconPack,
    updateThemePreset,
    updateThemeBase,
    updateFontFamily,
    updateUiScale,
    updateBorderRadius,
} = useUiPreferences();

const colorSchemeOptions: {
    value: UiThemePreset;
    label: string;
    color: string;
    accent: string;
}[] = [
    { value: 'yaru', label: 'Hospital blue', color: 'hsl(213 90% 48%)', accent: 'hsl(180 58% 44%)' },
    { value: 'clinic', label: 'Clinical teal', color: 'hsl(180 58% 44%)', accent: 'hsl(188 62% 42%)' },
    { value: 'emerald', label: 'Emerald', color: 'hsl(155 66% 38%)', accent: 'hsl(162 60% 40%)' },
    { value: 'violet', label: 'Violet', color: 'hsl(258 74% 56%)', accent: 'hsl(226 70% 58%)' },
    { value: 'amber', label: 'Amber', color: 'hsl(34 92% 48%)', accent: 'hsl(20 86% 52%)' },
];

const fontOptions: {
    value: UiFontFamily;
    label: string;
    sample: string;
    tone: string;
    previewStyle: string;
}[] = [
    {
        value: 'clinical',
        label: 'Clinical',
        sample: 'Aa',
        tone: 'Default',
        previewStyle: "'Aptos', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    {
        value: 'humanist',
        label: 'Humanist',
        sample: 'Aa',
        tone: 'Legible',
        previewStyle: "'Atkinson Hyperlegible', Verdana, Tahoma, 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
    },
    {
        value: 'compact',
        label: 'Compact',
        sample: 'Aa',
        tone: 'Dense',
        previewStyle: "Inter, Roboto, Arial, 'Helvetica Neue', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
];

const baseOptions: {
    value: UiThemeBase;
    label: string;
    preview: string[];
}[] = [
    { value: 'slate', label: 'Slate', preview: ['hsl(210 25% 97%)', 'hsl(214 18% 84%)', 'hsl(222 22% 14%)'] },
    { value: 'gray', label: 'Gray', preview: ['hsl(210 16% 97%)', 'hsl(214 12% 84%)', 'hsl(224 12% 16%)'] },
    { value: 'zinc', label: 'Zinc', preview: ['hsl(240 14% 97%)', 'hsl(240 8% 84%)', 'hsl(240 12% 14%)'] },
    { value: 'neutral', label: 'Neutral', preview: ['hsl(0 0% 97%)', 'hsl(0 0% 84%)', 'hsl(0 0% 14%)'] },
    { value: 'stone', label: 'Stone', preview: ['hsl(42 18% 96%)', 'hsl(34 12% 82%)', 'hsl(28 12% 15%)'] },
];

const radiusOptions: {
    value: UiRadiusPreset;
    label: string;
    radius: string;
}[] = [
    { value: '0', label: '0', radius: '0rem' },
    { value: '0.5', label: '0.5', radius: '0.25rem' },
    { value: '1', label: '1', radius: '0.5rem' },
    { value: '1.5', label: '1.5', radius: '0.75rem' },
    { value: '2', label: '2', radius: '1rem' },
];

const scaleOptions: {
    value: UiScalePreset;
    label: string;
    shortLabel: string;
    stackClass: string;
}[] = [
    { value: 'ultra-compact', label: 'Ultra compact', shortLabel: '75%', stackClass: 'gap-0.5' },
    { value: 'extra-compact', label: 'Extra compact', shortLabel: '80%', stackClass: 'gap-1' },
    { value: 'compact', label: 'Compact', shortLabel: '90%', stackClass: 'gap-1.5' },
    { value: 'comfortable', label: 'Comfortable', shortLabel: '100%', stackClass: 'gap-2' },
    { value: 'spacious', label: 'Spacious', shortLabel: '112%', stackClass: 'gap-2.5' },
];

const iconPackOptions: { value: IconPack; label: string; previewIcon: string }[] = [
    { value: 'lucide', label: 'Lucide', previewIcon: 'layout-grid' },
    { value: 'huge', label: 'HugeIcons', previewIcon: 'layout-grid' },
];
</script>

<template>
    <div class="space-y-6">
        <section class="space-y-3">
            <div>
                <p class="text-sm font-semibold text-foreground">Color scheme</p>
                <p class="text-xs text-muted-foreground">Primary color used for actions, focus, and active states.</p>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                    v-for="option in colorSchemeOptions"
                    :key="option.value"
                    :class="[
                        'group flex min-h-12 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-all',
                        themePreset === option.value
                            ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                            : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
                    ]"
                    @click="updateThemePreset(option.value)"
                >
                    <span class="flex size-5 shrink-0 overflow-hidden rounded-full border shadow-inner">
                        <span class="flex-1" :style="{ background: option.color }" />
                        <span class="flex-1" :style="{ background: option.accent }" />
                    </span>
                    <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
                    <AppIcon
                        v-if="themePreset === option.value"
                        name="check-circle"
                        class="size-3.5 shrink-0 text-primary"
                    />
                </button>
            </div>
        </section>

        <section class="space-y-3 border-t border-border/40 pt-5">
            <div>
                <p class="text-sm font-semibold text-foreground">Font family</p>
                <p class="text-xs text-muted-foreground">Choose the reading style for forms, tables, and dashboards.</p>
            </div>

            <div class="grid grid-cols-3 gap-2">
                <button
                    v-for="option in fontOptions"
                    :key="option.value"
                    :class="[
                        'flex min-h-20 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-center text-sm font-medium transition-all',
                        fontFamily === option.value
                            ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                            : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
                    ]"
                    @click="updateFontFamily(option.value)"
                >
                    <span
                        class="text-2xl leading-none"
                        :style="{ fontFamily: option.previewStyle }"
                    >
                        {{ option.sample }}
                    </span>
                    <span class="max-w-full truncate text-xs">{{ option.label }}</span>
                    <span class="max-w-full truncate text-[0.6875rem] leading-none text-muted-foreground">
                        {{ option.tone }}
                    </span>
                </button>
            </div>
        </section>

        <section class="space-y-3 border-t border-border/40 pt-5">
            <div>
                <p class="text-sm font-semibold text-foreground">Theme base</p>
                <p class="text-xs text-muted-foreground">Neutral shade used for surfaces, borders, and sidebars.</p>
            </div>

            <div class="grid grid-cols-5 gap-2">
                <button
                    v-for="option in baseOptions"
                    :key="option.value"
                    :class="[
                        'flex min-h-16 flex-col items-center gap-2 rounded-md border px-2 py-2 text-xs font-medium transition-all',
                        themeBase === option.value
                            ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                            : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
                    ]"
                    @click="updateThemeBase(option.value)"
                >
                    <span class="flex h-7 w-full overflow-hidden rounded-sm border border-border/70">
                        <span
                            v-for="color in option.preview"
                            :key="color"
                            class="flex-1"
                            :style="{ background: color }"
                        />
                    </span>
                    <span class="truncate">{{ option.label }}</span>
                </button>
            </div>
        </section>

        <section class="space-y-3 border-t border-border/40 pt-5">
            <div>
                <p class="text-sm font-semibold text-foreground">Corner radius</p>
                <p class="text-xs text-muted-foreground">Controls how sharp or soft buttons, sheets, and cards feel.</p>
            </div>

            <div class="grid grid-cols-5 gap-2">
                <button
                    v-for="option in radiusOptions"
                    :key="option.value"
                    :class="[
                        'flex min-h-16 flex-col items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs font-semibold transition-all',
                        borderRadius === option.value
                            ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                            : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
                    ]"
                    @click="updateBorderRadius(option.value)"
                >
                    <span
                        class="size-8 border-2 border-current bg-background"
                        :style="{ borderRadius: option.radius }"
                    />
                    {{ option.label }}
                </button>
            </div>
        </section>

        <section class="space-y-3 border-t border-border/40 pt-5">
            <div>
                <p class="text-sm font-semibold text-foreground">Workspace density</p>
                <p class="text-xs text-muted-foreground">Adjust how much clinical information fits on screen.</p>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <button
                    v-for="option in scaleOptions"
                    :key="option.value"
                    :class="[
                        'flex min-h-20 flex-col gap-2 rounded-md border px-2 py-2 text-left text-xs font-medium transition-all',
                        uiScale === option.value
                            ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                            : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
                    ]"
                    @click="updateUiScale(option.value)"
                >
                    <span
                        :class="[
                            'flex h-9 flex-col justify-center rounded-sm border border-current/20 bg-background px-1.5 text-current',
                            option.stackClass,
                        ]"
                    >
                        <span class="h-1 rounded-full bg-current/55" />
                        <span class="h-1 rounded-full bg-current/35" />
                        <span class="h-1 rounded-full bg-current/20" />
                    </span>
                    <span class="leading-tight">
                        <span class="block">{{ option.shortLabel }}</span>
                        <span class="block truncate text-muted-foreground">{{ option.label }}</span>
                    </span>
                </button>
            </div>
        </section>

        <section class="space-y-3 border-t border-border/40 pt-5">
            <div>
                <p class="text-sm font-semibold text-foreground">Icon style</p>
                <p class="text-xs text-muted-foreground">Switch between lighter line icons and bolder clinical icons.</p>
            </div>

            <div class="flex w-full items-center gap-1 rounded-md bg-muted/40 p-1">
                <button
                    v-for="option in iconPackOptions"
                    :key="option.value"
                    :class="[
                        'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium transition-all',
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
