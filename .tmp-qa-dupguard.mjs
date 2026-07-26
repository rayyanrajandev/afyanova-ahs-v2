import { chromium } from 'playwright';
import fs from 'node:fs';

const SHOT_DIR = '/tmp/claude-1000/-home-rajani-Desktop-Portfolio-afyanova-ahs-v2/0643d76f-d51b-4ec1-b967-eaf7d5e7b473/scratchpad/shots';
const BASE = 'http://localhost:8000';
const EMAIL = 'qa-verify-manage@example.test';
const PASSWORD = 'password';

async function shot(page, name) {
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
    console.log('shot:', name);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    await page.goto(`${BASE}/inventory-procurement/stock-control`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByRole('button', { name: 'New item' }).first().click();
    await page.waitForTimeout(700);
    await page.locator('#inv-item-category').click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /Pharmaceutical/i }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    // Metronidazole 400mg already has an auto-synced inventory item (confirmed via tinker earlier)
    await page.locator('#inv-item-clinical-catalog').click();
    await page.waitForTimeout(600);
    const option = page.locator('[data-slot="popover-content"] button', { hasText: 'Metronidazole 400mg' }).first();
    await option.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(800);
    await shot('p-duplicate-detected');

    const nextDisabled = await page.getByRole('button', { name: 'Next' }).isDisabled();
    console.log('Next disabled when duplicate detected:', nextDisabled);

    const text = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText || '');
    console.log('--- DIALOG TEXT ---');
    console.log(text);

    // Click "Open existing item"
    await page.getByRole('button', { name: 'Open existing item' }).click();
    await page.waitForTimeout(1000);
    await shot('q-opened-existing-item');

    const urlNow = page.url();
    console.log('URL after clicking open existing item:', urlNow);

    const sheetVisible = await page.locator('[role="dialog"]').count();
    console.log('A sheet/dialog is open:', sheetVisible > 0);
    const detailsText = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText.slice(0, 300) || '');
    console.log('--- OPENED SHEET TEXT (first 300 chars) ---');
    console.log(detailsText);
} catch (e) {
    console.log('SCRIPT ERROR:', e.message);
    await shot(page, '99-dup-error');
} finally {
    await browser.close();
}
