import { reactive, readonly } from 'vue';

/**
 * Laravel's actual validation error shape, already returned by every audited
 * endpoint (e.g. MedicalRecordController::validationError() — see
 * reports/clinical-note-audit/08-api-inventory.md §8.4/§8.5):
 *   422 { message, code, errors: { fieldName: [message, ...] } }
 *
 * This is the single source of truth for validation — no client-side schema
 * duplicates it. See the discussion in
 * reports/clinical-notes-frontend-rebuild-plan.md §2 for why VeeValidate/Zod
 * were reconsidered and dropped for form input validation.
 */
export type ApiValidationErrorPayload = {
    message?: string;
    code?: string;
    errors?: Record<string, string[]>;
};

export function useApiFormErrors() {
    const errors = reactive<Record<string, string[]>>({});

    function setFromResponse(payload: ApiValidationErrorPayload | null | undefined): void {
        clear();
        Object.assign(errors, payload?.errors ?? {});
    }

    function clear(): void {
        Object.keys(errors).forEach((key) => delete errors[key]);
    }

    function firstError(field: string): string | undefined {
        return errors[field]?.[0];
    }

    function hasError(field: string): boolean {
        return Boolean(errors[field]?.length);
    }

    return {
        errors: readonly(errors),
        setFromResponse,
        clear,
        firstError,
        hasError,
    };
}
