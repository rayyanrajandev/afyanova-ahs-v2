import { chromium } from 'playwright';
const BASE = 'https://afyanova-ahs-v2.test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[name="email"]', 'verify-agent@local.test');
  await page.fill('input[name="password"]', 'VerifyPass123!');
  await page.click('[data-test="login-button"]');
  await new Promise(r => setTimeout(r, 3000));

  await context.addCookies([
    { name: 'platform_tenant_code', value: 'TZH', url: BASE },
    { name: 'platform_facility_code', value: 'AFYANOVA', url: BASE },
  ]);

  const xsrf = (await context.cookies()).find(c => c.name === 'XSRF-TOKEN')?.value;
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}) };

  // Create a billing item with codes
  const ts = Date.now().toString().slice(-6);
  const lab = await page.request.post(`${BASE}/api/v1/platform/admin/clinical-catalogs/lab-tests`, { headers, data: { code: `CODES-${ts}`, name: `Codes Test ${ts}`, category: 'hematology', unit: 'test', facilityTier: 'dispensary' } });
  const catId = (await lab.json()).data.id;

  const bill = await page.request.post(`${BASE}/api/v1/billing-service-catalog/items`, { headers, data: { clinicalCatalogItemId: catId, serviceCode: `CODES-${ts}`, serviceName: `Codes Svc ${ts}`, serviceType: 'laboratory', basePrice: 9999, currencyCode: 'TZS', isTaxable: false, codes: { LOCAL: 'TEST-CODE', NHIF: 'NHIF-TEST' } } });
  console.log(`Create status: ${bill.status()}`);
  const billBody = await bill.json();
  console.log(`Create response codes field: ${JSON.stringify(billBody.data?.codes)}`);

  // List billing items to check the codes field structure
  const list = await page.request.get(`${BASE}/api/v1/billing-service-catalog/items?clinicalCatalogItemId=${catId}`, { headers });
  const listBody = await list.json();
  const items = listBody.data || [];
  for (const item of items) {
    console.log(`\nItem ${item.serviceCode}:`);
    console.log(`  codes: ${JSON.stringify(item.codes)}`);
    console.log(`  codes type: ${typeof item.codes}`);
    if (typeof item.codes === 'string') {
      try { console.log(`  parsed: ${JSON.stringify(JSON.parse(item.codes))}`); } catch {}
    }
    console.log(`  Full keys: ${Object.keys(item).join(', ')}`);
  }

  await browser.close();
}
main().catch(console.error);
