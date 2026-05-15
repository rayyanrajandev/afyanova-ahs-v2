import { toast } from 'vue-sonner';

type NotifyType = 'success' | 'error' | 'info' | 'warning';

const DEFAULT_DURATION_MS = 7000;
const IMPORTANT_DURATION_MS = 12000;

function normalizedMessage(message: string): string {
    return message.trim();
}

function browserFallback(message: string, type: NotifyType): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
        new CustomEvent('afyanova:notify', {
            detail: { message, type },
        }),
    );
}

function notify(type: NotifyType, message: string, important = false): void {
    const cleanMessage = normalizedMessage(message);
    if (!cleanMessage) return;

    const options = {
        duration: important ? IMPORTANT_DURATION_MS : DEFAULT_DURATION_MS,
        closeButton: true,
    };

    try {
        if (type === 'success') {
            toast.success(cleanMessage, options);
        } else if (type === 'error') {
            toast.error(cleanMessage, options);
        } else if (type === 'warning') {
            toast.warning(cleanMessage, options);
        } else {
            toast.info(cleanMessage, options);
        }
    } catch {
        browserFallback(cleanMessage, type);
    }
}

export function notifySuccess(message: string) {
    if (!message) return;
    notify('success', message);
}

export function notifyError(message: string) {
    if (!message) return;
    notify('error', message, true);
}

export function notifyInfo(message: string) {
    if (!message) return;
    notify('info', message);
}

export function notifyWarning(message: string) {
    if (!message) return;
    notify('warning', message, true);
}

export function messageFromUnknown(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
