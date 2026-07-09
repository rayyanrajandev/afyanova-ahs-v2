import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { computed, defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientCountryProfile } from './usePatientCountryProfile';

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    await flushPromises();

    return composable;
}

describe('usePatientCountryProfile', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('exposes region/district labels and preset options from the server profile', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: {
                activeCode: 'TZ',
                profile: {
                    code: 'TZ',
                    name: 'Tanzania',
                    patientAddressing: {
                        regionLabel: 'Region',
                        districtLabel: 'District',
                        regionPlaceholder: 'Select a region',
                        districtPlaceholder: 'Select a district',
                        addressLabel: 'Address',
                        addressPlaceholder: 'Street, ward, or landmark',
                    },
                    patientLocations: [
                        {
                            value: 'Dar es Salaam',
                            label: 'Dar es Salaam',
                            districts: ['Ilala', 'Kinondoni', 'Temeke'],
                        },
                    ],
                },
                availableProfiles: [],
            },
        });

        const { profile, regionOptions, districtOptionsForRegion } = await mount(() =>
            usePatientCountryProfile(computed(() => 'TZ')),
        );

        expect(profile.value.regionLabel).toBe('Region');
        expect(regionOptions.value.map((option) => option.value)).toContain('Dar es Salaam');
        expect(districtOptionsForRegion('Dar es Salaam').map((option) => option.value)).toEqual([
            'Ilala',
            'Kinondoni',
            'Temeke',
        ]);
    });

    it('falls back to generic labels and an empty district list when the region has no preset', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: null });

        const { profile, districtOptionsForRegion } = await mount(() => usePatientCountryProfile(computed(() => 'TZ')));

        expect(profile.value.regionLabel).toBe('Region');
        expect(districtOptionsForRegion('Unknown region')).toEqual([]);
    });

    it('reacts to the country code changing', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: {
                activeCode: 'TZ',
                profile: { code: 'TZ', name: 'Tanzania', patientAddressing: null, patientLocations: [] },
                availableProfiles: [
                    { code: 'TZ', name: 'Tanzania', patientAddressing: { regionLabel: 'Region' }, patientLocations: [] },
                    { code: 'KE', name: 'Kenya', patientAddressing: { regionLabel: 'County' }, patientLocations: [] },
                ],
            },
        });

        const code = ref('TZ');
        const { profile } = await mount(() => usePatientCountryProfile(computed(() => code.value)));

        expect(profile.value.regionLabel).toBe('Region');
        code.value = 'KE';
        await flushPromises();
        expect(profile.value.regionLabel).toBe('County');
    });
});
