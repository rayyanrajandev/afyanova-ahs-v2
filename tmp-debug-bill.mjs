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

  const xsrf = (await context.cookies()).find(c => c.name === 'XSRF-TOKEN')?.value;
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}) };

  // List billing items
  const billList = await page.request.get(`${BASE}/api/v1/billing-service-catalog/items?perPage=100`, { headers });
  const billJson = await billList.json();
  const items = billJson.data || [];
  console.log(`Total items: ${items.length}`);
  for (const item of items) {
    console.log(`  ${item.serviceCode}: clinicalCatalogItemId=${item.clinicalCatalogItemId}, serviceName=${item.serviceName}`);
  }

  await browser.close();
}
main().catch(console.error);
