import { toast } from 'vue-sonner';

export function notifySuccess(message: string) {
    if (!message) return;
    toast.success(message);
}

export function notifyError(message: string) {
    if (!message) return;
    toast.error(message);
}

export function messageFromUnknown(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
