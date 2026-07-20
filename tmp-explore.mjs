import { chromium } from 'playwright';

const BASE = 'https://afyanova-ahs-v2.test';

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // Login
  console.log('=== Logging in ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await wait(2000);
  await page.fill('input[type="email"]', 'verify-agent@local.test');
  await page.fill('input[type="password"]', 'VerifyPass123!');
  await page.click('button[type="submit"]');
  await wait(3000);

  // Explore: Take screenshot of current page
  await page.screenshot({ path: 'tmp-after-login.png', fullPage: false });
  console.log(`URL after login: ${page.url()}`);

  // Try navigating to clinical catalog
  console.log('\n=== Navigating to Clinical Catalog ===');
  await page.goto(`${BASE}/platform/clinical-catalog`, { waitUntil: 'networkidle', timeout: 30000 });
  await wait(3000);
  await page.screenshot({ path: 'tmp-clinical-catalog.png', fullPage: false });
  console.log(`Clinical catalog URL: ${page.url()}`);
  
  // Get page HTML to see structure
  const html = await page.content();
  console.log(`Page title: ${await page.title()}`);
  
  // Look for links, buttons, forms
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="button"], [data-testid]')).slice(0, 30).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 60),
      href: el.href || el.getAttribute('href') || '',
      dataTestid: el.getAttribute('data-testid') || '',
      class: el.className?.substring(0, 50),
    }));
  });
  console.log('Interactive elements:', JSON.stringify(links, null, 2));

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
