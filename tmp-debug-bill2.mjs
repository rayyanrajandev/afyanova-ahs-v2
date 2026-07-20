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

  const ts = Date.now().toString().slice(-6);

  // Create a billing item
  const lab = await page.request.post(`${BASE}/api/v1/platform/admin/clinical-catalogs/lab-tests`, {
    headers, data: { code: `DBG-BILL-${ts}`, name: `DBG Bill Test ${ts}`, category: 'hematology', unit: 'test', facilityTier: 'dispensary' }
  });
  const labJson = await lab.json();
  const catId = labJson.data?.id;
  console.log(`Catalog item: ${catId}`);

  const bill = await page.request.post(`${BASE}/api/v1/billing-service-catalog/items`, {
    headers, data: { clinicalCatalogItemId: catId, serviceCode: `DBG-BILL-SVC-${ts}`, serviceName: `DBG Bill Service ${ts}`, serviceType: 'laboratory', basePrice: 10000, currencyCode: 'TZS', isTaxable: false }
  });
  console.log(`Create billing status: ${bill.status()}`);
  const billJson = await bill.json();
  console.log(`Create response: ${JSON.stringify(billJson).slice(0, 300)}`);

  // List immediately
  const list = await page.request.get(`${BASE}/api/v1/billing-service-catalog/items?perPage=200`, { headers });
  const listJson = await list.json();
  const items = listJson.data || [];
  console.log(`\nListed ${items.length} items:`);
  for (const item of items) {
    console.log(`  code="${item.serviceCode}" name="${item.serviceName}" catalogId=${item.clinicalCatalogItemId}`);
  }

  // Also try listing by specific catalog ID
  const list2 = await page.request.get(`${BASE}/api/v1/billing-service-catalog/items?clinicalCatalogItemId=${catId}`, { headers });
  const listJson2 = await list2.json();
  console.log(`\nFiltered by catalog ID (${catId}): ${JSON.stringify(listJson2).slice(0, 300)}`);

  await browser.close();
}
main().catch(console.error);
