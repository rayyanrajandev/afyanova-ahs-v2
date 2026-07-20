# Billing Workspace — Implementation TODO Tracker

> **Source:** `reports/billing-module-architecture-redesign.md`  
> **Usage:** Check off tasks as completed. Keep one `PHASE` active at a time.  
> **Legend:** `⬜` Pending · `🔄` In Progress · `✅` Done · `❌` Skipped/Blocked

---

## Phase 0 — Preparation & Codebase Familiarization

**Goal:** Understand current code well enough to extract and refactor safely.

- [x] Identify common patterns by reading these reference files:
  - [x] `pages/encounters/WorkspaceV2.vue` — workspace orchestrator pattern
  - [x] `composables/useEncounterWorkspace.ts` — workspace composable pattern
  - [x] `GetEncounterWorkspaceUseCase.php` — server-side composite endpoint
  - [x] `EncounterWorkspaceResponseTransformer.php` — response assembly
- [x] Map all exports from `pages/billing/components/` — list every component and its public API (props, emits)
- [x] Map all exports from `pages/billing/invoices/components/` — compare against canonical list, identify exact duplicates
- [x] Audit all imports in `pages/billing/invoices/Index.vue` — list every relative import path
- [x] Identify all places that link to `/billing-invoices` or `/billing-invoices/legacy` — grep across repo
- [x] Identify all places that link to `/billing-cash` or `/billing-cash/legacy` — grep across repo

---

## Phase 1 — Workspace Shell + Invoices Tab

**Goal:** Create the workspace route and render the Invoices tab by extracting existing IndexV2 detail panel code. New code coexists with existing pages — nothing is deleted.

### 1.1 Backend: Workspace Endpoint

- [x] Register route: `GET /billing/{patientId}` → `Inertia::render('billing/workspace/Workspace')` in `routes/web.php`
- [x] Apply `can:billing.invoices.read` middleware
- [x] Create `GetBillingPatientWorkspaceUseCase.php` — done, see Phase 3 (scope: patient + invoices + summary only)
- [x] Create `BillingPatientWorkspaceController.php` — done, see Phase 3
- [x] Create `BillingPatientWorkspaceResponseTransformer.php` — done, see Phase 3
- [x] Register API route: `GET /api/v1/billing/{patientId}/workspace` — done, `routes/billing-phase1.php`

### 1.2 Frontend: Workspace Store & Composable

- [x] Create `composables/billingWorkspace/` directory
- [x] Create `composables/billingWorkspace/useBillingPatientWorkspace.ts` (uses 3 parallel queries: patient, invoices, charge-capture-candidates)
  - [x] Query key: `['billing-patient-workspace', patientId]`
  - [x] Expose: `data`, `isLoading`, `patient`, `invoices`, `charges`
- [x] Reuse `useBillingCashierActions` from `composables/billingCashierQueue/useBillingCashierActions.ts` for mutations

### 1.3 Frontend: Workspace Page & Components

- [x] Create `pages/billing/workspace/` directory
- [x] Create `pages/billing/workspace/Workspace.vue`
  - [x] Import and wire `useBillingPatientWorkspace`
  - [x] Import and wire `useBillingCashierActions` (recordPayment, issueInvoice, reversePayment, etc.)
  - [x] Render `<WorkspaceHeader>` with patient info + summary cards
  - [x] Render `<Tabs>` with tab navigation (5 tabs: Invoices, Payments, Charges, Insurance, Audit)
  - [x] Mount `<PaymentSheet>` as overlay
  - [x] Breadcrumbs: `Billing > {patientName}`
- [x] Create `pages/billing/workspace/WorkspaceHeader.vue`
  - [x] Patient name, MRN, phone display
  - [x] Summary cards: Total Billed, Total Unpaid, invoice count, unpaid count
- [x] Create `pages/billing/workspace/tabs/InvoicesTab.vue`
  - [x] Invoice list rendering with status badges
  - [x] Checkbox selection for each invoice
  - [x] "Issue Invoice" button for draft invoices
  - [x] "Record Payment" button for unpaid invoices
  - [x] Line items preview (first 3 items + "+N more")
  - [x] Amount display with `formatMoney()`

### 1.4 Frontend: Shared Sheets

- [x] Create `pages/billing/workspace/sheets/PaymentSheet.vue`
  - [x] Form fields: Amount, Payment Method (from constants), Reference
- [ ] Create `pages/billing/workspace/sheets/BulkPaymentSheet.vue` — *not yet implemented*

### 1.5 Verification

- [x] Navigate to `/billing/{patientId}` — workspace loads (route registered)
- [x] Build compiles with no errors — `Workspace-*.js` chunk generated
- [x] IndexV2 at `/billing-invoices` still works (no regressions)
- [ ] Invoices tab shows all invoices for the patient — *needs runtime test*
- [ ] "Issue Invoice" button works for draft invoices — *needs runtime test*
- [ ] Clicking "Record Payment" opens PaymentSheet — *needs runtime test*

---

## Phase 2 — Remaining Workspace Tabs

**Goal:** Add Payments, Charges, Insurance, Audit tabs.

### 2.1 Payments Tab

- [x] Create `composables/billingWorkspace/usePatientPayments.ts`
  - [x] Query: fetches `GET /billing-invoices/{id}/payments` for each paid invoice
  - [x] Returns flat chronological list with invoice metadata merged in
  - [x] Reuses `reversePayment` mutation from `useBillingCashierActions`
- [x] Create `pages/billing/workspace/tabs/PaymentsTab.vue`
  - [x] Payment timeline sorted by date descending
  - [x] Each entry: amount, method, reference, timestamp
  - [x] "Reverse" button for non-reversal entries
  - [x] Darkened reversal entries with reason display
  - [x] Empty state: "No payments found"
- [x] Create `pages/billing/workspace/sheets/PaymentReversalSheet.vue`
  - [x] Amount input (pre-filled with full payment amount)
  - [x] Reason textarea with quick-action buttons + required validation
  - [x] Note (optional)
  - [x] Confirm/cancel with loading state

### 2.2 Charges Tab (Charge Capture)

- [x] Create `pages/billing/workspace/tabs/ChargesTab.vue`
  - [x] "Ready to bill" section (priced candidates)
  - [x] "Needs pricing" section (unpriced candidates, dashed border)
  - [x] Each candidate: service name, type badge, amount, "Add to invoice" button
  - [x] "Add to invoice" reuse `addChargeCandidateToDraft` / `createInvoiceFromCandidate` from `useBillingCashierActions`
  - [x] Empty state: "No unbilled services found"

### 2.3 Insurance Tab

- [x] Reuse `usePatientInsuranceRecords` from `composables/patientChart/usePatientInsuranceRecords.ts`
- [x] Create `pages/billing/workspace/tabs/InsuranceTab.vue`
  - [x] Insurance records card: provider, plan, policy number, member ID, dates, status, copay, verification
  - [x] Third-party invoices card: payer name, contract, coverage percentage, expected payer amount
  - [x] Coverage posture badge per invoice
  - [x] Empty state: "No insurance or third-party coverage information found"

### 2.4 Audit Tab

- [x] Create `composables/billingWorkspace/usePatientAuditLogs.ts`
  - [x] Query: fetches `GET /billing-invoices/{id}/audit-logs` for each invoice
  - [x] Returns flat chronological list with invoice number merged in
- [x] Create `pages/billing/workspace/tabs/AuditTab.vue`
  - [x] Audit log timeline: action, actor type badge, invoice, user, timestamp
  - [x] Action filter dropdown (from `billingAuditActionOptions`)
  - [x] Search filter (searches invoice number, action, actor name)
  - [x] Reuses `auditActionDisplayLabel` and `auditActorDisplayName` from `lib/audit.ts`
  - [x] Empty state: "No audit logs found"

### 2.5 Verification

- [x] Build compiles with no errors — all 5 tab chunks generated
- [ ] Payments tab shows payment history for patient — *needs runtime test*
- [ ] Reversal works with reason requirement — *needs runtime test*
- [ ] Charges tab shows charge capture candidates — *needs runtime test*
- [ ] "Add to invoice" creates draft or appends to existing draft — *needs runtime test*
- [ ] Insurance tab shows coverage when patient has insurance — *needs runtime test*
- [ ] Audit tab shows payment audit trail — *needs runtime test*
- [ ] Tab badge counts are accurate — *needs runtime test*

---

## Phase 3 — Server-Side Workspace Endpoint

**Goal:** Build the composite API endpoint.

- [x] Create `GetBillingPatientWorkspaceUseCase.php`
  - [x] Fetches patient via `PatientRepositoryInterface`
  - [x] Fetches invoices via `BillingInvoiceRepositoryInterface::search()`
  - [x] Computes `summary` (totalBilled, totalPaid, totalUnpaid, invoiceCount, unpaidInvoiceCount)
- [x] Create `BillingPatientWorkspaceController.php` (single `__invoke`)
- [x] Create `BillingPatientWorkspaceResponseTransformer.php`
  - [x] `PatientSummaryTransformer` (inline: id, patientNumber, firstName, lastName, phone, dateOfBirth, gender)
  - [x] Reuses `BillingInvoiceResponseTransformer::transform()` for invoice items
- [x] Register route: `GET /api/v1/billing/{patientId}/workspace` in `routes/billing-phase1.php`
- [x] Update frontend `useBillingPatientWorkspace.ts` to call new composite endpoint
  - [x] Reduced from 3 parallel queries to 2 (workspace + charges)
  - [x] Exposes `summary` from endpoint response
- [ ] Create sub-transformers for payments + insurance + claims — *deferred to future phase when those endpoints are also consolidated*
- [ ] **Performance check:** Add eager loading; verify page load < 500ms — *needs runtime profiling*
- [ ] `availableTabs` server-driven tab visibility — **not implemented**; transformer has no such key, all 5 tabs are always rendered client-side regardless of patient state

### Verification

- [x] PHP syntax checks pass for all new files
- [x] Frontend build compiles with updated composable
- [ ] `GET /api/v1/billing/{patientId}/workspace` returns expected response shape — *needs runtime test*
- [ ] Frontend workspace loads from composite endpoint — *needs runtime test*
- [ ] Fallback works if endpoint is unavailable — *needs runtime test*

### 3.1 Known Gap: Payments/Audit tabs still fan out one request per invoice

The composite endpoint only folds in `patient` + `invoices` + `summary`. Two composables built in Phase 2 were **not** touched by Phase 3 and still do the exact N+1 fan-out the composite-endpoint approach was meant to avoid:

- `usePatientPayments.ts` — `Promise.all(paidInvoiceIds.map(id => apiGet('/billing-invoices/{id}/payments')))`
- `usePatientAuditLogs.ts` — `Promise.all(invoiceIds.map(id => apiGet('/billing-invoices/{id}/audit-logs')))`

For a patient with N paid invoices, opening the Payments tab fires N parallel requests (same for Audit). Fine for a handful of invoices, real latency risk once patients accumulate 20-30+. `charges` also remains a separate parallel call rather than being folded into the composite response.

**Fix (tracked in Phase 3.5 below):** add one batch endpoint per resource, scoped by patient, instead of scoped by invoice.

---

## Phase 3.5 — Fix Payments/Audit N+1 Fan-out

**Goal:** Replace the per-invoice `Promise.all()` fan-out in `usePatientPayments.ts` and `usePatientAuditLogs.ts` with a single batched request each, mirroring the `GetBillingPatientWorkspaceUseCase` pattern (query repository by patient's invoice IDs in one call, not one call per invoice).

- [x] Add `listByBillingInvoiceIds(array $billingInvoiceIds): array` to `BillingInvoicePaymentRepositoryInterface` + `EloquentBillingInvoicePaymentRepository` (single `whereIn('billing_invoice_id', $ids)` query, no pagination — matches prior "fetch everything, sort client-side" behavior, now sorted server-side)
- [x] Add `listByBillingInvoiceIds(array $billingInvoiceIds): array` to `BillingInvoiceAuditLogRepositoryInterface` + `EloquentBillingInvoiceAuditLogRepository` (same pattern)
- [x] Add `ListBillingPatientPaymentsUseCase` — resolves the patient's invoice IDs via `BillingInvoiceRepositoryInterface::search()`, fetches payments in one query, merges `invoiceNumber`/`invoiceStatus`/`currencyCode` server-side
- [x] Add `ListBillingPatientAuditLogsUseCase` — same, for audit logs, merges `invoiceNumber`
- [x] Add controller methods + routes in `routes/billing-phase1.php`:
  - [x] `GET /api/v1/billing/{patientId}/payments`
  - [x] `GET /api/v1/billing/{patientId}/audit-logs`
- [x] Update `usePatientPayments.ts` to call the new batch endpoint instead of looping `apiGet` per invoice
- [x] Update `usePatientAuditLogs.ts` to call the new batch endpoint instead of looping `apiGet` per invoice
- [x] Pass `patientId` prop through to `AuditTab.vue` (it previously only received `invoices`)

### Verification

- [x] PHP syntax checks pass for all new/changed files (`php -l`)
- [x] Frontend type-check passes for the changed composables/tabs (`vue-tsc --noEmit`, no new errors introduced)
- [ ] Payments tab for a patient with 20+ paid invoices fires exactly one request, not N — *needs runtime test*
- [ ] Audit tab for a patient with 20+ invoices fires exactly one request, not N — *needs runtime test*
- [ ] No regression in payment/audit data shown (same records, same sort order) — *needs runtime test*

---

## Phase 4 — Delete Dead `invoices/` Code (supersedes original Phase 4 + 5)

**Goal:** The original plan budgeted 1-2 weeks to fix imports across `invoices/Index.vue` (15,101 lines) and then another 2-3 days to decompose it into a thin shell. That work is unnecessary: verified by grep, **`invoices/Index.vue` is not referenced by any route (`routes/*.php`) and not imported by any other file in `resources/js`.** It only still exists on disk — nothing loads it. Per standing project policy, legacy pages that already have a V2/workspace replacement get deleted outright, not patched or decomposed. Since Phase 1-2 already gave the workspace tabs feature parity with what `invoices/Index.vue` did, there is nothing to decompose — just confirm parity and delete.

**Important — not everything under `invoices/` is dead.** Grepping actual importers (not just the architecture doc's file inventory) found:

| Path | Status | Evidence |
|------|--------|----------|
| `invoices/Index.vue` | **Dead** — delete now | No route renders it, no file imports it |
| `invoices/components/*.vue` (32 of 33 files) | **Dead** — delete now | Only reachable from `invoices/Index.vue` |
| `invoices/components/BillingModuleNav.vue` | **Live, but redundant** — repoint then delete | Imported by `cash/Index.vue`, `daily-close/Index.vue`, `refunds/Index.vue`. Diffed against canonical `pages/billing/components/BillingModuleNav.vue` — identical except import order. Safe to repoint to canonical. |
| `invoices/composables/` | **Dead** — delete now | No external importers |
| `invoices/types.ts` | **Live — do not delete** | Imported by the *new* workspace code: `usePatientAuditLogs.ts`, `usePatientPayments.ts`, `PaymentReversalSheet.vue`, `AuditTab.vue`, `InsuranceTab.vue`, `PaymentsTab.vue` |
| `invoices/helpers.ts` / `invoices/constants.ts` | **Live — do not delete** | Same 4 workspace files depend on these |

- [x] Feature-parity checklist: confirmed via grep — `invoices/Index.vue` was not referenced by any route or import anywhere, so there was no live functionality to lose
- [x] Repoint `BillingModuleNav` import in `cash/Index.vue`, `daily-close/Index.vue`, `refunds/Index.vue` from `invoices/components/BillingModuleNav.vue` to `pages/billing/components/BillingModuleNav.vue`
- [x] Delete `resources/js/pages/billing/invoices/Index.vue`
- [x] Delete `resources/js/pages/billing/invoices/components/` (34 files removed total between this and Index.vue)
- [x] Delete `resources/js/pages/billing/invoices/composables/` (3 files: `useBillingFinancialControls.ts`, `useBillingPermissions.ts`, `usePaymentReversal.ts`)
- [x] **Left `invoices/types.ts`, `invoices/helpers.ts`, `invoices/constants.ts` in place** — confirmed live dependencies of `PaymentsTab.vue`, `AuditTab.vue`, `InsuranceTab.vue`, `PaymentReversalSheet.vue`. `invoices/Print.vue` also left in place (out of scope — needs separate verification against root-level `Print.vue` before touching, per original Phase 8 note).

### Verification

- [x] `cash/Index.vue`, `daily-close/Index.vue`, `refunds/Index.vue` import `BillingModuleNav` from the canonical path now
- [x] `pages/billing/invoices/Index.vue` no longer exists
- [x] `pages/billing/invoices/components/` no longer exists
- [x] `pages/billing/invoices/composables/` no longer exists
- [x] `vue-tsc --noEmit` shows no "Cannot find module" errors and no new errors referencing the deleted paths (526 pre-existing unrelated errors elsewhere in the codebase, unchanged by this work)
- [ ] Manual smoke test: open `/billing-cash`, `/billing-daily-close`, `/billing-refunds` and confirm `BillingModuleNav` still renders — *needs runtime test*

---

## Phase 6 — Consolidate List Page

**Goal:** Strip detail panel from IndexV2. Make it a list-only page that links to workspace.

- [x] Copy `IndexV2.vue` → `List.vue` (new list-only page)
- [x] Remove from `List.vue`:
  - [x] Patient detail panel (right side)
  - [x] Payment sheet
  - [x] Bulk payment sheet
  - [x] Reversal dialog
  - [x] Undo toast
  - [x] Invoice-related computed refs (unpaidInvoices, totalUnpaid, totalBilled)
  - [x] Payment-related functions (recordPayment, recordBulkPayment, applyOptimisticPayment, etc.)
  - [x] Invoice-related functions (openPaymentDialog, issueInvoice, addCandidateToInvoice)
  - [x] Keyboard handlers for payment/bulk sheets
- [x] Change row click behavior: `selectPatient(entry)` → `router.visit('/billing/' + entry.patientId)`
- [x] Remove from `List.vue` script:
  - [x] `useBillingPatientInvoices` import and usage
  - [x] `selectedInvoiceIds`, `showPaymentDialog`, `paymentInvoice` and related refs
  - [x] `undoStack`, `showUndoToast`, `undoTimer` and related refs
  - [x] `capturingCandidateIds`, `issuingInvoiceIds` and related refs
  - [x] Draft payment functions (`saveDraftPayment`, `loadDraftPayment`, `clearDraftPayment`)
  - [x] Cache patch functions (`patchPatientInvoicesCache`, `patchQueueCache`, `updateQueueForPatient`)
  - [x] `loadPatientByIdDirect` function — replaced with a `router.visit()` redirect to the workspace on mount, preserving `focusInvoiceId`
- [x] Register route: `GET /billing` → `List.vue` in `routes/web.php`
- [x] Update sidebar navigation to point to `/billing` (from `/billing-invoices`) — `config/appNavCatalog.ts` "Invoices & billing" entry

**Extra fix found and applied while wiring the redirect:** `Workspace.vue` had no support for `focusInvoiceId` at all — a straight redirect from `List.vue`'s deep-link handler would have silently dropped the Patient Chart's "jump to this invoice" behavior. Added `focusInvoiceId` prop + scroll/highlight to `InvoicesTab.vue`, parsed the query param in `Workspace.vue`, and updated its breadcrumb to point at `/billing` instead of `/billing-invoices`.

**Extra fix found while updating the sidebar:** changing the nav entry's `href` from `/billing-invoices` to `/billing` would have silently broken two things that key off that exact string — `routeAccess.ts`'s permission-gating table and `facilityPageEntitlements.ts`'s entitlement table both only had a `/billing-invoices` rule (no `/billing` rule would have meant the sidebar link showed but visiting it read as ungated), and `AppSidebar.vue`'s `BADGE_HREF_MAP` keyed the unpaid-invoice count badge off `/billing-invoices` (would have silently dropped the badge). Added matching `/billing` entries to both tables (verified segment-boundary matching so it can't shadow `/billing-cash` etc.) and updated the badge map key.

### Verification

- [x] `vue-tsc --noEmit`: 0 new errors introduced (526 pre-existing errors unchanged; `List.vue`, updated `InvoicesTab.vue`/`Workspace.vue`, `appNavCatalog.ts`, `AppSidebar.vue`, `routeAccess.ts`, `facilityPageEntitlements.ts` all compile clean)
- [x] `php -l routes/web.php` passes
- [ ] `/billing` shows the queue with search, status tabs, pagination — *needs runtime test*
- [ ] Clicking a patient navigates to `/billing/{patientId}` (workspace) — *needs runtime test*
- [ ] No detail panel appears in `/billing` — *needs runtime test*
- [ ] `?patientId=X&focusInvoiceId=Y` deep links redirect to the workspace and scroll/highlight the right invoice — *needs runtime test*
- [ ] `/billing-invoices` still renders full IndexV2 (legacy support, unmodified) — *needs runtime test*
- [ ] Sidebar link points to `/billing` and the unpaid-invoice badge still shows — *needs runtime test*

---

## Phase 7 — Add Consistent Navigation

**Goal:** Add BillingModuleNav to V2 pages for consistent intra-billing navigation.

- [x] Audit current `BillingModuleNav.vue` — does it need enhancement?
  - [x] Current links: Invoices, Cash payments, Refunds
  - [x] Decided: keep focused on cashier workflow, no Daily Close/Financial Reports added (matches original recommendation)
- [x] Add `BillingModuleNav` to `List.vue`
- [x] Add `BillingModuleNav` to `CashV2.vue`
- [ ] (Optional) Create shared `BillingLayout.vue` — not done, only 2 V2 pages have the nav so far, not worth extracting yet

**Also updated while wiring this in:** the nav's "Invoices" link still pointed at `/billing-invoices` (the pre-cutover page) — now points at `/billing` (`List.vue`), matching the sidebar cutover from Phase 6. Its active-state check was a plain `startsWith('/billing-invoices')`; changed to a segment-boundary check (`u === '/billing' || u.startsWith('/billing/') || u.startsWith('/billing-invoices')`) so `/billing`, `/billing/{patientId}`, and the legacy `/billing-invoices` all light up the Invoices tab, without also matching `/billing-cash` or `/billing-refunds`.

### Verification

- [x] `vue-tsc --noEmit`: 0 new errors (526 pre-existing, unchanged) for `List.vue`, `CashV2.vue`, `BillingModuleNav.vue`
- [ ] `List.vue` shows BillingModuleNav with Invoices, Cash, Refunds tabs — *needs runtime test*
- [ ] `CashV2.vue` shows BillingModuleNav — *needs runtime test*
- [ ] Navigation between billing sections is consistent — *needs runtime test*
- [ ] Active tab highlights correctly on `/billing`, `/billing/{patientId}`, `/billing-cash`, `/billing-refunds` — *needs runtime test*

---

## Phase 7.5 — UX Alignment to Encounters List Pattern

**Goal (user-directed, not in the original redesign doc):** Billing V2 pages should match `encounters/List.vue`'s structure, not just be "V2 architecture" underneath. First target: `List.vue`.

- [x] Restructured `List.vue`'s header to match `encounters/List.vue`: `<Tabs>` now wraps the whole sticky-header + content region (`class="contents"`), title/description on the left, actions on the right
- [x] Added a 3-tile stat row (All / Unpaid / Paid) below the header, matching encounters' stat-tile grid pattern (billing only has 3 status buckets vs. encounters' 8, so 3 tiles not 8)
- [x] Removed `BillingModuleNav` (the tab-strip nav bar) from `List.vue` — user flagged it as "old UI"
- [x] Replaced it with plain header-right `Button` + `Link` pairs ("Cash payments", "Refunds") next to the existing refresh/clear-filters buttons — same visual language as encounters' right-aligned action buttons
- [x] `vue-tsc --noEmit`: 0 new errors (526 pre-existing, unchanged)

**Not yet done:** `CashV2.vue` and `Workspace.vue` still use the old header pattern (`CashV2.vue` still has `BillingModuleNav`); this was scoped to `List.vue` only per the request ("First is billing list page"). Follow-up pages should get the same treatment when requested.

**Follow-up: removed the manual refresh button, moved to the queue-page auto-poll pattern.** User asked whether the header refresh button could instead follow "the mechanism used in queues." Checked `useReceptionQueue.ts`/`useReceptionQueueStatusCounts.ts` (and emergency/pharmacy/lab/radiology/direct-service queues) — all use `refetchInterval: 30_000` with no manual refresh button and no "Retry" button on error (the alert just sits until the next poll recovers it). Applied the same to billing:
- [x] Added `refetchInterval: 30_000` to `useBillingCashierQueue.ts`
- [x] Added `refetchInterval: 30_000` to `useBillingCashierQueueStatusCounts.ts`
- [x] Removed the header refresh button and `refreshQueue()` from `List.vue`
- [x] Removed the error banner's "Retry" button (was calling the now-deleted `refreshQueue()`) — banner still shows, just no manual action, matching reception's error alerts
- [x] `vue-tsc --noEmit`: 0 new errors (526 pre-existing, unchanged)

**Follow-up: real "Live"/"Polling" WebSocket indicator, matching reception's header badge.** User asked what the dot+"Live"/"Polling" label next to `Reception Queue`'s title was. Explained it's backed by a real Echo/Reverb subscription (`useFacilityLiveUpdates.ts` → `patient-flow.{facilityId}` channel, `PatientFlowBoardUpdated` event, queued `ShouldBroadcast`) with `refetchInterval: 30_000` as the fallback if the socket is down — not just decorative. Billing invoice/payment activity isn't one of `PatientFlowBoardUpdated`'s triggers (check-in, appointment status, lab/pharmacy/radiology completion, direct-service status), so there was no existing channel to subscribe to. User chose the real-WebSocket option over a polling-only label or skipping it. Built billing's own equivalent rather than reusing patient-flow's channel:

- [x] New event `App\Modules\Billing\Domain\Events\BillingCashierQueueUpdated` — mirrors `PatientFlowBoardUpdated` exactly: `ShouldBroadcast` (queued, not `ShouldBroadcastNow`), `PrivateChannel('billing-queue.'.$facilityId)`, `broadcastAs() => 'queue.updated'`, payload is just `facilityId` (listeners invalidate + refetch, no pushed data shape to drift)
- [x] New `App\Modules\Billing\Application\Services\BillingQueueChannelAuthorizer` — mirrors `PatientFlowBoardChannelAuthorizer`: checks `billing.invoices.read` permission + universal-admin bypass + `facility_user` pivot `is_active` check
- [x] Registered `billing-queue.{facilityId}` in `routes/channels.php`
- [x] Dispatched `BillingCashierQueueUpdated` (via `event(new ...)`, matching the codebase's existing idiom) from all 4 use cases that change what the cashier queue shows:
  - [x] `RecordBillingInvoicePaymentUseCase`
  - [x] `ReverseBillingInvoicePaymentUseCase`
  - [x] `UpdateBillingInvoiceStatusUseCase` (covers "issue invoice" — there's no separate `IssueBillingInvoiceUseCase`)
  - [x] `CreateBillingInvoiceUseCase` — both the fresh-create path and the existing-draft-continuation path (charge capture appends to a draft), since both affect the queue
- [x] New frontend composable `resources/js/composables/billingCashierQueue/useBillingCashierQueueLiveUpdates.ts` — bespoke (not reusing `useFacilityLiveUpdates.ts`, which is hardcoded to the patient-flow channel/event names) but structurally identical: same `useEcho` + `useConnectionStatus` + debounced invalidate pattern, pointed at `billing-queue.{facilityId}` / `.queue.updated`
- [x] Wired into `List.vue`: `useBillingCashierQueueLiveUpdates([['billing-cashier-queue'], ['billing-cashier-queue-status-counts']])`, dot+"Live"/"Polling" badge added next to the `<h1>`, exact markup/classes copied from `reception/Queue.vue`
- [x] `php -l` clean on all new/changed PHP files; `vue-tsc --noEmit`: 0 new errors (526 pre-existing, unchanged)

**Not done:** no dedicated unit test for `BillingQueueChannelAuthorizer` — checked for a `PatientFlowBoardChannelAuthorizerTest` to mirror and found none exists either, despite its docblock claiming to be "directly unit tested" (stale comment, or tested only via feature tests elsewhere) — matched what actually exists rather than what a comment claims.

### Verification

- [ ] `/billing` visually matches `/encounters` structure (stat tiles, Tabs-wrapped sticky header, right-aligned buttons) — *needs runtime/visual test*
- [ ] "Cash payments" / "Refunds" buttons navigate correctly — *needs runtime test*
- [ ] Queue auto-refreshes every 30s without a manual refresh button — *needs runtime test*
- [ ] Header shows "Live" (green dot) when Reverb is connected, "Polling" (grey dot) otherwise — *needs runtime test, requires Reverb running*
- [ ] Recording a payment / reversing a payment / issuing an invoice / capturing a charge on one open tab updates the queue on another open tab within ~1s (not waiting for the 30s poll) — *needs runtime test with Reverb running*
- [ ] `billing-queue.{facilityId}` channel auth rejects a user without `billing.invoices.read` — *needs runtime test*

**Second target: `workspace/Workspace.vue`, matched to `encounters/WorkspaceV2.vue`.** Compared structurally against `encounters/WorkspaceV2.vue` (not just `List.vue`) since workspace has its own distinct pattern (single-file header, no separate header component; sticky header only renders once data loads; TabsContent blocks share one scrolling area instead of each being independently scrollable):

- [x] Folded `WorkspaceHeader.vue` into `Workspace.vue` directly — encounters/WorkspaceV2.vue and encounters/List.vue both keep the header inline in the page file, no separate header component; deleted `WorkspaceHeader.vue` (confirmed zero other importers first)
- [x] `<Tabs v-model="activeTab" class="contents">` now wraps the whole page (was previously only wrapping `TabsList`+`TabsContent` in its own `flex min-h-0 flex-1 flex-col overflow-hidden` sub-layout — independently-scrolling tab panels, unlike encounters)
- [x] Sticky header now only renders `v-if="patient"` (i.e. once workspace data has loaded) — matches encounters' `v-if="workspace.data.value"`; no more skeleton placeholders inside a header that renders regardless of load state
- [x] Patient name is now a `<Link>` to `/patients/{id}/chart` directly on the `<h1>` (hover:underline) — matches encounters' pattern of the name carrying chart navigation itself, rather than a separate "Patient Chart" button (removed) and a separate back-chevron button (removed — breadcrumbs handle back-navigation, encounters has no back button either)
- [x] Added a demographics line (gender · DOB (age) · patient number · phone) using the shared `lib/patientAge.ts` (`deriveAgeFromDateOfBirth`/`formatAgeLabel`) rather than duplicating encounters' own local age-calculation function — reuse over duplication
- [x] Replaced the old "Billed/Unpaid inline text, hidden on mobile" stat pair with a 3-tile stat grid (Total billed / Unpaid / Unpaid invoices) matching the `rounded-md border bg-muted/50 px-2.5 py-1.5` tile style used in both encounters pages and `List.vue`
- [x] Replaced the heavily-custom-styled `TabsList` (grid-cols-5, primary/10 backgrounds, per-trigger `AppIcon`s) with encounters' plain `flex w-full flex-wrap justify-start gap-1` + default `TabsTrigger` styling — dropped the per-tab icons entirely (encounters' own TabsList has no icons either, just label + count badge)
- [x] Loading/error/content now follow encounters' exact three-way branch: `workspace.isPending` → `Skeleton` pair, else `workspace.isError` → `Alert`, else `<template v-else-if="patient">` wrapping all 5 `TabsContent` blocks — previously each tab independently checked `isLoading` and rendered its own `RegistryListSkeleton`
- [x] `TabsContent` panels changed from `m-0 flex min-h-0 flex-1 flex-col overflow-auto p-4` (self-contained scrolling panels) to plain `space-y-4` inside one shared `space-y-4 px-4 pb-6 md:px-6` content area — matches encounters, where the whole page scrolls together rather than each tab owning its own scroll region
- [x] `vue-tsc --noEmit`: error count dropped from 526 to **523** — removing the invalid `AppIcon` names (`dollar-sign`, `shield`, `history`) that were on the old `TabsList` fixed 3 pre-existing type errors as a side effect, no new errors introduced

**Not done / explicitly out of scope this pass:** did not add header action buttons (encounters has "History"/"Close encounter" buttons; billing's workspace has no equivalent single primary action, so none were added — this isn't a gap, just nothing to port). Did not touch `InsuranceTab.vue`'s pre-existing `payerSummary` type errors (9 errors, present before and after, unrelated to this restructure).

### Verification

- [ ] `/billing/{patientId}` visually matches `/encounters/{id}/v2` structure (sticky header only after load, stat tiles, plain TabsList, single scroll area) — *needs runtime/visual test*
- [ ] Patient name link navigates to `/patients/{id}/chart` — *needs runtime test*
- [ ] All 5 tabs (Invoices, Payments, Charges, Insurance, Audit) still render their content correctly in the new single-scroll-area layout — *needs runtime test*
- [ ] `focusInvoiceId` deep-link scroll/highlight still works inside the new layout — *needs runtime test*

**Third pass: empty-state placeholders across all tabs, matched to encounters' exact two-tier pattern.** User flagged that the per-tab "no data" placeholders didn't match encounters' style. Checked `encounters/WorkspaceV2.vue`'s actual empty-state markup (not assumed) and found two distinct tiers, both reused as-is:

- **Whole-tab "nothing here at all"**: `rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground` — applied to: `Workspace.vue`'s Invoices tab (replacing the `InventoryEmptyState` icon+title+description component — now-unused import removed), `PaymentsTab.vue`, `ChargesTab.vue`, `AuditTab.vue`, and `InsuranceTab.vue`'s top-level empty state
- **Nested sub-section note** (e.g. encounters' "No orders linked yet" inside a populated Orders tab): `rounded-lg bg-muted/25 px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/30` (no `text-center`, no `border`) — considered for `InsuranceTab.vue`'s per-card empty states, then superseded by the fix below

**Caught on review (user: "insurance has multiple placeholder, check it carefully"):** `InsuranceTab.vue` has two independent data sections (insurance records, third-party invoices) plus a whole-tab fallback — three placeholder-shaped things, not one. My first pass gave the whole-tab fallback the tier-1 style and the "Insurance Records" card a nested tier-2 empty state, but left the "Third-Party Invoices" `Card` with **no empty state at all** (`v-if="thirdPartyInvoices.length > 0"` on the card itself — if insurance records existed but no third-party invoices, that section just silently didn't exist, no placeholder, no card, nothing). Checked how encounters actually handles this exact multi-section shape (its Results tab: lab results + radiology reports) and it does **not** show a per-section empty note next to a populated one — `hasAnyResults` gates one combined message when *everything* is empty, and each section (`v-if="resultedLabOrders.length"` / `v-if="reportedRadiologyOrders.length"`) simply doesn't render at all if that section alone is empty. Rebuilt `InsuranceTab.vue` to match this exactly instead of inventing a three-tier scheme:
- [x] Added `hasAnyInsuranceData` computed (`insuranceRecords.length > 0 || thirdPartyInvoices.length > 0`), mirroring encounters' `hasAnyResults`
- [x] Top-level: `v-if="!hasAnyInsuranceData"` → single combined "No insurance or third-party coverage information found." message (tier-1 style)
- [x] `v-else`: both `Card`s render only `v-if` they individually have data — no per-card empty-state text anymore, matching encounters' Results tab exactly
- [x] Removed an unused `Separator` import found while restructuring this file (dead since before this change, unrelated to the placeholder fix, cleaned up since it was already in view)
- [x] `vue-tsc --noEmit`: still 523 errors, 0 new (the file's 9 pre-existing `payerSummary` type errors are unchanged, just at shifted line numbers)

### Verification

- [ ] Patient with insurance records but no third-party invoices: Insurance Records card shows, Third-Party Invoices card doesn't render, no stray empty-state text — *needs runtime test*
- [ ] Patient with neither: single combined "No insurance or third-party coverage information found." message — *needs runtime test*
- [ ] Patient with both: both cards render with their data — *needs runtime test*

## Bug: workspace actions didn't refresh the UI without a manual page reload

**Reported by user:** "issue invoice does not auto change data untill refresh page. also other actions, even when record payment, something is not okay."

**Root cause, traced to a single function:** `useBillingCashierActions.ts`'s shared `invalidate(patientId)` — called after every mutation (record payment, reverse payment, issue invoice, add charge to draft, create invoice from candidate) across `InvoicesTab.vue`, `PaymentsTab.vue`, and `ChargesTab.vue` — only invalidated two query keys: `['billing-cashier-queue']` and `['billing-cashier-patient', patientId]`. The second key is `useBillingPatientInvoices.ts`'s query key — the **old** `IndexV2.vue` detail-panel composable. The new workspace doesn't use that composable at all; it reads from `useBillingPatientWorkspace.ts` (`['billing-patient-workspace', patientId]`), `usePatientPayments.ts` (`['billing-patient-payments', patientId]`), and `usePatientAuditLogs.ts` (`['billing-patient-audit-logs', patientId]`) — none of which were ever invalidated. So every mutation succeeded server-side (confirmed: the action call sites in every tab component were already correctly calling `invalidate()` — this wasn't a "forgot to call it" bug), but the workspace's own cached data just sat stale until a full page reload started a fresh query with no stale cache to skip.

Verified this is the *only* pathway: grepped the whole `pages/billing/workspace/` tree for `apiPost`/`apiPatch`/`mutateAsync`/`useMutation` — every mutation in the workspace goes through this one shared composable, no tab bypasses it with its own fetch call.

**Fix — `resources/js/composables/billingCashierQueue/useBillingCashierActions.ts`:**
- [x] `invalidate()` now also invalidates `['billing-patient-workspace', patientId]`, `['billing-patient-payments', patientId]`, `['billing-patient-audit-logs', patientId]`, and `['billing-cashier-queue-status-counts']` (unconditionally, alongside the existing `billing-cashier-queue`)
- [x] Kept the old `billing-cashier-patient` invalidation too — `IndexV2.vue` (the pre-cutover page, still reachable at `/billing-invoices`) still depends on it
- [x] `vue-tsc --noEmit`: 523 errors, 0 new

### Verification

- [ ] Issue a draft invoice from the Invoices tab — status flips to "issued" without a page reload — *needs runtime test*
- [ ] Record a payment — invoice balance/status and the header's Total billed/Unpaid tiles update without a page reload — *needs runtime test*
- [ ] Reverse a payment from the Payments tab — payment list shows the reversal entry and invoice balance updates without a page reload — *needs runtime test*
- [ ] Add a charge candidate to an invoice from the Charges tab — candidate disappears from Charges, appears on Invoices, without a page reload — *needs runtime test*
- [ ] After any of the above, navigate back to `/billing` — the queue row's unpaid/unbilled counts reflect the change without a page reload — *needs runtime test*

## Bug: cashier/accountant got "Unable to load this patient's billing — This action is unauthorized" on every workspace visit

**Reported by user:** roles Accountant (`FINANCE.OFFICER`) and Cashier (`FINANCE.CASHIER`) both got a hard authorization failure just from opening a patient's billing workspace, despite `config/roles.php` listing `billing.invoices.read` for both roles.

**Root cause:** `useBillingPatientWorkspace.ts` fires two parallel requests in one `Promise.all` — the workspace endpoint (`GET /billing/{patientId}/workspace`, gated `billing.invoices.read` — both roles have this) and the charge-capture-candidates list (`GET /billing-invoices/charge-capture-candidates`, gated **`billing.invoices.create`** — neither role has this). `Promise.all` rejects if either call 403s, so the *entire* workspace query failed even though the read-only part would have succeeded on its own. The route's permission was simply wrong: listing unbilled charge candidates is a read operation, not a create operation — the actual write actions that consume that list (`POST /billing-invoices`, `PATCH /billing-invoices/{id}`) already have their own separate `billing.invoices.create`/`billing.invoices.update-draft` gates, so loosening the GET doesn't weaken anything.

**Fix:** `routes/api.php` — changed `GET billing-invoices/charge-capture-candidates` from `can:billing.invoices.create` to `can:billing.invoices.read`.

### Verification

- [ ] Log in as a user with only the Cashier or Accountant role and open `/billing/{patientId}` — workspace loads without an authorization error — *needs runtime test*
- [ ] Charges tab shows candidates for that user — *needs runtime test*
- [ ] A user without `billing.invoices.create` still gets 403 on `POST /billing-invoices` / `PATCH /billing-invoices/{id}` (the actual write actions stayed gated) — *needs runtime test*

---

## Feature: invoice preview, invoice print, receipt print

**User-directed, not in the original redesign doc.** Before building anything, checked what document infrastructure already existed rather than assuming a blank slate — found a fully-built, already-modern pattern (`DocumentShell.vue`, `billing/Print.vue`, `BillingInvoiceDocumentController`, `BrandedPdfDocumentManager`, `DocumentContextLookup`, `DocumentAuditTrailManager`) that the new workspace simply never got wired up to. Also found that `pages/billing/components/InvoiceDetailsSheet.vue` — which might have looked like an existing "preview" component — is dead code: its only consumer was `invoices/Index.vue`, deleted in Phase 4, and its prop contract (`state`/`view`/`actions`/`helpers` untyped grab-bags) is unusably coupled to that deleted file's internals anyway. Did not attempt to revive or reuse it.

**Invoice print** — reused existing infra entirely, zero backend work:
- [x] `InvoicesTab.vue`: added a "Print" button per invoice, linking to the existing `/billing-invoices/{id}/print` (gated `billing.invoices.read`, which every role that can view the workspace already has)

**Invoice preview** — new, self-contained, no extra API call (every field is already in the workspace's in-memory `invoices` list):
- [x] Built `pages/billing/workspace/sheets/InvoicePreviewSheet.vue` — line items table, totals breakdown (subtotal/discount/tax/grand total/paid/balance), notes, a "Print" button that hands off to the real print route rather than duplicating it
- [x] Extended the `BillingInvoice` type (`useBillingPatientInvoices.ts`) with `subtotalAmount`/`discountAmount`/`taxAmount`/`notes` — the backend transformer already sends these, the frontend type just hadn't declared them since nothing used them client-side before
- [x] Added the same string→number normalization for the 3 new amount fields to **both** places that already normalize `totalAmount`/`paidAmount`/`balanceAmount` (`useBillingPatientInvoices.ts` and `useBillingPatientWorkspace.ts` each have their own copy of this normalizer)
- [x] `InvoicesTab.vue`: added a "Preview" button per invoice, wired to the new sheet

**Receipt print** — genuinely new; no receipt-document infrastructure existed at all (only an old ad-hoc `printReceipt()` in the pre-rebuild cashier queue page that built raw HTML in a popup window — not reused, since the ask was "modern UI/UX" and this repo already has a better pattern). Built by mirroring `BillingInvoiceDocumentController` exactly, just keyed on a single payment instead of the whole invoice:
- [x] `App\Modules\Billing\Application\UseCases\GetBillingInvoicePaymentUseCase` — thin wrapper around the already-existing `BillingInvoicePaymentRepositoryInterface::findByIdForBillingInvoice()` (same repository method `ReverseBillingInvoicePaymentUseCase` already uses)
- [x] `App\Modules\Billing\Presentation\Http\Controllers\BillingPaymentReceiptDocumentController` — `show()` (Inertia page) + `downloadPdf()` (branded PDF via `BrandedPdfDocumentManager`, audit-logged via `DocumentAuditTrailManager` same as invoice PDF downloads). Rejects reversal ledger entries with 404 — a reversal isn't a receipt-worthy event
- [x] `resources/views/documents/billing-payment-receipt.blade.php` — PDF template using the same `<x-documents.pdf-layout>` Blade component and `DocumentViewFormatter` the invoice PDF uses
- [x] `resources/js/pages/billing/invoices/Receipt.vue` — mirrors `Print.vue`'s structure (`DocumentShell`, Print/Download PDF/Back buttons)
- [x] Routes: `GET billing-invoices/{invoiceId}/payments/{paymentId}/receipt` (page) + `.../receipt/pdf` (download), both gated `billing.payments.view-history` (the permission that already gates seeing payment details at all — both Cashier and Accountant roles have it)
- [x] `PaymentsTab.vue`: added a "Receipt" button per non-reversal payment

**Verification:**
- [x] `php -l` clean on all new/changed PHP files
- [x] `vue-tsc --noEmit`: 523 errors, 0 new

### Runtime verification still needed

- [ ] Preview sheet shows correct line items/totals for a real invoice — *needs runtime test*
- [ ] "Print" from the Invoices tab and from inside the preview sheet both open `/billing-invoices/{id}/print` and render correctly — *needs runtime test*
- [ ] "Receipt" from the Payments tab opens the receipt page, shows correct payment/patient/invoice data, and "Download PDF" produces a real PDF — *needs runtime test*
- [ ] Receipt route correctly 404s if given a reversal payment's ID instead of a real payment — *needs runtime test*
- [ ] Both receipt routes work for the Cashier/Accountant roles (not just admin) — *needs runtime test*

---

## Phase 7.5 (cont'd): CashV2.vue UI pass

**User-directed follow-up** to the encounters-pattern work — `List.vue` and `Workspace.vue` had it, `CashV2.vue` (a master-detail page, structurally different from either — kept as-is, this was a UI pass not an architecture change) did not:

- [x] Removed `BillingModuleNav` (the tab-strip nav bar), replaced with right-aligned `Button`+`Link` pairs ("Invoices" → `/billing`, "Refunds" → `/billing-refunds") next to the page's own action buttons (New cash account, Refresh, Clear filters)
- [x] `<Tabs :model-value="filters.status" class="contents">` now wraps the whole page (previously only wrapped `TabsList` in its own `mt-3` sub-block) — matches `List.vue`/`Workspace.vue`/encounters
- [x] Top-level status `TabsList` (All/Active/Settled/Suspended) simplified from `grid grid-cols-4` to plain `flex flex-wrap justify-start gap-1`
- [x] Account-detail panel's Charges/Payments `TabsList` simplified from the heavy custom-pill styling (`grid grid-cols-2 gap-1 bg-muted/40 p-1`) to the same plain style — matches what `Workspace.vue` got in the earlier pass
- [x] Stat tiles (Active/Settled/Suspended) were already tile-styled correctly — left as-is
- [x] Master-detail (list + inline account panel) layout **kept as-is** — that's `CashV2.vue`'s own established architecture, not part of the billing-invoices List→Workspace split the redesign doc calls for; this was scoped as a UI pass, not a restructure
- [x] `vue-tsc --noEmit`: 523 errors, 0 new; manually verified `<Tabs>`/`</Tabs>` tag balance (2 open, 2 close) since vue-tsc's own template-structure checking isn't exhaustive

### Verification

- [ ] `/billing-cash` visually matches the `List.vue`/encounters header pattern (stat tiles, plain TabsList, right-aligned buttons) — *needs runtime/visual test*
- [ ] "Invoices" / "Refunds" buttons navigate correctly — *needs runtime test*
- [ ] Selecting an account still opens the detail panel with working Charges/Payments tabs — *needs runtime test*
- [ ] All existing sheets/dialogs (new account, record charge, record payment, convert, void, refund) still open and submit correctly — *needs runtime test*

---

## Phase 8 — Delete Legacy Files

**Goal:** Remove all legacy/dead code after confirming no active references.

### 8.1 Pre-Deletion Verification

- [ ] **Grep `Import` statements:** `rg "'(\.\./)?pages/billing/Index'" --include="*.vue" --include="*.ts"`
- [ ] **Grep Inertia renders:** `rg "Inertia::render\(.*billing/Index" --include="*.php"`
- [ ] **Grep route references:** `rg "billing-invoices/legacy|billing-cash/legacy" --include="*.php" --include="*.vue" --include="*.ts"`
- [ ] **Grep sidebar links:** `rg "href=['\"]/billing-invoices['\"]" --include="*.vue" --include="*.php"` (should now point to `/billing`)
- [ ] **Grep patient chart links:** `rg "billing-invoices" --include="*.vue" --include="*.ts"` (should now point to `/billing/`)
- [ ] Verify `BillingRoutingController.php` doesn't reference legacy routes
- [ ] Verify any external integrations don't link to legacy URLs

### 8.2 File Deletions

After all checks pass:

- [ ] Delete `resources/js/pages/billing/Index.vue`
- [ ] Delete `resources/js/pages/billing/Cash.vue`
- [ ] Delete `resources/js/pages/billing/cash/Index.vue` (alternative cash page)
- [ ] Delete `resources/js/pages/billing/refunds/Index.vue` (duplicate)
- [ ] Delete `resources/js/pages/billing/daily-close/Index.vue` (duplicate)
- [ ] Delete `resources/js/pages/billing/invoices/Print.vue` (if duplicates Print.vue at root level — verify first)
- [x] ~~Delete `resources/js/pages/billing/invoices/Index.vue`~~ — moved up to Phase 4 (file was already dead/unrouted, didn't need to wait for List.vue cutover)

### 8.3 Route Cleanup

- [ ] Remove `GET /billing-invoices/legacy` from `routes/web.php`
- [ ] Remove `GET /billing-cash/legacy` from `routes/web.php`
- [ ] Remove any other legacy rollback routes that are no longer needed

### 8.4 Final Verification

- [ ] `GET /billing` renders List.vue (consolidated queue)
- [ ] `GET /billing/{patientId}` renders Workspace.vue
- [ ] `GET /billing-invoices` still works (if kept as alias) or redirects to `/billing`
- [ ] All sidebar/header links to billing pages resolve correctly
- [ ] All patient chart links to billing resolve correctly
- [ ] All encounter workspace links to billing resolve correctly
- [ ] No 404s in billing navigation
- [ ] Build completes without errors (`npx vite build`)

---

## Phase 9 — Future Opportunities (Post-MVP)

**Not in scope for initial migration — documented for future reference.**

- [ ] **Create shared `BillingLayout.vue`** — extract common billing page structure (navigation, breadcrumbs, scroll container) into a reusable layout, analogously to how all billing pages currently repeat the same patterns
- [ ] **Add E2E tests** for the workspace workflow — cover: load workspace, record payment, bulk payment, reversal, charge capture, issue invoice
- [ ] **Add unit tests** for workspace composables — cover: optimistic updates, cache invalidation, error recovery
- [ ] **Parallelize bulk payments** — record payments concurrently instead of sequentially, with rollback on partial failure
- [ ] **WebSocket/live updates** — push payment confirmations from Selcom/TIPS gateway to workspace without polling
- [ ] **Patient-facing portal page** — `/pay/{paymentLinkToken}` for self-service payment (identified as gap in earlier audit)
- [ ] **PHI masking** — add configurable masking of patient name/phone on queue rows

---

## Summary Dashboard

| Phase | Tasks | Est. Days | Status |
|-------|-------|-----------|--------|
| 0 — Preparation | 7 sub-tasks | 1 | ✅ |
| 1 — Workspace Shell + Invoices Tab | ~30 sub-tasks | 3-5 | ✅ |
| 2 — Remaining Workspace Tabs | ~20 sub-tasks | 3-5 | ✅ |
| 3 — Server-Side Endpoint | ~10 sub-tasks | 2-3 | ✅ (reduced scope — see 3.1 gap) |
| 3.5 — Fix Payments/Audit N+1 | ~9 sub-tasks | 1 | 🔄 (code done, needs runtime test) |
| 4 — Delete Dead `invoices/` Code *(replaces old Phase 4+5)* | ~10 sub-tasks | 0.5-1 | 🔄 (code done, needs smoke test) |
| 6 — Consolidate List Page | ~15 sub-tasks | 2-3 | 🔄 (code done, needs runtime test) |
| 7 — Add Consistent Navigation | ~5 sub-tasks | 0.5-1 | 🔄 (code done, needs runtime test) |
| 8 — Delete Legacy Files | ~15 sub-tasks | 1 | ⬜ |
| **Total** | **~130 sub-tasks** | **13-19** | **Phases 0-4, 6-7** 🔄 — original Phase 4+5 estimate of 3-7 days cut to 0.5-1 day; 34 dead files removed |

---

## Quick Reference: File Paths

| Logical Name | Path |
|-------------|------|
| Workspace page | `resources/js/pages/billing/workspace/Workspace.vue` |
| Consolidated list | `resources/js/pages/billing/List.vue` |
| Workspace composables | `resources/js/composables/billingWorkspace/*.ts` |
| Workspace endpoint use case | `app/Modules/Billing/Application/UseCases/GetBillingPatientWorkspaceUseCase.php` |
| Workspace controller | `app/Modules/Billing/Presentation/Http/Controllers/BillingPatientWorkspaceController.php` |
| Workspace transformer | `app/Modules/Billing/Presentation/Http/Transformers/BillingPatientWorkspaceResponseTransformer.php` |
| Billing routes | `routes/billing-phase1.php` (API) + `routes/web.php` (Inertia) |
| Canonical components | `resources/js/pages/billing/components/` |
| Duplicates (deleted in Phase 4) | ~~`resources/js/pages/billing/invoices/components/`~~ — removed |
| Existing V2 queue page | `resources/js/pages/billing/IndexV2.vue` (source for extraction) |
| Legacy queue page | `resources/js/pages/billing/Index.vue` (to delete in Phase 8) |
| Live files kept from `invoices/` | `invoices/types.ts`, `invoices/helpers.ts`, `invoices/constants.ts`, `invoices/Print.vue` — still used by workspace tabs, not dead |
| Existing V2 cash page | `resources/js/pages/billing/CashV2.vue` (add navigation in Phase 7) |
| Encounter reference | `resources/js/pages/encounters/WorkspaceV2.vue` |
| Encounter composable ref | `resources/js/composables/useEncounterWorkspace.ts` |

---

*End of TODO tracker. Update checkboxes as work progresses.*
