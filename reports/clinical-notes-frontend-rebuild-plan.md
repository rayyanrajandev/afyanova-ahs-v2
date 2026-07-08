# Clinical Note Creation & Ordering UI — Greenfield Rebuild Plan

**Document type**: Rebuild plan. Not implemented. Scope is the **frontend only** — `resources/js/pages/encounters/Workspace.vue` and its ordering/composer subtree. The backend (`MedicalRecord`/`Encounter` modules, the API contract in `clinical-note-audit/08-api-inventory.md`) is treated as fixed and unchanged, including the C-1/C-16 fixes already shipped.

## Scope assumptions (stated explicitly so they're easy to redirect)

1. **Vue 3 + Inertia stays.** The current stack (Vue 3.5, Vite 7, TypeScript 5.2) is already current for 2026/2027 — the problem is how the Workspace page is built, not the framework underneath it. If you actually want a different framework or to drop Inertia for a pure SPA/API architecture, that's a materially different, larger plan — say so and I'll redo this section.
2. **The REST API surface is reused as-is.** Everything in `clinical-note-audit/08-api-inventory.md` is the fixed contract this rebuild targets — including the optimistic-lock fields (`expectedUpdatedAt`, `forceDraftSave`) and the status-transition behavior the C-1 fix now enforces correctly under lock. No backend rewrite is in scope here.
3. **"Rebuild fresh" means the code, not the requirements.** The functional behavior catalogued in `clinical-note-audit/03`–`07` (workflow, lifecycle, saving mechanism, frontend behavior, backend behavior) is the feature-parity baseline this plan must hit before cutover — not a constraint on *how* it's built, just on *what it must still do*.
4. **Real-time presence/collaboration is out of baseline scope**, flagged as an optional Phase 6 — it's a genuine 2026/2027-modern addition directly motivated by the concurrency risks already found in the backend (C-1, C-9), but it requires new backend infrastructure (websockets) and shouldn't block the core rebuild.
5. **Print/PDF chart-packet pages** (`MedicalRecordDocumentController`, `EncounterDocumentController` — server-rendered Blade views) are **not** part of this rebuild. They're a different rendering path entirely.

---

## 1. Why a rebuild carries real risk (stated once, not re-litigated)

Full rewrites of working, safety-critical software have a well-documented failure pattern: they take 2–3x longer than estimated, and the old system's accumulated edge-case handling — much of it earned through real incidents — gets silently lost in the rewrite, then rediscovered in production one bug report at a time. This system specifically has hard-earned behavior: the autosave debounce/flush timing, the optimistic-lock conflict handling, the finalize-after-sign→amended override, the note-type-specific section variations, the medication-safety integration. None of that is optional polish; it's the product.

**This plan does not argue against the rebuild** — that decision is made. It argues for de-risking it: build the new thing behind a flag, run it in parallel against the same backend, and cut over page-by-page against a concrete parity checklist, rather than a big-bang replace. Section 6 is the actual mechanism for this.

---

## 2. Target architecture

Each choice below is a direct answer to a specific gap identified in the prior UI assessment.

| Current gap | Target |
|---|---|
| 10,151-line monolithic `Workspace.vue`, 25+ statically-imported children, zero code-splitting within the page | Decomposed into a page shell + a set of focused components/composables (§3), with rarely-opened panels (audit log, version diff, signer attestation, close-readiness checklist) loaded via `defineAsyncComponent` |
| No shared state layer — everything is local `ref`/`reactive` in one file | **Pinia** for cross-component state that's genuinely shared (permission flags, current encounter context, active note draft identity) — not a replacement for local component state, just a home for what actually needs to be shared |
| Hand-rolled `apiRequest()` fetch wrapper, manual `loading`/`error` refs per call site | **TanStack Query for Vue** (`@tanstack/vue-query`) for every server-state read/write: caching, dedup, retry, background refetch, and mutation state, replacing the manual ref bookkeeping |
| No optimistic UI — skeleton-then-wait on every action | TanStack Query's optimistic-update pattern for save/finalize/status actions: update the UI immediately, reconcile or roll back on the server response |
| No list virtualization anywhere | Virtualized list rendering (e.g. `@tanstack/vue-virtual`) for the order panels once the display-cap workaround (the C-8 finding) is replaced with a real list — see `clinical-note-audit/16` for the product decision this depends on |
| Ad hoc, scattered validation logic | **Corrected after review — not VeeValidate/Zod.** Laravel's `FormRequest` classes are already the exhaustive, documented rule set (`clinical-note-audit/08` §8.4), and some rules (the diagnosis-code catalog match) require a live DB lookup that no static client schema can replicate — a Zod schema would only ever be a partial, drifting approximation. Separately, this page doesn't use Inertia's `useForm()`/page-visit submission model at all (autosave needs JSON API + TanStack Query, not repeated Inertia visits), so VeeValidate has no natural integration point here anyway. **Actual approach**: Laravel's `422 { errors: { field: [message] } }` response (already the real, working shape) is the single source of truth; a small `useApiFormErrors()` composable reads it directly into a reactive error-bag, no schema library involved. Client-side checks are limited to pure UX affordances (e.g. disable-submit-until-something-typed), not validation duplication. |
| Hand-maintained TypeScript interfaces for API shapes, prone to drifting from the real backend contract | Generate frontend types from the backend contract rather than hand-write them — either an OpenAPI spec generated from the Laravel routes/FormRequests (`clinical-note-audit/08` is the manual version of this contract today) plus `openapi-typescript`, or Laravel's own typed-route generation if adopted; either way, the type source of truth moves to the backend contract, not a parallel hand-maintained file |
| No accessibility review ever performed | WCAG 2.2 AA as an explicit acceptance bar, tested with axe-core in CI, not just "inherited for free" from the component library |
| No component-level tests; only the existing Playwright e2e journey (`tests/e2e/clinical/encounter-workspace-journey.spec.ts`) | Add **Vitest + Vue Testing Library** component/composable tests as the new code is built; keep and extend the existing Playwright suite as the end-to-end regression safety net across the whole migration — it's the thing that proves the new page behaves like the old one |
| No bundle-size guardrail | Add `rollup-plugin-visualizer` (or equivalent) as a CI check with a size budget, so the monolithic-bundle problem can't quietly regress back in |
| No real-time awareness of concurrent editors, despite confirmed concurrency risk in the backend (C-1, C-9) | **Optional, Phase 6**: Laravel Reverb (native Laravel websocket server) broadcasting presence ("Dr. X is also viewing this encounter") — directly motivated by, not decorative to, the risks already found |

Kept as-is (already modern, no reason to replace): Vite 7, TypeScript, the shadcn-vue/Tailwind component primitives (`@/components/ui/*`), native `fetch` as the transport underneath TanStack Query.

---

## 3. Component/composable decomposition (replacing the monolith)

Indicative structure — not a final file list, but the shape the rebuild should take instead of one file:

```
pages/encounters/Workspace.vue                 — thin page shell: layout, tab routing, permission gates
composables/useEncounterWorkspace.ts           — TanStack Query wrapper around the workspace-bundle endpoint
composables/useNoteAutosave.ts                 — debounce/max-wait/flush-on-hide logic, isolated and unit-testable
composables/useNoteConflictResolution.ts       — optimistic-lock conflict UI logic (expectedUpdatedAt/forceDraftSave)
composables/useEncounterCloseReadiness.ts      — close-checklist state, wrapping the existing backend contract
components/clinical/note-composer/
    NoteComposerShell.vue
    NoteTypeSelector.vue                       — reads noteTypes.ts metadata (kept, it's just data)
    NoteSoapSection.vue                        — one component, reused per SOAP section, not 4 copies
    NoteLifecycleActions.vue                   — finalize/amend/archive actions + status dialog
composables/clinical/useEncounterOrdering.ts   — **built, revised from plan**: permission gating, care summaries,
                                                  inline-order dialog state, and the lifecycle (cancel/discontinue/
                                                  entered-in-error) dialog. Deliberately does NOT wrap new
                                                  lab/pharmacy/radiology form components — see note below.
components/clinical/panels/ (async-loaded)
    AuditLogPanel.vue
    VersionHistoryPanel.vue
    SignerAttestationPanel.vue
    CloseReadinessChecklistDialog.vue
```

**Revision made during Phase 3 (not in the original plan)**: `OrderEntryDialog.vue` and the four per-type form
components above were never built. Investigation before writing new code found `EncounterOrdersCommandCenter.vue`,
`EncounterInlineOrderPanel.vue` (lab/pharmacy/radiology, switch-based on order type), `EncounterWorkflowCareStreams.vue`
(order-stream display + lifecycle actions), and `EncounterLifecycleDialog.vue` — plus the pure libs
`encounterInlineOrders.ts`, `encounterWorkspaceCare.ts`, `encounterWorkspaceLifecycle.ts` — were already modern,
already reasonably sized on their own, and already reused across multiple pages (not just the old `Workspace.vue`).
The old page's 518.88 KB bundle came from bundling everything into one file, not from these components being
bloated or stale. Rebuilding them would have re-implemented already-proven duplicate-check and medication-safety
logic for no benefit and real regression risk. They were reused as-is; `useEncounterOrdering.ts` supplies only the
glue the old page hand-rolled inline (permission checks, care summaries, dialog state, the lifecycle POST, and a
context-preserving href builder for theatre/billing, which already link out to their own full pages by existing,
intentional design — not an inline-ordering gap).

**Gap closed after Phase 4**: theatre-procedure inline ordering, appointment-visit-completion on close, and
audit-log CSV export were initially deferred out of Phase 3/4 (see prior wording of this note) and have since been
built:

- **Theatre-procedure inline ordering** — added as a deliberately separate module (`lib/theatreInlineOrder.ts` +
  `components/clinical/panels/TheatreInlineOrderForm.vue`) rather than a fourth branch inside
  `encounterInlineOrders.ts`/`EncounterInlineOrderPanel.vue`, since those are shared with the still-live
  `encounters/{id}` Workspace.vue page and extending their type union would change behavior there too. This new
  form covers the common "quick booking" case (procedure, operating clinician, schedule, optional room name/notes)
  against the real `StoreTheatreProcedureRequest` contract; the full room-registry picker and resource-allocation
  workflow remain on the standalone `/theatre-procedures` page, unaffected.
- **Appointment-visit completion on close** — `useEncounterClose.ts` now also calls
  `PATCH /appointments/{id}/provider-workflow` after a successful close, gated the same way the old page gates it
  (`appointments.manage-provider-session` + a linked appointment). Deliberately *not* a faithful copy of the old
  page's error handling: there, a failed appointment-completion call surfaced as "unable to close this encounter"
  even though the encounter had already closed. The rebuild reports the two outcomes separately.
- **Audit-log CSV export** — `useMedicalRecordAuditLog.ts` gained `exportCsv()`, matching the old page's
  `window.open`-based download of `GET /medical-records/{id}/audit-logs/export` with the current filters applied.

All three verified via Vitest (65 tests total) + `vue-tsc` (zero new errors beyond 3 that reproduce an
already-existing, pre-existing type-checking quirk in the sibling `EncounterInlineOrderPanel.vue` this new code
intentionally mirrors) + production build. **Not yet live-tested against the real backend** — same caveat as the
rest of Phase 4.

---

## 4. Feature-parity checklist (the actual "done" bar)

Every rebuilt component must be verifiable against the corresponding behavior already documented in the audit — this is the acceptance criteria, not a suggestion:

- [x] All 7 note types render with their correct section labels/placeholders/narrative headings — **verified**: `noteTypes.ts` still defines exactly 7 options (confirmed by direct count), reused unchanged; `NoteTypeSelector.vue`/`NoteComposerShell.vue` consume it via the same `medicalRecordNoteTypeNarrativeHeading`/section-label helpers
- [x] Autosave timing matches the 1.5s debounce / 15s max-wait contract — **verified**: `useNoteAutosave.ts` defaults confirmed at `debounceMs = 1500`, `maxWaitMs = 15000`
- [x] Optimistic-lock conflict handling surfaces correctly against the (now-fixed) backend contract — **built and live-tested in Phase 2**: `useMedicalRecordDraft.ts`'s 409-conflict `adoptServerVersion()`/`overwriteServerVersion()` flow, later reused for the duplicate-draft case too (see §8, Bug 1/2)
- [x] Content-lock behavior (draft-only editing) is enforced and communicated in the UI — **built in Phase 2**: `NoteComposerShell.vue`'s `isLocked` computed disables all SOAP/diagnosis inputs and shows an explicit "Finalized notes are read-only" alert when status isn't draft
- [x] Status-lifecycle actions (finalize/amend/archive) match the transition table, including the finalize-after-sign→amended and amend-request→draft overrides — **built in Phase 2**: `runLifecycle()` always reloads editable content from the server's actual returned record rather than assuming requested==stored, specifically to handle these overrides
- [x] Order-entry flows for lab/pharmacy/radiology/theatre preserve catalog loading, duplicate-order checking, and the medication-safety integration confirmed real in the prior session — **verified in this pass**: lab/pharmacy/radiology reused the existing components unchanged and were live-tested by the user against the real backend. Theatre-procedure inline ordering was added afterward as a separate, additive-only module (see §3) — not yet live-tested
- [x] Close-readiness checklist matches the 4-item contract (`note_signed`/`diagnosis_documented`/`pending_orders`/`unbilled_services`) and the acknowledge-with-reason flow — **built in Phase 4**: reused `EncounterCloseChecklistDialog.vue` as-is (already correct for this contract), wired via a new `useEncounterClose.ts` composable hitting the same `PATCH /encounters/{id}/status` endpoint. Now also completes the linked appointment visit on close (see §3), matching the old page's side effect
- [x] Version history, signer attestation, and audit log panels — **built in Phase 4**, not in the original checklist wording but required by the "supporting panels" scope in §3: `useMedicalRecordVersions.ts`, `useMedicalRecordAttestations.ts`, `useMedicalRecordAuditLog.ts` (all TanStack Query, unlike ordering these had no existing decomposed components to reuse — this feature set was hand-rolled inline in the old page, so it was genuinely rebuilt) plus `VersionHistoryPanel.vue`/`SignerAttestationPanel.vue`/`AuditLogPanel.vue`. Audit-log CSV export now included (`exportCsv()`)
- [x] Every permission-gated UI affordance is re-verified against the actual permission strings — **verified**: all 16 `permissions.has(...)`/gate checks across `WorkspaceV2.vue` and the new composables cross-checked against real backend authorization code (FormRequests/Controllers/policies); every string is an exact match, none stale or guessed
- [x] Error/success messaging preserves the toast-based pattern — **verified**: 12 `notifySuccess`/`notifyError` call sites across the new composables/panels/page, zero bare `console.log`/`window.alert` left in

---

## 5. Effort estimate (rough — no team velocity data exists to ground this precisely)

| Phase | Content | Rough effort |
|---|---|---|
| 0. Contract freeze & parity checklist | Formalize §4 as sign-off criteria; confirm no backend API changes are needed | 2–3 days — **done in this pass** |
| 1. Foundation | Pinia + TanStack Query + Vitest scaffolding + `useApiFormErrors()`; new component/composable skeleton; feature flag wiring | 1 week — **done in this pass**: dependencies installed, wired into `app.ts`/`ssr.ts`, first real composable (`useEncounterWorkspace`) and page (`WorkspaceV2.vue`) working end-to-end behind `FRONTEND_WORKSPACE_V2_ENABLED`, all tested (7 Vitest + 2 Pest), zero regression on the existing Workspace page |
| 2. Note composer rebuild | SOAP editor, autosave composable, note-type variations, lifecycle actions | 2–3 weeks — **built and live-tested against the real backend in this pass**; see §8 for two real bugs live testing caught that unit tests alone did not |
| 3. Ordering UI rebuild | Lab/pharmacy/radiology/theatre order placement + order streams + lifecycle actions | **done in this pass, far under estimate**: investigation found the existing ordering components already modern and reusable as-is (see §3 revision note) — only a glue composable (`useEncounterOrdering.ts`) was new. Live-tested by the user against the real backend for lab/pharmacy/radiology. Theatre-procedure inline ordering was added afterward as a separate, additive-only module (`theatreInlineOrder.ts` + `TheatreInlineOrderForm.vue`) — not yet live-tested |
| 4. Supporting panels | Audit log, version history, signer attestation, close-readiness | **done in this pass**: close-readiness reused the existing dialog/lib (like Phase 3); audit log/version history/signer attestation were genuinely new (no existing decomposed components for these, unlike ordering) — 4 new composables, 3 new panel components, 15 Vitest tests. Not yet live-tested against the real backend (see below) |
| 5. Parallel-run & cutover | Feature-flagged rollout, parity verification, staged cutover, rollback window | **scope decided, not a build phase for now**: owner chose to rely on the live testing already done rather than build a Playwright parity suite; keep `FRONTEND_WORKSPACE_V2_ENABLED` as a personal/staging toggle only (not enabled for real users yet); defer any rollback-window/old-page-removal decision until V2 has seen more real usage. See note below the table |
| 6. (Optional) Real-time presence | Laravel Reverb integration, presence indicators | 1–2 weeks, separate initiative |

**Total core rebuild (Phases 0–5): roughly 9–13 weeks of engineering time**, before considering the parallel-run observation window. Treat this as an order-of-magnitude starting point for your own estimation, not a commitment — consistent with every other effort estimate in this report set.

**Phase 5 decision (recorded, not re-litigated going forward)**: three of the §7 open questions were resolved directly by the owner rather than left as engineering defaults —
1. No formal Playwright parity suite will be built; the live testing already performed (note composer, all 4 order types, close/attestation/audit-log flows) is treated as sufficient, with issues fixed as they surface.
2. `FRONTEND_WORKSPACE_V2_ENABLED` stays a personal/staging toggle — not flipped on for real users yet.
3. The rollback-window length and old-`Workspace.vue`-removal timeline remain undecided, to be revisited once V2 has more real usage behind it.

This means there is currently no active Phase 5 build work — the phase is "keep exercising V2 personally, fix what surfaces" rather than a scheduled cutover.

---

## 6. De-risking strategy (how the rebuild actually ships)

1. **Build behind a feature flag**, same pattern already established for the canonical-state Shadow Mode work (`config/canonical_encounter_state.php` as the template) — the new Workspace page exists alongside the old one, invisible until explicitly enabled.
2. **The existing Playwright journey test** (`tests/e2e/clinical/encounter-workspace-journey.spec.ts`) is the parity oracle — run it against both the old and new pages during the transition; it must pass against the new page before any real user sees it.
3. **Roll out by facility or user cohort, not globally** — same reasoning as the Shadow Mode staging plan: bound the blast radius to a chosen group before wide release.
4. **Keep the old page reachable for a defined rollback window** after cutover (a specific number of days, decided by whoever owns the release, not assumed here) — don't delete `Workspace.vue` the day the new page ships.
5. **Track the same conflict/error signals the Shadow Mode work already established** (the `canonical_encounter_shadow` log channel and the existing clinical audit logs) during the parallel-run window to catch behavioral drift, not just crashes.

---

## 7. Open questions requiring a decision before Phase 1 starts

- **Order-list display** (C-8, `clinical-note-audit/16`): the rebuild is the natural place to actually fix this (virtualized full list instead of a 6-item cap) — but that's still the product decision from `clinical-note-audit/16`, not something this plan resolves on its own.
- **Real-time presence** (§2, Phase 6): worth doing, given the backend's own confirmed concurrency risks, but it's a scope/budget decision, not a default inclusion.
- **Type-generation approach**: OpenAPI-from-Laravel vs. a different contract-typing strategy — needs a decision before Phase 1's scaffolding is built, since it shapes the composables' type boundaries.
- **Rollback-window length** (§6 item 4): needs an owner to pick a number, not an engineering default.

---

## 8. Real bugs live testing caught that unit tests alone did not

Phase 2 was built with 24 passing Vitest tests before ever touching a real browser. Live-testing it against the real backend (a real logged-in session, a real encounter, real Postgres data) still surfaced two genuine bugs neither the unit tests nor the type checker caught, because both were about the *interaction* between a documented backend quirk and new frontend code, not something either side alone would reveal. Recorded here because this is exactly the category of risk §1 warned a rewrite would hit.

**Bug 1 — the composer always tried to create a new note, even when a draft already existed.** `GetEncounterWorkspaceUseCase`'s `primaryMedicalRecord` field only resolves finalized/amended notes by design (`clinical-note-audit/04-clinical-note-lifecycle.md` §4.3) — a draft is invisible there. The old `Workspace.vue` has a specific, non-obvious fallback for this (`findExistingCreateEncounterDraft`) that the audit had documented but that didn't get carried into the rebuild's first pass. Result: every page load with an existing draft tried to POST-create again, got rejected by the backend's duplicate-draft guard, and retried forever on the same 1.5s/15s autosave cycle — a wall of repeating 422s, caught only by actually loading the page as a user would, not by any unit test (which each tested `useMedicalRecordDraft` in isolation with a controlled mock, never the specific "backend already has an invisible draft" scenario).

**Bug 2 — the fix for Bug 1 was itself unsafe.** The first attempt at a fix caught the duplicate-draft error and recovered by finding the existing draft and immediately re-saving over it with whatever was currently in the (still-blank) local form — which would have silently blanked out every field the user hadn't touched yet. Caught before shipping by reasoning through the exact data flow rather than trusting that "the error is gone now" meant "this is correct." Fixed by reusing the already-built, already-tested 409-conflict resolution mechanism (`adoptServerVersion()`/`overwriteServerVersion()`) instead of a new silent-overwrite path — a duplicate-draft-on-create and a version-conflict-on-update are the same underlying situation (the server has a copy the client doesn't) and now share one code path and one UI.

**Backend change made as a result**: `DuplicateEncounterDraftMedicalRecordException` now returns a distinct `MEDICAL_RECORD_DUPLICATE_DRAFT` error code instead of the generic `VALIDATION_ERROR`, so the frontend can distinguish "this is recoverable, look up the existing draft" from "this is a real validation problem, show it to the user." No test asserted the old generic code, so this was a safe, additive change — verified against the full backend suite (same 5 pre-existing, unrelated failures, nothing new).

**Takeaway for whoever continues Phase 3 onward**: unit tests with mocked API responses prove the composable does what you told it the API does. They cannot prove you told it the truth. Budget real-backend, real-browser verification into every phase, not just a final parity pass at the end — this is the second time in this rebuild alone that it caught something the test suite was confidently green about.

**Bug 3 (Phase 4) — closing an encounter right after finalizing its note showed a stale "note not signed" block.** `useEncounterWorkspace`'s bundle query (which carries the server-computed `closeReadiness`) and `NoteComposerShell`'s own `draft.record` state are two independent pieces of state fetched from two different calls. Finalizing a note updates `draft.record` locally (so the "Close encounter" button appeared correctly, since that gate reads the live composer state), but nothing told the workspace query to refetch — so the close-readiness checklist dialog kept showing the pre-finalize snapshot ("Consultation note signed — Required") until a manual page reload forced a fresh fetch. Caught immediately by the user live-testing the finalize→close sequence; no unit test would have caught it, since each composable was tested in isolation against its own mocked response and never against the other's staleness. **Fix**: `NoteComposerShell.vue` now emits `status-changed` after any successful finalize/amend/archive; `WorkspaceV2.vue` listens and calls `workspace.refetch()`. General lesson for the rest of this rebuild: any time one composable's mutation affects data another composable/query owns, that dependency has to be wired explicitly — TanStack Query's per-key caching does not infer cross-query relationships on its own.
