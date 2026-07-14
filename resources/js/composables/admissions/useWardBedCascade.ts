import { computed, ref, type ComputedRef } from 'vue';
import type { AvailableBed } from './useAvailableBeds';

/**
 * Derives a ward-then-bed cascade from an already-fetched bed list (facility
 * ward_bed resources have `wardName`/`bedNumber` on the same row, not a
 * separate wards table — so this filters client-side instead of a second
 * network round-trip). Shared by CreateAdmissionSheet.vue,
 * AdmissionStatusDialog.vue's transfer bed picker, and
 * EmergencyStatusDialog.vue's admit bed picker — all three previously
 * showed every bed in one flat list, which is unusable once a facility has
 * more than a handful of wards.
 */
export function useWardBedCascade(beds: ComputedRef<AvailableBed[]>) {
    const selectedWard = ref('');

    const wardOptions = computed<string[]>(() => {
        const names = new Set<string>();
        for (const bed of beds.value) {
            if (bed.wardName) {
                names.add(bed.wardName);
            }
        }
        return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    });

    const bedOptions = computed<AvailableBed[]>(() =>
        selectedWard.value ? beds.value.filter((bed) => bed.wardName === selectedWard.value) : [],
    );

    return { selectedWard, wardOptions, bedOptions };
}
