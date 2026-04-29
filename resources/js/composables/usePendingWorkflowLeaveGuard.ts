import { router } from '@inertiajs/vue3';
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

type BooleanRef = Readonly<Ref<boolean>> | Ref<boolean>;

type PendingWorkflowLeaveGuardOptions = {
    shouldBlock: BooleanRef;
    isSubmitting?: BooleanRef;
    blockBrowserUnload?: boolean;
};

export function usePendingWorkflowLeaveGuard(
    options: PendingWorkflowLeaveGuardOptions,
) {
    const confirmOpen = ref(false);
    const pendingVisit = ref<any | null>(null);

    let removeNavigationGuard: VoidFunction | null = null;
    let bypassNavigationGuard = false;

    function confirmLeave(): void {
        const visit = pendingVisit.value;
        confirmOpen.value = false;
        pendingVisit.value = null;

        if (!visit) return;

        bypassNavigationGuard = true;
        router.visit(visit.url, visit);
        bypassNavigationGuard = false;
    }

    function cancelLeave(): void {
        confirmOpen.value = false;
        pendingVisit.value = null;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent): void {
        if (
            options.blockBrowserUnload === false
            || !options.shouldBlock.value
            || options.isSubmitting?.value
        ) {
            return;
        }
        event.preventDefault();
        event.returnValue = '';
    }

    onMounted(() => {
        if (options.blockBrowserUnload !== false) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }
        removeNavigationGuard = router.on('before', (event) => {
            if (
                bypassNavigationGuard
                || !options.shouldBlock.value
                || options.isSubmitting?.value
            ) {
                return;
            }

            pendingVisit.value = event.detail.visit;
            confirmOpen.value = true;
            event.preventDefault();
            return false;
        });
    });

    onBeforeUnmount(() => {
        if (options.blockBrowserUnload !== false) {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        }
        removeNavigationGuard?.();
        removeNavigationGuard = null;
    });

    return {
        confirmOpen,
        confirmLeave,
        cancelLeave,
    };
}
