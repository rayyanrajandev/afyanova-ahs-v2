/**
 * Pure date-of-birth <-> age derivation. The backend (StorePatientRequest)
 * only ever accepts a real `dateOfBirth` date string — age-in-years/months
 * is UI-local scratch state that gets derived into that date before
 * submission, never sent as its own field. Extracted from the sheet
 * component so it's independently unit-testable.
 */
export type PatientAgeParts = { years: number; months: number };

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

function todayAtMidnight(): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

export function deriveDateOfBirthFromAge(ageYearsInput: string | number, ageMonthsInput: string | number): string | null {
    const yearsInput = String(ageYearsInput ?? '').trim();
    const monthsInput = String(ageMonthsInput ?? '').trim();
    if (yearsInput === '' && monthsInput === '') return null;

    const years = /^\d{1,3}$/.test(yearsInput) ? Number.parseInt(yearsInput, 10) : 0;
    const months = /^\d{1,2}$/.test(monthsInput) ? Number.parseInt(monthsInput, 10) : 0;
    if (years === 0 && months === 0) return null;
    if (years > 130 || months > 11) return null;

    const today = todayAtMidnight();
    const derived = new Date(today.getFullYear() - years, today.getMonth() - months, today.getDate());

    return `${derived.getFullYear()}-${pad2(derived.getMonth() + 1)}-${pad2(derived.getDate())}`;
}

export function deriveAgeFromDateOfBirth(dateOfBirthInput: string): PatientAgeParts | null {
    const trimmed = String(dateOfBirthInput ?? '').trim();
    if (trimmed === '') return null;

    const dateOfBirth = new Date(trimmed);
    if (Number.isNaN(dateOfBirth.getTime())) return null;

    const today = todayAtMidnight();
    if (dateOfBirth.getTime() > today.getTime()) return null;

    let years = today.getFullYear() - dateOfBirth.getFullYear();
    let months = today.getMonth() - dateOfBirth.getMonth();

    if (today.getDate() < dateOfBirth.getDate()) {
        months -= 1;
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }
    if (years < 0) return null;

    return { years, months };
}

export function formatAgeLabel(age: PatientAgeParts): string {
    const parts: string[] = [];
    if (age.years > 0) parts.push(`${age.years} yr${age.years === 1 ? '' : 's'}`);
    if (age.months > 0 || age.years === 0) parts.push(`${age.months} mo${age.months === 1 ? '' : 's'}`);
    return parts.join(' ');
}
