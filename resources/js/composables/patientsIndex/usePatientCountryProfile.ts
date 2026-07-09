import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import {
    districtPresetOptionsForRegion,
    regionPresetOptions,
    type PatientLocationPreset,
    type SearchableSelectOption,
} from '@/lib/patientLocations';

/**
 * Server-sourced region/district presets + localized addressing labels
 * (e.g. Tanzania's regional structure), matching what the legacy page's
 * loadCountryProfile() reads from GET /platform/country-profile — same
 * endpoint, reimplemented as a real useQuery (this rebuild's established
 * composable shape) instead of a manual ref+fetch.
 */
export type PatientCountryProfile = {
    code: string;
    name: string;
    regionLabel: string;
    districtLabel: string;
    regionPlaceholder: string;
    districtPlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    locations: PatientLocationPreset[];
};

type CountryProfileApiProfile = {
    code?: string | null;
    name?: string | null;
    patientAddressing?: {
        regionLabel?: string | null;
        districtLabel?: string | null;
        regionPlaceholder?: string | null;
        districtPlaceholder?: string | null;
        addressLabel?: string | null;
        addressPlaceholder?: string | null;
    } | null;
    patientLocations?: PatientLocationPreset[] | null;
};

type CountryProfileResponse = {
    data?: {
        activeCode?: string | null;
        profile?: CountryProfileApiProfile | null;
        availableProfiles?: CountryProfileApiProfile[] | null;
    } | null;
};

const FALLBACK: PatientCountryProfile = {
    code: 'TZ',
    name: 'Tanzania',
    regionLabel: 'Region',
    districtLabel: 'District',
    regionPlaceholder: 'Select a region',
    districtPlaceholder: 'Select a district',
    addressLabel: 'Address',
    addressPlaceholder: 'Street, ward, or landmark',
    locations: [],
};

function toCountryProfile(profile: CountryProfileApiProfile | null | undefined): PatientCountryProfile | null {
    const code = (profile?.code ?? '').trim().toUpperCase();
    if (!code) return null;

    return {
        code,
        name: (profile?.name ?? '').trim() || code,
        regionLabel: (profile?.patientAddressing?.regionLabel ?? '').trim() || FALLBACK.regionLabel,
        districtLabel: (profile?.patientAddressing?.districtLabel ?? '').trim() || FALLBACK.districtLabel,
        regionPlaceholder: (profile?.patientAddressing?.regionPlaceholder ?? '').trim() || FALLBACK.regionPlaceholder,
        districtPlaceholder: (profile?.patientAddressing?.districtPlaceholder ?? '').trim() || FALLBACK.districtPlaceholder,
        addressLabel: (profile?.patientAddressing?.addressLabel ?? '').trim() || FALLBACK.addressLabel,
        addressPlaceholder: (profile?.patientAddressing?.addressPlaceholder ?? '').trim() || FALLBACK.addressPlaceholder,
        locations: Array.isArray(profile?.patientLocations) ? (profile?.patientLocations ?? []) : [],
    };
}

export function usePatientCountryProfile(countryCode: ComputedRef<string>): {
    profile: ComputedRef<PatientCountryProfile>;
    regionOptions: ComputedRef<SearchableSelectOption[]>;
    districtOptionsForRegion: (region: string) => SearchableSelectOption[];
    query: UseQueryReturnType<CountryProfileResponse['data'] | null, Error>;
} {
    const query = useQuery({
        queryKey: ['patient-country-profile'],
        queryFn: async () => {
            const response = await apiGet<CountryProfileResponse>('/platform/country-profile');
            return response.data ?? null;
        },
        staleTime: 5 * 60 * 1000,
    });

    const catalog = computed<PatientCountryProfile[]>(() => {
        const available = query.data.value?.availableProfiles;
        const profiles = Array.isArray(available) && available.length > 0
            ? available
            : query.data.value?.profile
              ? [query.data.value.profile]
              : [];

        return profiles
            .map((item) => toCountryProfile(item))
            .filter((item): item is PatientCountryProfile => item !== null);
    });

    const profile = computed<PatientCountryProfile>(
        () => catalog.value.find((item) => item.code === countryCode.value.trim().toUpperCase()) ?? catalog.value[0] ?? FALLBACK,
    );

    const regionOptions = computed(() => regionPresetOptions(profile.value.locations));

    function districtOptionsForRegion(region: string): SearchableSelectOption[] {
        return districtPresetOptionsForRegion(profile.value.locations, region);
    }

    return { profile, regionOptions, districtOptionsForRegion, query };
}
