import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';
import type { IconPack, UiScalePreset, UiThemePreset } from '@/types';

const ICON_PACK_STORAGE_KEY = 'ui.icon-pack';
const THEME_PRESET_STORAGE_KEY = 'ui.theme-preset';
const UI_SCALE_STORAGE_KEY = 'ui.scale-preset';

const ICON_PACK_VALUES: IconPack[] = ['lucide', 'huge'];
const THEME_PRESET_VALUES: UiThemePreset[] = ['yaru', 'clinic', 'emerald'];
const UI_SCALE_VALUES: UiScalePreset[] = ['ultra-compact', 'extra-compact', 'compact', 'comfortable', 'spacious'];
const UI_SCALE_FONT_SIZE_MAP: Record<UiScalePreset, string> = {
    'ultra-compact': '12px',
    'extra-compact': '12.8px',
    compact: '14px',
    comfortable: '16px',
    spacious: '18px',
};

const iconPack = ref<IconPack>('lucide');
const themePreset = ref<UiThemePreset>('yaru');
const uiScale = ref<UiScalePreset>('comfortable');
let initialized = false;

const setCookie = (name: string, value: string, days = 365) => {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;

    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

function readStoredPreference<T extends string>(
    storageKey: string,
    allowedValues: readonly T[],
    fallback: T,
): T {
    if (typeof window === 'undefined') {
        return fallback;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
        return fallback;
    }

    const normalized = raw.trim() as T;
    return allowedValues.includes(normalized) ? normalized : fallback;
}

function applyIconPack(value: IconPack): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.iconPack = value;
    if (document.body) {
        document.body.dataset.iconPack = value;
    }
}

function applyThemePreset(value: UiThemePreset): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.themePreset = value;
    if (document.body) {
        document.body.dataset.themePreset = value;
    }
}

function applyUiScale(value: UiScalePreset): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.uiScale = value;
    document.documentElement.style.fontSize = UI_SCALE_FONT_SIZE_MAP[value];
    if (document.body) {
        document.body.dataset.uiScale = value;
    }
}

export function initializeUiPreferences(): void {
    if (initialized || typeof window === 'undefined') {
        return;
    }

    iconPack.value = readStoredPreference(
        ICON_PACK_STORAGE_KEY,
        ICON_PACK_VALUES,
        'lucide',
    );
    themePreset.value = readStoredPreference(
        THEME_PRESET_STORAGE_KEY,
        THEME_PRESET_VALUES,
        'yaru',
    );
    uiScale.value = readStoredPreference(
        UI_SCALE_STORAGE_KEY,
        UI_SCALE_VALUES,
        'comfortable',
    );

    applyIconPack(iconPack.value);
    applyThemePreset(themePreset.value);
    applyUiScale(uiScale.value);
    initialized = true;
}

export type UseUiPreferencesReturn = {
    iconPack: Ref<IconPack>;
    themePreset: Ref<UiThemePreset>;
    uiScale: Ref<UiScalePreset>;
    updateIconPack: (value: IconPack) => void;
    updateThemePreset: (value: UiThemePreset) => void;
    updateUiScale: (value: UiScalePreset) => void;
};

export function useUiPreferences(): UseUiPreferencesReturn {
    onMounted(() => {
        initializeUiPreferences();
    });

    function updateIconPack(value: IconPack): void {
        iconPack.value = value;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(ICON_PACK_STORAGE_KEY, value);
        }
        setCookie(ICON_PACK_STORAGE_KEY, value);
        applyIconPack(value);
    }

    function updateThemePreset(value: UiThemePreset): void {
        themePreset.value = value;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, value);
        }
        setCookie(THEME_PRESET_STORAGE_KEY, value);
        applyThemePreset(value);
    }

    function updateUiScale(value: UiScalePreset): void {
        uiScale.value = value;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(UI_SCALE_STORAGE_KEY, value);
        }
        setCookie(UI_SCALE_STORAGE_KEY, value);
        applyUiScale(value);
    }

    return {
        iconPack,
        themePreset,
        uiScale,
        updateIconPack,
        updateThemePreset,
        updateUiScale,
    };
}
