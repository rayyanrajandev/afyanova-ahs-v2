# Pharmacy Reports — Capability Audit

## Backend Data Readiness

| Report | Possible? | Why | What's Missing |
|--------|-----------|-----|----------------|
| **Stock Status** | ✅ Yes | `InventoryItemModel.current_stock` + reservation-aware `availability()` via `InventoryBatchStockService` | Nothing — ready to query |
| **Low Stock** | ✅ Yes | `current_stock <= reorder_level` threshold check. `stockAlertCounts()` repository method and `stockState()` service method exist | Nothing — ready to expose via API |
| **Out of Stock** | ✅ Yes | `current_stock <= 0`. Same `stockAlertCounts()` / `stockState()` infrastructure | Nothing |
| **Near Expiry** | ✅ Yes | `InventoryBatchModel.expiry_date` exists. `expiryWastage()` endpoint classifies `critical` (<=30d) and `warning` (<=90d) | No dedicated near-expiry-only endpoint (but trivial to add) |
| **Expired** | ✅ Yes | `isBatchIssueEligible()` blocks expired batches. `expiryWastage()` includes `expired` category | Nothing |
| **Overstock** | ⚠️ Partial | `max_stock_level` field exists on items | No "overstock" threshold logic. Would need a rule like `current_stock > max_stock_level * 1.2` (define threshold). No existing endpoint |
| **Slow Moving** | ⚠️ Partial | `consumptionTrends()` provides time-series issue data | No velocity model. Would need to compare consumption rate against stock level over a period (e.g., < 25% of stock consumed in 90 days = slow moving) |
| **Fast Moving** | ⚠️ Partial | Same consumption trends data | Same — needs a velocity classification endpoint |
| **Stock Valuation** | ⚠️ Partial | `InventoryBatchModel.unit_cost` records per-unit cost at receipt | No formal costing method (FIFO/WAC). Can compute `SUM(batch.quantity * batch.unit_cost)` for approximate valuation, but this is actual-cost, not a GAAP-standard method |
| **Batch Tracking** | ✅ Yes | Full batch lifecycle: batch_number, lot_number, manufacture_date, expiry_date, unit_cost, warehouse, supplier. FEFO allocation implemented | Nothing |
| **Dispensed Medicines** | ✅ Yes | `InventoryDispensingClaimLinkModel` ties pharmacy_order_id → stock_movement_id → item_id → batch_id → patient_id → cost. Every dispense creates a permanent record | Nothing |
| **Medicines by Diagnosis** | ❌ No | Encounters store diagnoses, pharmacy orders reference encounters, but there is no pre-built join across orders → encounter diagnoses. The diagnosis model structure would need investigation | No existing query path. Would need to map `PharmacyOrderModel.encounter_id` → `EncounterModel` → diagnosis records (data model for diagnoses would need auditing first) |
| **Medicines by Clinician** | ✅ Yes | `PharmacyOrderModel.ordered_by_user_id` captures the prescriber. Dispensing claim links can be grouped by order → user | No aggregation endpoint, but straightforward to add |
| **Antibiotic Usage** | ⚠️ Partial | `ClinicalCatalogItemModel` has `category` and `name` fields | No `is_antibiotic` flag on the catalog. Would need either: (a) a dedicated classification flag, or (b) name/category pattern matching (fragile), or (c) a reference table of antibiotic codes |
| **Controlled Drugs Register** | ✅ Yes | `ClinicalCatalogItemModel.is_controlled_substance` (bool) and `controlled_substance_schedule` (string). Dispensing claim links capture patient + batch | No register-style endpoint, but query is straightforward |
| **Prescription Trends** | ✅ Yes | `PharmacyOrderModel` has `ordered_at` / `signed_at` timestamps, status, and dosage fields. Group by time period | No aggregation endpoint, but trivial to add |
| **Pharmacy Sales** | ⚠️ Partial | `InventoryItemUnitPriceModel.price` per unit per payer contract. Dispensing claim links record quantity + patient | No sales aggregation. Would need to join dispense quantities with applicable price at time of dispense (pricing is contract/date-effective) |
| **Revenue** | ⚠️ Partial | `billing_invoice_id` on dispensing claim links links to billing | No revenue-by-pharmacy query. Would need to join dispensing → billing invoice line items, which adds complexity (not all dispenses may be billed) |
| **Profit Margin** | ❌ No | Batch cost + sales price exist separately | Would need a cost-of-goods-sold model: match each dispensed unit to its batch cost, compare against billed price. Requires both valuation method and sales price resolution, plus currency handling |
| **Insurance Claims** | ✅ Yes | Full claim lifecycle on `InventoryDispensingClaimLinkModel`: `claim_status`, `payer_type`, `payer_name`, `nhif_code`, `submitted_at`, `adjudicated_at`, `approved_amount`, `rejected_amount` | Nothing — claim tracking is already operational |
| **Medicine Consumption** | ✅ Yes | `DepartmentStockBalanceModel.quantity_consumed`, `DepartmentStockMovementModel`, `consumptionTrends()` analytics endpoint | Nothing |

## Frontend Readiness

| Capability | Status | What's Needed |
|-----------|--------|---------------|
| **Chart library** | ❌ Not installed | Install `apexcharts` + `vue3-apexcharts` or `chart.js` + `vue-chartjs` |
| **PDF export** | ✅ Available | `barryvdh/laravel-dompdf` + `BrandedPdfDocumentManager`. Create Blade templates per report |
| **CSV export** | ✅ Available | `BrandedCsvExportManager`. Create export use cases per report |
| **Excel export** | ❌ Not available | Would need `maatwebsite/laravel-excel` or build XLSX manually |
| **Analytics endpoints** | ✅ 4 exist | `InventoryAnalyticsController`: consumptionTrends, abcVenMatrix, expiryWastage, stockTurnover. Would need ~8 more |
| **Existing analytics UI** | ⚠️ `SupplyChainAnalyticsTab.vue` | CSS bar charts only. Would be superseded by real chart library |
| **KPI card pattern** | ✅ In use | Dashboard.vue, FinancialReports.vue — reusable Card + metric pattern |
| **Worklist page pattern** | ✅ In use | Pharmacy IndexV2.vue — can surface alerts (low stock, near expiry) as queue rows |

## Summary

**Of 19 requested reports:**

| Status | Count | Reports |
|--------|:-----:|---------|
| ✅ Fully possible | 11 | Stock Status, Low Stock, Out of Stock, Near Expiry, Expired, Batch Tracking, Dispensed Medicines, Medicines by Clinician, Controlled Drugs Register, Prescription Trends, Insurance Claims, Medicine Consumption |
| ⚠️ Partially possible | 6 | Overstock, Slow/Fast Moving, Stock Valuation, Antibiotic Usage, Pharmacy Sales, Revenue |
| ❌ Not possible today | 2 | Medicines by Diagnosis, Profit Margin |

### What blocks the "No" items:

1. **Medicines by Diagnosis** — requires understanding the encounter diagnosis data model and building a join path from pharmacy orders → encounter → diagnosis. The diagnosis storage mechanism (ICD codes, free text, structured conditions) must be audited first. This is a data model investigation, not an architectural blocker.

2. **Profit Margin** — requires a cost-of-goods-sold (COGS) system that matches each dispensed unit back to its batch cost and compares it against the billed price. This needs: (a) a formal valuation method (FIFO cost layers or weighted average), (b) a currency model, and (c) resolution of date-effective pricing contracts. This is a substantive feature, not a simple query.

### What blocks the "Partial" items:

- **Overstock** — needs a business rule definition (what threshold constitutes overstock?)
- **Slow/Fast Moving** — needs a velocity classification algorithm (what period? what threshold?)
- **Stock Valuation** — needs a formal costing method (currently only per-batch actual cost)
- **Antibiotic Usage** — needs an antibiotic classification strategy (flag on catalog, or lookup table)
- **Pharmacy Sales / Revenue** — needs joining dispensing data with billing/pricing, which works but is complex due to date-effective contracts
