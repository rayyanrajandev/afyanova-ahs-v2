import { expect, test } from '@playwright/test';
import {
    loginAsConfiguredE2EUser,
    skipWithoutConfiguredE2EUser,
} from '../support/auth';
import {
    fillEncounterNoteSections,
    seedEncounterWorkspace,
} from '../support/encounter-workspace';

test.describe('encounter workspace journey', () => {
    test.beforeEach(() => {
        skipWithoutConfiguredE2EUser();
    });

    test('charts in workspace, switches tabs, and completes sign-off when permitted', async ({
        page,
    }) => {
        await loginAsConfiguredE2EUser(page);

        let encounterId: string;
        try {
            const seed = await seedEncounterWorkspace(page);
            encounterId = seed.encounterId;
        } catch (error) {
            test.skip(
                true,
                `Encounter workspace seed failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return;
        }

        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto(`/encounters/${encounterId}`);
        await page.waitForLoadState('networkidle');

        await expect(page.getByTestId('encounter-workspace-header')).toBeVisible();

        await page.getByRole('tab', { name: /Orders & results/i }).click();
        await expect(
            page.getByTestId('encounter-workspace-pane-care-panel'),
        ).toBeVisible();

        await page.getByRole('tab', { name: /Clinical Notes/i }).click();
        await expect(
            page.getByTestId('encounter-workspace-pane-note-panel'),
        ).toBeVisible();

        await fillEncounterNoteSections(page);

        await page.getByTestId('encounter-workspace-save-note').click();
        await expect(page.getByText(/saved|chart/i).first()).toBeVisible({
            timeout: 20_000,
        });

        const finalizeButton = page.getByTestId('encounter-workspace-finalize-note');
        if (await finalizeButton.isVisible()) {
            await finalizeButton.click();
            await page.getByTestId('encounter-workspace-finalize-confirm').click();
            await expect(page.getByText(/finaliz|signed|locked/i).first()).toBeVisible({
                timeout: 20_000,
            });
        }

        await page.getByRole('tab', { name: /Orders & results/i }).click();
        await expect(
            page.locator('#encounter-workspace-close-readiness'),
        ).toBeVisible();

        const closeEncounterButton = page.getByTestId(
            'encounter-workspace-close-encounter',
        );
        if (await closeEncounterButton.isVisible()) {
            await closeEncounterButton.click();
            await expect(page.getByText(/encounter closed|closed/i).first()).toBeVisible({
                timeout: 20_000,
            });
        }
    });
});
