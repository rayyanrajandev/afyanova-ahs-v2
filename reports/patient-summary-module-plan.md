# Patient Summary Module — Design Plan

## 1. Goal

A reusable, **read-only** "quick patient context" module — not part of `reports/patients-index-modernization-plan.md`'s Phase 3 (which is the *full* Patient Details sheet: timeline, audit log, insurance management — deep history that stays on `patients/chart/ShowV2.vue`). This module is deliberately smaller: identity, demographics, active alerts, an insurance chip, the latest encounter, current workflow status, and a lightweight "what's currently in motion" signal — meant to be dropped into any page that needs quick patient context without navigating away (reception, queues, lab/pharmacy/radiology/billing worklists, medical records, encounter pages).

No write functionality. No deep history. Consuming pages provide their own page-specific quick actions (view chart, start encounter, etc.) via composition — the module itself doesn't know what actions make sense on any given page.

## 2. What already exists (research findings, not assumptions)

- **No existing summary/snapshot endpoint.** `PatientController::show()` returns the full patient record via `PatientResponseTransformer`. `patients/{id}/medication-safety-summary` is a narrow prescribing-safety-check, not reusable here.
- **No existing `PatientCard`/`PatientSummaryCard`/`PatientChip` component anywhere.** Every consumer (`IndexV2.vue`, `reception/Queue.vue`, `VisitJourneyBoard.vue`) reinvents patient-name formatting inline. This module is genuinely new, not a duplicate.
- **`ShowV2.vue`'s sticky header** (name, `gender · age · patientNumber`, status badge) is the closest existing "at a glance" precedent — but it doesn't surface allergy alerts at all (those are a deeper Overview-tab tile). This module surfacing alerts prominently is a real improvement, not a re-implementation.
- **`GetActiveVisitJourneyUseCase`** (this session's earlier work) takes no patient filter — always computes the whole facility board. Needs a `patientId`-scoped variant pushed down to the SQL, not fetch-then-filter.
- **`activityFeed()` / `ListPatientAuditLogsUseCase`** already exists on `PatientController`, but it's an audit trail (`action`/`actionLabel` like "patient.updated"), not a clinical activity feed — not usable for "what's currently happening with this patient."
- **Composition convention**: `RegistryListRow.vue` establishes the pattern to match — props for the common case (`primaryLabel`/`secondaryLabel`/`meta`), named slots (`actions`, etc.) for page-specific extension, each slot gated with `v-if="$slots.x"` so unused slots render nothing.
- **No `useQueries`/multi-query-merge precedent anywhere in this codebase.** Decided (§3 below): sidestep this by aggregating server-side instead of inventing a new client-side merge pattern.

## 3. Backend: one new aggregated endpoint

**Decision** (explicit, not defaulted): `GET /patients/{id}/summary` aggregates everything server-side in one round trip, rather than the composable firing 4-5 parallel requests per patient. This matters because the stated reuse targets are mostly *queue/list* pages — even with on-demand (not always-rendered) fetching, one request beats five every time this opens.

- Route: `patients/{id}/summary` → `PatientController::summary()`, same gates as `show()` (`can:patients.read`, `facility.entitlement:patients.search`).
- New `GetPatientSummaryUseCase` (`app/Modules/Patient/Application/UseCases/`), composing:
  - **Identity/demographics** — existing patient repository lookup, slimmed to `id, patientNumber, firstName, middleName, lastName, gender, dateOfBirth, phone, status, region, district`.
  - **Alerts** — active allergies (same query `GET /patients/{id}/allergies?status=active` already uses), capped at 5, sorted by severity.
  - **Insurance summary** — the active/primary insurance record only (same derivation the legacy page already does client-side: `find` the active one), not the full list.
  - **Latest encounter** — one encounter, `perPage=1 sortDir=desc`, reusing the existing encounters query rather than `usePatientEncounters.ts`'s current over-fetch-then-slice.
  - **Current workflow status** — requires extending `GetActiveVisitJourneyUseCase` with an optional `patientId` parameter pushed into its underlying queries (not fetching the whole board and filtering in PHP). Returns `null` if the patient has no active visit today.
  - **Active-orders signal** (scoped-down "recent activity preview" — see §5 below) — `{ labActive, pharmacyActive, imagingActive, procedureActive }` counts, reusing the same per-module count queries `ShowV2.vue`'s `careCounts` already computes.
- New `PatientSummaryResponseTransformer` for the response shape.
- Tests: `PatientApiTest.php` additions — summary shape, 404 for unknown patient, 403 for missing permission, `workflowStatus: null` when no active visit, `insurance: null` when no active record.

## 4. Frontend

**Composable** — `resources/js/composables/patientSummary/usePatientSummary.ts`:
```ts
usePatientSummary(patientId: Ref<string>, options?: { enabled?: Ref<boolean> }): UseQueryReturnType<PatientSummary, Error>
```
`options.enabled` lets a consumer defer fetching until the summary is actually opened (e.g. a popover's `open` state) — the module fetches nothing until something asks for it, which is what keeps "used in a 20-row queue" cheap regardless of endpoint design.

**Presentational component** — `resources/js/components/patients/summary/PatientSummaryCard.vue`: pure props-in (`summary`, `isPending`, `error`), no fetching of its own. Named slots for extension, matching `RegistryListRow.vue`'s established hybrid: an `actions` slot for page-specific quick-action buttons, gated with `v-if="$slots.actions"`.

**Drop-in wrapper** — `resources/js/components/patients/summary/PatientSummaryPopover.vue`: combines the composable + card inside a `Popover` (this codebase has no `HoverCard` primitive — `Popover` is the established choice, already used by `SearchableSelectField.vue`), triggered by a slot (`trigger`) the consumer provides (a name, a row, a badge — whatever). This is the piece most pages would actually import; the composable and card exist separately for anyone who needs a different layout.

## 5. Explicit scope calls (flagging, not hiding)

- **"Recent activity preview"** is scoped down to active-order counts (`labActive`/`pharmacyActive`/`imagingActive`/`procedureActive`), not a generic activity timeline. Building a real cross-module recent-activity feed is its own feature (arguably part of Phase 3's deep-history territory) — this gives "what's currently in motion" at a glance without that scope.
- **First integration is `patients/v2` only** — wiring this into reception/triage/lab/pharmacy/billing/etc. is real, separate work per page, not implied by building the module. Ship the module + one real consumer to validate the API shape before any other page adopts it.
- **No merged loading state across sub-fetches** — since this is one backend call, `usePatientSummary` has exactly one `isPending`/`error`, which sidesteps the "no multi-query-merge precedent" gap entirely rather than inventing one.

## 6. Rough phases

| Phase | Content | Effort |
|---|---|---|
| **A — Backend** | `GetPatientSummaryUseCase`, `PatientSummaryResponseTransformer`, route, `GetActiveVisitJourneyUseCase` patientId-scoping, tests | 1-2 days |
| **B — Composable + presentational component** | `usePatientSummary.ts`, `PatientSummaryCard.vue`, Vitest coverage | 1 day |
| **C — Drop-in wrapper + first consumer** | `PatientSummaryPopover.vue`, wired into `patients/v2`'s table rows (click/hover a patient name) | 0.5-1 day |

Total: ~3-4 days. Other pages (reception, queues, lab, etc.) adopt the module later, as separate follow-up work, not part of this pass.

## 7. Status

**All three phases shipped.**

- **Phase A** (backend): `GetPatientSummaryUseCase`, `PatientSummaryResponseTransformer`, `GET /patients/{id}/summary`. `GetActiveVisitJourneyUseCase` gained an optional `patientId` parameter pushed into its queries (existing callers unaffected — defaults to `null`, full board). 7 new tests (4 `PatientApiTest.php`, 3 `GetActiveVisitJourneyUseCaseTest.php`).
- **Phase B** (composable + presentational component): `usePatientSummary.ts` (one `useQuery`, `enabled` option to defer fetching until actually opened), `PatientSummaryCard.vue` (pure presentational, `actions` slot matching `RegistryListRow.vue`'s `$slots`-gated convention). Exported type renamed `PatientSummary` → `PatientSummaryDetails` after finding 15 unrelated files each already define their own local `PatientSummary` type (a `PatientLookupField.vue`-shaped lookup result) — no compile conflict, but confusing to grep for. 4 new tests (`usePatientSummary.spec.ts`).
- **Phase C** (drop-in wrapper + first consumer): `PatientSummaryPopover.vue` (`Popover`-based — no `HoverCard` primitive exists in this codebase), wired into `IndexV2.vue`'s table rows (click a patient's name → summary popover, with "View chart" as the page's own `actions`-slot quick action).

164/164 frontend Vitest passing (12 new), 1491/1535 backend passing (44 pre-existing baseline failures, unchanged — confirmed via full-suite run, none in `Patient`/`PatientFlow`).

**Not done, and correctly out of scope for this pass**: adoption by triage/lab/pharmacy/radiology/billing/medical-records/encounter pages beyond the two shipped (`patients/v2`, `reception/Queue.vue`). The module and its consumers are validated; wiring it into each remaining page is real, separate work per page, to be scheduled individually rather than bundled here.

## 8. Second disclosure tier — PatientDetailSheet.vue

Research-grounded addition (progressive disclosure / record-preview patterns — Notion's row-expansion, Epic's Storyboard banner, "make the user commit to seeing more with an intentional click rather than hover"): a single popover trying to hold identity + contact + alerts + insurance + admission + appointments + stats + activity becomes unreadable. The actual 2026/2027 norm for this kind of quick-context UI is a 3-tier architecture:

1. **Tier 1** (`PatientSummaryPopover`/`PatientSummaryCard`, §4): glanceable, hover/click, minimal info.
2. **Tier 2** (`PatientDetailSheet.vue`, new): identity, contact, alerts, current admission (surfaced prominently as an `Alert` when present — the most urgent context a page could show), active workflow status, upcoming appointment, latest encounter, insurance, quick stats (visits/encounters/outstanding invoices), and a recent-activity preview. Still deliberately short of `ShowV2.vue`'s full deep history — that boundary hasn't moved.
3. **Tier 3** (`patients/chart/ShowV2.vue`, unchanged): the full record.

Backend: `GetPatientSummaryUseCase`/`PatientSummaryResponseTransformer` extended (same endpoint, same query) with `contact`, `upcomingAppointment`, `currentAdmission`, `stats`, and `recentActivity` (a lightweight stand-in for a real cross-module activity feed — the single most recent row from each module the patient has touched, not a dedicated event-sourcing table). Frontend: `usePatientSummary.ts`'s types extended; `PatientSummaryCard.vue` gained a "View full summary" affordance; `PatientSummaryPopover.vue` now owns the Tier 1 → Tier 2 transition internally (closes itself, opens the Sheet), so **existing consumers needed zero changes** — `IndexV2.vue` and `ReceptionQueueList.vue` inherited the new tier automatically since the public prop/slot API didn't change.

Because Tier 1 and Tier 2 share the exact same `usePatientSummary()` query key, opening the Sheet right after the Popover for the same patient is a TanStack Query cache hit, not a second network request.

5 new backend tests (contact, upcoming appointment, current admission — present and absent, outstanding invoices + recent activity). Confirmed via `git stash` comparison that 10 pre-existing `Billing`/`Admission`/`PatientFlow` suite failures (`BillingInvoicePrintPageTest` Inertia-page assertion) are unrelated — identical failure count with and without this change. 164/164 frontend Vitest passing, no new TypeScript errors.
