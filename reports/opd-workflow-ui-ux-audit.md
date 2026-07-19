# Outpatient Visit Workflow — UI/UX & Architecture Audit

**Scope**: a static-code audit (not a live-browser run, unlike the companion `opd-visit-workflow-live-audit.md`) of four dimensions of the same OPD visit workflow app: speed of daily operations, access/navigation, functional completeness against expected HMS coverage, and UX scalability from a small clinic to a large hospital network. Conducted by reading the actual Laravel 12 + Inertia.js + Vue 3 codebase (DDD module layout under `app/Modules/`, pages under `resources/js/pages/`) — every finding below cites a real file and, where feasible, a line number.

**Stack context confirmed during this audit**: this is a hybrid architecture — Inertia handles page navigation and shares some props (permissions, facility scope, feature flags) on every request, but most in-page data fetching goes through TanStack Vue Query hitting a versioned JSON API (`/api/v1/*`) rather than Inertia's `router.reload({ only: [...] })`. Forms are consistently hand-rolled `reactive()` state managed through TanStack `useMutation`, not Inertia's `useForm()` — this is an app-wide, deliberate pattern, not N separate bugs, and is treated as low severity throughout except where it causes a concrete UX gap (missing Enter-to-submit).

**Severity key**: Critical = breaks or silently corrupts core behavior, or fails outright at real hospital scale. High = a real gap with no workaround, or a serious scale/functional limitation. Medium = a real gap with a workaround, or partial coverage. Low = cosmetic, minor, or a deliberate/acceptable trade-off worth flagging.

---

## Scorecard

| Section | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1. Speed of daily operations | 0 | 1 | 3 | 4 |
| 2. Access and navigation | 0 | 0 | 0 | 2 |
| 3. Functional completeness | 0 | 2 | 2 | 3 |
| 4. UX scalability | 3 (all addressed — see below) | 3 (2 fixed) | 2 | 2 |
| **Total** | **3** (all addressed) | **6** (2 fixed) | **7** | **11** |

Headline: the **access/navigation layer is unusually well-built** (real permission-driven nav, dual global search + command palette, server gates that actually match frontend rules, working multi-facility refresh) — zero Critical/High findings there. The **scalability layer carried all the real risk**: two Critical findings in one file (`ListCashierQueueUseCase`'s pagination and missing scoping — fixed and verified) plus a third, much larger one (multi-tenant isolation shipped disabled by default) that turned into its own 77-file audit — 10 more concrete bugs found and fixed, with a release-gate checklist for what's left as explicit product decisions rather than code bugs. See `reports/multi-tenant-facility-rollout-readiness.md` for the full detail.

---

## 1. Speed of daily operations

Traced the actual click/screen path for the 7 highest-frequency workflows: registration, triage, order entry (lab/radiology/pharmacy/theatre), charting, results review, discharge, and billing capture + payment.

**Registration, Triage, and Results Review are all well-designed**: each opens its form in-place (a Sheet/Dialog over the list, no full-page navigation) — 1 click from list to form. Discharge (`EncounterCloseChecklistDialog.vue`) is similarly clean — one dialog, a real blocking/warning checklist, no dead ends. Charting has **working autosave** (`useNoteAutosave.ts` — 1.5s debounce, conflict detection, manual flush) — a real EHR data-loss risk that turned out to already be handled correctly.

### Findings

- **High** — Theatre-procedure booking and billing-charge creation have no inline path from the encounter workspace at all. `resources/js/components/domain/clinical/EncounterOrdersCommandCenter.vue:1069-1099` (via `useEncounterOrdering.ts:80-83`): unlike lab/pharmacy/radiology (which open inline when permitted), theatre and billing always render as a `<Link>` full-page navigation to `/theatre-procedures` or `/billing-invoices`. Every theatre booking during a live consultation forces the clinician out of the encounter workspace, losing note/order context.
  **Fix**: give theatre and billing-charge creation the same inline-sheet treatment already built for lab/pharmacy/radiology.

- **Medium** — Registration and triage forms lack `<form>`/Enter-to-submit wiring. `resources/js/components/patients/PatientRegistrationSheet.vue` (body is a bare `<div>`, Submit is `@click`-only) and `resources/js/components/triage/TriageRecordSheet.vue:150-291` (same pattern) — a registrar/nurse filling ~15 fields many times a shift cannot finish with Enter. Notably, `billing/IndexV2.vue`'s payment dialog *already* wires Enter-to-submit and Escape-to-save-draft — that pattern just wasn't copied to the other two.
  **Fix**: wrap both in `<form @submit.prevent="submit">`, copying billing's existing keyboard pattern.

- **Medium** — Placing an order (any of the 4 types) or completing triage triggers a full data refetch instead of an optimistic UI update. `WorkspaceV2.vue:436-460` calls `workspace.refetch()`/re-fetches the whole encounter bundle on every new order; `triage/Queue.vue:238-241` refetches the whole queue after recording triage rather than optimistically removing the entry. Causes a visible flash/delay on very frequent actions.
  **Fix**: append the new order / remove the triaged entry optimistically in the local cache, reconciling on the next natural poll instead of forcing an immediate full refetch.

- **Medium** — `IndexV2.vue:1035-1099` order/billing round-trip: even where an inline sheet exists, the new item only appears after a full round-trip completes (`ordering.handleInlineOrderCreated`), not via optimistic insert.
  **Fix**: same pattern as above — insert optimistically, reconcile on response.

- **Low** — App-wide, all clinical/registration forms use hand-rolled `reactive()` state via TanStack `useMutation` rather than Inertia's `useForm()`. This is a deliberate, consistent architectural choice (the app is API-first, not textbook-Inertia) and TanStack's `isPending`/`error` already covers what `useForm` would — not a bug, just worth naming so it isn't mistaken for N separate defects.

- **Low** — Lab result entry (`StructuredLabResultForm.vue`) uses the same `reactive()` pattern; consistent with the above, no additional finding.

- **Low** — Triage queue list doesn't optimistically remove a just-triaged patient (see Medium finding above) — the visible symptom, listed here for completeness of the click-trace.

---

## 2. Access and navigation

Investigated role dashboards, global search, patient-context switching, nav generation, and server-side enforcement across physician/nurse/front-desk/lab/pharmacy/radiology/billing/admin roles.

**This is the strongest section of the app.** Nav is genuinely permission-driven (`AppSidebar.vue` + `routeAccess.ts`'s ~50 explicit per-path rules with prefix-matching fallback), global patient search and a Cmd/Ctrl+K command palette are both real and permission-filtered, server-side `can:` gate middleware was sampled across 5 cross-module routes and consistently matches the frontend's own permission strings, and facility switching correctly triggers a full permission/nav refresh via `router.reload()`. No Critical or High finding surfaced in this section.

### Findings

- **Low** — `resources/js/pages/billing/IndexV2.vue:899`: the "View chart" link on an invoice row uses a raw `<a href="...">` instead of Inertia's `<Link>` component (used everywhere else in the app), forcing a full browser reload instead of an SPA transition.
  **Fix**: swap to `<Link :href="...">`.

- **Low** — Role tailoring on `/dashboard` is done via a single adaptive route (`GetDashboardContextUseCase` picks from 11 permission-gated "workflow presets" — Front Desk, Clinician, Nursing, Emergency, Direct Service, Cashier, Admin, Operations, Records, Supply, Theatre) rather than distinct per-role URLs. Functionally complete, but a role's view can't be bookmarked/deep-linked directly.
  **Fix**: optional — expose a `?preset=` query param or per-role sub-route if bookmarking becomes a real user request.

---

## 3. Functional completeness (vs. expected HMS coverage)

Checked each expected HMS module area for whether it exists, and if so, whether it's a real, reachable feature or a stub.

**Complete and substantial**: Registration/ADT (outpatient + inpatient, including bed availability), EMR (`MedicalRecord` — versioning/diffs, signer attestations, handoff workflow), CPOE (all 4 order types, internal), Pharmacy + Inventory (the deepest module in the codebase — batch/expiry tracking, auto-reorder, supplier lead times, stock-blocked dispensing tied to real inventory), Billing + Claims (`ClaimsInsurance` has a real `DRAFT→SUBMITTED→ADJUDICATING→APPROVED/REJECTED/PARTIAL/CANCELLED` lifecycle with settlement reconciliation).

### Findings

- **High** — No LIS/RIS integration or e-prescribing transmission anywhere in the codebase (zero HL7/FHIR/DICOM/external-pharmacy references found). Laboratory, Radiology, and Pharmacy are entirely closed-loop, manual-entry systems.
  **Fix**: if external lab/imaging/pharmacy interop is a real requirement, design the integration boundary (even a stub adapter interface) before more internal modules couple directly to these models.

- **High** — No async/queued job infrastructure at all — `grep -rn "ShouldQueue\|Queue::\|->dispatch(" app/Modules` returns zero matches. Long operations (claims settlement reconciliation, financial report generation) run synchronously in the request cycle, blocking the UI.
  **Fix**: introduce `ShouldQueue` jobs for at least claims reconciliation and financial report generation, with a completion notification.

- **Medium** — No centralized audit-log viewer. Real, substantial audit-log data exists per module (`*AuditLogRepositoryInterface` implementations for Admission, InpatientWard, MedicalRecord, Pharmacy, Billing, ClaimsInsurance, Inventory), but it's only surfaced embedded per-record (e.g. `InvoiceDetailsAuditTab.vue`), with no system-wide searchable admin page.
  **Fix**: add one `platform/admin/audit-logs` page aggregating the existing repositories.

- **Medium** — Claims workflow has no real external payer submission — "SUBMITTED" is a manual status transition, not an EDI/X12 or payer-API call.
  **Fix**: clarify with stakeholders whether real payer integration is in scope; currently entirely absent if so.

- **Low** — Theatre scheduling has conflict *exceptions* (`TheatreProcedureResourceAllocationConflictException`) but no visible multi-room calendar/scheduler use case — validation-on-create, not a true scheduler. Worth confirming double-booking is actually prevented across concurrent bookings.

- **Low** (confirm intent, not necessarily a defect) — Patient portal and telehealth are completely absent — this appears to be intentionally staff-only software, which is fine, but should be an explicit product decision rather than a silent gap.

---

## 4. UX scalability (20-bed clinic → 1,000-bed hospital network)

This section carries the most severe findings in the audit, and they concentrate in two places: the Billing Cashier Queue's implementation, and the fact that multi-tenant/multi-facility isolation ships **disabled by default**.

### Findings

- **Critical — Fixed** — In-memory pagination on the live Billing Cashier Queue. `app/Modules/Billing/Application/UseCases/ListCashierQueueUseCase.php`. Unlike every other list use case sampled (Patients, Billing Invoices, Laboratory Orders, Appointments, Staff — all confirmed using real DB-level `->paginate()`), this one pulled **unbounded** patient-ID sets across 4 tables via `->pluck()`, loaded the full matching `PatientModel` set with no limit, and paginated in PHP via `->slice()`. At hospital scale (thousands of patients with any unpaid invoice/unbilled service) every request loaded the full result set into memory.
  **Fix**: replaced the four PHP candidate-ID scans with correlated `whereExists`/`whereNotExists` subqueries applied directly to a `PatientModel` query, then a single real `->paginate()` call — the status/search/pagination logic all now runs as one SQL query. `buildQueueEntries()` now only hydrates invoice/unbilled/consultation data for the current page's ~20 patients, not the full matching population. Also added a deterministic `orderBy('id')` — the original had no explicit order either, so pagination boundaries were already implementation-defined, but a real `LIMIT`/`OFFSET` needs an explicit tiebreaker to stay stable across pages.
  **Verified**: ran the original and fixed implementations back-to-back against identical live data (`git stash` to isolate old vs. new) across 7 scenarios (all/unpaid/paid/in_consultation/search/two small-page-size pagination checks) and diffed every row and meta field — all scenarios matched exactly after adding the deterministic order.

- **Critical — Fixed** — That same use case never applied its own injected scoping dependency. `PlatformScopeQueryApplier` was constructor-injected but **never called anywhere in the class** (confirmed via grep — 1 match, the constructor). Every sub-query ran unscoped. At multi-facility/multi-tenant scale, this leaked every facility's cashier queue into one view regardless of active scope.
  **Fix**: applied the injected scoper to the main patient query, gated behind the same `isPlatformScopingEnabled()` check (`platform.multi_facility_scoping` or `platform.multi_tenant_isolation`) and `facilityColumn: null` convention already used by `EloquentPatientRepository` — necessary because, per the High finding below, `patients` has no `facility_id` column at all; calling `apply()` with the default `facilityColumn` would have thrown a SQL error the moment facility scoping was active.
  **Verified live**: with the feature flag forced on and a real tenant context bound, the query ran with no crash and correctly returned a reduced row count (4 of 5) once scoped to one tenant, confirming the scoping is actually filtering, not silently a no-op.

- **Critical — Audited, 10 bugs fixed, rollout plan produced** — Multi-tenant/multi-facility isolation ships disabled. `config/feature_flags.php:17-28`: both `platform.multi_facility_scoping` and `platform.multi_tenant_isolation` default to `false` (stage: `planned`). The real scope turned out much larger than "25+ repositories" — **77 files** across the codebase inject the shared scoping helper. A full audit (4 parallel passes covering all 77) found and fixed **10 concrete bugs**: 6 files where scoping was silently dead code due to a wrong/nonexistent feature-flag key (same failure mode as the `ListCashierQueueUseCase` bug above, just a typo'd flag name instead of a missing call), and 4 files with partial scoping within an otherwise-scoped class (most notably `EloquentPlatformRbacRepository::syncUserRoles()`, which could attach a different tenant's role with zero validation). All fixes verified live in both flag states (no behavior change with flags off, correct exclusion with flags on).
  Several further findings need an explicit **product decision**, not a mechanical fix — most notably a pervasive, ~25-method-wide pattern of unscoped "does this number already exist" duplicate checks (order/case/invoice numbers etc.) that reads as an intentional global-uniqueness design choice, but needs confirming before the flags go on; and one authorization-sensitive method (`EloquentPlatformUserAdminRepository::syncUserFacilitiesInScope()`) that needs security review rather than a guessed fix.
  **See `reports/multi-tenant-facility-rollout-readiness.md` for the full audit, every fix, and the release-gate checklist.**

- **High — Investigated and confirmed intentional, no change made** — The `patients` table has no `facility_id` column at all — only `tenant_id` (confirmed across the create + tenant-scope migrations), unlike every other clinical table (appointments, billing_invoices, laboratory_orders, encounters), which all have both.
  **Product decision**: confirmed with the product owner that this is the intended design, not an oversight — facilities under one tenant deliberately share a single patient registry (a Master Patient Index per tenant/network), so a patient referred or transferred between facilities in the same network is recognized as the same person rather than duplicated. Every clinical *activity* (appointments, encounters, orders, billing, admissions) already carries its own `facility_id` independently, so per-facility reporting and access control still work correctly — only the patient's demographic identity itself is shared across the network, which is the point. No migration made; this finding is closed as confirmed-by-design.

- **High** — Patient search can't use its own indexes at scale. `EloquentPatientRepository.php:179-200` builds `whereRaw('LOWER(x) LIKE ?', ['%term%'])` (leading wildcard on a `LOWER()` expression) across name/email/national-ID columns — standard B-tree indexes (including ones added earlier this session) can't serve a leading-wildcard LIKE. Only phone search was fixed to use an indexed prefix match. At hundreds of thousands of patients, this is a full table scan per search keystroke.
  **Fix**: move to Postgres trigram (`pg_trgm`/`GIN`) indexes or a dedicated search service (e.g. Meilisearch/Typesense) for name/ID search.

- **High** — The facility switcher won't scale past a handful of sites. `AppSidebarFacilitySwitcher.vue:299-323` renders facilities as a flat, unsearchable dropdown list with no filtering or virtualization. Fine for a handful of facilities; unusable for a hospital network with dozens/hundreds of sites. (The underlying switching mechanism — cookies + a server-side reload — is architecturally sound; only the picker UI needs work.)
  **Fix**: replace the flat list with a searchable combobox once facility counts grow past ~15-20.

- **Medium** — Composite DB indexes miss the most common real-world query shape. Appointments/billing invoices/laboratory orders all index `(patient_id, date)` and `(status, date)`, but nothing covers `(facility_id, status)` — the actual shape of "this facility's open worklist," a query every worklist page runs constantly.
  **Fix**: add `(tenant_id, facility_id, status)` or `(facility_id, status)` composite indexes to the hot worklist tables.

- **Medium** — `@tanstack/vue-virtual` is an installed dependency with zero actual usage (`grep -rl` across `resources/js` returns no files). No list in the app is virtualized. Tolerable today because lists are server-paginated to 15-100 rows, but any future "show all"/infinite-scroll worklist would need this wired up before it's usable at hospital scale.
  **Fix**: no action needed today; flag for whoever builds the first long unpaginated list.

- **Low** — Several DB-backed props (`permissions`, `roleCodes`, `platform.scope`, `platform.featureFlags`, `platform.subscriptionAccess`) are computed as Inertia-shared Closures on every full page load (Inertia only skips closures on *partial* reloads) — roughly 5+ extra queries per navigation. Not currently expensive (no large lists shared), but worth caching per-request/per-scope as usage grows.

- **Low** — The main JS shell (`app-*.js`) is ~500KB; per-page code splitting is confirmed working (`import.meta.glob` in `app.ts`), so this is the shared shell specifically, not a page-level bundle. Not disqualifying at current scale, worth periodic auditing.

---

## Prioritized action list

1. ~~**Fix `ListCashierQueueUseCase`'s pagination and missing scoping**~~ — **Done.** Both Critical findings (in-memory pagination, unused `PlatformScopeQueryApplier` injection) were in the same file and are now fixed: real SQL-level pagination via correlated `whereExists` subqueries, plus scoping applied consistently with `EloquentPatientRepository`'s own convention. Verified against live data with an old-vs-new comparison across 7 scenarios and a forced-scoping-on test.
2. ~~**Decide the multi-tenant/multi-facility rollout plan explicitly**~~ — **Done.** Audited all 77 files gating scoping behind these flags, fixed 10 confirmed bugs, and produced a release-gate checklist with the remaining product decisions needed before flipping the flags — see `reports/multi-tenant-facility-rollout-readiness.md`.
3. ~~**Resolve the `patients` table facility-scoping question**~~ — **Done.** Confirmed with the product owner: a shared per-tenant patient registry is intentional (Master Patient Index pattern for a hospital network), not a gap. No migration needed.
4. ~~**Fix patient search indexing**~~ — **Done.** Replaced the 9 separate leading-wildcard `LOWER(x) LIKE` conditions with one DB-generated `search_text` column (Postgres `pg_trgm` GIN index) that concatenates the same 9 fields/expressions behind a single indexed substring match. Verified: the index is valid and used by the planner (confirmed via `EXPLAIN` with `enable_seqscan` forced off — naturally not yet preferred over a seq scan on this dev DB's 420 rows, exactly as expected at this scale); search results are byte-identical to the old implementation across 8 representative terms (name fragments, patient number, phone, email, full name); the new generated column is hidden from `PatientModel::toArray()` so it can't leak into API responses.
5. **Give theatre/billing-charge creation an inline path from the encounter workspace**, matching lab/pharmacy/radiology's existing pattern — the one real daily-workflow friction point found.
6. **Add async job handling** for claims reconciliation and financial report generation.
7. **Make the facility switcher searchable** before facility counts grow past a handful of sites.
8. **Add composite `(facility_id, status)` indexes** to the hot worklist tables.
9. **Add Enter-to-submit to Registration and Triage forms**, copying the pattern already built for Billing's payment dialog.
10. **Add optimistic UI updates** for order placement and triage completion, instead of full refetches.
11. Lower-priority cleanup: centralized audit-log viewer, billing chart link's `<a>` → `<Link>` swap, clarify patient-portal/telehealth/claims-EDI scope as explicit product decisions rather than silent gaps.
