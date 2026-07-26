import { chromium } from 'playwright';
import fs from 'node:fs';

const SHOT_DIR = '/tmp/claude-1000/-home-rajani-Desktop-Portfolio-afyanova-ahs-v2/0643d76f-d51b-4ec1-b967-eaf7d5e7b473/scratchpad/shots';
const BASE = 'http://localhost:8000';

async function shot(page, name) {
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
    console.log('shot:', name);
}

async function login(page, email) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });

try {
    // --- Manage-items user ---
    const page1 = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await login(page1, 'qa-verify-manage@example.test');
    await page1.goto(`${BASE}/inventory-procurement/stock-control`, { waitUntil: 'networkidle', timeout: 30000 });
    await page1.waitForTimeout(500);

    const rowButtons = await page1.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.filter((b) => b.textContent?.trim() === 'View details').length;
    });
    console.log('Manage user: "View details" buttons remaining on page:', rowButtons);

    await page1.getByText('Amlodipine 5mg', { exact: true }).first().click();
    await page1.waitForTimeout(1000);
    await shot(page1, 'n-manage-user-item-details');

    const tabsText = await page1.evaluate(() => {
        const list = document.querySelector('[role="tablist"]');
        return list ? list.innerText : 'NO TABLIST';
    });
    console.log('Manage user tabs:', JSON.stringify(tabsText));

    await page1.close();

    // --- Read-only user ---
    const page2 = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await login(page2, 'qa-verify-readonly@example.test');
    await page2.goto(`${BASE}/inventory-procurement/stock-control`, { waitUntil: 'networkidle', timeout: 30000 });
    await page2.waitForTimeout(500);
    console.log('Read-only user URL after login+nav:', page2.url());

    await page2.getByText('Amlodipine 5mg', { exact: true }).first().click();
    await page2.waitForTimeout(1000);
    await shot(page2, 'o-readonly-user-item-details');

    const tabsText2 = await page2.evaluate(() => {
        const list = document.querySelector('[role="tablist"]');
        return list ? list.innerText : 'NO TABLIST';
    });
    console.log('Read-only user tabs:', JSON.stringify(tabsText2));

    const fieldsDisabled = await page2.evaluate(() => {
        const input = document.querySelector('#inv-item-edit-manufacturer');
        return input ? input.disabled : 'FIELD NOT FOUND';
    });
    console.log('Read-only user: manufacturer field disabled?', fieldsDisabled);

    const footerText = await page2.evaluate(() => {
        const footer = document.querySelector('[data-slot="sheet-footer"]');
        return footer ? footer.innerText : 'NO FOOTER';
    });
    console.log('Read-only user footer:', JSON.stringify(footerText));

    await page2.close();
} catch (e) {
    console.log('SCRIPT ERROR:', e.message);
} finally {
    await browser.close();
}
