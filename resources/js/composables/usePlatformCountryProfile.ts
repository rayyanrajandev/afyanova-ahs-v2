import { computed, ref } from 'vue';

export type PlatformCountryProfile = {
    code?: string | null;
    name?: string | null;
    currencyCode?: string | null;
};

type CountryProfileResponse = {
    data?: {
        activeCode?: string | null;
        profile?: PlatformCountryProfile | null;
        availableProfiles?: PlatformCountryProfile[] | null;
        catalogProfiles?: PlatformCountryProfile[] | null;
    } | null;
};

const fallbackCountryCode = 'TZ';
const fallbackCurrencyCode = 'TZS';

const activeCountryCodeState = ref(fallbackCountryCode);
const countryProfileCatalogState = ref<PlatformCountryProfile[]>([]);
const countryProfileFullCatalogState = ref<PlatformCountryProfile[]>([]);
const countryProfileLoadedState = ref(false);
const countryProfileLoadingState = ref(false);
let pendingCountryProfileLoad: Promise<void> | null = null;

function normalizeCountryCode(value: string | null | undefined): string {
    return (value ?? '').trim().toUpperCase();
}

function normalizeCurrencyCode(value: string | null | undefined): string {
    return (value ?? '').trim().toUpperCase();
}

function normalizeCountryProfile(
    profile: PlatformCountryProfile | null | undefined,
): PlatformCountryProfile | null {
    const code = normalizeCountryCode(profile?.code);
    if (!code) return null;

    return {
        code,
        name: (profile?.name ?? '').trim() || code,
        currencyCode: normalizeCurrencyCode(profile?.currencyCode) || null,
    };
}

async function requestCountryProfile(): Promise<void> {
    const response = await fetch('/api/v1/platform/country-profile', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }

    const payload = (await response.json().catch(() => ({}))) as CountryProfileResponse;
    const profiles = Array.isArray(payload.data?.availableProfiles)
        ? payload.data?.availableProfiles ?? []
        : payload.data?.profile
          ? [payload.data.profile]
          : [];
    const fullCatalog = Array.isArray(payload.data?.catalogProfiles)
        ? payload.data?.catalogProfiles ?? []
        : profiles;

    countryProfileCatalogState.value = profiles
        .map((profile) => normalizeCountryProfile(profile))
        .filter((profile): profile is PlatformCountryProfile => profile !== null);
    countryProfileFullCatalogState.value = fullCatalog
        .map((profile) => normalizeCountryProfile(profile))
        .filter((profile): profile is PlatformCountryProfile => profile !== null);

    activeCountryCodeState.value =
        normalizeCountryCode(payload.data?.profile?.code) ||
        normalizeCountryCode(payload.data?.activeCode) ||
        countryProfileCatalogState.value[0]?.code ||
        fallbackCountryCode;

    countryProfileLoadedState.value = true;
}

export function usePlatformCountryProfile() {
    const activeCountryProfile = computed(
        () =>
            countryProfileCatalogState.value.find(
                (profile) => normalizeCountryCode(profile.code) === activeCountryCodeState.value,
            ) ??
            countryProfileCatalogState.value[0] ??
            null,
    );

    const activeCurrencyCode = computed(
        () => normalizeCurrencyCode(activeCountryProfile.value?.currencyCode) || fallbackCurrencyCode,
    );

    async function loadCountryProfile(options?: { force?: boolean }): Promise<void> {
        if (!options?.force && countryProfileLoadedState.value) {
            return;
        }

        if (pendingCountryProfileLoad && !options?.force) {
            return pendingCountryProfileLoad;
        }

        pendingCountryProfileLoad = (async () => {
            countryProfileLoadingState.value = true;
            try {
                await requestCountryProfile();
            } catch {
                if (countryProfileCatalogState.value.length === 0) {
                    activeCountryCodeState.value = fallbackCountryCode;
                }
            } finally {
                countryProfileLoadingState.value = false;
                pendingCountryProfileLoad = null;
            }
        })();

        return pendingCountryProfileLoad;
    }

    return {
        activeCountryCode: computed(() => activeCountryCodeState.value),
        activeCountryProfile,
        activeCurrencyCode,
        countryProfileCatalog: computed(() => countryProfileCatalogState.value),
        countryProfileFullCatalog: computed(
            () => countryProfileFullCatalogState.value.length > 0
                ? countryProfileFullCatalogState.value
                : countryProfileCatalogState.value,
        ),
        countryProfileLoaded: computed(() => countryProfileLoadedState.value),
        countryProfileLoading: computed(() => countryProfileLoadingState.value),
        loadCountryProfile,
    };
}
