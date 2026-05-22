import type { APIRequestContext, Page } from '@playwright/test';

export type EncounterWorkspaceSeed = {
    patientId: string;
    appointmentId: string;
    encounterId: string;
    recordId: string;
};

async function readCsrfHeader(page: Page | APIRequestContext): Promise<Record<string, string>> {
    const cookies = await page.context().cookies();
    const xsrf = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;

    if (!xsrf) {
        return {};
    }

    return { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) };
}

async function apiHeaders(page: Page): Promise<Record<string, string>> {
    return {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(await readCsrfHeader(page)),
    };
}

async function firstPatientId(
    page: Page,
    headers: Record<string, string>,
): Promise<string | null> {
    const response = await page.request.get('/api/v1/patients?perPage=1', {
        headers,
    });

    if (!response.ok()) {
        return null;
    }

    const payload = (await response.json()) as {
        data?: Array<{ id?: string | null }>;
    };

    const patientId = payload.data?.[0]?.id?.trim() ?? '';

    return patientId !== '' ? patientId : null;
}

async function createPatient(
    page: Page,
    headers: Record<string, string>,
): Promise<string> {
    const suffix = Date.now().toString().slice(-6);
    const response = await page.request.post('/api/v1/patients', {
        headers,
        data: {
            firstName: 'E2E',
            lastName: `Encounter${suffix}`,
            gender: 'female',
            dateOfBirth: '1990-01-15',
            phone: `+255700${suffix}`,
            countryCode: 'TZ',
            region: 'Dar es Salaam',
            district: 'Kinondoni',
            addressLine: 'E2E test address',
        },
    });

    if (!response.ok()) {
        throw new Error(
            `Unable to create patient for encounter workspace E2E (${response.status()}).`,
        );
    }

    const payload = (await response.json()) as { data?: { id?: string | null } };
    const patientId = payload.data?.id?.trim() ?? '';

    if (patientId === '') {
        throw new Error('Patient create response did not include an id.');
    }

    return patientId;
}

export async function seedEncounterWorkspace(
    page: Page,
): Promise<EncounterWorkspaceSeed> {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const headers = await apiHeaders(page);
    const patientId =
        (await firstPatientId(page, headers)) ??
        (await createPatient(page, headers));

    const appointmentResponse = await page.request.post('/api/v1/appointments', {
        headers,
        data: {
            patientId,
            department: 'General Medicine',
            scheduledAt: new Date().toISOString(),
            durationMinutes: 30,
            reason: 'Encounter workspace E2E journey',
        },
    });

    if (!appointmentResponse.ok()) {
        throw new Error(
            `Unable to create appointment for encounter workspace E2E (${appointmentResponse.status()}).`,
        );
    }

    const appointmentPayload = (await appointmentResponse.json()) as {
        data?: { id?: string | null };
    };
    const appointmentId = appointmentPayload.data?.id?.trim() ?? '';

    if (appointmentId === '') {
        throw new Error('Appointment create response did not include an id.');
    }

    const recordResponse = await page.request.post('/api/v1/medical-records', {
        headers,
        data: {
            patientId,
            appointmentId,
            recordType: 'consultation_note',
            encounterAt: new Date().toISOString(),
            subjective: 'E2E subjective documentation.',
            objective: 'E2E objective findings.',
            assessment: 'E2E assessment.',
            plan: 'E2E plan of care.',
        },
    });

    if (!recordResponse.ok()) {
        throw new Error(
            `Unable to create medical record for encounter workspace E2E (${recordResponse.status()}).`,
        );
    }

    const recordPayload = (await recordResponse.json()) as {
        data?: { id?: string | null; encounterId?: string | null };
    };
    const recordId = recordPayload.data?.id?.trim() ?? '';
    const encounterId = recordPayload.data?.encounterId?.trim() ?? '';

    if (recordId === '' || encounterId === '') {
        throw new Error('Medical record create response did not include encounter context.');
    }

    return {
        patientId,
        appointmentId,
        encounterId,
        recordId,
    };
}

export async function fillEncounterNoteSections(page: Page): Promise<void> {
    const editors = page.locator('[contenteditable="true"]');
    const count = await editors.count();

    for (let index = 0; index < count; index += 1) {
        const editor = editors.nth(index);
        if (!(await editor.isVisible())) {
            continue;
        }

        await editor.click();
        await editor.fill(`E2E section ${index + 1} content.`);
    }
}
