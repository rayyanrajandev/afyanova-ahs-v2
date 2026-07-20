# Billing Module — Architecture Redesign Plan

> **Status:** Proposed  
> **Scope:** Frontend architecture only (backend DDD layering is sound)  
> **Target pattern:** Encounter-module-style List → Workspace flow  
> **Audience:** Senior engineers implementing the migration

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Target Architecture — Billing Patient Workspace](#2-target-architecture--billing-patient-workspace)
3. [Route Map](#3-route-map)
4. [Component Architecture](#4-component-architecture)
5. [Composable Architecture](#5-composable-architecture)
6. [Server-Side Workspace Endpoint](#6-server-side-workspace-endpoint)
7. [Migration Phases](#7-migration-phases)
8. [Old Files Cleanup Plan](#8-old-files-cleanup-plan)
9. [Risk Register](#9-risk-register)
10. [Architecture Decision Records](#10-architecture-decision-records)

---

## 1. Current State Audit

### 1.1 Page Topology — 15+ Flat Pages

| Route | File(s) | Lines | Architecture |
|-------|---------|-------|-------------|
| `/billing-invoices` | `IndexV2.vue` | 1,201 | TanStack Query composables ✓ |
| `/billing-invoices/legacy` | `Index.vue` | 1,672 | Custom `apiRequest()` — Legacy |
| `/billing-invoices` (alt) | `invoices/Index.vue` | ~15,000 | Hybrid props+API — **critical problem** |
| `/billing-cash` | `CashV2.vue` | 791 | TanStack Query composables ✓ |
| `/billing-cash/legacy` | `Cash.vue` | 235 | Custom `apiRequestJson()` — Legacy |
| `/billing-cash` (alt) | `cash/Index.vue` | 1,088 | Hybrid — different pattern |
| `/billing-refunds` | `Refunds.vue` / `refunds/Index.vue` | 230 / 1,350 | Legacy / Hybrid |
| `/billing-daily-close` | `DailyClose.vue` / `daily-close/Index.vue` | 255 / 255 | Legacy (duplicates) |
| `/billing-aging-report` | `AgingReport.vue` | 211 | Custom |
| `/billing-financial-reports` | `FinancialReports.vue` | 837 | Custom |
| `/billing-service-catalog` | `ServiceCatalog.vue` | 3,090 | Monolithic workspace |
| `/billing-payer-contracts` | `PayerContracts.vue` | 4,015 | Monolithic workspace |
| `/billing-payment-plans` | `PaymentPlans.vue` | 1,060 | Monolithic workspace |
| `/billing-corporate` | `Corporate.vue` | 715 | Monolithic workspace |
| `/billing-discounts` | `Discounts.vue` | 1,029 | Monolithic workspace |
| `/billing-write-offs` | `WriteOffs.vue` | 143 | Simple form |
| `/billing-adjustments` | `Adjustments.vue` | 157 | Simple form |

### 1.2 Critical Architectural Weaknesses

| # | Problem | Evidence | Severity |
|---|---------|----------|----------|
| 1 | **15000-line component** | `invoices/Index.vue` — contains queue, board, create, payer contracts, audit in one file | **Critical** |
| 2 | **Component duplication** | `pages/billing/components/` (31 files) and `pages/billing/invoices/components/` (33 files) — 25 exact duplicates | **Critical** |
| 3 | **Three parallel architectures** | Legacy (`apiRequest`), V2 (TanStack Query), invoices/Index (hybrid Inertia+API) | **High** |
| 4 | **No patient workspace** | Patient context lost on navigation between /billing-invoices and /billing-cash | **High** |
| 5 | **No billing navigation** | `BillingModuleNav.vue` only used by legacy pages — V2 pages rely on sidebar | **Medium** |
| 6 | **Repetitive patterns** | Payment recording implemented in 3+ places (IndexV2, CashV2, invoices/Index) | **Medium** |
| 7 | **Duplicate composables** | `useBillingPermissions.ts` exists in both `components/` and `invoices/composables/` | **Low** |
| 8 | **Dead route** | `POST .../payments/undo` called by Index.vue but doesn't exist server-side | **Low** (fixed in V2) |

### 1.3 Strengths to Preserve

| Strength | Location | Why |
|----------|----------|-----|
| TanStack Query composables | `composables/billingCashierQueue/*`, V2 pages | Proper caching, optimistic updates, background refetching |
| URL-synced filters | `useBillingCashierQueueFilters.ts` | Bookmarkable queue state |
| Server-side DDD layering | `app/Modules/Billing/` — 85+ use cases | Clean separation of concerns |
| FormRequest validation | 41 request classes | Consistent server-side validation |
| Response transformers | 30 transformers | Consistent camelCase API contract |
| Sticky scroll container | `useStickyScrollContainer` | Matches Encounter/Patients V2 pattern |
| Deep-link support | `?patientId=X&focusInvoiceId=Y` | Enables Patient Chart integration |
| Status badge/color system | Constants, label formatters | Already matches app conventions |

---

## 2. Target Architecture — Billing Patient Workspace

### 2.1 Core Concept (Encounter Module Pattern)

```
Current:                                   Proposed:
                                                                         
/billing-invoices   (queue)                /billing                   (consolidated queue/list)
/billing-cash       (separate page)        /billing/{patientId}       (patient billing workspace)
/billing-refunds    (separate page)          ├── Invoices tab
/billing-aging      (separate page)          ├── Payments tab
...                                           ├── Charges tab
                                              ├── Insurance tab
                                              └── Audit tab
                                                                       
Standalone pages preserved:                Standalone pages preserved:
/billing-cash                              /billing/cash
/billing-refunds                           /billing/refunds
/billing-daily-close                       /billing/daily-close
/billing-financial-reports                 /billing/financial-reports
/billing-aging-report                      /billing/aging-report
/billing-service-catalog                   /billing/service-catalog
/billing-payer-contracts                   /billing/payer-contracts
/billing-payment-plans                     /billing/payment-plans
/billing-corporate                         /billing/corporate
/billing-discounts                         /billing/discounts
/billing-write-offs                        /billing/write-offs
/billing-adjustments                       /billing/adjustments
```

### 2.2 Why This Pattern Fits Billing

The Encounter module proved this pattern works well in this codebase because:

1. **Server-driven workspace** — One API call returns everything needed for a patient visit. The frontend decomposes into tabs. No waterfall requests.

2. **Composable isolation** — Each tab has its own query composable. Adding a new tab means adding a composable + a component, not touching a 15000-line file.

3. **Patient context** — Always derived from workspace response. Never stale, never lost on navigation.

4. **Permission gating** — Workspace tabs conditionally rendered based on server-side `availableTabs`. New features can be selectively enabled.

5. **Breadcrumb trail** — `Billing > Patient Name` follows the same pattern as `Encounters > Encounter #1234`.

### 2.3 What Does NOT Change

- Backend DDD layer (Use Cases, Repositories, Transformers, Form Requests)
- Individual API endpoints (record payment, issue invoice, capture charge)
- CashV2 standalone page (casual cash patients without linked billing account)
- All non-workspace standalone pages
- `components/billing/` shared app-level components (lookup fields)
- `useStickyScrollContainer` pattern

---

## 3. Route Map

### 3.1 Proposed URL Structure

```php
// === Billing Patient Workspace ===

// Consolidated list page (replaces IndexV2's master-detail with list-only)
Route::get('billing', fn() => Inertia::render('billing/List'))
    ->middleware(['auth', 'verified', 'can:billing.invoices.read', ...])
    ->name('billing.page');

// Patient billing workspace (new)
Route::get('billing/{patientId}', fn($patientId) => Inertia::render('billing/workspace/Workspace', [
    'patientId' => $patientId,
]))->middleware(['auth', 'verified', 'can:billing.invoices.read', ...])
  ->name('billing.workspace');

// === Standalone pages (unchanged routes, preserved as-is) ===

Route::get('billing-cash', ...)->name('billing-cash.page');
Route::get('billing-refunds', ...)->name('billing-refunds.page');
Route::get('billing-daily-close', ...)->name('billing-daily-close.page');
Route::get('billing-financial-reports', ...)->name('billing-financial-reports.page');
Route::get('billing-aging-report', ...)->name('billing-aging-report.page');
Route::get('billing-service-catalog', ...)->name('billing-service-catalog.page');
Route::get('billing-payer-contracts', ...)->name('billing-payer-contracts.page');
Route::get('billing-payment-plans', ...)->name('billing-payment-plans.page');
Route::get('billing-corporate', ...)->name('billing-corporate.page');
Route::get('billing-discounts', ...)->name('billing-discounts.page');
Route::get('billing-write-offs', ...)->name('billing-write-offs.page');
Route::get('billing-adjustments', ...)->name('billing-adjustments.page');

// Legacy rollback paths (preserved during transition, removed in Phase 8)
Route::get('billing-invoices', ...)->name('billing-invoices.page');
Route::get('billing-invoices/legacy', ...)->name('billing-invoices.page.legacy');
```

### 3.2 Entry Points into Workspace

| From | How |
|------|-----|
| Billing list page | Click patient row → `/billing/{patientId}` |
| Patient Chart billing tab | Deep link → `/billing/{patientId}?focusInvoiceId=X` |
| Encounter workspace | Context-preserving link from `EncounterBillingPanel.vue` |
| Clinician queue | Link from patient row with unpaid flag |

---

## 4. Component Architecture

### 4.1 New File Structure

```
resources/js/pages/billing/
├── List.vue                              # Consolidated queue (list-only, from IndexV2)
│
├── workspace/
│   ├── Workspace.vue                     # Orchestrator — wires composables + renders tabs
│   ├── WorkspaceHeader.vue               # Patient info, summary cards, status
│   ├── WorkspaceNavBar.vue               # Tab navigation + mobile pane toggle
│   │
│   ├── tabs/
│   │   ├── InvoicesTab.vue               # Invoice list, status, payment actions
│   │   ├── PaymentsTab.vue               # Payment timeline + reversal
│   │   ├── ChargesTab.vue                # Charge capture (pulled from IndexV2 inline)
│   │   ├── InsuranceTab.vue              # Coverage, NHIF, claims (NEW — surface existing data)
│   │   └── AuditTab.vue                  # Payment audit log (NEW — surface existing data)
│   │
│   ├── sheets/
│   │   ├── PaymentSheet.vue              # Single payment form (pulled from IndexV2 inline)
│   │   ├── BulkPaymentSheet.vue          # Bulk payment form (pulled from IndexV2 inline)
│   │   ├── InvoiceDetailSheet.vue        # Invoice detail slide-over
│   │   ├── InvoiceEditDraftSheet.vue     # Edit draft invoice
│   │   └── PaymentReversalSheet.vue      # Reversal with reason prompt
│   │
│   └── components/
│       ├── InvoiceRow.vue                # Single invoice line (reusable by InvoicesTab)
│       ├── PaymentTimelineEntry.vue      # Single payment entry
│       ├── ChargeCandidateCard.vue       # Single charge candidate
│       └── InsuranceCoverageCard.vue     # Insurance coverage breakdown
│
├── components/                           # EXISTING — single source of truth (keep all)
│   ├── BillingModuleNav.vue
│   ├── BillingBoardView.vue
│   ├── InvoiceDetailsSheet.vue
│   ├── InvoiceStatusDialogSheet.vue
│   ├── InvoiceEditDraftSheet.vue
│   ├── PaymentReversalDialog.vue
│   ├── ClaimsDashboard.vue
│   ├── BillingQueueTable.vue
│   ├── BillingQueueToolbar.vue
│   ├── BillingCreate*.vue (10 files)
│   └── ... (existing)
│
├── invoices/components/                  # DELETE — 25+ exact duplicates of components/
│
├── Composables remain at:               # EXISTING — reuse/extend
│   composables/billingCashierQueue/*.ts
│
└── Add new composables:
    composables/billingWorkspace/*.ts      # NEW — workspace-specific
```

### 4.2 Component Responsibility Mapping

| Component | Responsibility | Source |
|-----------|---------------|--------|
| `List.vue` | Search bar, status tabs, patient queue, pagination | Extracted from IndexV2 (remove detail panel) |
| `Workspace.vue` | Fetch workspace bundle, wire composables, render tabs + sheets | New |
| `WorkspaceHeader.vue` | Patient name/MRN, summary cards (total billed, unpaid, balance) | Extracted from IndexV2 detail header |
| `WorkspaceNavBar.vue` | Tab switcher, mobile pane toggle | New (pattern from Encounter) |
| `InvoicesTab.vue` | Invoice list with checkboxes, status badges, action buttons | Extracted from IndexV2 invoices list |
| `PaymentsTab.vue` | Payment timeline with method/amount/reference, undo button | New |
| `ChargesTab.vue` | Priced/unpriced candidates, add-to-invoice buttons | Extracted from IndexV2 unbilled tab |
| `InsuranceTab.vue` | Payer contract, copay, coverage %, NHIF status, claims | New — surface existing API data |
| `AuditTab.vue` | Payment/reversal audit log | New — surface existing API data |
| `PaymentSheet.vue` | Amount, method, reference form with draft persistence | Extracted from IndexV2 inline sheet |
| `BulkPaymentSheet.vue` | Multi-invoice payment form | Extracted from IndexV2 inline sheet |

### 4.3 Component Rules

1. **Every component gets a single responsibility.** If it has more than one "reason to change", split it.
2. **Sheets are self-contained.** Each sheet manages its own form state, validation, and mutation callbacks (received as props from Workspace.vue).
3. **Tabs are stateless.** Each tab receives data via props and emits events. All state lives in workspace-level composables.
4. **No component exceeds 500 lines.** If it does, extract a child component.

---

## 5. Composable Architecture

### 5.1 New Workspace Composables

```
composables/billingWorkspace/
├── useBillingWorkspace.ts           # TanStack Query for workspace bundle
│   Query key: ['billing-workspace', patientId]
│   Returns: patient + invoices + payments + charges + insurance + claims + summary
│
├── useBillingWorkspaceInvoices.ts   # Invoice list sub-query (could be part of workspace)
│   Depends on: patientId
│   Exposes: invoices, unpaidInvoices, totalUnpaid, selectedInvoiceIds
│
├── useBillingWorkspacePayments.ts   # Payment timeline + record/reverse mutations
│   Depends on: patientId
│   Exposes: payments, recordPayment(), reversePayment(), undoStack
│
├── useBillingWorkspaceCharges.ts    # Charge capture
│   Depends on: patientId
│   Exposes: candidates (priced + unpriced), addCandidateToInvoice()
│
├── useBillingWorkspaceInsurance.ts  # Coverage + NHIF + claims
│   Depends on: patientId
│   Exposes: coverage, contract, nhifStatus, claims
│
└── useBillingWorkspaceAudit.ts      # Audit log
    Depends on: patientId
    Exposes: auditLogs, isLoading
```

### 5.2 Existing Composables to Reuse/Extend

| Existing Composable | Fate | Notes |
|---------------------|------|-------|
| `useBillingCashierQueueFilters.ts` | **Reuse** in new `List.vue` | URL-synced filter pattern is best practice |
| `useBillingCashierQueue.ts` | **Reuse** in new `List.vue` | TanStack Query wrapper for queue data |
| `useBillingCashierQueueStatusCounts.ts` | **Reuse** in new `List.vue` | Status tab badge counts |
| `useBillingCashierActions.ts` | **Extend** for Workspace | Already has recordPayment, reversePayment, issueInvoice, addCandidateToDraft, createInvoiceFromCandidate |
| `useBillingPatientInvoices.ts` | **Extend** into workspace layer | Add insurance/coverage fields to BillingInvoice type |

### 5.3 Composable Design Rules

1. **Each composable owns its query key prefix.** No two composables share a query key.
2. **Each composable exposes `isLoading`, `isError`, `error`, and `data`** in a consistent shape.
3. **Mutation composables expose individual `UseMutationReturn` objects** named as verbs (`recordPayment`, `reversePayment`), not wrapped in a single `mutateAsync`.
4. **Optimistic updates happen in the composable** that owns the affected query cache, not in the page component.
5. **Cache invalidation is explicit** — each action composable has an `invalidate(patientId)` method.

---

## 6. Server-Side Workspace Endpoint

### 6.1 New API Endpoint

```
GET /api/v1/billing/{patientId}/workspace
Response:
{
  data: {
    patient: {
      id: string;
      patientNumber: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      dateOfBirth: string;
      gender: string;
    },
    summary: {
      totalBilled: number;
      totalPaid: number;
      totalUnpaid: number;
      invoiceCount: number;
      unpaidInvoiceCount: number;
    },
    invoices: InvoiceItem[],
    payments: PaymentItem[],
    charges: ChargeCaptureCandidate[],
    insurance: {
      payerContractId: string | null;
      payerName: string | null;
      payerType: 'self_pay' | 'insurance' | 'employer' | 'government' | 'donor' | 'other';
      copayAmount: number | null;
      coveragePercent: number | null;
      policyNumber: string | null;
      memberId: string | null;
      status: 'active' | 'expired' | 'pending' | null;
    } | null,
    claims: ClaimSummary[],
    availableTabs: string[],  // Server-driven tab visibility
  }
}
```

### 6.2 Backend Implementation

```php
// New use case
class GetBillingPatientWorkspaceUseCase
{
    public function execute(string $patientId, string $tenantId, string $facilityId): array
    {
        $patient = $this->patientRepo->findById($patientId);
        $invoices = $this->invoiceRepo->findByPatient($patientId, $facilityId);
        $payments = $this->paymentRepo->findByPatient($patientId, $facilityId);
        $charges = $this->chargeCaptureRepo->findCandidates($patientId);
        $insurance = $this->payerContractRepo->findActiveForPatient($patientId, $facilityId);
        $claims = $this->claimRepo->findByPatient($patientId, $facilityId);

        return [
            'patient' => PatientSummaryTransformer::transform($patient),
            'summary' => $this->buildSummary($invoices),
            'invoices' => array_map([InvoiceItemTransformer::class, 'transform'], $invoices),
            'payments' => array_map([PaymentItemTransformer::class, 'transform'], $payments),
            'charges' => array_map([ChargeCaptureTransformer::class, 'transform'], $charges),
            'insurance' => $insurance ? InsuranceTransformer::transform($insurance) : null,
            'claims' => array_map([ClaimSummaryTransformer::class, 'transform'], $claims),
            'availableTabs' => $this->resolveAvailableTabs($insurance, $claims),
        ];
    }

    private function resolveAvailableTabs(?array $insurance, array $claims): array
    {
        $tabs = ['invoices', 'payments', 'charges'];
        if ($insurance !== null) $tabs[] = 'insurance';
        if (!empty($claims)) $tabs[] = 'claims';
        $tabs[] = 'audit';
        return $tabs;
    }
}
```

### 6.3 Why a New Endpoint Instead of Reusing Existing Ones

| Approach | Cost | Benefit |
|----------|------|---------|
| **New composite endpoint** | ~200 lines — new UseCase + Controller + Transformer | Single round-trip, server-driven tab visibility, consistent response shape |
| **Reuse existing endpoints** | 0 new code | Requires 5+ parallel API calls on every workspace load, no tab visibility control |

The composite endpoint follows the exact same pattern as `GetEncounterWorkspaceUseCase.php` — which the Encounter module uses successfully.

---

## 7. Migration Phases

### Phase 1 — Workspace Shell + Invoices Tab (Est: 3-5 days)

**Goal:** Create the workspace route and render the first tab by extracting existing IndexV2 detail panel code.

**Steps:**

1. Create `composables/billingWorkspace/useBillingWorkspace.ts` — fetches new composite endpoint
2. Create `pages/billing/workspace/Workspace.vue` — orchestrator with tabs + sheets
3. Create `pages/billing/workspace/WorkspaceHeader.vue` — patient info + summary cards (extract from IndexV2 lines 896-918)
4. Create `pages/billing/workspace/tabs/InvoicesTab.vue` — invoice list (extract from IndexV2 lines 952-1013)
5. Create `pages/billing/workspace/sheets/PaymentSheet.vue` — payment form (extract from IndexV2 lines 1074-1123)
6. Create `pages/billing/workspace/sheets/BulkPaymentSheet.vue` — bulk payment form (extract from IndexV2 lines 1126-1164)
7. Register route: `GET /billing/{patientId}`
8. **Do NOT delete anything yet** — new code coexists with existing pages

**Verification:** Navigate to `/billing/{patientId}` and see patient workspace with Invoices tab, same functionality as IndexV2 detail panel.

### Phase 2 — Remaining Workspace Tabs (Est: 3-5 days)

**Goal:** Add Payments, Charges, Insurance, Audit tabs.

**Steps:**

1. Create `useBillingWorkspacePayments.ts` — payment timeline query + record/reverse mutations
2. Create `pages/billing/workspace/tabs/PaymentsTab.vue` — payment timeline UI
3. Create `useBillingWorkspaceCharges.ts` — re-use existing charge capture logic
4. Create `pages/billing/workspace/tabs/ChargesTab.vue` — extract from IndexV2 lines 1016-1065
5. Create `useBillingWorkspaceInsurance.ts` — fetch payer contract + NHIF data
6. Create `pages/billing/workspace/tabs/InsuranceTab.vue` — coverage display
7. Create `pages/billing/workspace/tabs/AuditTab.vue` — payment audit log
8. Add `serverResolvedAvailableTabs` to workspace response; render tabs conditionally

**Verification:** Workspace shows correct tabs per patient. Insurance tab visible only for insured patients.

### Phase 3 — Server-Side Workspace Endpoint (Est: 2-3 days)

**Goal:** Build the composite API endpoint.

**Steps:**

1. Create `GetBillingPatientWorkspaceUseCase.php` in `app/Modules/Billing/Application/UseCases/`
2. Create `BillingPatientWorkspaceController.php` with a single `__invoke` method
3. Create `BillingPatientWorkspaceResponseTransformer.php`
4. Create sub-transformers if needed: `PaymentItemTransformer`, `InsuranceTransformer`, `ClaimSummaryTransformer`
5. Register route: `GET /api/v1/billing/{patientId}/workspace`
6. Update `useBillingWorkspace.ts` to call new endpoint

**Verification:** Workspace loads from single composite endpoint. Response includes `availableTabs`.

### Phase 4 — Eliminate Component Duplication (Est: 1-2 days)

**Goal:** Delete 25+ duplicate component files.

**Steps:**

1. Audit all imports in `pages/billing/invoices/Index.vue` and its sub-components
2. Identify which components in `pages/billing/invoices/components/` are exact duplicates of those in `pages/billing/components/`
3. Update all import paths in `pages/billing/invoices/Index.vue` to point to `../components/` (the canonical location)
4. Delete `pages/billing/invoices/components/` directory
5. Delete `pages/billing/invoices/composables/` directory (duplicate composables)

**Verification:** `invoices/Index.vue` still renders correctly. All imports resolve to canonical location.

### Phase 5 — Decompose invoices/Index.vue (Est: 5-8 days)

**Goal:** Break the 15000-line file into manageable pieces.

**Strategy — NOT a full rewrite:**

1. Identify extractable sections:
   - Queue view → reuse `BillingQueueTable.vue`, `BillingQueueToolbar.vue` (already extracted)
   - Board view → `BillingBoardView.vue` (already extracted)
   - Create workflow → 10 `BillingCreate*.vue` components (already extracted)
   - Invoice detail → `InvoiceDetailsSheet.vue` (already extracted)
   - Status change → `InvoiceStatusDialogSheet.vue` (already extracted)
2. These components are **already extracted** into `pages/billing/components/`
3. The problem is `invoices/Index.vue` has its **own copies** in `invoices/components/` and uses those instead
4. After Phase 4 (import path fix), `invoices/Index.vue` will use canonical components
5. Once imports are fixed, `invoices/Index.vue` itself still exists at ~15000 lines but delegates to extracted components
6. **Optional:** Convert `invoices/Index.vue` to a thin shell (~500 lines) that imports and arranges the canonical components
7. If the workspace (Phase 1-2) covers the same use cases, routes can redirect from `invoices/Index.vue` to the workspace

**Verification:** No regressions. The old route still works, but now delegates to canonical components.

### Phase 6 — Consolidate List Page (Est: 2-3 days)

**Goal:** Strip detail panel from `IndexV2.vue`. Make it list-only, linking to workspace.

**Steps:**

1. Create `pages/billing/List.vue` — starts as a copy of `IndexV2.vue`
2. Remove patient detail panel (right side) — the conditional rendering block at lines 889-1067
3. Change row click handler: `selectPatient(entry)` → navigate to `/billing/${entry.patientId}`
4. Update route to point to `List.vue`:
   ```php
   Route::get('billing', fn() => Inertia::render('billing/List'))
   ```

**What List.vue keeps from IndexV2.vue:**
- Search bar with debounce
- Status tabs (All / Unpaid / Paid) with count badges
- Patient queue with pagination
- View controls (per-page, compact rows)
- Refresh button, clear filters
- Patient summary popover

**What is removed:**
- Patient detail panel (moved to workspace)
- Payment sheet, bulk payment sheet (moved to workspace)
- Reversal dialog, undo toast (moved to workspace)
- Charge capture tab (moved to workspace)
- Invoice-related computed refs (all move to workspace composables)

**Verification:** `/billing` shows the queue. Clicking a patient navigates to `/billing/{patientId}` (workspace).

### Phase 7 — Add Consistent Navigation (Est: 0.5-1 day)

**Goal:** Add `BillingModuleNav` to all V2 pages so users can navigate between billing sections.

**Steps:**

1. Add `BillingModuleNav.vue` to `IndexV2.vue` (now `List.vue`) at the top of the content area
2. Add `BillingModuleNav.vue` to `CashV2.vue`
3. Consider adding a shared billing layout component that wraps all billing pages with `BillingModuleNav` + breadcrumbs

**BillingModuleNav enhancement:**
The current component only links to Invoices, Cash payments, Refunds. Add links to:
- Daily Close
- Financial Reports
- Service Catalog
- Payer Contracts

Or keep it focused and let the sidebar handle secondary navigation. Decision: keep `BillingModuleNav` focused on the cashier workflow (Invoices, Cash, Refunds), leave admin pages in sidebar.

### Phase 8 — Delete Legacy Files (Est: 0.5-1 day)

**Goal:** Remove all legacy/dead code after confirming no active references.

**Steps:**

1. Verify no imports reference `pages/billing/Index.vue` (can be checked via grep after route update)
2. Delete `resources/js/pages/billing/Index.vue`
3. Delete `resources/js/pages/billing/Cash.vue`
4. Delete `resources/js/pages/billing/cash/Index.vue` (after verifying CashV2 handles all cases)
5. Delete `resources/js/pages/billing/refunds/Index.vue` (after verifying Refunds.vue handles all cases)
6. Delete `resources/js/pages/billing/daily-close/Index.vue` (duplicate)
7. Remove legacy fallback routes from `web.php`:
   - `GET /billing-invoices/legacy`
   - `GET /billing-cash/legacy`

---

## 8. Old Files Cleanup Plan

### 8.1 Files to Delete (After Migration Complete)

| File | Reason | Dependency Check Required | Cleanup Phase |
|------|--------|--------------------------|---------------|
| `pages/billing/Index.vue` | Superseded by IndexV2 → List.vue | Check sidebar links, patient chart links | Phase 8 |
| `pages/billing/Cash.vue` | Superseded by CashV2 | Check route references | Phase 8 |
| `pages/billing/cash/Index.vue` | Alternative Cash page — superseded by CashV2 | Check route references | Phase 8 |
| `pages/billing/refunds/Index.vue` | Duplicate of Refunds.vue | Check route, sidebar links | Phase 8 |
| `pages/billing/daily-close/Index.vue` | Duplicate of DailyClose.vue | Check route references | Phase 8 |
| `pages/billing/invoices/components/` (entire directory) | 25+ exact duplicates of `components/` | Update imports in invoices/Index.vue first | Phase 4 |
| `pages/billing/invoices/composables/` (entire directory) | Duplicates of `composables/` | Update imports first | Phase 4 |
| `pages/billing/invoices/Index.vue` | 15000-line component — superseded by workspace | Verify feature parity first | Phase 5-6 |
| `routes/web.php` legacy routes | `/billing-invoices/legacy`, `/billing-cash/legacy` | Verify no external links | Phase 8 |

### 8.2 Components to Consolidate (Keep One Copy)

| Component | Canonical Location | Duplicate Location |
|-----------|-------------------|-------------------|
| `BillingBoardView.vue` | `components/` | `invoices/components/` |
| `BillingModuleNav.vue` | `components/` | `invoices/components/` |
| `BillingQueueTable.vue` | `components/` | `invoices/components/` |
| `BillingQueueControlBar.vue` | `components/` | `invoices/components/` |
| `BillingQueueToolbar.vue` | `components/` | `invoices/components/` |
| `BillingQueueFiltersPanels.vue` | `components/` | `invoices/components/` |
| `BillingWorkspaceHeader.vue` | `components/` | `invoices/components/` |
| `BillingWorkspaceAlerts.vue` | `components/` | `invoices/components/` |
| `BillingInvoiceViewTabs.vue` | `components/` | `invoices/components/` |
| `InvoiceDetailsSheet.vue` | `components/` | `invoices/components/` |
| `InvoiceDetailsOverviewTab.vue` | `components/` | `invoices/components/` |
| `InvoiceDetailsWorkflowsTab.vue` | `components/` | `invoices/components/` |
| `InvoiceDetailsAuditTab.vue` | `components/` | `invoices/components/` |
| `InvoiceDetailsAuditLogsPanel.vue` | `components/` | `invoices/components/` |
| `InvoiceDetailsAuditExportJobsPanel.vue` | `components/` | `invoices/components/` |
| `InvoiceStatusDialogSheet.vue` | `components/` | `invoices/components/` |
| `InvoiceEditDraftSheet.vue` | `components/` | `invoices/components/` |
| `PaymentReversalDialog.vue` | `components/` | `invoices/components/` |
| `ClaimsDashboard.vue` | `components/` | `invoices/components/` |
| `BillingCreate*.vue` (10 files) | `components/` | `invoices/components/` |
| `useBillingPermissions.ts` | `composables/` | `invoices/composables/` |
| `useBillingFinancialControls.ts` | `composables/` | `invoices/composables/` |

### 8.3 Cleanup Execution Order

```
Phase 4: Fix imports → Delete invoices/components/ + invoices/composables/
Phase 5-6: Decompose invoices/Index.vue → Delete invoices/Index.vue (optional, depends on workspace parity)
Phase 8: Delete legacy page files → Delete legacy routes
```

### 8.4 Dependency Verification Checklist

Before deleting any file, verify:

- [ ] No `import` statements reference the file
- [ ] No Inertia route renders the file (`Inertia::render('billing/...')`)
- [ ] No sidebar navigation links to the route
- [ ] No `href` or `Link` components in other pages point to the route
- [ ] No bookmark/URL that users might have saved

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Regression in invoices/Index.vue** when fixing imports to canonical components | Medium | High | Comprehensive QA pass on all features after Phase 4 |
| **Lost feature during decomposition** of 15000-line file | Medium | High | Feature inventory checklist before Phase 5; compare against list of all buttons, dialogs, sheets |
| **Workspace doesn't cover all IndexV2 use cases** | Low | Medium | Start with Phase 1 as additive only — IndexV2 remains fully functional until parity confirmed |
| **Backend workspace endpoint performance** | Low | Medium | Add pagination for invoices/payments if needed; use `withCount` / eager loading |
| **Team confusion during coexistence** of old and new code | Medium | Low | Clear documentation in this doc; old code has `/legacy` suffix; add deprecation notices |
| **Sidebar links pointing to old routes** after deletion | Low | Medium | Grep all `.vue` and `.php` files for href patterns before removing routes |

---

## 10. Architecture Decision Records

### ADR-1: Server-Driven Workspace over Client-Side Composition

**Decision:** Build a new composite API endpoint (`GET /billing/{patientId}/workspace`) rather than composing from existing endpoints on the client.

**Context:** The Encounter module uses `GetEncounterWorkspaceUseCase` which bundles encounter + patient + orders + close readiness into a single response. The alternative is 5+ parallel client-side API calls.

**Consequence:** ~200 lines of new server code. Eliminates waterfall requests. Server controls tab visibility. Response is exactly what the workspace needs — no over-fetching or under-fetching.

### ADR-2: Patient ID as Route Parameter, Not Encounter ID

**Decision:** Workspace keyed on `patientId` instead of `encounterId` or `invoiceId`.

**Context:** Billing is patient-centric, not encounter-centric. A patient may have multiple encounters but one billing workspace. The Encounter module keys on `encounterId` because encounters are the unit of clinical work.

**Consequence:** Workspace URL is `/billing/{patientId}`. Encounter context can still be passed via `?encounterId=X` query parameter for deep links.

### ADR-3: Decompose invoices/Index.vue by Extracting Components, Not Rewriting

**Decision:** Fix imports to use canonical components from `components/` instead of the duplicates in `invoices/components/`. Do not attempt a full rewrite of the 15000-line file.

**Context:** The file already delegates to extracted components (`BillingQueueTable`, `BillingCreate*`, `InvoiceDetailsSheet`, etc.) — but uses copies from `invoices/components/`. Fixing imports is ~2 days of work. A rewrite would be 2+ weeks with high regression risk.

**Consequence:** The file remains large (~500 lines as a thin shell) but its logic lives in canonical, reusable components. Future workspace additions can ignore this file entirely.

### ADR-4: Legacy Pages Removed, Not Migrated

**Decision:** Delete `Index.vue`, `Cash.vue`, and their duplicates rather than migrating them to the new architecture.

**Context:** These pages have V2 replacements (`IndexV2.vue`, `CashV2.vue`) that already cover the same functionality with better architecture. The V2 pages have been the default route for at least one release cycle.

**Consequence:** Cleaner codebase. Any user still on legacy routes will get a 404 unless a redirect is added.

### ADR-5: One Composable Directory for Workspace

**Decision:** New workspace composables live in `composables/billingWorkspace/`, not in `pages/billing/composables/`.

**Context:** Existing billing composables are split across `composables/billingCashierQueue/` (V2 pages) and `pages/billing/composables/` (page-specific). The Encounter module keeps composables in `composables/` at the app level.

**Consequence:** Consistent with Encounter pattern. Composables are discoverable by convention. Pages only import, never define, composables.

---

## Appendix: Encounter Module Reference Architecture

For implementers: Study these Encounter module files as reference implementations.

| Concept | Encounter File | Lines | What to Learn |
|---------|---------------|-------|---------------|
| Workspace orchestrator | `pages/encounters/WorkspaceV2.vue` | ~2,800 | How to wire composables + render tabs + sheets |
| Workspace composable | `composables/useEncounterWorkspace.ts` | ~150 | Single-query workspace data fetch |
| Tab rendering | `WorkspaceV2.vue` template `<Tabs>` section | ~200 | Conditional tab rendering with `availableTabs` |
| Sheet management | `WorkspaceV2.vue` dialog/sheet sections | ~300 | Inline sheets vs. external components |
| Server workspace endpoint | `GetEncounterWorkspaceUseCase.php` | ~150 | Composite response assembly |
| Server response transformer | `EncounterWorkspaceResponseTransformer.php` | ~200 | Minimal patient/admission summaries |
| Navigation | `encounterWorkspaceHref()` in `lib/encounterWorkspace.ts` | ~30 | Context-preserving URL builder |
| Component decomposition | `components/domain/clinical/Encounter*` | 18 files | How to split workspace into panels |

---

*End of document. Last updated: 2026-07-19*
