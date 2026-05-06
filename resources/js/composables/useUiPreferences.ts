import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';
import type {
    IconPack,
    UiFontFamily,
    UiRadiusPreset,
    UiScalePreset,
    UiThemeBase,
    UiThemePreset,
} from '@/types';

const ICON_PACK_STORAGE_KEY = 'ui.icon-pack';
const THEME_PRESET_STORAGE_KEY = 'ui.theme-preset';
const THEME_BASE_STORAGE_KEY = 'ui.theme-base';
const FONT_FAMILY_STORAGE_KEY = 'ui.font-family';
const UI_SCALE_STORAGE_KEY = 'ui.scale-preset';
const BORDER_RADIUS_STORAGE_KEY = 'ui.border-radius';

const ICON_PACK_VALUES: IconPack[] = ['lucide', 'huge'];
const THEME_PRESET_VALUES: UiThemePreset[] = ['yaru', 'clinic', 'emerald', 'violet', 'amber'];
const THEME_BASE_VALUES: UiThemeBase[] = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const FONT_FAMILY_VALUES: UiFontFamily[] = ['clinical', 'humanist', 'compact'];
const LEGACY_FONT_FAMILY_VALUES: Record<string, UiFontFamily> = {
    sans: 'clinical',
    serif: 'humanist',
    mono: 'compact',
};
const UI_SCALE_VALUES: UiScalePreset[] = ['ultra-compact', 'extra-compact', 'compact', 'comfortable', 'spacious'];
const BORDER_RADIUS_VALUES: UiRadiusPreset[] = ['0', '0.5', '1', '1.5', '2'];
const UI_SCALE_FONT_SIZE_MAP: Record<UiScalePreset, string> = {
    'ultra-compact': '12px',
    'extra-compact': '12.8px',
    compact: '14px',
    comfortable: '16px',
    spacious: '18px',
};

const iconPack = ref<IconPack>('lucide');
const themePreset = ref<UiThemePreset>('yaru');
const themeBase = ref<UiThemeBase>('slate');
const fontFamily = ref<UiFontFamily>('clinical');
const uiScale = ref<UiScalePreset>('comfortable');
const borderRadius = ref<UiRadiusPreset>('1');
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

function readStoredFontFamily(): UiFontFamily {
    if (typeof window === 'undefined') {
        return 'clinical';
    }

    const raw = window.localStorage.getItem(FONT_FAMILY_STORAGE_KEY)?.trim();
    if (!raw) {
        return 'clinical';
    }

    if (FONT_FAMILY_VALUES.includes(raw as UiFontFamily)) {
        return raw as UiFontFamily;
    }

    return LEGACY_FONT_FAMILY_VALUES[raw] ?? 'clinical';
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

function applyThemeBase(value: UiThemeBase): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.themeBase = value;
    if (document.body) {
        document.body.dataset.themeBase = value;
    }
}

function applyFontFamily(value: UiFontFamily): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.fontFamily = value;
    if (document.body) {
        document.body.dataset.fontFamily = value;
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

function applyBorderRadius(value: UiRadiusPreset): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.borderRadius = value;
    if (document.body) {
        document.body.dataset.borderRadius = value;
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
    themeBase.value = readStoredPreference(
        THEME_BASE_STORAGE_KEY,
        THEME_BASE_VALUES,
        'slate',
    );
    fontFamily.value = readStoredFontFamily();
    uiScale.value = readStoredPreference(
        UI_SCALE_STORAGE_KEY,
        UI_SCALE_VALUES,
        'comfortable',
    );
    borderRadius.value = readStoredPreference(
        BORDER_RADIUS_STORAGE_KEY,
        BORDER_RADIUS_VALUES,
        '1',
    );

    applyIconPack(iconPack.value);
    applyThemePreset(themePreset.value);
    applyThemeBase(themeBase.value);
    applyFontFamily(fontFamily.value);
    applyUiScale(uiScale.value);
    applyBorderRadius(borderRadius.value);
    initialized = true;
}

export type UseUiPreferencesReturn = {
    iconPack: Ref<IconPack>;
    themePreset: Ref<UiThemePreset>;
    themeBase: Ref<UiThemeBase>;
    fontFamily: Ref<UiFontFamily>;
    uiScale: Ref<UiScalePreset>;
    borderRadius: Ref<UiRadiusPreset>;
    updateIconPack: (value: IconPack) => void;
    updateThemePreset: (value: UiThemePreset) => void;
    updateThemeBase: (value: UiThemeBase) => void;
    updateFontFamily: (value: UiFontFamily) => void;
    updateUiScale: (value: UiScalePreset) => void;
    updateBorderRadius: (value: UiRadiusPreset) => void;
    resetUiPreferences: () => void;
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

    function updateThemeBase(value: UiThemeBase): void {
        themeBase.value = value;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_BASE_STORAGE_KEY, value);
        }
        setCookie(THEME_BASE_STORAGE_KEY, value);
        applyThemeBase(value);
    }

    function updateFontFamily(value: UiFontFamily): void {
        fontFamily.value = value;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(FONT_FAMILY_STORAGE_KEY, value);
        }
        setCookie(FONT_FAMILY_STORAGE_KEY, value);
        applyFontFamily(value);
    }

    function updateUiScale(value: UiScalePreset): void {
        uiScale.value = value;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(UI_SCALE_STORAGE_KEY, value);
        }
        setCookie(UI_SCALE_STORAGE_KEY, value);
        applyUiScale(value);
    }

    function updateBorderRadius(value: UiRadiusPreset): void {
        borderRadius.value = value;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(BORDER_RADIUS_STORAGE_KEY, value);
        }
        setCookie(BORDER_RADIUS_STORAGE_KEY, value);
        applyBorderRadius(value);
    }

    function resetUiPreferences(): void {
        updateIconPack('lucide');
        updateThemePreset('yaru');
        updateThemeBase('slate');
        updateFontFamily('clinical');
        updateUiScale('comfortable');
        updateBorderRadius('1');

        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('ui.accent-color');
        }
        setCookie('ui.accent-color', '', -1);
    }

    return {
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
        resetUiPreferences,
    };
}
