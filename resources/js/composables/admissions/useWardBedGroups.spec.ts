import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import type { AvailableBed } from './useAvailableBeds';
import { useWardBedGroups } from './useWardBedGroups';

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

describe('useWardBedGroups', () => {
    it('groups beds by ward, sorted alphabetically', () => {
        const beds = ref<AvailableBed[]>([
            bed({ id: '1', wardName: 'Maternity Ward' }),
            bed({ id: '2', wardName: 'Dental Recovery' }),
            bed({ id: '3', wardName: 'General Ward A' }),
        ]);

        const groups = useWardBedGroups(computed(() => beds.value));

        expect(groups.value.map((g) => g.wardName)).toEqual(['Dental Recovery', 'General Ward A', 'Maternity Ward']);
    });

    it('sorts beds within a ward by bed number', () => {
        const beds = ref<AvailableBed[]>([
            bed({ id: '1', wardName: 'General Ward A', bedNumber: 'Bed 03' }),
            bed({ id: '2', wardName: 'General Ward A', bedNumber: 'Bed 01' }),
            bed({ id: '3', wardName: 'General Ward A', bedNumber: 'Bed 02' }),
        ]);

        const groups = useWardBedGroups(computed(() => beds.value));

        expect(groups.value[0].beds.map((b) => b.bedNumber)).toEqual(['Bed 01', 'Bed 02', 'Bed 03']);
    });

    it('falls back to "Unassigned ward" for a bed with no ward name', () => {
        const beds = ref<AvailableBed[]>([bed({ id: '1', wardName: null })]);

        const groups = useWardBedGroups(computed(() => beds.value));

        expect(groups.value).toHaveLength(1);
        expect(groups.value[0].wardName).toBe('Unassigned ward');
    });

    it('preserves occupancy state on each grouped bed', () => {
        const beds = ref<AvailableBed[]>([
            bed({ id: '1', isOccupied: true, occupiedByAdmissionNumber: 'ADM123' }),
        ]);

        const groups = useWardBedGroups(computed(() => beds.value));

        expect(groups.value[0].beds[0].isOccupied).toBe(true);
        expect(groups.value[0].beds[0].occupiedByAdmissionNumber).toBe('ADM123');
    });
});
