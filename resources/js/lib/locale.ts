export type AppLocale = 'en' | 'sw';

export type LocaleMessages<K extends string> = Record<
    AppLocale,
    Record<K, string>
>;

const DEFAULT_LOCALE: AppLocale = 'en';
const LOCALE_STORAGE_KEY = 'locale.v1';

function normalizeLocale(value: string | null | undefined): AppLocale | null {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === '') return null;
    if (normalized === 'sw' || normalized.startsWith('sw-')) return 'sw';
    if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
    return null;
}

function queryLocale(): AppLocale | null {
    if (typeof window === 'undefined') return null;
    return normalizeLocale(
        new URLSearchParams(window.location.search).get('lang'),
    );
}

function readStoredLocale(): AppLocale | null {
    if (typeof window === 'undefined') return null;
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

function readDocumentLocale(): AppLocale | null {
    if (typeof document === 'undefined') return null;
    return normalizeLocale(document.documentElement.lang);
}

function readNavigatorLocale(): AppLocale | null {
    if (typeof navigator === 'undefined') return null;
    return normalizeLocale(navigator.language);
}

function writeStoredLocale(locale: AppLocale): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

function writeDocumentLocale(locale: AppLocale): void {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale === 'sw' ? 'sw-TZ' : 'en';
}

let cachedLocale: AppLocale | null = null;

export function getCurrentLocale(): AppLocale {
    if (cachedLocale) return cachedLocale;

    const fromQuery = queryLocale();
    if (fromQuery) {
        cachedLocale = fromQuery;
        writeStoredLocale(fromQuery);
        writeDocumentLocale(fromQuery);
        return cachedLocale;
    }

    cachedLocale =
        readStoredLocale() ??
        readDocumentLocale() ??
        readNavigatorLocale() ??
        DEFAULT_LOCALE;
    writeDocumentLocale(cachedLocale);
    return cachedLocale;
}

export function setCurrentLocale(locale: AppLocale): void {
    cachedLocale = locale;
    writeStoredLocale(locale);
    writeDocumentLocale(locale);
}

export function resolveLocale(): AppLocale {
    return getCurrentLocale();
}

function interpolate(
    template: string,
    replacements?: Record<string, string | number>,
): string {
    if (!replacements) return template;
    return template.replace(/\{(\w+)\}/g, (match, token: string) => {
        const value = replacements[token];
        return value === undefined ? match : String(value);
    });
}

export function createLocaleTranslator<K extends string>(
    messages: LocaleMessages<K>,
    fallbackLocale: AppLocale = DEFAULT_LOCALE,
): (key: K, replacements?: Record<string, string | number>) => string {
    return (key: K, replacements?: Record<string, string | number>) => {
        const locale = resolveLocale();
        const localized =
            messages[locale]?.[key] ??
            messages[fallbackLocale]?.[key] ??
            String(key);
        return interpolate(localized, replacements);
    };
}
