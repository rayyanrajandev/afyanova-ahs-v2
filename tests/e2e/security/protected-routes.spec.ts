import { expect, test } from '@playwright/test';

const protectedRoutes = [
    '/dashboard',
    '/patients',
    '/appointments',
    '/emergency-triage',
    '/medical-records',
    '/laboratory-orders',
    '/pharmacy-orders',
    '/admissions',
    '/billing-invoices',
];

test.describe('protected clinical and operational routes', () => {
    for (const route of protectedRoutes) {
        test(`redirects unauthenticated users from ${route} to login`, async ({
            page,
        }) => {
            await page.goto(route);

            await expect(page).toHaveURL(/\/login(?:\?|$)/);
            await expect(page.locator('input[name="email"]')).toBeVisible();
        });
    }
});
