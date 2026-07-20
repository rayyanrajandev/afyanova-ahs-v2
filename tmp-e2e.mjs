import { chromium } from 'playwright';

const BASE = 'https://afyanova-ahs-v2.test';

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(label, ok, detail = '') {
  const icon = ok ? 'PASS' : 'FAIL';
  console.log(`  ${icon}: ${label}${detail ? ' — ' + detail : ''}`);
  return ok;
}

async function api(page, method, path, body = null) {
  return page.evaluate(async ({ method, path, body }) => {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    const opts = {
      method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(path, opts);
    const data = await resp.json();
    return { status: resp.status, data };
  }, { method, path, body });
}

async function apiGet(page, path) {
  return api(page, 'GET', path);
}

async function apiPost(page, path, body) {
  return api(page, 'POST', path, body);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  let passed = 0, failed = 0;

  // ─── LOGIN ──────────────────────────────────────────────────
  console.log('\n=== STEP 1: LOGIN ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'verify-agent@local.test');
  await page.fill('input[type="password"]', 'VerifyPass123!');
  await page.click('button[type="submit"]');
  await wait(3000);
  const ok1 = !page.url().includes('/login');
  if (ok1) passed++; else failed++;
  log('Login successful', ok1);
  if (!ok1) { await browser.close(); return; }

  // ─── CREATE CLINICAL CATALOG ITEMS ─────────────────────────
  console.log('\n=== STEP 2: CREATE CLINICAL CATALOG ITEMS ===');

  // 2a. Lab Test
  console.log('\n--- 2a. Lab Test (CBC) ---');
  const lab = await apiPost(page, '/api/v1/platform/admin/clinical-catalogs/lab-tests', {
    code: 'E2E-LAB-CBC', name: 'E2E Complete Blood Count',
    departmentId: null, category: 'hematology', unit: 'panel',
    description: 'E2E test lab panel', facilityTier: 'dispensary',
    codes: { LOCAL: 'CBC', LOINC: '58410-2' },
    metadata: { sampleType: 'blood', specimenContainer: 'purple_top', turnaroundHours: 4, fastingRequired: false }
  });
  const labId = lab.data?.id;
  log('Create Lab Test', lab.status < 400 && !!labId, `status=${lab.status}, id=${labId}`);
  if (lab.status < 400 && labId) passed++; else failed++;

  // 2b. Radiology Procedure
  console.log('\n--- 2b. Radiology Procedure (Chest X-Ray) ---');
  const rad = await apiPost(page, '/api/v1/platform/admin/clinical-catalogs/radiology-procedures', {
    code: 'E2E-RAD-XR-CHEST', name: 'E2E Chest X-Ray',
    departmentId: null, category: 'general_radiography', unit: 'study',
    description: 'E2E test chest x-ray', facilityTier: 'dispensary',
    codes: { LOCAL: 'CXR', LOINC: '18748-4' },
    metadata: { modality: 'x-ray', bodySite: 'chest', contrastRequired: false, studyDurationMinutes: 15 }
  });
  const radId = rad.data?.id;
  log('Create Radiology Procedure', rad.status < 400 && !!radId, `status=${rad.status}, id=${radId}`);
  if (rad.status < 400 && radId) passed++; else failed++;

  // 2c. Theatre Procedure
  console.log('\n--- 2c. Theatre Procedure (Appendectomy) ---');
  const thr = await apiPost(page, '/api/v1/platform/admin/clinical-catalogs/theatre-procedures', {
    code: 'E2E-THR-APPEND', name: 'E2E Appendectomy',
    departmentId: null, category: 'general_surgery', unit: 'procedure',
    description: 'E2E test appendectomy', facilityTier: 'health_centre',
    codes: { LOCAL: 'APPEND', CPT: '44970' },
    metadata: { procedureClass: 'major', anesthesiaType: 'general', expectedDurationMinutes: 60, sterilePrepRequired: true }
  });
  const thrId = thr.data?.id;
  log('Create Theatre Procedure', thr.status < 400 && !!thrId, `status=${thr.status}, id=${thrId}`);
  if (thr.status < 400 && thrId) passed++; else failed++;

  // 2d. Formulary Item
  console.log('\n--- 2d. Formulary Item (Amoxicillin 500mg) ---');
  const frm = await apiPost(page, '/api/v1/platform/admin/clinical-catalogs/formulary-items', {
    code: 'E2E-FRM-AMOX-500', name: 'E2E Amoxicillin 500mg Capsule',
    departmentId: null, category: 'antibiotic', unit: 'capsule',
    description: 'E2E test amoxicillin', facilityTier: 'dispensary',
    codes: { LOCAL: 'AMOX500', MSD: 'AMOX500MG' },
    metadata: { strength: '500mg', dosageForm: 'capsule', route: 'oral', otcAllowed: false, packSize: 100, stockUnit: 'capsule', conversionFactor: 1, purchaseUnit: 'bottle', purchaseUnitQuantity: 100 }
  });
  const frmId = frm.data?.id;
  log('Create Formulary Item', frm.status < 400 && !!frmId, `status=${frm.status}, id=${frmId}`);
  if (frm.status < 400 && frmId) passed++; else failed++;

  // ─── VERIFY CLINICAL CATALOG ITEMS ──────────────────────────
  console.log('\n=== STEP 3: VERIFY CLINICAL CATALOG ===');
  const labList = await apiGet(page, '/api/v1/platform/admin/clinical-catalogs/lab-tests?perPage=100');
  const labItems = labList.data?.data || [];
  const ourItem = labItems.find(i => i.code === 'E2E-LAB-CBC');
  log('Lab test listed with catalogType', ourItem?.catalogType === 'lab-tests', `catalogType=${ourItem?.catalogType}`);
  if (ourItem?.catalogType === 'lab-tests') passed++; else failed++;
  log('Lab test has billingLinkStatus', 'billingLinkStatus' in (ourItem || {}), `status=${ourItem?.billingLinkStatus}`);
  if ('billingLinkStatus' in (ourItem || {})) passed++; else failed++;

  // ─── CREATE BILLING SERVICE CATALOG ITEMS ──────────────────
  console.log('\n=== STEP 4: CREATE BILLING SERVICES ===');

  if (labId) {
    const billLab = await apiPost(page, '/api/v1/billing-service-catalog/items', {
      clinicalCatalogItemId: labId, serviceCode: 'E2E-BILL-LAB-CBC',
      serviceName: 'E2E CBC Lab Service', serviceType: 'laboratory',
      departmentId: null, unit: 'test', basePrice: 15000,
      currencyCode: 'TZS', isTaxable: false,
      effectiveFrom: '2026-01-01T00:00:00Z', facilityTier: 'dispensary',
      description: 'E2E billing service for CBC'
    });
    const billLabId = billLab.data?.data?.id || billLab.data?.id;
    log('Create Lab Billing Service', billLab.status < 400 && !!billLabId, `status=${billLab.status}, id=${billLabId}`);
    if (billLab.status < 400 && billLabId) passed++; else failed++;
  }

  if (radId) {
    const billRad = await apiPost(page, '/api/v1/billing-service-catalog/items', {
      clinicalCatalogItemId: radId, serviceCode: 'E2E-BILL-RAD-CXR',
      serviceName: 'E2E Chest X-Ray Service', serviceType: 'radiology',
      departmentId: null, unit: 'study', basePrice: 35000,
      currencyCode: 'TZS', isTaxable: false,
      effectiveFrom: '2026-01-01T00:00:00Z', facilityTier: 'dispensary',
      description: 'E2E billing service for chest x-ray'
    });
    const billRadId = billRad.data?.data?.id || billRad.data?.id;
    log('Create Radiology Billing Service', billRad.status < 400 && !!billRadId, `status=${billRad.status}, id=${billRadId}`);
    if (billRad.status < 400 && billRadId) passed++; else failed++;
  }

  if (thrId) {
    const billThr = await apiPost(page, '/api/v1/billing-service-catalog/items', {
      clinicalCatalogItemId: thrId, serviceCode: 'E2E-BILL-THR-APP',
      serviceName: 'E2E Appendectomy Service', serviceType: 'procedures',
      departmentId: null, unit: 'procedure', basePrice: 250000,
      currencyCode: 'TZS', isTaxable: true, taxRatePercent: 18,
      effectiveFrom: '2026-01-01T00:00:00Z', facilityTier: 'health_centre',
      description: 'E2E billing service for appendectomy'
    });
    const billThrId = billThr.data?.data?.id || billThr.data?.id;
    log('Create Theatre Billing Service', billThr.status < 400 && !!billThrId, `status=${billThr.status}, id=${billThrId}`);
    if (billThr.status < 400 && billThrId) passed++; else failed++;
  }

  if (frmId) {
    const billPharm = await apiPost(page, '/api/v1/billing-service-catalog/items', {
      clinicalCatalogItemId: frmId, serviceCode: 'E2E-BILL-PHR-AMOX',
      serviceName: 'E2E Amoxicillin 500mg Service', serviceType: 'pharmacy',
      departmentId: null, unit: 'capsule', basePrice: 500,
      currencyCode: 'TZS', isTaxable: false,
      effectiveFrom: '2026-01-01T00:00:00Z', facilityTier: 'dispensary',
      description: 'E2E billing service for amoxicillin'
    });
    const billPharmId = billPharm.data?.data?.id || billPharm.data?.id;
    log('Create Pharmacy Billing Service', billPharm.status < 400 && !!billPharmId, `status=${billPharm.status}, id=${billPharmId}`);
    if (billPharm.status < 400 && billPharmId) passed++; else failed++;
  }

  // ─── VERIFY BILLING SERVICES ───────────────────────────────
  console.log('\n=== STEP 5: VERIFY BILLING SERVICES ===');
  const billList = await apiGet(page, '/api/v1/billing-service-catalog/items?perPage=100');
  const billItems = billList.data?.data || [];
  const labBillItem = billItems.find(i => i.serviceCode === 'E2E-BILL-LAB-CBC');
  log('Lab billing linked to clinical catalog', !!labBillItem?.clinicalCatalogItemId, `id=${labBillItem?.clinicalCatalogItemId}`);
  if (!!labBillItem?.clinicalCatalogItemId) passed++; else failed++;
  log('Lab billing has correct price', labBillItem?.basePrice == 15000, `price=${labBillItem?.basePrice}`);
  if (labBillItem?.basePrice == 15000) passed++; else failed++;

  // Check serviceType counts
  const typeCounts = await apiGet(page, '/api/v1/billing-service-catalog/items/service-type-counts');
  log('Billing service type counts accessible', typeCounts.status < 400, `status=${typeCounts.status}`);
  if (typeCounts.status < 400) passed++; else failed++;

  // ─── CREATE WAREHOUSE ──────────────────────────────────────
  console.log('\n=== STEP 6: CREATE WAREHOUSE & INVENTORY ITEM ===');
  let warehouseId = null;
  const whList = await apiGet(page, '/api/v1/inventory-procurement/warehouses?perPage=10');
  const whData = whList.data?.data || [];
  log('Warehouses API accessible', whList.status < 400, `status=${whList.status}, count=${whData.length}`);
  if (whList.status < 400) passed++; else failed++;

  if (whData.length > 0) {
    warehouseId = whData[0].id;
    log('Found existing warehouse', true, `id=${warehouseId}`);
    passed++;
  } else {
    // Create one
    const wh = await apiPost(page, '/api/v1/inventory-procurement/warehouses', {
      code: 'E2E-MAIN-WH', name: 'E2E Main Warehouse',
      type: 'main_store', facilityTier: 'dispensary',
      description: 'E2E test warehouse'
    });
    warehouseId = wh.data?.id;
    log('Create warehouse', !!warehouseId, `id=${warehouseId}`);
    if (warehouseId) passed++; else failed++;
  }

  // ─── CREATE INVENTORY ITEM ─────────────────────────────────
  if (frmId && warehouseId) {
    const inv = await apiPost(page, '/api/v1/inventory-procurement/items', {
      clinicalCatalogItemId: frmId, itemCode: 'E2E-INV-AMOX-500',
      itemName: 'E2E Amoxicillin 500mg Capsules', genericName: 'Amoxicillin',
      dosageForm: 'capsule', strength: '500mg', category: 'pharmaceutical',
      subcategory: 'antibiotic', venClassification: 'essential',
      abcClassification: 'A', unit: 'capsule', dispensingUnit: 'capsule',
      conversionFactor: 1, binLocation: 'A-01-01', manufacturer: 'E2E Pharma',
      storageConditions: 'Store below 25°C', requiresColdChain: false,
      isControlledSubstance: false, reorderLevel: 100, maxStockLevel: 1000,
      defaultWarehouseId: warehouseId, barcode: 'E2E1234567890'
    });
    const invId = inv.data?.data?.id || inv.data?.id;
    log('Create Inventory Item', inv.status < 400 && !!invId, `status=${inv.status}, id=${invId}`);
    if (inv.status < 400 && invId) passed++; else failed++;

    // Verify
    const invList2 = await apiGet(page, '/api/v1/inventory-procurement/items?perPage=100');
    const invItems2 = invList2.data?.data || [];
    const ourInv = invItems2.find(i => i.itemCode === 'E2E-INV-AMOX-500');
    log('Inventory item listed', !!ourInv, `itemCode=${ourInv?.itemCode}, category=${ourInv?.category}`);
    if (!!ourInv) passed++; else failed++;
  } else {
    log('Create Inventory Item (skipped — missing dependencies)', false, `frmId=${frmId}, whId=${warehouseId}`);
    failed++;
  }

  // ─── CHECK PAGES LOAD ──────────────────────────────────────
  console.log('\n=== STEP 7: VERIFY FRONTEND PAGES ===');
  await page.goto(`${BASE}/billing/charge-capture`, { waitUntil: 'networkidle', timeout: 30000 }); await wait(2000);
  log('Charge capture page loads', !page.url().includes('/login'));
  if (!page.url().includes('/login')) passed++; else failed++;

  await page.goto(`${BASE}/pos/frontdesk-quick`, { waitUntil: 'networkidle', timeout: 30000 }); await wait(2000);
  log('POS frontdesk quick page loads', !page.url().includes('/login'));
  if (!page.url().includes('/login')) passed++; else failed++;

  await page.goto(`${BASE}/billing-service-catalog`, { waitUntil: 'networkidle', timeout: 30000 }); await wait(2000);
  log('Billing service catalog page loads', !page.url().includes('/login'));
  if (!page.url().includes('/login')) passed++; else failed++;

  await page.goto(`${BASE}/platform/admin/clinical-catalogs`, { waitUntil: 'networkidle', timeout: 30000 }); await wait(2000);
  log('Clinical catalog admin page loads', !page.url().includes('/login'));
  if (!page.url().includes('/login')) passed++; else failed++;

  await page.goto(`${BASE}/inventory-procurement/stock-control`, { waitUntil: 'networkidle', timeout: 30000 }); await wait(2000);
  log('Inventory stock control page loads', !page.url().includes('/login'));
  if (!page.url().includes('/login')) passed++; else failed++;

  // ─── SUMMARY ────────────────────────────────────────────────
  console.log(`\n${'='.repeat(50)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(failed === 0 ? 'ALL E2E TESTS PASSED' : 'SOME TESTS FAILED');

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
