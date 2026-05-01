import { ref, watch } from 'vue';
import { DASHBOARD_PRESETS, type DashboardPresetKey } from '@/config/dashboardPresets';

const STORAGE_KEY = 'dashboard.workflow-preset';

const VALID_PRESET_KEYS = new Set<DashboardPresetKey>(DASHBOARD_PRESETS.map((preset) => preset.key));

function isDashboardPresetKey(value: string): value is DashboardPresetKey {
    return VALID_PRESET_KEYS.has(value as DashboardPresetKey);
}

function readStored(): DashboardPresetKey | 'auto' {
    if (typeof localStorage === 'undefined') return 'auto';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null || stored === 'auto') return 'auto';
    if (isDashboardPresetKey(stored)) return stored;
    return 'auto';
}

/** Persisted dashboard workflow mode: Auto follows RBAC-derived default; otherwise a preset the user explicitly chose (when permitted). */
export function useDashboardWorkflowPresetStorage() {
    const preset = ref<DashboardPresetKey | 'auto'>(readStored());

    watch(
        preset,
        (value) => {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(STORAGE_KEY, value);
        },
        { flush: 'post' },
    );

    return preset;
}
