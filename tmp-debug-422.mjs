import { chromium } from 'playwright';

const BASE = 'https://afyanova-ahs-v2.test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
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

  const cookies = await context.cookies();
  const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value;
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
  };

  const ts = Date.now().toString().slice(-6);

  // Create test data first
  // Lab test
  const lab = await page.request.post(`${BASE}/api/v1/platform/admin/clinical-catalogs/lab-tests`, {
    headers, data: { code: `D422-CBC-${ts}`, name: `D422 CBC ${ts}`, category: 'hematology', unit: 'test', facilityTier: 'dispensary' }
  });
  const labJson = await lab.json();
  const catId = labJson.data.id;
  console.log(`Catalog item: ${catId}`);

  // Warehouse
  const wh = await page.request.post(`${BASE}/api/v1/inventory-procurement/warehouses`, {
    headers, data: { warehouseCode: `D422-WH-${ts}`, warehouseName: `D422 WH ${ts}`, warehouseType: 'main_store' }
  });
  const whJson = await wh.json();
  const whId = whJson.data.id;
  console.log(`Warehouse: ${whId}`);

  // Supplier
  const sup = await page.request.post(`${BASE}/api/v1/inventory-procurement/suppliers`, {
    headers, data: { supplierCode: `D422-SUP-${ts}`, supplierName: `D422 SUP ${ts}`, contactPerson: 'Test', phone: '+255700111111', countryCode: 'TZ' }
  });
  const supJson = await sup.json();
  const supId = supJson.data.id;
  console.log(`Supplier: ${supId}`);

  // Inventory item
  const inv = await page.request.post(`${BASE}/api/v1/inventory-procurement/items`, {
    headers, data: {
      clinicalCatalogItemId: catId,
      itemCode: `D422-INV-${ts}`, itemName: `D422 Tube ${ts}`,
      category: 'consumable', unit: 'piece',
      defaultWarehouseId: whId, defaultSupplierId: supId,
    }
  });
  console.log(`\n=== CREATE INVENTORY ITEM ===`);
  console.log(`Status: ${inv.status()}`);
  const invText = await inv.text();
  console.log(`Response: ${invText.slice(0, 400)}`);

  let invId;
  try {
    const invJson = JSON.parse(invText);
    invId = invJson.data?.id || invJson.id;
    console.log(`Inv ID: ${invId}`);
  } catch(e) {
    console.log(`Could not parse JSON`);
  }

  // Receive stock - debug the 422
  if (invId) {
    const rcv = await page.request.post(`${BASE}/api/v1/inventory-procurement/stock-movements`, {
      headers,
      data: {
        movementType: 'receive',
        itemId: invId,
        warehouseId: whId,
        quantity: 200,
        unit: 'piece',
        reason: 'Debug receipt - initial stock',
      }
    });
    console.log(`\n=== RECEIVE STOCK ===`);
    console.log(`Status: ${rcv.status()}`);
    if (rcv.status() === 422) {
      const rcvJson = await rcv.json();
      console.log(`422 Errors: ${JSON.stringify(rcvJson)}`);
    } else {
      console.log(`Response: ${(await rcv.text()).slice(0, 400)}`);
    }

    // Consumption recipe
    const recipe = await page.request.put(
      `${BASE}/api/v1/platform/admin/clinical-catalogs/lab-tests/${catId}/consumption-recipe`,
      { headers, data: { items: [{ inventoryItemId: invId, quantityPerOrder: 1, unit: 'piece' }] } }
    );
    console.log(`\n=== CONSUMPTION RECIPE ===`);
    console.log(`Status: ${recipe.status()}`);
    if (recipe.status() === 422) {
      console.log(`422 Errors: ${JSON.stringify(await recipe.json())}`);
    } else {
      console.log(`Response: ${(await recipe.text()).slice(0, 400)}`);
    }
  }

  // Check billing list response format
  console.log(`\n=== BILLING LIST FORMAT ===`);
  const billList = await page.request.get(`${BASE}/api/v1/billing-service-catalog/items?perPage=5`, { headers });
  const billJson = await billList.json();
  console.log(`Top-level keys: ${Object.keys(billJson).join(', ')}`);
  console.log(`data is Array: ${Array.isArray(billJson.data)}`);
  if (Array.isArray(billJson.data) && billJson.data.length > 0) {
    console.log(`First item keys: ${Object.keys(billJson.data[0]).join(', ')}`);
  } else if (billJson.data?.data) {
    console.log(`Nested data.data is Array: ${Array.isArray(billJson.data.data)}`);
  }

  // Encounter workspace HTML dump
  console.log(`\n=== ENCOUNTER WORKSPACE HTML ===`);
  
  // Create patient + encounter
  const pat = await page.request.post(`${BASE}/api/v1/patients`, {
    headers, data: { firstName: 'Debug', lastName: `Enc${ts}`, gender: 'female', dateOfBirth: '1990-01-01', phone: `+255700${ts}99`, countryCode: 'TZ', region: 'Dar es Salaam', district: 'Kinondoni' }
  });
  const patId = (await pat.json()).data.id;
  
  const apt = await page.request.post(`${BASE}/api/v1/appointments`, {
    headers, data: { patientId: patId, department: 'General Medicine', scheduledAt: new Date().toISOString(), durationMinutes: 30, reason: 'Debug' }
  });
  const aptId = (await apt.json()).data.id;
  
  const mr = await page.request.post(`${BASE}/api/v1/medical-records`, {
    headers, data: { patientId: patId, appointmentId: aptId, recordType: 'consultation_note', encounterAt: new Date().toISOString(), subjective: 'Test', objective: 'Test', assessment: 'Test', plan: 'Test' }
  });
  const mrJson = await mr.json();
  const encId = mrJson.data?.encounterId || mrJson.encounterId;
  console.log(`Encounter ID: ${encId}`);

  // Navigate to encounter workspace
  await page.goto(`${BASE}/encounters/${encId}`, { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  console.log(`\nPage URL: ${page.url()}`);
  
  // Dump key sections of the page to understand the layout
  const body = await page.textContent('body');
  
  // Look for encounter-specific text
  const keywords = ['Orders', 'Lab', 'Clinical', 'Notes', 'Patient', 'Encounter', 'order', 'command'];
  for (const keyword of keywords) {
    const found = body.includes(keyword);
    if (found) console.log(`  Found "${keyword}" on page`);
  }
  
  // Check for all buttons
  const buttons = page.locator('button');
  const btnCount = await buttons.count();
  console.log(`\nButtons on page (${btnCount}):`);
  for (let i = 0; i < Math.min(btnCount, 50); i++) {
    const text = (await buttons.nth(i).textContent() || '').trim().slice(0, 60);
    if (text) console.log(`  [${i}] "${text}"`);
  }

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(err => { console.error(err); process.exit(1); });
