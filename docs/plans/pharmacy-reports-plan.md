# Pharmacy Reports — Implementation Plan

Based on `docs/pharmacy-reports-capability-audit.md`. Delivers **12 production-ready reports** built entirely on existing backend capabilities.

> **Status: ✅ ALL SPRINTS COMPLETED** — See commit history for incremental delivery.

---

## Sprint 1 — Inventory Health

Quickest operational value. All five share the same `InventoryItemModel` / `InventoryBatchModel` / `InventoryBatchStockService` data.

| Report | Backend | Frontend |
|--------|---------|----------|
| **Stock Status** | New `GET /pharmacy-reports/inventory/stock-status` returning items with `current_stock`, `reorder_level`, `available_stock` (reservation-aware), `stock_state` (healthy/low/out), warehouse, category | Table with columns: Item code, Name, Current stock, Available stock, Reorder level, Stock state badge, Warehouse, Last movement date |
| **Low Stock** | New `GET /pharmacy-reports/inventory/low-stock` — filter `stockAlertCounts()` / `stockState()` to `low_stock` only, sorted by `current_stock / reorder_level` ascending | Table + KPI card showing count. Highlight rows where `current_stock <= reorder_level` |
| **Out of Stock** | New `GET /pharmacy-reports/inventory/out-of-stock` — filter to `current_stock <= 0`, include `last_out_of_stock_at` if tracked | Table with red badge. Show days since last stock |
| **Near Expiry** | New `GET /pharmacy-reports/inventory/near-expiry` — batches where `expiry_date` is within configurable window (default 30/60/90 days). Leverage `expiryWastage()` logic | Table with coloured rows: red (<=30d), amber (<=60d), yellow (<=90d). Include batch number, quantity, estimated value |
| **Expired** | New `GET /pharmacy-reports/inventory/expired` — batches where `expiry_date < today()` and `quantity > 0` | Table showing expired stock value, days since expiry, batch details |

### API Endpoints (Sprint 1)

```
GET  /pharmacy-reports/inventory/stock-status
GET  /pharmacy-reports/inventory/low-stock
GET  /pharmacy-reports/inventory/out-of-stock
GET  /pharmacy-reports/inventory/near-expiry
GET  /pharmacy-reports/inventory/expired
```

Each accepts shared filters (date range irrelevant; warehouse, department, item, category, supplier).

### Backend Work

1. ✅ `app/Modules/Pharmacy/Presentation/Http/Controllers/PharmacyReportsController.php` — refactored to method-inject Use Cases
2. ✅ Each endpoint → dedicated Use Case in `app/Modules/Pharmacy/Application/UseCases/Reports/`
3. ✅ `routes/api.php` — route group under `/pharmacy-reports/*` (all 13 endpoints)

### Frontend Work

1. ✅ `resources/js/pages/pharmacy-reports/InventoryReports.vue` — sub-tabs for 5 inventory reports
2. ✅ Shared filter bar component (see Shared Infrastructure below)

---

## Sprint 2 — Dispensing

All three share `InventoryDispensingClaimLinkModel` + `PharmacyOrderModel`.

| Report | Backend | Frontend |
|--------|---------|----------|
| **Dispensed Medicines** | `GET /pharmacy-reports/dispensing/dispensed-medicines` — group dispensing claim links by item/patient/date range. Include `quantity_dispensed`, `unit_cost`, `total_cost`, batch, prescriber | Table with filters (item, patient, date, prescriber). Show running total row |
| **Batch Tracking** | `GET /pharmacy-reports/dispensing/batch-tracking` — per-batch summary: received qty, dispensed qty, current qty, expiry, supplier, movements timeline | Batches as collapsible rows with full movement history. Show remaining quantity vs original |
| **Medicines by Clinician** | `GET /pharmacy-reports/dispensing/by-clinician` — group by `ordered_by_user_id`, count orders, sum quantity, distinct patients | Table grouped by clinician. Show prescription count, patient count, top-5 medicines per clinician |

### API Endpoints (Sprint 2)

```
GET  /pharmacy-reports/dispensing/dispensed-medicines
GET  /pharmacy-reports/dispensing/batch-tracking
GET  /pharmacy-reports/dispensing/by-clinician
```

### Backend Work

1. ✅ Methods added to `PharmacyReportsController` (delegates to Use Cases)
2. ✅ Each endpoint → dedicated Use Case in `app/Modules/Pharmacy/Application/UseCases/Reports/`
3. ✅ Pagination + sorting on all three

### Frontend Work

1. ✅ `resources/js/pages/pharmacy-reports/DispensingReports.vue` — sub-tabs for each report

---

## Sprint 3 — Compliance

Audit and reimbursement critical.

| Report | Backend | Frontend |
|--------|---------|----------|
| **Controlled Drugs Register** | `GET /pharmacy-reports/compliance/controlled-drugs` — dispensing claim links where `clinical_catalog_item.is_controlled_substance = true` (or schedule check). Include patient, batch, prescriber, verifier, datetime | Register-style table matching regulatory format. Columns: Date, Patient ID, Patient Name, Medicine, Strength, Batch, Quantity, Prescriber, Verifier, Balance After |
| **Insurance Claims** | `GET /pharmacy-reports/compliance/insurance-claims` — claim status summary + detail from dispensing claim links. `claim_status`, `payer_name`, `approved_amount`, `rejected_amount`, `submitted_at` | KPI cards (total claims, pending, approved, rejected amount) + table with payer breakdown |

### API Endpoints (Sprint 3)

```
GET  /pharmacy-reports/compliance/controlled-drugs
GET  /pharmacy-reports/compliance/insurance-claims
```

### Backend Work

1. ✅ Controlled drugs: join via `InventoryDispensingClaimLinkModel` → `PharmacyOrderModel` → `ClinicalCatalogItemModel.is_controlled_substance`
2. ✅ Insurance claims: summary aggregation + detail in `GetInsuranceClaimsUseCase`

### Frontend Work

1. ✅ `resources/js/pages/pharmacy-reports/ComplianceReports.vue` — sub-tabs for each report

---

## Sprint 4 — Analytics

Aggregate reports completing the first reporting suite.

| Report | Backend | Frontend |
|--------|---------|----------|
| **Prescription Trends** | `GET /pharmacy-reports/analytics/prescription-trends` — time-series: group `PharmacyOrderModel` by day/week/month, count orders, sum quantity, filter by item/clinician/status | Line chart (chart library) showing orders over time. Toggle daily/weekly/monthly. Optional overlay by clinician or status |
| **Medicine Consumption** | `GET /pharmacy-reports/analytics/medicine-consumption` — leverages existing `consumptionTrends()` endpoint. Aggregate issue movements + department consumption by day/week/month/item | Bar/line chart showing consumption rate. Include MoM change. Table below with top-N consumed items |

### API Endpoints (Sprint 4)

```
GET  /pharmacy-reports/analytics/prescription-trends
GET  /pharmacy-reports/analytics/medicine-consumption
```

### Backend Work

1. ✅ Prescription trends: `GetPrescriptionTrendsUseCase` queries `PharmacyOrderModel` grouped by period
2. ✅ Medicine consumption: `GetMedicineConsumptionUseCase` queries `InventoryStockMovementModel` issue movements
3. ✅ Both support `granularity` (daily/weekly/monthly) and `days` parameters

### Frontend Work

1. ✅ `resources/js/pages/pharmacy-reports/AnalyticsReports.vue` — sub-tabs for 2 analytics reports
2. ✅ `apexcharts` + `vue3-apexcharts` installed
3. ✅ `TimeSeriesChart.vue` + `BarChart.vue` chart components

---

## Shared Infrastructure

### Shared Filter Bar

Build once, use across all reports.

```
Date range  |  Pharmacy/store  |  Warehouse  |  Department
Item/medicine  |  Batch number  |  Supplier
Patient  |  Prescriber  |  Payer  |  Status
```

- ✅ `resources/js/components/pharmacyReports/ReportFilters.vue`
- Emits `@update:from`, `@update:to`, `@update:q` — reactive filters consumed by report composables
- Filters auto-hide when irrelevant (showSearch/showDateRange props)
- TODO: Persist in URL query params for bookmarkability

### Shared Report Layout

- ✅ `resources/js/components/pharmacyReports/ReportLayout.vue` — wraps AppLayout, title, description, breadcrumbs, actions slot, filters slot
- Consistent header: report title, description, action buttons (slot)

### KPI Card Row

Rendered above each report table for relevant metrics:

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Current Inventory│  Low Stock Items │ Out-of-Stock     │ Expiring ≤30d    │
│ Value            │                  │ Items            │                  │
│ R12,450,000      │ 23               │ 8                │ 14               │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Dispensed Today  │ Controlled Drug  │ Pending Claims   │ Avg Wait Time    │
│ 142 items        │ Dispenses: 12    │ R340,000         │ 2.4 days         │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### Shared Actions

Every report supports:

| Action | Mechanism |
|--------|-----------|
| **View** | Table rows rendered in `ReportLayout.vue` with sortable columns |
| **Print (PDF)** | `BrandedPdfDocumentManager::downloadView()` + dedicated Blade template per report |
| **Export CSV** | `BrandedCsvExportManager` + optional queued job for large datasets |
| **Search** | Filter bar's text input |
| **Sort** | Clickable column headers (`sortBy` + `sortDir` params) |
| **Pagination** | Server-side, matching existing `meta.currentPage/lastPage/total` pattern |

### Folder Structure (✅ all files created)

```
resources/js/pages/pharmacy-reports/
├── Index.vue                          # ✅ Parent page — routes to 4 tab groups
├── InventoryReports.vue               # ✅ Sprint 1 — 5 inventory sub-tabs
├── DispensingReports.vue              # ✅ Sprint 2 — 3 dispensing sub-tabs
├── ComplianceReports.vue              # ✅ Sprint 3 — 2 compliance sub-tabs
├── AnalyticsReports.vue               # ✅ Sprint 4 — 2 analytics sub-tabs

resources/js/components/pharmacyReports/
├── ReportLayout.vue                   # ✅ Shared layout wrapper
├── ReportFilters.vue                  # ✅ Shared filter bar
├── ReportKpiCards.vue                 # ✅ KPI card row
├── ReportTable.vue                    # ✅ Reusable sortable table
├── ReportPagination.vue               # ✅ Pagination controls
├── ReportExportButton.vue             # ✅ CSV + PDF export dropdown
├── charts/
│   ├── TimeSeriesChart.vue            # ✅ Line chart (Sprint 4)
│   └── BarChart.vue                   # ✅ Bar chart (Sprint 4)

app/Modules/Pharmacy/Presentation/Http/Controllers/
├── PharmacyReportsController.php      # ✅ Refactored to method-inject Use Cases

app/Modules/Pharmacy/Application/Support/Reports/
├── ReportQueryHelper.php              # ✅ Shared scope/filter/pagination helpers

app/Modules/Pharmacy/Application/UseCases/Reports/
├── GetStockStatusReportUseCase.php    # ✅
├── GetLowStockReportUseCase.php       # ✅
├── GetOutOfStockReportUseCase.php     # ✅
├── GetNearExpiryReportUseCase.php     # ✅
├── GetExpiredReportUseCase.php        # ✅
├── GetDispensedMedicinesUseCase.php   # ✅
├── GetBatchTrackingUseCase.php        # ✅
├── GetMedicinesByClinicianUseCase.php # ✅
├── GetControlledDrugsRegisterUseCase.php # ✅
├── GetInsuranceClaimsUseCase.php      # ✅
├── GetPrescriptionTrendsUseCase.php   # ✅
├── GetMedicineConsumptionUseCase.php  # ✅
├── GetInventoryDashboardKpisUseCase.php # ✅

resources/views/documents/pharmacy-reports/
├── stock-status.blade.php             # ✅
├── low-stock.blade.php                # ✅
├── out-of-stock.blade.php             # ✅
├── near-expiry.blade.php              # ✅
├── expired.blade.php                  # ✅
├── dispensed-medicines.blade.php      # ✅
├── batch-tracking.blade.php           # ✅
├── medicines-by-clinician.blade.php   # ✅
├── controlled-drugs-register.blade.php # ✅
├── insurance-claims.blade.php         # ✅
├── prescription-trends.blade.php      # ✅
├── medicine-consumption.blade.php     # ✅
```

---

## Dashboard KPIs

Add to existing Dashboard.vue `admin` or `supply` preset:

| KPI | Source | Sprint | Status |
|-----|--------|--------|--------|
| Current Inventory Value | `SUM(InventoryBatchModel.quantity * unit_cost)` | 1 | ✅ |
| Low Stock Items | `stockAlertCounts().lowStock` | 1 | ✅ |
| Out-of-Stock Items | `stockAlertCounts().outOfStock` | 1 | ✅ |
| Items Expiring in 30 Days | `expiryWastage().critical` count | 1 | ✅ |
| Dispensed Today | `PharmacyOrderModel` where `dispensed_at = today()` | 2 | ✅ |
| Controlled Drug Dispenses Today | Same + `is_controlled_substance` join | 2 | ✅ |
| Pending Insurance Claims | `claim_status = 'pending'` count on claim links | 3 | ✅ |

**Added to Dashboard.vue:** Pharmacy KPIs appear under the `supply` and `admin` presets (via `appendWorkflowBatch.ts`). Two KPI cards ("Inventory value" and "Dispensed today") plus a "Pharmacy reports" action link shown when data is available.

---

## Deferred Reports (After Phase 1)

These need additional business rules or financial logic. Revisit after Sprint 4.

| Report | Why Deferred |
|--------|--------------|
| **Overstock** | Needs a business rule definition (% above max_stock_level, or days of stock). Design decision, not implementation |
| **Slow Moving Medicines** | Needs velocity classification: period window (90 days?) and threshold (<25% consumed?). Requires calibration with pharmacy team |
| **Fast Moving Medicines** | Same as slow-moving — inverse threshold |
| **Stock Valuation (formal)** | Current per-batch actual cost exists. Formal FIFO/WAC would need a costing service layer |
| **Antibiotic Usage** | Needs an `is_antibiotic` classification strategy on catalog items or a separate lookup |
| **Pharmacy Sales** | Needs joining dispense data with billing/pricing (date-effective contracts). Possible but complex |
| **Pharmacy Revenue** | Same as sales — depends on billing integration maturity |

## Deferred Indefinitely

| Report | Why |
|--------|-----|
| **Medicines by Diagnosis** | Requires auditing the encounter diagnosis data model and building a join path. The diagnosis storage mechanism must be investigated first |
| **Profit Margin (COGS)** | Needs a full cost-of-goods-sold system: valuation method + price resolution + currency model. Substantive feature, not a query |

---

## Summary

| Sprint | Reports | Backend Endpoints | Frontend Pages | Effort | Status |
|--------|:-------:|:-----------------:|:--------------:|:------:|:------:|
| 1 — Inventory Health | 5 | 5 | 1 | Medium | ✅ Complete |
| 2 — Dispensing | 3 | 3 | 1 | Medium | ✅ Complete |
| 3 — Compliance | 2 | 2 | 1 | Small | ✅ Complete |
| 4 — Analytics | 2 | 2 | 1 | Medium | ✅ Complete |
| Shared infrastructure | — | — | 8 components + chart lib | Small | ✅ Complete |
| Dashboard KPI integration | 7 | 1 API | 1 surface + 2 batch entries | Small | ✅ Complete |
| **Total** | **12** | **13** | **5 pages + shared** | — | **✅ ALL DONE** |

---

## Composables Created

All in `resources/js/composables/pharmacyReports/`:

| Composable | Exports |
|------------|---------|
| `useInventoryReports.ts` ✅ | `useStockStatus`, `useLowStock`, `useOutOfStock`, `useNearExpiry`, `useExpired` + types |
| `useDispensingReports.ts` ✅ | `useDispensedMedicines`, `useBatchTracking`, `useMedicinesByClinician` + types |
| `useComplianceReports.ts` ✅ | `useControlledDrugsRegister`, `useInsuranceClaims` + types |
| `useAnalyticsReports.ts` ✅ | `usePrescriptionTrends`, `useMedicineConsumption`, `useDashboardKpis` + types |

## Architecture Decisions

- **Use Cases** follow the existing `PharmacyOrderController` method-injection pattern (`Request`, `UseCase`) → `JsonResponse`
- **`ReportQueryHelper`** extracted as a shared service for platform scope, filters, stock state, and paginator metadata
- **Blade PDF templates** follow the existing `x-documents.pdf-layout` component pattern with branded header/footer
- **Dashboard integration** adds `pharmacyKpis` to `counts` in both `supply` and `admin` presets via `appendWorkflowBatch.ts`
- **Chart components** use `vue3-apexcharts` wrapping `apexcharts` (installed in `package.json`)
- **Data fetching** uses `@tanstack/vue-query` `useQuery` with reactive filter-based query keys, matching the existing codebase pattern
- **No repository interfaces** were created for inventory models — Use Cases inject Eloquent models directly (read-only queries; full repository layer would be over-engineering for report queries)
