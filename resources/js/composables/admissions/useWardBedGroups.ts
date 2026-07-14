import { computed, type ComputedRef } from 'vue';
import type { AvailableBed } from './useAvailableBeds';

export type WardBedGroup = {
    wardName: string;
    beds: AvailableBed[];
};

/**
 * P4 of the Reception/Emergency/Admission/Bed-Management audit
 * follow-through — pure client-side grouping over an already-fetched
 * useAvailableBeds() response (which already includes occupied beds, not
 * just vacant ones — no backend change needed). Extracted into its own
 * composable (not an inline computed on the page) specifically so it's
 * independently testable, matching this codebase's "every composable gets
 * a spec" convention. Simpler than inpatient-ward/RebuiltPage.vue's own
 * wardBedGroups (which cross-references a second, richer census data
 * source by a `ward::bed` string key) — AvailableBed rows already carry
 * their own occupancy state directly, so no matching step is needed here.
 */
export function useWardBedGroups(beds: ComputedRef<AvailableBed[]>): ComputedRef<WardBedGroup[]> {
    return computed(() => {
        const groups = new Map<string, AvailableBed[]>();

        for (const bed of beds.value) {
            const wardName = bed.wardName?.trim() || 'Unassigned ward';
            const existing = groups.get(wardName);
            if (existing) {
                existing.push(bed);
            } else {
                groups.set(wardName, [bed]);
            }
        }

        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }))
            .map(([wardName, wardBeds]) => ({
                wardName,
                beds: wardBeds
                    .slice()
                    .sort((a, b) => (a.bedNumber ?? '').localeCompare(b.bedNumber ?? '', undefined, { sensitivity: 'base', numeric: true })),
            }));
    });
}
