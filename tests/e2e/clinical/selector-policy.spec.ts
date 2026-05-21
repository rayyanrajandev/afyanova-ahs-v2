import { expect, test } from '@playwright/test';
import {
    loginAsConfiguredE2EUser,
    skipWithoutConfiguredE2EUser,
} from '../support/auth';

const clinicalSelectorRoutes = [
    '/appointments',
    '/emergency-triage',
    '/theatre-procedures',
];

const rawIdentifierPatterns = [
    /preferred clinician user id/i,
    /target clinician user id/i,
    /accepting clinician user id/i,
    /operating clinician user id/i,
    /anesthetist user id/i,
    /enter .*user id manually/i,
    /enter .*uuid manually/i,
];

test.describe('clinical selector safety policy', () => {
    test.beforeEach(() => {
        skipWithoutConfiguredE2EUser();
    });

    test('normal clinical pages do not expose raw identifier entry copy', async ({
        page,
    }) => {
        await loginAsConfiguredE2EUser(page);

        for (const route of clinicalSelectorRoutes) {
            await page.goto(route);
            await page.waitForLoadState('networkidle');

            for (const pattern of rawIdentifierPatterns) {
                await expect(page.getByText(pattern)).toHaveCount(0);
            }
        }
    });
});
