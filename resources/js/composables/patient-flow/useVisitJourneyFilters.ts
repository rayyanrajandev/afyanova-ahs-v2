import { reactive } from 'vue';

export type VisitJourneyFilters = {
    department: string | null;
    clinicianUserId: number | null;
    q: string;
};

/**
 * Reactive board filter state, passed into useVisitJourneyBoard()'s query
 * params — same shape/role as every other V2 page's filters composable
 * (e.g. worklist search+department+status filters), kept separate from the
 * query itself so Board.vue's filter row can bind directly to it.
 */
export function useVisitJourneyFilters(): VisitJourneyFilters {
    return reactive<VisitJourneyFilters>({
        department: null,
        clinicianUserId: null,
        q: '',
    });
}
