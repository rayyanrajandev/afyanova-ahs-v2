<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next';
import { useAppearance } from '@/composables/useAppearance';

const { appearance, updateAppearance } = useAppearance();

const tabs = [
    { value: 'light', Icon: Sun, label: 'Light', description: 'Bright workspace for daytime use.' },
    { value: 'dark', Icon: Moon, label: 'Dark', description: 'Lower-glare view for dim rooms.' },
    { value: 'system', Icon: Monitor, label: 'System', description: 'Follow the device setting automatically.' },
] as const;
</script>

<template>
    <div class="inline-flex items-center gap-1 rounded-lg bg-muted/40 p-1">
        <button
            v-for="{ value, Icon, label } in tabs"
            :key="value"
            @click="updateAppearance(value)"
            :class="[
                'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-all duration-150',
                appearance === value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
            ]"
        >
            <component :is="Icon" class="size-4" />
            {{ label }}
        </button>
    </div>
</template>
