import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import type { AvailableBed } from './useAvailableBeds';
import { useWardBedCascade } from './useWardBedCascade';

function bed(overrides: Partial<AvailableBed>): AvailableBed {
    return {
        id: 'bed-1',
        code: null,
        name: null,
        wardName: 'General Ward A',
        bedNumber: 'Bed 01',
        departmentId: null,
        location: null,
        status: 'active',
        isOccupied: false,
        occupiedByAdmissionId: null,
        occupiedByAdmissionNumber: null,
        ...overrides,
    };
}

describe('useWardBedCascade', () => {
    it('derives sorted, de-duplicated ward names from the bed list', () => {
        const beds = ref<AvailableBed[]>([
            bed({ id: '1', wardName: 'Maternity Ward' }),
            bed({ id: '2', wardName: 'General Ward A' }),
            bed({ id: '3', wardName: 'General Ward A' }),
            bed({ id: '4', wardName: null }),
        ]);

        const { wardOptions } = useWardBedCascade(computed(() => beds.value));

        expect(wardOptions.value).toEqual(['General Ward A', 'Maternity Ward']);
    });

    it('shows no bed options until a ward is selected', () => {
        const beds = ref<AvailableBed[]>([bed({ id: '1', wardName: 'General Ward A' })]);
        const { selectedWard, bedOptions } = useWardBedCascade(computed(() => beds.value));

        expect(bedOptions.value).toEqual([]);

        selectedWard.value = 'General Ward A';

        expect(bedOptions.value).toHaveLength(1);
        expect(bedOptions.value[0].id).toBe('1');
    });

    it('filters bed options to only the selected ward', () => {
        const beds = ref<AvailableBed[]>([
            bed({ id: '1', wardName: 'General Ward A', bedNumber: 'Bed 01' }),
            bed({ id: '2', wardName: 'Maternity Ward', bedNumber: 'Bed 01' }),
        ]);
        const { selectedWard, bedOptions } = useWardBedCascade(computed(() => beds.value));

        selectedWard.value = 'Maternity Ward';

        expect(bedOptions.value.map((b) => b.id)).toEqual(['2']);
    });
});
