import { expect, test } from '@playwright/test';

test.describe('dashboard workflow context', () => {
    test('unauthenticated users are redirected away from dashboard', async ({ page }) => {
        await page.goto('/dashboard');

        await expect(page).not.toHaveURL(/\/dashboard$/);
        await expect(page.locator('body')).toBeVisible();
    });

    test('login page remains reachable for authenticated workflow smoke setup', async ({ page }) => {
        await page.goto('/login');

        await expect(page.getByRole('heading', { name: /log in to your account/i })).toBeVisible();
        await expect(page.getByTestId('login-button')).toBeVisible();
    });
});
