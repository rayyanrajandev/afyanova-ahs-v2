import { expect, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from '../support/accessibility';

test.describe('login smoke', () => {
    test('renders the login form with baseline accessibility', async ({ page }) => {
        await page.goto('/login');

        await expect(
            page.getByRole('heading', { name: /log in to your account/i }),
        ).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.getByTestId('login-button')).toBeVisible();

        await expectNoCriticalA11yViolations(page);
    });
});
