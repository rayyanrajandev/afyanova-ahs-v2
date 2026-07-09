# Patients Index — Modernization Plan

**Document type**: Implementation plan, synthesized from `reports/patients-index-audit.md`. Where a decision requires product judgment rather than engineering default, it is flagged rather than resolved by assumption — the same posture the audit and every other plan this session took.

---

## 0. Framing correction (read first)

This is the largest, and by test-coverage the riskiest, V2 rebuild attempted in this codebase so far. `patient-chart-rebuild-plan.md` and `medical-records-index-rebuild-plan.md` both had a working backend contract *and* the source page was smaller (`ShowV2.vue`'s predecessor and `IndexV2.vue`'s predecessor were both well under half this file's size). `patients/Index.vue` is ~12,000 lines, has zero frontend/Vitest coverage and no functional e2e coverage (audit §6), and contains a mature, already-iterated offline-sync subsystem that must not regress. Nothing here proposes changing `PatientDuplicateDetectionService`, `EloquentPatientRepository`, `offlinePatientRegistration.ts`, or any backend contract — this is a frontend architecture rebuild of one page, reusing the audit's own finding that the backend is already trustworthy.

Given the size and risk, this plan is phased more conservatively than the Reception or queue-workflow plans: each phase ships one composable domain, is independently testable, and does not touch the legacy page until the final cutover phase.

---

## 1. Overview

### 1.1 Goal

Bring `patients/Index.vue` in line with the composable/TanStack-Query/`usePlatformAccess()` architecture `ShowV2.vue` and `IndexV2.vue` already established, closing the concrete gaps the audit found:
1. Permission booleans become reactive (`computed()` over `usePlatformAccess()`), not one-time snapshots (audit §2).
2. The redundant `GET /auth/me/permissions` call is removed (audit §3).
3. The file-local `apiRequest()` is replaced by the shared `@/lib/apiClient.ts`, already proven in this session's own composables (audit §4).
4. Each of the 8 feature areas gets its own composable(s), the same one-domain-per-composable shape `ShowV2.vue` uses (audit §5).
5. The duplicate-detection client/server scoring duplication gets an explicit decision, not silent preservation (audit §1, §8).

### 1.2 Scope

**In scope**: a new `patients/IndexV2.vue` page and its supporting composables under `resources/js/composables/patientsIndex/`, covering all 8 feature areas from the audit. Reuse `offlinePatientRegistration.ts`, `patientLocations.ts`, `patientChart.ts`, and the shared `apiClient.ts`/`notify.ts` as-is.

**Out of scope**: any backend change (`PatientController`, `PatientDuplicateDetectionService`, `EloquentPatientRepository`, `ServiceRequest`/`Reception` modules — all already correct per this session's own work and the audit). The Visit Handoff sheet's underlying atomic endpoints (`POST /reception/walk-ins`, `POST /service-requests`) are consumed, not modified.

---

## 2. Requirements

### 2.1 Functional requirements — the feature-parity bar

Every item in the audit's §1 feature inventory must work identically in the new page before cutover:
- Patient list: search, filters, status counts, pagination, sort.
- Registration: full form, duplicate detection (hard-block / strong / possible warning tiers), draft autosave, offline queueing when disconnected.
- Patient Visit Handoff, all 5 modes: outpatient walk-in, emergency walk-in, direct-services (lab/pharmacy/radiology/theatre), billing handoff, chart handoff — including each mode's availability gating (`visitHandoffModeAvailable()`).
- Patient Details sheet: Overview (including embedded insurance cards), Activity, Audit tabs.
- Edit Demographics, including offline-queued edits.
- Status Change dialog.
- Every cross-page navigation href (`/appointments`, `/emergency-triage`, `/laboratory-orders`, `/pharmacy-orders`, `/radiology-orders`, `/theatre-procedures`, `/billing-invoices`).

This checklist **is** the "done" bar, in place of the frontend test coverage that doesn't exist yet (audit §6) — see §6 for how each phase gets verified without it.

### 2.2 Non-functional requirements

| Category | Status per audit | Assessment |
|---|---|---|
| **Reactivity correctness** | Permission booleans are frozen snapshots (audit §2) | Fixed as part of Phase 0 — every permission check becomes `computed()`. |
| **Network efficiency** | A redundant `GET /auth/me/permissions` call exists (audit §3) | Removed in Phase 0 — no replacement call needed, `usePlatformAccess()` is free. |
| **Data integrity — duplicate detection** | Client and server independently implement the same scoring (audit §1, §8) | Explicit decision required before Phase 2 — see §5. |
| **Offline resilience** | Mature, already-extracted subsystem (audit §1, §7) | Preserved as-is; new composables wire into it, do not rebuild it. |
| **Test coverage** | Zero frontend/e2e coverage today (audit §6) | Each phase ships with new Vitest coverage for its composable(s) — the first real frontend tests this page will have ever had. |

---

## 3. Architecture

### 3.1 Existing stack (unchanged by this plan)

Laravel + Inertia + Vue 3 + TypeScript, TanStack Vue Query, shadcn-vue components. No new stack component. `offlinePatientRegistration.ts`, `patientLocations.ts`, `patientChart.ts` reused unmodified.

### 3.2 Target architecture

```
resources/js/composables/patientsIndex/
    usePatientList.ts                — list + search + pagination (TanStack Query)
    usePatientListFilters.ts         — reactive filter state
    usePatientStatusCounts.ts        — status-count KPI cards
    usePatientRegistration.ts        — create form + duplicate detection + draft autosave
    usePatientVisitHandoff.ts        — shared handoff state (patient, mode, source)
    useOutpatientWalkIn.ts           — outpatient + emergency modes (both call POST /reception/walk-ins)
    useDirectServiceHandoff.ts       — direct-services mode (POST /service-requests)
    usePatientTimeline.ts            — Details sheet: Overview/Activity tab data
    usePatientAuditLog.ts            — Details sheet: Audit tab
    usePatientInsurance.ts           — Details sheet: Overview tab's insurance cards
    usePatientEdit.ts                — Edit Demographics mutation
    usePatientStatusChange.ts        — Status Change mutation

resources/js/pages/patients/
    IndexV2.vue                      — imports the above, same one-page-many-sheets
                                        shape as today, not split into separate routes
                                        (sheets are overlay UI, not navigation)
```

Every composable uses `@/lib/apiClient.ts` (`apiGet`/`apiPost`/`apiPatch`), not a new local `apiRequest()`. Permission checks throughout `IndexV2.vue` use `computed()` over `usePlatformAccess().hasPermission()`, matching `ShowV2.vue`/`IndexV2.vue`'s existing pattern exactly — no new permission-checking convention invented.

`useOutpatientWalkIn.ts` and `useDirectServiceHandoff.ts` are deliberately separate from a monolithic "visit handoff" composable — outpatient/emergency and direct-services hit different endpoints and have different availability rules (audit §1); forcing them into one composable would recreate the same mode-branching complexity the rewrite is meant to remove.

### 3.3 Rollout mechanism — decision needed, not assumed

The audit (§8) found this codebase's own flag-gating convention has drifted: `config/frontend_rebuild.php`'s flags are defined but no longer referenced anywhere in `routes/web.php`. Every completed V2 cutover (`patients/{id}/chart` → `ShowV2`) now ships as a direct route swap with a `/legacy` fallback path for rollback, not a config flag gate. This plan defaults to that same pattern — `/patients` renders `IndexV2` directly once validated, `/patients/legacy` keeps the old page reachable — but this is a real decision point (see §5), not silently assumed.

---

## 4. Implementation phases

| Phase | Content | Depends on | Risk | Effort |
|---|---|---|---|---|
| **0 — Foundation** | `usePlatformAccess()`-based permission computeds, no redundant `/auth/me/permissions` call, empty `IndexV2.vue` shell at a new, unlinked route | — | Low | **Done** |
| **1 — List, filters, status counts** | `usePatientList`, `usePatientListFilters`, `usePatientStatusCounts` | 0 | Low — direct analog to `useMedicalRecordList` | **Done** |
| **2 — Registration + duplicate detection** | `usePatientRegistration`, draft autosave, offline queue wiring | 0 | Medium — depends on §5's dedup-scoring decision | **Done** — registration, live server-backed duplicate check with an explicit acknowledgment gate, offline queue wiring, region/DOB UX upgrades. Draft autosave (persisting not-yet-submitted form state across a crash/reload) intentionally not built — a distinct feature from offline submit resilience, not required for feature parity with the legacy sheet's actual risk (losing a *completed* registration to a dropped connection) |
| **3 — Patient Details sheet** | `usePatientTimeline`, `usePatientAuditLog`, `usePatientInsurance` | 1 | Medium — 3 composables, ~2020 lines of source template to account for | 1-1.5 weeks |
| **4 — Edit + Status dialogs** | `usePatientEdit`, `usePatientStatusChange`, offline-edit-queue wiring | 1 | Low | 3-5 days |
| **5 — Visit Handoff sheet** | `usePatientVisitHandoff`, `useOutpatientWalkIn`, `useDirectServiceHandoff`; billing/chart modes (thin href routing, no new composable needed) | 1, 3 | Medium-High — highest-complexity single feature; the walk-in race condition is already fixed (nothing to redo), and direct-services can be simplified now that `patient-flow/Board.vue` gives it a real downstream view | 1-1.5 weeks |
| **6 — Cutover** | Feature-parity checklist (§2.1) verified against the legacy page side-by-side; `/patients` → `IndexV2`, old page moves to `/patients/legacy` | 0-5 | Medium — the actual risk moment, per §6's de-risking strategy | 3-5 days |

Rough total: 4.5–6 weeks, consistent with this being roughly 4x `medical-records-index-rebuild-plan.md`'s own estimate for a page with a quarter the line count.

**Update**: Phase 0 is implemented — `routes/web.php` gains an unlinked `patients/v2` route (`Route::get('patients/v2', ...)`, same `patients.read` + `facility.entitlement:patients.search` gates as `/patients`), rendering a new `patients/IndexV2.vue` shell with the `<Head>` title / `usePlatformAccess()` in-page gate / sticky-header-inside-bounded-scroll-container conventions this session already validated on `Board.vue`/`reception/Queue.vue`. `/patients` is untouched and still renders the legacy page — confirmed by a dedicated test, not just left alone by omission.

Two scope corrections made during implementation, both resolving ambiguity in this plan's own original phrasing rather than problems found in the codebase:
1. **No `resources/js/types/patient.ts` shared types file.** Re-checking `IndexV2.vue` (medical records)'s actual imports found the established convention exports types directly from the composable that owns them (`MedicalRecordListItem` lives in `useMedicalRecordList.ts`, not a shared types directory) — the same pattern this session's own `useReceptionQueue.ts`/`useVisitJourneyBoard.ts` already follow. §3.2's `resources/js/types/patient.ts` line is superseded; the `Patient` type will be extracted into whichever Phase 1 composable owns it instead.
2. **Genuinely empty shell, not "rendering only the list."** The original phase-table wording ("empty shell rendering only the list") clashed with Phase 1's own content (building the list composables) — resolved in favor of true Phase 0 scope: no data-bearing UI at all yet, just the route/permission/layout foundation, with an in-page note pointing back to `/patients` for the working page. Phase 1 adds the first real data.

3 new tests (page renders, permission-forbidden, legacy route unaffected). No new TypeScript errors (778, unchanged). Full `Patient`/`WebRouteAuthorizationTest`/Vitest suites confirm zero regressions.

**Update**: Phase 1 is implemented — `usePatientListFilters` (matches `ListPatientsUseCase`'s filter shape 1:1: `q`/`status`/`gender`/`region`/`district`/`page`/`perPage`/`sortBy`/`sortDir`), `usePatientList` and `usePatientStatusCounts` (both in `usePatientList.ts`, mirroring `useMedicalRecordList.ts`'s one-file-two-composables shape), and the `IndexV2.vue` list table itself — search bar, gender/sort selects, clickable active/inactive/all status-pill KPI cards (doubling as the status filter, matching the legacy page's own pill behavior), a real `<table>` (not the legacy page's div-grid — matching `medical-records/IndexV2.vue`'s established markup instead), and pagination.

Two deliberate, documented departures from legacy behavior, not oversights:
1. **No URL-query-param filter hydration.** The legacy page restores filters from the URL on load (`queryParam()`/`queryStatusParam()`); `useMedicalRecordListFilters.ts` established no such convention, and this composable doesn't either. Deep-linkable filtered views are deferred to the Phase 6 feature-parity checklist (§2.1) as an explicit decision, not silently dropped.
2. **Inline filter bar, not a separate "Filters" sheet.** The legacy page's region/district/sort filters live behind a dedicated sheet (`patientFiltersSheetOpen`); this page puts gender/sort inline next to search, matching `medical-records/IndexV2.vue`'s shape. `region`/`district` filters exist in `usePatientListFilters`/the backend contract but have no UI control yet — not needed for Phase 1's read-only table, revisit if Phase 6's checklist calls for it.

No row actions yet (view/edit/status-change/register) — those arrive with Phases 2-5. 5 new Vitest tests for the two composables (mocking `apiGet`, mounting via the same `QueryClient`/`VueQueryPlugin` pattern `useMedicalRecordAuditLog.spec.ts` already uses). No new TypeScript errors (778, unchanged). Full frontend Vitest (129/129) and backend `Patient`/`WebRouteAuthorizationTest` suites confirm zero regressions.

**Update**: Phase 2 slice 1 is implemented, per the user's explicit decision: "Authoritative duplicate scoring: Server. Client: Thin UI layer that calls the server and renders results." This required new backend surface the audit hadn't found a need for — `PatientDuplicateDetectionService::evaluate()` (used today only inside `CreatePatientUseCase`) had no dry-run entry point, so a "check while typing, before submit" UX had no server call to make. Added:

- `CheckPatientDuplicatesUseCase` — a thin wrapper calling the exact same `evaluate()` `CreatePatientUseCase` calls, so "what the check said" and "what submission does" can never disagree; they're the same call.
- `POST /patients/duplicate-check` (`patients.create` + `facility.entitlement:patients.registration`, same gates as `POST /patients`). **POST, not GET** — deliberately deviating from the `duplicate-check` GET convention `Laboratory`/`Pharmacy`/`Radiology`/`TheatreProcedure` controllers already use, since this endpoint's payload is patient PII (name, phone, national ID) that has no business sitting in a URL or access log the way a lab test code does.
- `usePatientDuplicateCheck.ts` (a `useQuery` reacting to a caller-debounced identity ref — debouncing itself lives in the caller, `PatientRegistrationSheet.vue`, via `@vueuse/core`'s `refDebounced`, the same "composable doesn't own timing policy" split `useReceptionQueue.ts` already established) and `usePatientRegistration.ts` (the actual `POST /patients` mutation — itself the true authoritative check, since it calls the identical service).
- `PatientRegistrationSheet.vue` — the registration form, wired to both: duplicate findings render live as the user types (debounced 400ms), submission is blocked client-side only as a UX nicety when the server already reported `hard_block` (the server enforces this regardless via the same 409 the legacy page's create call always returned).

**Slice 2, explicitly deferred, not dropped**: the legacy sheet's draft autosave and offline-queue wiring into the already-extracted `@/lib/offlinePatientRegistration.ts` (audit §1, §5's offline-sync non-functional requirement). Slice 1 is the online-only registration path; offline resilience is real scope this rebuild still owes before Phase 6's feature-parity checklist can be satisfied.

12 new tests (4 backend `PatientApiTest.php`, 4 `usePatientDuplicateCheck.spec.ts`, 3 `usePatientRegistration.spec.ts`, plus a Vitest count check). No new TypeScript errors (778, unchanged). Full frontend Vitest (136/136) and backend `Patient`/`WebRouteAuthorizationTest` suites confirm zero regressions.

**Update**: Corrected two V2-convention drifts in `IndexV2.vue` after the fact, both repeats of a mistake already caught and fixed once on `reception/Queue.vue` this session — logged here so the pattern doesn't recur in Phases 3-5:
1. The sticky header's status-pill KPI cards were clickable buttons doubling as the status filter (§4's Phase 1 note above literally documents this as "matching the legacy page's own pill behavior" — that was the wrong precedent to match). Fixed: the sticky header now shows non-interactive mini-stat cards (`ShowV2.vue`'s `rounded-md bg-muted/30` treatment), and active/inactive/all filtering moved into a real `Tabs`/`TabsList`/`TabsTrigger` control in the scrolling body.
2. The gender/sort filters used native `<select>` elements. Fixed: both now use shadcn-vue's `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`, matching `appointments/Index.vue`'s convention (including its `"all"`-sentinel workaround for the gender field, since Radix `Select` rejects empty-string item values — `usePatientListFilters.gender`'s `''` "no filter" state maps to/from `"all"` via a computed).

136/136 Vitest still passing; no new TypeScript errors in the file.

**Update**: Fixed two real gaps in `PatientRegistrationSheet.vue`/`usePatientDuplicateCheck.ts`, both raised directly by the user testing the sheet against the legacy page's actual behavior:
1. **Duplicate-check gate bug.** `hasEnoughIdentity()` only enabled the query once both `firstName` and `lastName` were filled — but `EloquentPatientRepository::findActiveHardDuplicateIdentifiers()` matches on `nationalId` alone (no name needed at all) and `findActiveDuplicateCandidates()` matches on `phone` alone, independent of name. Typing a phone number or national ID that matched an existing patient, without also typing a matching name, silently never triggered a check — the query never fired, so nothing appeared. The gate now mirrors the repository's actual match conditions (nationalId alone, phone alone, or any of the repository's `$hasDemographicCandidateKey` combinations). 2 new tests.
2. **Region/district were plain text `Input`s, not the legacy sheet's actual UX.** The legacy sheet uses `SearchableSelectField` (`@/components/forms`) — a searchable, cascading combobox that still allows a free-text custom value — fed by `GET /platform/country-profile`'s server-sourced region/district presets and localized addressing labels (`patients/Index.vue`'s `loadCountryProfile()`/`@/lib/patientLocations.ts`). Added `usePatientCountryProfile.ts` (the same endpoint as a real `useQuery`, not a manual ref+fetch) and wired it in: district disables until a region is picked and resets when region changes (matching the legacy sheet's own watcher), and the address field became a `Textarea` using the profile's own label/placeholder. 3 new tests.

Note: `usePlatformCountryProfile.ts` (an existing shared composable) was **not** reused — it only exposes `code`/`name`/`currencyCode` (built for billing/currency contexts), not the `patientAddressing`/`patientLocations` fields this needed, so a dedicated composable was the correct call rather than widening a composable's contract for an unrelated consumer.

141/141 Vitest passing; no new TypeScript errors. No backend files touched (`PatientDuplicateDetectionService`/`EloquentPatientRepository` were read, not modified — the fix was entirely in the frontend gate matching existing backend capability).

**Update**: Explicit direction from the user: don't just replicate the legacy sheet's UX — build something genuinely better, "downgrade" if it merely matches. Two concrete gaps called out (location picker, date-of-birth entry) became two real upgrades, not reskins:

1. **Date of birth, two entry mechanisms** (`@/lib/patientAge.ts`, pure and unit-tested — 12 tests). The sheet previously had only a single exact-date input, a real capability gap for walk-ins and infant guardians who often don't know an exact birth date. Added an "Estimated age" / "Exact date" switch using the app's shared `Tabs` primitive (not a one-off button pair like the legacy sheet's hand-rolled toggle), with a live `≈ N yrs M mos old` preview computed in both directions and a native `max` date guard against future dates. Only `dateOfBirth` is ever sent to the server (`StorePatientRequest` has no age fields) — years/months are derived, client-side-only scratch state, same division of responsibility the legacy sheet used.
2. **Region quick-pick chips**, ranked by frequency in the page's already-loaded patient list (`IndexV2.vue`'s own `usePatientList` data — zero extra fetch). The legacy sheet mined the same "recently common region" signal via `historicalRegionOptionsForCountry()`, which bulk-loaded *every* patient client-side just to compute it — a real cost the audit flagged as an anti-pattern. This version gets the same practical value (one-tap for the common case) from data the page was fetching anyway.

Also converted the sheet's remaining native gender `<select>` to shadcn-vue's `Select`, closing the last native-dropdown gap in the sheet.

153/153 Vitest passing (12 new for `patientAge.ts`); no new TypeScript errors.

**Update**: A direct old-vs-new comparison surfaced two remaining regressions versus the legacy sheet — not visual/legacy-parity gaps, but a safety-UX gap and a resilience gap. Both are now closed:

1. **Duplicate acknowledgment gate.** The live duplicate-check Alert had no cost to ignoring it — `canSubmit` only blocked on `hard_block`, so a `strong_warning`/`possible_warning` match could be click-through-ignored, unlike the legacy sheet's forced "Continue registration / View existing patient / Review form" choice. Added an explicit checkbox ("I've reviewed the match(es) above and confirm this is a different patient") that gates submission, plus a "View chart" link per match (`/patients/{id}/chart`). The acknowledgment resets whenever the matched duplicate set changes (`duplicateWarningSignature`), so it never silently carries over to a different match typed a moment later.
2. **Offline resilience.** Registration had no fallback for a dropped connection — a real regression given Tanzania's connectivity reality, not legacy cruft the rebuild was entitled to drop. Added `useOfflinePatientRegistrationQueue.ts` (VueUse's `useOnline()` + the same IndexedDB outbox `@/lib/offlinePatientRegistration.ts` already provided, so records land in one place regardless of which sheet saved them): submitting while offline, or an online submit that fails with a network-shaped error mid-flight, queues the payload instead of failing; the sheet shows an inline offline state and relabels the submit button; `IndexV2.vue`'s header surfaces a "N saved offline" sync action, and the queue auto-syncs on reconnect. Module-singleton state (same pattern as `usePlatformCountryProfile.ts`) means a patient saved offline from the sheet immediately shows up in the page's badge with no prop/event plumbing.

Explicitly still out of scope: draft autosave (persisting not-yet-submitted, in-progress form state across a crash/reload) — a distinct feature from "don't lose a completed submission to a dropped connection," and not the gap that made this sheet a functional downgrade.

159/159 Vitest passing (6 new for `useOfflinePatientRegistrationQueue.ts`); no new TypeScript errors. With this, `PatientRegistrationSheet.vue` has no known regression versus the legacy sheet on either architecture or UX.

---

## 5. Risks & open questions

- ~~**Duplicate-detection scoring duplication (audit §1, §8) needs a decision before Phase 2.**~~ **Decided**: server is the sole scoring authority; the client is a thin UI layer that calls it and renders results, with client-side pre-filtering of already-loaded data allowed only as an optimization that never substitutes for a server validation before the final assessment is shown. Implemented in Phase 2 — see its update note below.
- **Rollout mechanism (§3.3) needs explicit confirmation.** Defaulting to direct-cutover-with-legacy-fallback (matching `ShowV2.vue`'s actual precedent, not the unused config-flag pattern) — but this is exactly the kind of naming/rollout call the Reception plan flagged as a decision, not an engineering default, and should get the same explicit sign-off here.
- **No frontend/e2e coverage exists to regression-test against (audit §6).** The feature-parity checklist (§2.1) is a manual verification bar, not automated; Phase 6's cutover risk is real precisely because of this gap. Consider adding at least Playwright coverage for the Visit Handoff sheet's 5 modes before Phase 6, given `tests/e2e/` already exists and is real infrastructure, not something to stand up from scratch.
- **Offline-sync regression risk.** `offlinePatientRegistration.ts` is mature and already extracted, but Phases 2 and 4 are the two places new composables must wire into it correctly — an offline registration or edit silently failing to queue would be a severe, hard-to-notice regression. Needs explicit manual verification (airplane-mode testing) in those two phases, not just online-path testing.
- **Visit Handoff sheet decomposition boundary (audit §8).** §3.2 proposes `useOutpatientWalkIn`/`useDirectServiceHandoff` as separate composables rather than one monolithic handoff composable — this is a design choice made in this plan, not yet validated against how the actual sheet UI wants to consume shared state (selected patient, mode, source) across modes. May need adjustment once Phase 5 is actually underway.

---

## 6. De-risking strategy

- Phases 0–5 build entirely new, unlinked composables and an unlinked route — the live `/patients` page is untouched until Phase 6. Every phase before cutover is zero-risk to production by construction.
- Each phase ships with new Vitest coverage for its own composable(s) — the first frontend tests this page area will ever have, built incrementally rather than attempted all at once against the finished 12,000-line file.
- Phase 3 and Phase 5 (the two largest, highest-complexity phases) are ordered after Phase 1 specifically so the list/filter foundation and its testing patterns are already proven before tackling the harder domains.
- Phase 6's feature-parity checklist (§2.1) is verified against the *audit's* inventory, not against memory of what the page does — closing the same "re-derive facts, don't assume" discipline this session applied throughout.
- Consistent with the Reception and queue-workflow plans' own lesson: every phase gets checked against real data volumes before the next starts, not assumed cheap — the list/timeline/audit queries in particular should be checked against a realistic patient count, not just fixture-scale test data.

---

## 7. Next steps

1. Get a decision on duplicate-detection scoring (§5) before scheduling Phase 2 — Phases 0, 1 can proceed without it.
2. Get explicit confirmation on the rollout mechanism (§3.3, §5) before Phase 6 is scheduled — Phases 0–5 don't depend on this decision.
3. Ship Phase 0 — no open questions block it, ready now.
4. Decide whether Playwright coverage for the Visit Handoff sheet should be added before or as part of Phase 5, given it's the highest-risk, least-covered feature area.
