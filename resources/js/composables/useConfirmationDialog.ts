import { reactive } from 'vue';

type ConfirmationDialogVariant =
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';

export type ConfirmationDialogOptions = {
    title: string;
    description?: string;
    details?: string[];
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: ConfirmationDialogVariant;
    contentClass?: string;
};

export type ConfirmationDialogState = {
    open: boolean;
    title: string;
    description: string;
    details: string[];
    confirmLabel: string;
    cancelLabel: string;
    confirmVariant: ConfirmationDialogVariant;
    contentClass: string;
};

export function useConfirmationDialog() {
    const confirmationDialogState = reactive<ConfirmationDialogState>({
        open: false,
        title: '',
        description: '',
        details: [],
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        confirmVariant: 'default',
        contentClass: 'sm:max-w-lg',
    });

    let pendingResolver: ((value: boolean) => void) | null = null;

    function closeConfirmationDialog(confirmed: boolean): void {
        confirmationDialogState.open = false;

        const resolver = pendingResolver;
        pendingResolver = null;
        resolver?.(confirmed);
    }

    function requestConfirmation(
        options: ConfirmationDialogOptions,
    ): Promise<boolean> {
        if (pendingResolver) {
            pendingResolver(false);
            pendingResolver = null;
        }

        confirmationDialogState.title = options.title;
        confirmationDialogState.description = options.description ?? '';
        confirmationDialogState.details = [...(options.details ?? [])];
        confirmationDialogState.confirmLabel =
            options.confirmLabel ?? 'Confirm';
        confirmationDialogState.cancelLabel = options.cancelLabel ?? 'Cancel';
        confirmationDialogState.confirmVariant =
            options.confirmVariant ?? 'default';
        confirmationDialogState.contentClass =
            options.contentClass ?? 'sm:max-w-lg';
        confirmationDialogState.open = true;

        return new Promise<boolean>((resolve) => {
            pendingResolver = resolve;
        });
    }

    function updateConfirmationDialogOpen(open: boolean): void {
        if (!open) {
            closeConfirmationDialog(false);
            return;
        }

        confirmationDialogState.open = true;
    }

    function confirmDialogAction(): void {
        closeConfirmationDialog(true);
    }

    return {
        confirmationDialogState,
        requestConfirmation,
        updateConfirmationDialogOpen,
        confirmDialogAction,
    };
}
