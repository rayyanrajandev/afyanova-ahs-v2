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

  // Helper
  async function api(method, path, body = null) {
    const result = await page.evaluate(async ({ method, path, body }) => {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
      const opts = {
        method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': csrf,
        },
        credentials: 'same-origin',
      };
      if (body) opts.body = JSON.stringify(body);
      const resp = await fetch(path, opts);
      const text = await resp.text();
      let data = null;
      try { data = JSON.parse(text); } catch(e) { data = text; }
      return { status: resp.status, body: data };
    }, { method, path, body });
    return result;
  }

  // 1. Create Lab Test - check response shape
  console.log('\n=== CREATE LAB TEST ===');
  const ts = Date.now().toString().slice(-6);
  const lab = await api('POST', '/api/v1/platform/admin/clinical-catalogs/lab-tests', {
    code: `DBG-CBC-${ts}`,
    name: `DEBUG CBC ${ts}`,
    departmentId: null,
    category: 'hematology',
    unit: 'test',
    description: 'Debug test',
    facilityTier: 'dispensary',
    codes: { LOCAL: 'CBC', LOINC: '58410-2' },
  });
  console.log(`Status: ${lab.status}`);
  console.log(`Response keys: ${Object.keys(lab.body || {})}`);
  console.log(`Full response:`, JSON.stringify(lab.body, null, 2).slice(0, 1000));
  const labId = lab.body?.id || lab.body?.data?.id;
  console.log(`Extracted ID: ${labId}`);

  // 2. Create Billable Service - check response and link
  console.log('\n=== CREATE BILLABLE SERVICE ===');
  const bill = await api('POST', '/api/v1/billing-service-catalog/items', {
    clinicalCatalogItemId: labId,
    serviceCode: `DBG-BILL-${ts}`,
    serviceName: `DEBUG Bill ${ts}`,
    serviceType: 'laboratory',
    basePrice: 15000,
    currencyCode: 'TZS',
    isTaxable: false,
  });
  console.log(`Status: ${bill.status}`);
  console.log(`Response:`, JSON.stringify(bill.body, null, 2).slice(0, 1000));
  const billId = bill.body?.id || bill.body?.data?.id || bill.body?.data?.data?.id;
  console.log(`Extracted ID: ${billId}`);

  // 3. List billing items to check the link
  console.log('\n=== LIST BILLING ITEMS ===');
  const billList = await api('GET', '/api/v1/billing-service-catalog/items?perPage=10');
  const items = billList.body?.data || [];
  console.log(`Items count: ${items.length}`);
  const ourItem = items.find(i => i.serviceCode === `DBG-BILL-${ts}`);
  if (ourItem) {
    console.log(`Found item: clinicalCatalogItemId=${ourItem.clinicalCatalogItemId}, expected=${labId}`);
    console.log(`Item keys: ${Object.keys(ourItem).join(', ')}`);
  }

  // 4. Create inventory item - check required fields
  console.log('\n=== CREATE WAREHOUSE ===');
  const wh = await api('POST', '/api/v1/inventory-procurement/warehouses', {
    warehouseCode: `DBG-WH-${ts}`,
    warehouseName: `DEBUG Warehouse ${ts}`,
    warehouseType: 'main_store',
    location: 'Debug',
    contactPerson: 'Debug',
    phone: '+255700999999',
  });
  console.log(`Status: ${wh.status}`);
  console.log(`Response:`, JSON.stringify(wh.body, null, 2).slice(0, 500));
  const whId = wh.body?.id || wh.body?.data?.id;
  console.log(`Warehouse ID: ${whId}`);

  console.log('\n=== CREATE SUPPLIER ===');
  const sup = await api('POST', '/api/v1/inventory-procurement/suppliers', {
    supplierCode: `DBG-SUP-${ts}`,
    supplierName: `DEBUG Supplier ${ts}`,
    contactPerson: 'Debug',
    phone: '+255700888888',
    countryCode: 'TZ',
  });
  console.log(`Status: ${sup.status}`);
  console.log(`Response:`, JSON.stringify(sup.body, null, 2).slice(0, 500));
  const supId = sup.body?.id || sup.body?.data?.id;
  console.log(`Supplier ID: ${supId}`);

  console.log('\n=== CREATE INVENTORY ITEM ===');
  const inv = await api('POST', '/api/v1/inventory-procurement/items', {
    clinicalCatalogItemId: labId,
    itemCode: `DBG-INV-${ts}`,
    itemName: `DEBUG Blood Tube ${ts}`,
    category: 'consumable',
    unit: 'piece',
    defaultWarehouseId: whId,
    defaultSupplierId: supId,
  });
  console.log(`Status: ${inv.status}`);
  console.log(`Response:`, JSON.stringify(inv.body, null, 2).slice(0, 1000));
  const invId = inv.body?.data?.id || inv.body?.id;
  console.log(`Inventory ID: ${invId}`);

  // 5. Receive stock
  console.log('\n=== RECEIVE STOCK ===');
  const rcv = await api('POST', '/api/v1/inventory-procurement/stock-movements', {
    movementType: 'receive',
    itemId: invId,
    warehouseId: whId,
    quantity: 200,
    unit: 'piece',
    reason: 'Debug receipt',
    occurredAt: new Date().toISOString(),
  });
  console.log(`Status: ${rcv.status}`);
  console.log(`Response:`, JSON.stringify(rcv.body, null, 2).slice(0, 1000));

  // 6. Set consumption recipe
  console.log('\n=== SET CONSUMPTION RECIPE ===');
  const recipe = await api('PUT', `/api/v1/platform/admin/clinical-catalogs/lab-tests/${labId}/consumption-recipe`, {
    items: [{
      inventoryItemId: invId,
      quantityPerOrder: 1,
      unit: 'piece',
      wasteFactorPercent: 5,
      consumptionStage: 'collection',
    }],
  });
  console.log(`Status: ${recipe.status}`);
  console.log(`Response:`, JSON.stringify(recipe.body, null, 2).slice(0, 500));

  // 7. Check encounter workspace - what test selectors exist
  await page.goto(`${BASE}/patients`, { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  console.log('\n=== PATIENTS PAGE ===');
  console.log(`URL: ${page.url()}`);

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(err => { console.error(err); process.exit(1); });
