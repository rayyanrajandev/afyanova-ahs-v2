import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Login via HTTPS
  await page.goto('https://afyanova-ahs-v2.test/login', { waitUntil: 'networkidle', timeout: 30000 });
  console.log(`After goto login: ${page.url()}`);
  
  await page.fill('input[name="email"]', 'verify-agent@local.test');
  await page.fill('input[name="password"]', 'VerifyPass123!');
  await page.click('[data-test="login-button"]');
  await new Promise(r => setTimeout(r, 3000));
  console.log(`After login: ${page.url()}`);

  // Check the actual base URL and cookies
  const cookies = await context.cookies();
  console.log('\nCookies:');
  cookies.forEach(c => console.log(`  ${c.name}: ${c.value.slice(0,30)}... (domain=${c.domain}, path=${c.path})`));

  // Set facility cookies for the correct domain
  await context.addCookies([
    { name: 'platform_tenant_code', value: 'TZH', url: 'https://afyanova-ahs-v2.test' },
    { name: 'platform_facility_code', value: 'AFYANOVA', url: 'https://afyanova-ahs-v2.test' },
  ]);

  // Determine the protocol
  const BASE = page.url().startsWith('https') ? 'https://afyanova-ahs-v2.test' : 'http://afyanova-ahs-v2.test';
  console.log(`\nUsing base: ${BASE}`);

  const ts = Date.now().toString().slice(-6);

  // 1. Create Lab Test
  console.log('\n=== CREATE LAB TEST ===');
  const labResp = await page.request.post(`${BASE}/api/v1/platform/admin/clinical-catalogs/lab-tests`, {
    data: {
      code: `DBG3-CBC-${ts}`,
      name: `DEBUG3 CBC ${ts}`,
      departmentId: null,
      category: 'hematology',
      unit: 'test',
      description: 'Debug test 3',
      facilityTier: 'dispensary',
      codes: { LOCAL: 'CBC', LOINC: '58410-2' },
    },
  });
  console.log(`Status: ${labResp.status()} ${labResp.statusText()}`);
  const labJson = await labResp.json();
  console.log(`Type:`, typeof labJson, Array.isArray(labJson) ? 'array' : 'object');
  console.log(`Keys: ${Object.keys(labJson).join(', ')}`);
  const content = JSON.stringify(labJson, null, 2);
  console.log(content.slice(0, 600));

  // 2. Create Billable Service
  console.log('\n=== CREATE BILLABLE SERVICE ===');
  const billResp = await page.request.post(`${BASE}/api/v1/billing-service-catalog/items`, {
    data: {
      clinicalCatalogItemId: '019f7f01-f757-716a-94cb-4741d6a2229b',
      serviceCode: `DBG3-BILL-${ts}`,
      serviceName: `DEBUG3 Bill ${ts}`,
      serviceType: 'laboratory',
      basePrice: 15000,
      currencyCode: 'TZS',
      isTaxable: false,
    },
  });
  console.log(`Status: ${billResp.status()} ${billResp.statusText()}`);
  const billJson = await billResp.json();
  console.log(JSON.stringify(billJson, null, 2).slice(0, 600));

  // 3. Create Warehouse
  console.log('\n=== CREATE WAREHOUSE ===');
  const whResp = await page.request.post(`${BASE}/api/v1/inventory-procurement/warehouses`, {
    data: {
      warehouseCode: `DBG3-WH-${ts}`,
      warehouseName: `DEBUG3 WH ${ts}`,
      warehouseType: 'main_store',
      location: 'Debug',
    },
  });
  console.log(`Status: ${whResp.status()} ${whResp.statusText()}`);
  const whJson = await whResp.json();
  console.log(JSON.stringify(whJson, null, 2).slice(0, 400));

  // 4. Test the encounter workspace page
  console.log('\n=== ENCOUNTER WORKSPACE STRUCTURE ===');
  await page.goto(`${BASE}/encounters/019f7f02-6879-70bc-9e4e-38244ed345a3`, { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  console.log(`URL: ${page.url()}`);

  // Check what's on the page
  const header = page.getByTestId('encounter-workspace-header');
  console.log(`Header testid count: ${await header.count()}`);
  
  const tabOrders = page.getByRole('tab', { name: /Orders & results/i });
  console.log(`Orders tab count: ${await tabOrders.count()}`);
  
  const labBtn = page.getByTestId('encounter-workspace-new-order');
  console.log(`Lab order button testid count: ${await labBtn.count()}`);

  // Check for any buttons with Lab in name
  const allBtns = page.locator('button');
  const btnCount = await allBtns.count();
  console.log(`Total buttons: ${btnCount}`);
  for (let i = 0; i < Math.min(btnCount, 30); i++) {
    const text = await allBtns.nth(i).textContent();
    if (text && text.trim()) console.log(`  Button ${i}: "${text.trim().slice(0, 50)}"`);
  }

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(err => { console.error(err); process.exit(1); });
