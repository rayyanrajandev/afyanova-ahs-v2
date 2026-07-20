import { chromium } from 'playwright';

const BASE = 'https://afyanova-ahs-v2.test';
const USER = { email: 'verify-agent@local.test', pass: 'VerifyPass123!' };
const TENANT_CODE = 'TZH';
const FACILITY_CODE = 'AFYANOVA';

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  let passed = 0, failed = 0;

  function check(label, ok) {
    if (ok) { console.log(`  PASS: ${label}`); passed++; }
    else { console.log(`  FAIL: ${label}`); failed++; }
  }

  // --- Step 1: Navigate to login ---
  console.log('\n=== 1. Login ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await wait(2000);
  await page.fill('input[type="email"]', USER.email);
  await page.fill('input[type="password"]', USER.pass);
  await page.click('button[type="submit"]');
  await wait(3000);

  const currentUrl = page.url();
  check('redirected away from /login', !currentUrl.includes('/login'));

  // --- Step 2: Set tenant/facility cookies for scope ---
  console.log('\n=== 2. Set facility scope cookies ===');
  await context.addCookies([
    { name: 'platform_tenant_code', value: TENANT_CODE, url: BASE },
    { name: 'platform_facility_code', value: FACILITY_CODE, url: BASE },
  ]);

  // --- Step 3: Navigate to billing charge capture ---
  console.log('\n=== 3. Billing Charge Capture ===');
  await page.goto(`${BASE}/billing/charge-capture`, { waitUntil: 'networkidle', timeout: 30000 });
  await wait(3000);
  check('charge capture page loaded', !page.url().includes('/login'));

  // Try to find candidate rows or data
  const bodyText = await page.textContent('body');
  const hasNoData = bodyText.includes('No') || bodyText.includes('no') || bodyText.includes('empty');
  console.log(`  Page title: ${await page.title()}`);
  console.log(`  URL: ${page.url()}`);
  check('page rendered without login redirect', !page.url().includes('/login'));

  // --- Step 4: Check API endpoint directly ---
  console.log('\n=== 4. API: Charge Capture Candidates ===');
  try {
    const apiResp = await page.evaluate(async () => {
      const resp = await fetch('/api/v1/billing/charge-capture/candidates?patientId=demo', {
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      });
      return { status: resp.status, data: await resp.json() };
    });
    console.log(`  API status: ${apiResp.status}`);
    console.log(`  Response: ${JSON.stringify(apiResp.data).substring(0, 200)}`);
    check('charge capture API accessible', apiResp.status < 500);
  } catch (e) {
    console.log(`  API error: ${e.message}`);
    check('charge capture API accessible', false);
  }

  // --- Step 5: Navigate to POS Frontdesk Quick ---
  console.log('\n=== 5. POS Frontdesk Quick Cashier ===');
  await page.goto(`${BASE}/pos/frontdesk-quick`, { waitUntil: 'networkidle', timeout: 30000 });
  await wait(3000);
  check('POS frontdesk quick page loaded', !page.url().includes('/login'));

  // --- Step 6: API: POS candidates ---
  console.log('\n=== 6. API: POS Candidates ===');
  try {
    const posResp = await page.evaluate(async () => {
      const resp = await fetch('/api/v1/pos/frontdesk-quick/candidates?patientId=demo', {
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      });
      return { status: resp.status, data: await resp.json() };
    });
    console.log(`  API status: ${posResp.status}`);
    check('POS candidates API accessible', posResp.status < 500);
  } catch (e) {
    console.log(`  API error: ${e.message}`);
    check('POS candidates API accessible', false);
  }

  // --- Step 7: Navigate to Clinical Catalog ---
  console.log('\n=== 7. Clinical Catalog ===');
  await page.goto(`${BASE}/platform/clinical-catalog`, { waitUntil: 'networkidle', timeout: 30000 });
  await wait(3000);
  check('clinical catalog page loaded', !page.url().includes('/login'));

  // --- Step 8: API: Clinical Catalog ---
  console.log('\n=== 8. API: Clinical Catalog Items ===');
  try {
    const catResp = await page.evaluate(async () => {
      const resp = await fetch('/api/v1/platform/clinical-catalog/items?perPage=5', {
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      });
      return { status: resp.status, data: await resp.json() };
    });
    console.log(`  API status: ${catResp.status}`);
    if (catResp.data?.data) {
      console.log(`  Items found: ${catResp.data.data.length}`);
      catResp.data.data.forEach(item => {
        console.log(`    ${item.code} | ${item.name} | ${item.catalogType}`);
      });
    }
    check('clinical catalog API accessible', catResp.status < 500);
  } catch (e) {
    console.log(`  API error: ${e.message}`);
    check('clinical catalog API accessible', false);
  }

  // --- Summary ---
  console.log(`\n=== SUMMARY ===`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(failed === 0 ? 'ALL SMOKE TESTS PASSED' : 'SOME TESTS FAILED');

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
