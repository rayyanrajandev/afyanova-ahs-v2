import { onMounted, ref, watch, type Ref } from 'vue';

export function useLocalStorageBoolean(
    key: string,
    defaultValue = false,
): Ref<boolean> {
    const state = ref(defaultValue);

    onMounted(() => {
        if (typeof window === 'undefined') return;

        const rawValue = window.localStorage.getItem(key);
        if (rawValue === null) return;

        if (rawValue === 'true' || rawValue === '1') {
            state.value = true;
            return;
        }

        if (rawValue === 'false' || rawValue === '0') {
            state.value = false;
        }
    });

    watch(state, (value) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value ? 'true' : 'false');
    });

    return state;
}
