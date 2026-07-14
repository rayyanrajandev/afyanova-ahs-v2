# Emergency Queue — Modernization Plan

**Document type**: Implementation plan, following the same conventions established in `reports/appointments-scheduling-workspace-modernization-plan.md` (role-scoped V2 pages, extract-don't-rewrite from the legacy page, live queries not synced tables, `usePlatformAccess()`-based permission computeds, sticky-header-in-bounded-scroll-container layout, new standalone page not an immediate route cutover).

## 1. Why this is separate from the appointments/triage work

`EmergencyTriageCaseModel` is a fully independent lifecycle, not a variant of generic appointment triage. Confirmed by investigation before any code was written:

- Separate table, separate model, separate status enum (`EmergencyTriageCaseStatus`: `waiting`/`triaged`/`in_treatment`/`admitted`/`discharged`/`cancelled`) — nothing to do with `AppointmentStatus::WAITING_TRIAGE` or `triage/Queue.vue`'s job.
- `appointment_id`/`admission_id` on the model are both nullable, loosely cross-linkable, no status coupling. The only place an Appointment auto-produces a case is `CreateSkeletonEmergencyTriageCase.php` (Reception module, Mode C, opt-in, disabled by default).
- An `EmergencyTriageCase` spans a patient's entire ED-visit lifecycle (arrival → triage → treatment → disposition), not just a triage step — despite the word "triage" appearing in both the case-creation form's title and `triage/Queue.vue`'s name, these are unrelated features operating on unrelated data.

The legacy page, `resources/js/pages/emergency-triage/Index.vue` (4,730 lines), bundles five concerns: queue+filters, case creation (3-way patient/appointment/admission context linking), status-transition workflow, a full transfer sub-CRUD (internal/external handoff coordination), and dual audit-log surfaces (case + transfer, both with CSV export). Backend for all five is fully built and already used by the legacy frontend, except one dead route (`PATCH emergency-triage-cases/{id}`, full-record update — the legacy page never calls it) and MCI mode's activate/deactivate endpoints (built, gated, but **no frontend anywhere calls them** — Dashboard.vue only reads the flag).

**Naming, explicit per user instruction**: the backend module is genuinely named `EmergencyTriage` (`app/Modules/EmergencyTriage/`, `EmergencyTriageCaseModel`, `emergency-triage-cases` API routes) — those are real, existing names cited accurately wherever this document or the code's own docblocks reference actual backend classes/endpoints. Nothing newly built for this plan uses the combined term, though: every new page, folder, composable, and component is named "Emergency" only (`pages/emergency/`, `composables/emergency/`, `components/emergency/`, `useEmergencyCases`, `EmergencyStatusDialog.vue`, etc.) — the same separation of concerns as the naming, deliberately, so nothing about the new frontend implies Emergency and generic appointment Triage (`triage/Queue.vue`) are the same feature.

## 2. Phasing (confirmed with the user before starting)

Given the size, phased the same way triage/clinician queues were — start with the core "see who's here, move them through" workflow, not full legacy parity in one pass.

| Phase | Content | Depends on | Status |
|---|---|---|---|
| **1 — Queue + status workflow** | New `emergency/Queue.vue`: list + status counts (`GET emergency-triage-cases`, `GET emergency-triage-cases/status-counts`), status-transition dialog (`PATCH emergency-triage-cases/{id}/status`) — extracted from the legacy page's `statusDialogMeta`/transition-button gating, not invented. Read-only case list; no create/edit. | — | **Done** |
| **2 — Create intake** | Case-creation form (patient lookup, triage level/chief complaint/vitals, optional assigned clinician) — scoped down from the legacy 3-tab patient/appointment/admission context editor to a single patient lookup, matching `AppointmentCreateSheet.vue`'s shape | 1 | **Done** |
| **3 — Transfer coordination** | Internal/external handoff sub-CRUD | 1 | Not started |
| **4 — Audit logs** | Case + transfer audit trail, CSV export | 1 | Not started |
| **5 — MCI mode toggle** | A genuine gap-fill, not a legacy port: backend activate/deactivate endpoints exist (`emergency.triage.update-status`) but no frontend anywhere calls them today | — (independent) | Not started |
| **6 — Cutover** | Retarget `/emergency-triage` (or add a dedicated nav entry) once feature parity is reached; legacy stays reachable for whatever isn't ported yet | 1–5 | Not started |

## 3. Phase 1 scope detail

**Backend**: zero changes — `ListEmergencyTriageCasesUseCase`, `ListEmergencyTriageCaseStatusCountsUseCase`, `UpdateEmergencyTriageCaseStatusUseCase` are all live, tested, and sufficient.

**Transition matrix**, extracted from the legacy queue row's button gating (`Index.vue:3400-3405`), not re-derived — the backend itself enforces no transition graph (any status can PATCH to any status), so the UI is the only place this semantics lives:
- `waiting` → Mark triaged (`triaged`), Cancel
- `waiting`/`triaged` → Start treatment (`in_treatment`)
- `in_treatment` → Admit (`admitted`), Discharge (`discharged`), Cancel
- Any non-terminal status → Cancel (`cancelled`, reason required)
- `admitted`/`discharged` require `dispositionNotes`; `cancelled` requires `reason` — both server-enforced (`UpdateEmergencyTriageCaseStatusRequest.php`), one dialog handles both conditional fields (matching the legacy page's own single-dialog approach, not two).

**Deliberately excluded from Phase 1**: create-intake form, transfer sub-CRUD, audit logs/export, MCI mode toggle. All confirmed real, separate scopes (see §2), not overlooked.

---

## Update — Phase 1 shipped

**Naming correction mid-build**: shipped a first pass of the composables/component under an `emergencyTriage`-named folder/identifier set (`useEmergencyTriageCases`, `EmergencyTriageStatusDialog.vue`, etc.) before being stopped and corrected — the whole point of building this as its own page was to stop conflating Emergency with generic appointment Triage, and naming the new frontend code "EmergencyTriage" undermined that immediately. Renamed everything before continuing: `composables/emergency/` (not `emergencyTriage/`), `useEmergencyCases`/`useEmergencyCaseFilters`/`useEmergencyCaseStatusCounts`/`useUpdateEmergencyCaseStatus`/`useEmergencyCasePatientDirectory`, `components/emergency/EmergencyStatusDialog.vue`. Backend citations (`EmergencyTriageCaseModel`, `emergency-triage-cases` endpoints) still say what they actually are — only the new frontend naming changed. §1 above now documents this split explicitly so it isn't re-litigated.

**Shipped**:
- Composables (`composables/emergency/`): `useEmergencyCaseFilters` (q/status/triageLevel/from/to/sort/page, no default status filter — an emergency queue shows everything active by default, unlike appointments' `scheduled` default), `useEmergencyCases` (list), `useEmergencyCaseStatusCounts`, `useUpdateEmergencyCaseStatus` (typed to the five real transition targets, matching `UpdateEmergencyTriageCaseStatusRequest`'s validation), `useEmergencyCasePatientDirectory` (per-id `/patients/{id}` hydration — kept as its own small composable rather than reusing `useAppointmentPatientDirectory`, despite being nearly identical, since importing an "appointment" composable into this page would be its own naming confusion).
- `EmergencyStatusDialog.vue` — one dialog for all five transitions (`triaged`/`in_treatment`/`admitted`/`discharged`/`cancelled`), conditional `dispositionNotes`/`reason` fields, copy extracted verbatim from the legacy page's `statusDialogMeta`.
- `emergency/Queue.vue` — sticky header with 4 KPI cards (Waiting/Triaged/In treatment/Total), a 4-tab status filter (All/Waiting/Triaged/In treatment), search + triage-level filter, and a card-list (not a reused `ReceptionQueueList.vue` — that component is Appointment-based and this page's data has no relationship to `AppointmentModel`) showing case number, patient (`PatientSummaryPopover`-wrapped, matching every other V2 list), status/triage-level badges (triage level gets real red/yellow/green coloring via custom classes, since shadcn's `Badge` has no built-in "warning" variant), chief complaint, arrival time, and per-row transition buttons matching the confirmed matrix.
- Route `GET /emergency/queue` (`can:emergency.triage.read` + `facility.entitlement:emergency.triage`, same gate as the legacy route) — a new, standalone route, not a swap; `/emergency-triage` keeps rendering the legacy page unchanged. New sidebar entry "Emergency queue", separate from "Emergency & triage" (which still points at legacy). `routeAccess.ts` and `facilityPageEntitlements.ts` both gained `/emergency` prefix rules alongside their existing `/emergency-triage` ones.

Verified: TS errors unchanged at the 778-error baseline (zero errors in any new file). 215/215 Vitest passing (8 new composable tests). Backend: 3 new route tests (`EmergencyQueuePageRouteTest.php`, including one confirming the legacy route is genuinely untouched) — full `EmergencyTriage`-filtered suite 11/11 passing.

---

## Update — nav scope decision: Emergency Queue is now the only discoverable page, Phase 2 shipped immediately after

User question after Phase 1 shipped: given the whole point is retiring the legacy page eventually, why keep a separate "Emergency Workspace" sidebar entry pointing at it at all? Answered directly: because Phase 1 alone can't create a new case — removing all discovery of the legacy page immediately would leave no way to intake a new ED patient. Presented the tradeoff and asked; **user chose to remove the legacy nav entry now and build Phase 2 (create intake) immediately**, rather than leave a temporary second entry around.

**Shipped in the same pass**:
- Removed the sidebar entry that had briefly existed pointing at `/emergency-triage` (added, then removed within the same session once this question came up) — "Emergency queue" is now the only Emergency entry in the sidebar. Also removed 3 `OPDQuickCommandPalette.vue` entries that pointed at `/emergency-triage` (a nav shortcut, a "New Emergency Triage Intake" create shortcut, and a compact workflow-row link) — repointed all three at `/emergency/queue` instead, and renamed "New Emergency Triage Intake" to "New Emergency Intake" (same naming fix as the sidebar). This matches the exact precedent already established for `/patients/legacy` and `/appointments/legacy`: zero nav-discovery surfaces link to a retired-but-still-functional legacy route, not sidebar, not command palette.
- Also renamed the legacy page's own `<Head>` title/breadcrumb/heading text from "Emergency & Triage" to "Emergency Workspace" — cosmetic, zero logic touched, but consistent since the page is still reachable by direct URL.
- **Phase 2 (create intake), built immediately after**: `useCreateEmergencyCase.ts` (`POST emergency-triage-cases`, scoped to the fields a fast ED intake needs — deliberately excludes `admissionId`/`appointmentId` context-linking and `triagedAt`/`dispositionNotes`, which the status-transition workflow already owns) and `EmergencyCaseCreateSheet.vue` — a single patient lookup + arrival time + triage level + optional assigned clinician + chief complaint + vitals summary, matching `AppointmentCreateSheet.vue`'s one-sheet shape rather than the legacy page's 3-tab patient/appointment/admission context editor (an edge case the legacy UI over-built for, not something every intake needs). Wired into `emergency/Queue.vue`'s header as a "New case" button, gated `emergency.triage.create`.

Verified: TS errors unchanged at the 778-error baseline. 216/216 Vitest passing (1 new composable test). Backend: 6 new tests in `EmergencyCaseApiTest.php` — the module's first dedicated coverage of the case list/create/status-counts/status-transition endpoints themselves (the only prior coverage, `EmergencyTriageTransferApiTest.php`, only exercised case creation as fixture setup for its own transfer-focused assertions). Full `EmergencyTriage`-filtered suite re-run: 17/17 passing.

Remaining phases (3 — transfers, 4 — audit logs, 5 — MCI mode toggle, 6 — legacy page removal) are unchanged from the original plan, ready to pick up in any order.

---

## Update — sync gap found and closed: Reception/patients "emergency" now actually reaches Emergency Queue

User question, sharp and correct: does a patient sent to "emergency" from the patients list, or checked in as "emergency" arrival mode from Reception Queue, actually show up in Emergency Queue — or the old Emergency Workspace? Traced every path directly rather than assume, since this determines whether the page just shipped is actually useful in the real workflow.

**Found: all three "emergency" entry points were completely disconnected, confirmed by reading each path, not inferred:**
- **Patients list "send to emergency"** only exists on the *legacy* `patients/Index.vue` — the live `/patients` (`IndexV2.vue`) has zero emergency-related code, so this action isn't even reachable from the current live page.
- Both that action and Reception Queue's own "emergency" walk-in check-in call the identical endpoint (`POST /reception/walk-ins`), which only ever touches `AppointmentModel` (`RegisterWalkInAndCheckInUseCase` → `CreateAppointmentUseCase` + `CheckInUseCase`) — neither creates an `EmergencyTriageCase`.
- The one designed bridge between the two models — `CreateSkeletonEmergencyTriageCase` (Reception module "Mode C": auto-creates an advisory skeleton case on an emergency-mode check-in) — existed in the backend already but was **disabled by default**, confirmed by reading `config/reception_automation.php` and all three `.env*` files directly (zero overrides anywhere in the repo).
- `emergency/Queue.vue`'s own "New case" form has no `appointmentId` field at all, by design (Phase 2's docblock) — so a case opened directly there was equally invisible to Reception/patients.

**Net effect before this fix**: a triage nurse working Emergency Queue would never see a patient the front desk had just checked in as an emergency arrival, and front-desk/patients-list staff would never see a case a nurse opened directly. This predates this session's work — Mode C was deliberately shipped disabled pending a "clinical-workflow decision, not an engineering default" (its own config docblock's words) — but it matters far more now that Emergency Queue is a real, discoverable page.

Presented the finding and three real options (auto-create via Mode C / add an explicit manual link action / leave intentionally separate); **user chose to enable Mode C**, closing the loop as the product decision the flag was always waiting for.

**Shipped**: flipped `config/reception_automation.php`'s default from `false` to `true` (still overridable per deployment via `RECEPTION_MODE_C_SKELETON_TRIAGE_CASE_ENABLED`). No other backend code touched — `CreateSkeletonEmergencyTriageCase` already existed, fully built, idempotent, and best-effort (a failure here can never break the check-in it observed). An emergency-mode check-in from *either* Reception Queue or the legacy patients-list action now creates an advisory skeleton `EmergencyTriageCase` (status `waiting`, `triage_level: 'unassigned'`, a clearly-marked placeholder chief complaint) that immediately appears in `emergency/Queue.vue`.

`emergency/Queue.vue` updated to treat `unassigned` as its own explicit, visually distinct state — a dashed neutral badge reading "Needs triage" rather than the raw word "unassigned" or a misleading real-acuity color, so a nurse can tell at a glance which cases are auto-created placeholders still needing a real assessment versus ones a clinician has already triaged.

**Test fallout, found and fixed**: `ReceptionShadowAutomationTest.php`'s shadow-logging test hardcoded "the log channel is called exactly once" — true only when Mode C was off (Mode B's shadow-logger was the sole listener touching that channel). With Mode C now also live, both listeners fire and both log, so that assumption broke. Rewrote the assertion to check for Mode B's specific message via `Log::shouldReceive()->atLeast()->once()` plus a catch-all for Mode C's own differently-worded line, rather than a brittle total-call count coupled to exactly one listener being active. `ReceptionModeCEmergencyTriageTest.php`'s "disabled (the default)" test title/docblock updated to stay accurate — the test itself (explicitly setting `enabled => false` per-test) was already correct and unaffected.

Verified: TS errors unchanged at the 778-error baseline. 216/216 Vitest passing (no frontend test changes needed — display-only badge/label change). Backend: full `Reception`, `EmergencyTriage`, and `Encounter`-filtered suites re-run together, 103/103 passing (including the 2 fixed tests); full `Appointment`/`PatientFlow`-filtered suites re-run as a broader sanity check, 129/130 passing (same known pre-existing, unrelated Billing failure confirmed throughout this session).
