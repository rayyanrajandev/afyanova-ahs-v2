import { chromium } from 'playwright';

const BASE = 'http://afyanova-ahs-v2.test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[name="email"]', 'verify-agent@local.test');
  await page.fill('input[name="password"]', 'VerifyPass123!');
  await page.click('[data-test="login-button"]');
  await new Promise(r => setTimeout(r, 3000));

  await context.addCookies([
    { name: 'platform_tenant_code', value: 'TZH', url: BASE },
    { name: 'platform_facility_code', value: 'AFYANOVA', url: BASE },
  ]);

  // Helper to read CSRF from the page context cookies
  async function apiHeaders() {
    const cookies = await context.cookies();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (xsrf) {
      headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    }
    return headers;
  }

  // 1. Create Lab Test using page.request
  console.log('\n=== CREATE LAB TEST ===');
  const ts = Date.now().toString().slice(-6);
  const headers = await apiHeaders();
  
  const labResp = await page.request.post(`${BASE}/api/v1/platform/admin/clinical-catalogs/lab-tests`, {
    headers,
    data: {
      code: `DBG2-CBC-${ts}`,
      name: `DEBUG2 CBC ${ts}`,
      departmentId: null,
      category: 'hematology',
      unit: 'test',
      description: 'Debug test 2',
      facilityTier: 'dispensary',
      codes: { LOCAL: 'CBC', LOINC: '58410-2' },
    },
  });
  console.log(`Status: ${labResp.status()}`);
  const labJson = await labResp.json();
  console.log(`Response keys: ${Object.keys(labJson).join(', ')}`);
  console.log(`Full:`, JSON.stringify(labJson, null, 2).slice(0, 500));
  const labId = labJson.id || labJson.data?.id;
  console.log(`Lab ID: ${labId}`);

  // 2. Create billable service
  console.log('\n=== CREATE BILLABLE SERVICE ===');
  const billResp = await page.request.post(`${BASE}/api/v1/billing-service-catalog/items`, {
    headers,
    data: {
      clinicalCatalogItemId: labId,
      serviceCode: `DBG2-BILL-${ts}`,
      serviceName: `DEBUG2 Bill ${ts}`,
      serviceType: 'laboratory',
      basePrice: 15000,
      currencyCode: 'TZS',
      isTaxable: false,
    },
  });
  console.log(`Status: ${billResp.status()}`);
  const billJson = await billResp.json();
  console.log(`Full:`, JSON.stringify(billJson, null, 2).slice(0, 500));

  // 3. Create warehouse
  console.log('\n=== CREATE WAREHOUSE ===');
  const whResp = await page.request.post(`${BASE}/api/v1/inventory-procurement/warehouses`, {
    headers,
    data: {
      warehouseCode: `DBG2-WH-${ts}`,
      warehouseName: `DEBUG2 WH ${ts}`,
      warehouseType: 'main_store',
      location: 'Debug',
      contactPerson: 'Debug',
      phone: '+255700999999',
    },
  });
  console.log(`Status: ${whResp.status()}`);
  const whJson = await whResp.json();
  console.log(`Full:`, JSON.stringify(whJson, null, 2).slice(0, 500));

  // 4. Create supplier
  console.log('\n=== CREATE SUPPLIER ===');
  const supResp = await page.request.post(`${BASE}/api/v1/inventory-procurement/suppliers`, {
    headers,
    data: {
      supplierCode: `DBG2-SUP-${ts}`,
      supplierName: `DEBUG2 SUP ${ts}`,
      contactPerson: 'Debug',
      phone: '+255700888888',
      countryCode: 'TZ',
    },
  });
  console.log(`Status: ${supResp.status()}`);
  const supJson = await supResp.json();
  console.log(`Full:`, JSON.stringify(supJson, null, 2).slice(0, 500));

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(err => { console.error(err); process.exit(1); });
