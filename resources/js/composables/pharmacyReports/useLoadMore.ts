import { ref, computed } from 'vue';
import { apiGet } from '@/lib/apiClient';

type PaginatedApiResponse<T> = {
    data: T[];
    meta: { currentPage: number; lastPage: number; total: number; perPage: number };
};

export function useLoadMore<T>(
    url: string,
    baseParams: Record<string, unknown>,
) {
    const allData = ref<T[]>([]);
    const meta = ref<PaginatedApiResponse<T>['meta'] | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const currentPage = ref(0);

    const hasMore = computed(() => {
        if (!meta.value) return true;
        return meta.value.currentPage < meta.value.lastPage;
    });

    const total = computed(() => meta.value?.total ?? 0);
    const loadedCount = computed(() => allData.value.length);

    async function loadMore() {
        if (isLoading.value) return;
        if (meta.value && !hasMore.value) return;
        isLoading.value = true;
        error.value = null;
        try {
            const page = currentPage.value + 1;
            const params = { ...baseParams, page, perPage: baseParams.perPage ?? 50 };
            const response = await apiGet<PaginatedApiResponse<T>>(url, params);
            if (page === 1) {
                allData.value = response.data;
            } else {
                allData.value = [...allData.value, ...response.data];
            }
            meta.value = response.meta;
            currentPage.value = page;
        } catch (e) {
            error.value = 'Failed to load data';
        } finally {
            isLoading.value = false;
        }
    }

    function reset() {
        allData.value = [];
        meta.value = null;
        currentPage.value = 0;
        isLoading.value = false;
        error.value = null;
    }

    return {
        data: allData,
        meta,
        isLoading,
        error,
        hasMore,
        total,
        loadedCount,
        loadMore,
        reset,
    };
}
