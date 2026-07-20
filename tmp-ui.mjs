import { chromium } from 'playwright';

const BASE = 'https://afyanova-ahs-v2.test';

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiCsrf(page) {
  return page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.on('response', r => {
    if (r.status() >= 400) console.log(`  [${r.status()}] ${r.url().substring(0,120)}`);
  });

  // LOGIN
  console.log('=== LOGIN ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await wait(2000);
  await page.fill('input[type="email"]', 'verify-agent@local.test');
  await page.fill('input[type="password"]', 'VerifyPass123!');
  await page.click('button[type="submit"]');
  await wait(4000);
  console.log('URL:', page.url().substring(0,80));

  // Go to clinical catalog admin page
  console.log('\n=== CLINICAL CATALOG ===');
  await page.goto(`${BASE}/platform/admin/clinical-catalogs`, { waitUntil: 'networkidle', timeout: 30000 });
  await wait(3000);
  console.log('URL:', page.url().substring(0,120));

  // Take screenshot
  await page.screenshot({ path: 'tmp-01-clinical-catalog.png', fullPage: false });
  console.log('Screenshot saved: tmp-01-clinical-catalog.png');

  // Get page title and visible text
  const title = await page.title();
  const bodyPreview = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log(`Title: ${title}`);
  console.log(`Body: ${bodyPreview.replace(/\n/g, ' | ').substring(0,300)}`);

  // List interactive elements
  const interactives = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'))
      .slice(0, 40)
      .map(el => ({
        tag: el.tagName,
        type: el.getAttribute('type') || '',
        text: (el.textContent || '').trim().substring(0, 50),
        href: el.getAttribute('href') || '',
        placeholder: el.getAttribute('placeholder') || '',
        name: el.getAttribute('name') || '',
        id: el.id || '',
        class: (el.className || '').substring(0, 40),
        visible: el.offsetParent !== null,
      }))
      .filter(e => e.text || e.href || e.placeholder || e.name || e.id);
  });
  console.log(`Interactive elements (${interactives.length}):`);
  interactives.forEach(e => console.log(`  <${e.tag}${e.type ? ' type='+e.type : ''}> ${e.text || e.placeholder || e.name || e.href || e.id.substring(0,30)}`));

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
