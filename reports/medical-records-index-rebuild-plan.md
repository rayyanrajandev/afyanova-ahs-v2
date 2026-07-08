# Medical Records Index — Rebuild Plan (V2)

## Scope assumptions (stated explicitly so they're easy to redirect)

- This plan covers `resources/js/pages/medical-records/Index.vue` (6,126 lines, route `medical-records`) only.
- Per the investigation pass: this page is a **cross-patient registry + status-governance surface** (search/filter, finalize/amend/archive, signer attestation, version history, audit log) — it is **not** a note editor. Content creation/editing is already fully delegated to the Encounter Workspace; visiting Index.vue with `?tab=new` or an appointment/admission context immediately redirects there via `router.replace()`. This plan does not change that delegation.
- **No new backend contract needed.** `GET /medical-records` (`ListMedicalRecordsUseCase.php`) already supports every filter the page uses (`q`, `patientId`, `encounterId`, `appointmentId`, `appointmentReferralId`, `admissionId`, `theatreProcedureId`, `authorUserId`, `status`, `recordType`, `from`/`to`, pagination, sort) — same endpoint Patient Chart's Records tab already calls with `patientId` set. This is a frontend-only rebuild, same situation as Patient Chart, the opposite of the encounters list.
- **Real reuse opportunity, not just a pattern match**: Phase 4 of the note-composer rebuild already built `useMedicalRecordVersions.ts`, `useMedicalRecordAttestations.ts`, `useMedicalRecordAuditLog.ts` (all TanStack Query, all parameterized by a plain `recordId`, none WorkspaceV2-specific) plus `VersionHistoryPanel.vue`/`SignerAttestationPanel.vue`/`AuditLogPanel.vue`/`EncounterHistorySheet.vue`. Index.vue's version/attestation/audit-log features can reuse these **as-is** — this is the single biggest effort reduction in this plan.
- Like the other two rebuilds, this ships as a new, flag-gated page (`medical-records/v2` or similar) — the existing `medical-records` route and `Index.vue` are completely untouched until there's confidence to cut over.

---

## 1. Risk profile — moderate, not low, but not new-contract risk either

This isn't as low-risk as Patient Chart (which had zero writes at all), but it isn't the note-composer's shape of risk either:

- **Writes exist** (finalize/amend/archive, signer attestation) — but they hit the exact same `PATCH /medical-records/{id}/status` and `POST /medical-records/{id}/signer-attestations` endpoints already proven correct by both the still-live old `Workspace.vue` and the already-shipped `WorkspaceV2.vue`. No new lifecycle logic to get right — reuse the contract, not reinvent it.
- **No content editing here** — the SOAP fields, autosave, and draft-resolution complexity that made the note composer risky don't exist on this page at all (confirmed: opening a record for editing redirects to the Encounter Workspace).
- **The real risk is the same as Patient Chart's**: a wide filter surface (11 filter params) with 150 hand-rolled top-level functions in one file — the risk is a dropped filter or a silently-wrong status-action permission gate during the port, not a systemic contract problem.

---

## 2. Target architecture

```
routes/web.php
    GET medical-records/v2 → Inertia::render('medical-records/IndexV2')
    Config-gated: frontend_rebuild.medical_records_index_v2_enabled (mirrors the other three flags)

config/frontend_rebuild.php
    'medical_records_index_v2_enabled' => (bool) env('FRONTEND_MEDICAL_RECORDS_INDEX_V2_ENABLED', false)

resources/js/pages/medical-records/IndexV2.vue
    Thin page shell: filter bar, results list/table, detail sheet — permission gates via
    usePlatformAccess() (see §3), not the async /auth/me/permissions fetch the old page uses.

resources/js/composables/medicalRecordsIndex/
    useMedicalRecordListFilters.ts   — reactive filter state, mirrors useEncounterListFilters()'s
                                        shape 1:1 (q/status/recordType/patientId/encounterId/
                                        appointmentId/admissionId/authorUserId/from/to/page/
                                        perPage/sortBy/sortDir)
    useMedicalRecordList.ts          — TanStack Query wrapping GET /medical-records with the above
    useMedicalRecordStatusAction.ts  — finalize/amend/archive dialog state + PATCH .../status,
                                        same endpoint & reason-required rules as WorkspaceV2's
                                        note lifecycle actions — port the permission/transition
                                        rules, don't reinvent them

resources/js/composables/clinical/  (already built — Phase 4, reused not rebuilt)
    useMedicalRecordVersions.ts
    useMedicalRecordAttestations.ts
    useMedicalRecordAuditLog.ts

resources/js/components/medical-records/
    MedicalRecordListFilters.vue
    MedicalRecordListTable.vue
    MedicalRecordDetailSheet.vue      — hosts VersionHistoryPanel/SignerAttestationPanel/AuditLogPanel
                                        (all reused as-is from clinical/panels/)
    MedicalRecordStatusActionDialog.vue
```

**Reused as-is, not rebuilt**: `VersionHistoryPanel.vue`, `SignerAttestationPanel.vue`, `AuditLogPanel.vue` (and the `Sheet variant="workspace" size="6xl"` shell pattern `EncounterHistorySheet.vue` established), `AuditTimelineList`, `DateRangeFilterPopover`, `PatientLookupField` (already-extracted components the old page itself uses), `@/lib/apiClient.ts`.

---

## 3. Permission model — same recommendation as Patient Chart, for the same reason

Confirmed: Index.vue uses the **async** pattern — 20 `ref(false)` permission flags populated by a `GET /auth/me/permissions` fetch on mount (lines ~1433-1465), the same mechanism `usePermissions.ts` formalizes for WorkspaceV2. This is *not* the synchronous Inertia-shared-props approach (`usePlatformAccess()`) Patient Chart V2 uses, which reads permissions already present in every page load's shared props with zero extra network cost.

**Recommendation**: switch this page to `usePlatformAccess()` during the rebuild, same as Patient Chart V2. This removes an entire network round-trip this page currently pays on every load, and is a behavior-neutral swap — both mechanisms reflect the same underlying permission set, just fetched differently. Not a scope-creep risk; a strict improvement, consistent with the direction already established.

---

## 4. Overlap with Patient Chart's Records tab — confirmed intentional, not a bug to fix

When `patientId` is set, this page and Patient Chart's Records tab call the identical backend endpoint. Investigation found Patient Chart's tab is a deliberately thinner view (problem-focus/next-step summary, no status actions, no audit/version/attestation panels) that links "Open in records" back to *this* page for anything more — i.e. Patient Chart = glance, Index = full registry + governance. This looks like correct layering already, not the kind of duplication the original three-concept review flagged elsewhere. **Not resolved here**: worth a one-line confirmation that this layering is deliberate before Phase 1 starts, rather than assumed.

---

## 5. Feature-parity checklist (the actual "done" bar)

- [x] All 10 filter params in active use (`authorUserId` deliberately left dormant per §8) round-trip against real data — status-count chips, search, patient lookup, note-type, and date-range filters all wired via `useMedicalRecordListFilters`/`useMedicalRecordList`, including the cross-patient (no `patientId`) registry mode. Built in Phase 1.
- [x] Finalize/amend/archive actions match the same transition rules and reason-required behavior as the old page's status dialogs — `useMedicalRecordStatusAction.ts` ports `canApplyMedicalRecordStatusAction`'s exact draft→finalized/finalized→amended/any-non-archived→archived rules 1:1, same `PATCH /medical-records/{id}/status` endpoint, same reason-required-for-amend/archive-only behavior. Covered by 6 Vitest tests. Built in Phase 2.
- [x] Signer attestation, version history, and audit log panels work identically via the reused Phase-4 composables/components — confirmed a direct port: `EncounterHistorySheet.vue` (despite its name, fully generic) is reused as-is, wired to whichever record's "History" button was clicked. Built in Phase 2.
- [x] The `?tab=new` / appointment-context redirect-to-Encounter-Workspace behavior is preserved, with the admission-only dead-branch from §9.3 fixed rather than faithfully reproduced (per §8's decision) — `filters.admissionId` is now set instead of silently falling through to an unfiltered view. Built in Phase 3.
- [x] Permission gates ported 1:1 for everything Phase 1-2 actually uses (`medical.records.read/finalize/amend/archive/attest`, `medical-records.view-audit-logs`) via `usePlatformAccess()` per §3's recommendation — confirmed against real backend authorization in Phase 0, not assumed. Per the user's explicit decision, the old page's inline lab/pharmacy/imaging/billing ordering workflow was **not** ported — a record's Actions column instead gets a single "Open encounter" link (`encounterWorkspaceHrefForRecord`) out to the Encounter Workspace, keeping this page registry/governance-only. Built in Phase 3.
- [x] Deep-linking (`?recordId=X&patientId=Y` opening the detail sheet) preserved — `openRecordFromDeepLink()` fetches the single record and opens `EncounterHistorySheet` on mount. Built in Phase 3.

---

## 6. Effort estimate (rough)

| Phase | Content | Rough effort |
|---|---|---|
| 0. Contract re-verification | Confirm all 11 filter params and 11 permission strings against real backend code and real data, per the established discipline | 1–2 days |
| 1. Foundation + list/filters | Route/config flag, page shell, `useMedicalRecordListFilters`/`useMedicalRecordList`, filter bar + results table | 3–5 days |
| 2. Status actions + detail sheet | `useMedicalRecordStatusAction`, detail sheet wiring the **reused** version/attestation/audit-log panels | 3–5 days — smaller than it sounds because the panels already exist |
| 3. Parity pass | Redirect-to-workspace behavior, deep-linking, cross-link hrefs (billing/orders), permission-gate audit | 2–3 days |

**Total: roughly 2–3 weeks** — less than Patient Chart, mainly because three of its supporting panels are pure reuse rather than new builds.

---

## 7. De-risking strategy

- Flag-gated (`FRONTEND_MEDICAL_RECORDS_INDEX_V2_ENABLED`), old page completely untouched, same pattern as the other three rebuilds.
- Live-test against real data before moving between phases — same discipline that caught the Postgres `MAX(uuid)` bug and the draft-recovery bug earlier in this engagement is exactly what a 150-function, 11-filter page needs.
- Specifically verify the redirect-away behavior (`?tab=new`, appointment/admission context) early — this is the one piece of behavior that, if silently dropped, would reintroduce note-editing into a page this plan explicitly keeps registry-only.

---

## 8. Open questions requiring a decision before Phase 1 starts

- **Confirm the Patient Chart Records tab / Index.vue layering is intentional** (§4) — a quick sign-off, not expected to change anything, but stated as a decision rather than an assumption per the original review's own instruction not to assume based on names/behavior alone.
- **Should `authorUserId` filtering be exposed in the UI?** Confirmed in Phase 0 (§9.5): the backend supports it, the old page's UI has zero filter input for it anywhere — genuinely dormant, not a page-reading miss. Decide whether V2 finally exposes it or leaves it dormant.
- **The admission-only redirect gap** (§9.3) — fix or faithfully reproduce? Leaning toward fix, since it looks like an unreachable dead branch in the old page rather than an intentional behavior, but flagging as a decision rather than assuming.

---

## 9. Phase 0 findings (verified against actual code and real data, not assumed)

1. **All 11 filters confirmed wired into real WHERE clauses** (`EloquentMedicalRecordRepository::search()`, lines 240–264) — none silently dropped. `q` is a multi-field `LIKE '%term%'` OR-group across `record_number`/`record_type`/`assessment`/`plan`/`diagnosis_code` — **not** a patient-name search and **not** a join. Patient-scoped search relies entirely on the separate `patientId` param (resolved via `PatientLookupField`, not free text). **The rebuild must replicate this exactly** — a filter bar that lets someone type a patient's name into the free-text box and expect a match would be a regression, since the backend genuinely doesn't support that.

2. **All 11 permission strings confirmed real**, enforced in `UpdateMedicalRecordStatusRequest::authorize()` (same "auth lives in the FormRequest, not route middleware" pattern already seen on Encounter's status endpoint) and real seeded permissions (`RoleHierarchySeeder.php:646,780,793,837,860`) / `Gate::define` entries (`AppServiceProvider.php:113`). One additional gate exists (`medical-records.update-draft`, `AppServiceProvider.php:117`) that the plan's checklist doesn't list — but it only guards the content-PATCH endpoint, which Index V2 has no reason to call given its registry-only scope. Not a plan defect.

3. **Redirect logic confirmed** (`Index.vue:3916-3948`): triggers on `tab === 'new' || appointmentId || admissionId`. **One latent edge case found in the old page**: if `admissionId` is present but `appointmentId`/`patientId` are both empty and `tab !== 'new'`, the outer condition fires but no inner branch matches — execution silently falls through to a normal page refresh instead of redirecting. Likely unreachable today (no admission-only links without a patientId were found anywhere), but this is exactly the kind of thing worth a conscious decision in Phase 1 rather than a faithful copy of a probable bug (see §8).

4. **Deep-linking confirmed exactly as assumed**: `?recordId=X&patientId=Y` is real (`queryParam('recordId')` at line 655), opens the detail sheet after the initial page load.

5. **`authorUserId` confirmed dormant**: backend fully supports it, zero UI filter input anywhere in the template (only a display-only "Clinician #{id}" fallback label exists, unrelated).

6. **Real-data check passed** — ran `ListMedicalRecordsUseCase` directly against the live Postgres dev database (bootstrap script, not `tinker`, matching the established pattern for this kind of check): no-filter registry mode and `patientId`-scoped mode both returned correct rows with no errors. No Postgres-specific issue like the `MAX(uuid)` bug found here — consistent with this repository never using `latestOfMany()`/aggregate functions on UUID columns anywhere in its query.
