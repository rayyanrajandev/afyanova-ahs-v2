import { describe, expect, it } from 'vitest';
import { useApiFormErrors } from './useApiFormErrors';

describe('useApiFormErrors', () => {
    it('populates errors directly from a Laravel-shaped 422 response', () => {
        const form = useApiFormErrors();

        form.setFromResponse({
            message: 'The given data was invalid.',
            code: 'VALIDATION_ERROR',
            errors: {
                admissionId: ['A draft note of this type already exists for this visit.'],
            },
        });

        expect(form.hasError('admissionId')).toBe(true);
        expect(form.firstError('admissionId')).toBe(
            'A draft note of this type already exists for this visit.',
        );
        expect(form.hasError('appointmentId')).toBe(false);
    });

    it('clears previous errors before applying a new response', () => {
        const form = useApiFormErrors();

        form.setFromResponse({ errors: { patientId: ['Required.'] } });
        expect(form.hasError('patientId')).toBe(true);

        form.setFromResponse({ errors: { recordType: ['Invalid.'] } });

        expect(form.hasError('patientId')).toBe(false);
        expect(form.hasError('recordType')).toBe(true);
    });

    it('clear() removes all errors', () => {
        const form = useApiFormErrors();
        form.setFromResponse({ errors: { patientId: ['Required.'] } });

        form.clear();

        expect(form.hasError('patientId')).toBe(false);
    });
});
