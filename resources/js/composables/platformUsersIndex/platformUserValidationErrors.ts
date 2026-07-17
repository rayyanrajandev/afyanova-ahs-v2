import { isApiClientError } from '@/lib/apiClient';

type ValidationErrorPayload = { message?: string; errors?: Record<string, string[]> };

/** Pulls the first validation message for any of `keys` out of an ApiClientError's 422 payload. */
export function firstValidationError(error: unknown, keys: string[]): string | null {
    if (!isApiClientError(error)) return null;
    const errors = (error.payload as ValidationErrorPayload | undefined)?.errors ?? {};
    for (const key of keys) {
        const messages = errors[key];
        if (Array.isArray(messages) && messages.length > 0) {
            return messages[0] ?? null;
        }
    }
    return null;
}

/** True when the server rejected a sensitive change because it needs an approval-case reference (privileged target). */
export function requiresApprovalCaseReference(error: unknown): boolean {
    return firstValidationError(error, ['approvalCaseReference']) !== null;
}
