import { useStorage } from '@vueuse/core';

const FAVORITES_STORAGE_KEY = 'afyanova-sidebar-favorites';

/**
 * Manages sidebar navigation favorites — persisted in localStorage.
 * Tracks up to N user-pinned nav items for quick-access at the top of the sidebar.
 */
export function useSidebarFavorites() {
    const favoriteIds = useStorage<string[]>(FAVORITES_STORAGE_KEY, []);

    function isFavorite(id: string): boolean {
        return favoriteIds.value.includes(id);
    }

    function toggleFavorite(id: string): void {
        const idx = favoriteIds.value.indexOf(id);
        if (idx === -1) {
            // Add to front, cap at 8
            favoriteIds.value = [id, ...favoriteIds.value].slice(0, 8);
        } else {
            favoriteIds.value = favoriteIds.value.filter((fid) => fid !== id);
        }
    }

    function getFavorites<T extends { id?: string }>(items: T[]): T[] {
        if (!favoriteIds.value.length) return [];
        return favoriteIds.value
            .map((fid) => items.find((item) => item.id === fid))
            .filter((item): item is T => item !== undefined);
    }

    return {
        favoriteIds,
        isFavorite,
        toggleFavorite,
        getFavorites,
    };
}