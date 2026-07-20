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
  await page.fill('input[name="email"]', 'verify-agent@local.test');
  await page.fill('input[name="password"]', 'VerifyPass123!');
  await page.click('[data-test="login-button"]');
  await new Promise(r => setTimeout(r, 3000));
  console.log(`After login: ${page.url()}`);

  await context.addCookies([
    { name: 'platform_tenant_code', value: 'TZH', url: 'https://afyanova-ahs-v2.test' },
    { name: 'platform_facility_code', value: 'AFYANOVA', url: 'https://afyanova-ahs-v2.test' },
  ]);

  const BASE = 'https://afyanova-ahs-v2.test';
  const ts = Date.now().toString().slice(-6);

  // Helper to build CSRF headers
  async function getHeaders() {
    const cookies = await context.cookies();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (xsrf) {
      headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
      console.log(`XSRF token found: ${xsrf.slice(0, 20)}...`);
    } else {
      console.log('XSRF token NOT FOUND in cookies');
    }
    return headers;
  }

  const headers = await getHeaders();

  // 1. Create Lab Test
  console.log('\n=== CREATE LAB TEST ===');
  const labResp = await page.request.post(`${BASE}/api/v1/platform/admin/clinical-catalogs/lab-tests`, {
    headers,
    data: {
      code: `DBG4-CBC-${ts}`,
      name: `DEBUG4 CBC ${ts}`,
      departmentId: null,
      category: 'hematology',
      unit: 'test',
      description: 'Debug test 4',
      facilityTier: 'dispensary',
      codes: { LOCAL: 'CBC', LOINC: '58410-2' },
    },
  });
  console.log(`Status: ${labResp.status()}`);
  const labText = await labResp.text();
  console.log(`Response (first 300): ${labText.slice(0, 300)}`);

  // 2. Create Warehouse
  console.log('\n=== CREATE WAREHOUSE ===');
  const whResp = await page.request.post(`${BASE}/api/v1/inventory-procurement/warehouses`, {
    headers,
    data: {
      warehouseCode: `DBG4-WH-${ts}`,
      warehouseName: `DEBUG4 WH ${ts}`,
      warehouseType: 'main_store',
      location: 'Debug',
      contactPerson: 'Debug',
      phone: '+255700999999',
    },
  });
  console.log(`Status: ${whResp.status()}`);
  const whText = await whResp.text();
  console.log(`Response (first 300): ${whText.slice(0, 300)}`);

  // 3. Navigate to the encounter page to inspect what buttons exist
  console.log('\n=== ENCOUNTER PAGE BUTTONS ===');
  
  // First, let's look at the encounter page source
  await page.goto(`${BASE}/encounters`, { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  console.log(`Encounters list URL: ${page.url()}`);
  
  const bodyText = await page.textContent('body');
  // Look for encounter-related text
  const searchTerms = ['encounter', 'Encounter', 'New Encounter', 'Create Encounter', '+'];
  for (const term of searchTerms) {
    if (bodyText.includes(term)) console.log(`  Found "${term}" on page`);
  }

  // Count all links and buttons
  const links = page.locator('a');
  const linkCount = await links.count();
  console.log(`Total links: ${linkCount}`);
  for (let i = 0; i < Math.min(linkCount, 15); i++) {
    const text = await links.nth(i).textContent();
    if (text && text.trim()) console.log(`  Link ${i}: "${text.trim().slice(0, 60)}"`);
  }

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(err => { console.error(err); process.exit(1); });
