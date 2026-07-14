/**
 * Shared source of truth for "urgent" priority on the Patient-Flow Board —
 * extracted so VisitJourneyBoard.vue's rose priority badge and Board.vue's
 * "Urgent only" quick filter can't silently drift apart (e.g. someone
 * widening one list without remembering the other).
 */
export const URGENT_PRIORITIES = ['P1', 'P2'];

export function isUrgentPriority(priority: string | null): boolean {
    return priority !== null && URGENT_PRIORITIES.includes(priority);
}
