import { useStorage } from '@vueuse/core';
import { computed } from 'vue';

const HISTORY_STORAGE_KEY = 'afyanova-sidebar-history';
const MAX_HISTORY = 5;

type HistoryEntry = {
    id: string;
    title: string;
    href: string;
    iconName?: string;
};

/**
 * Tracks recently visited sidebar nav items for quick-access recall.
 * Persisted in localStorage, capped at MAX_HISTORY entries.
 */
export function useSidebarHistory() {
    const history = useStorage<HistoryEntry[]>(HISTORY_STORAGE_KEY, []);

    function recordVisit(entry: Omit<HistoryEntry, 'href'> & { href: string }) {
        if (!entry.href || entry.href === '/' || entry.href === '/dashboard') return;

        history.value = [
            entry,
            ...history.value.filter((h) => h.href !== entry.href),
        ].slice(0, MAX_HISTORY);
    }

    function clearHistory() {
        history.value = [];
    }

    return {
        recentItems: computed(() => history.value),
        recordVisit,
        clearHistory,
    };
}