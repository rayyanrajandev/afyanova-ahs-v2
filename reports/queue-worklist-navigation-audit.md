# Queue & Worklist Navigation Audit

**Document type**: Read-only audit, no code changes. Answers four questions for six requested worklists: does the page exist, is it reachable from the sidebar, is it clearly named/organized there, and is it a V2 (composable/TanStack-Query) page or a legacy monolith. Every claim below is backed by a file/line citation, not memory — same discipline as `reception-checkin-architecture-audit.md`.

---

## 1. Summary

| Worklist | Page exists? | Sidebar entry | Name/organization | V2? |
|---|---|---|---|---|
| Reception Queue | ✅ `reception/Queue.vue` | ✅ "Reception queue" | ✅ Clear, correctly grouped | ✅ Yes |
| Triage Queue | ⚠️ Exists, but not as a page — a *mode* inside `appointments/Index.vue` | ❌ No dedicated entry | ❌ Not discoverable from the sidebar at all | ❌ No (8,602-line legacy monolith) |
| Clinician Queue | ⚠️ Same — a mode inside `appointments/Index.vue` | ❌ No dedicated entry | ❌ Not discoverable from the sidebar at all | ❌ No (same file) |
| Laboratory worklist | ✅ `laboratory-orders/Index.vue` | ✅ "Laboratory" | ✅ Clear name, correct section | ❌ No (10,102 lines) |
| Radiology worklist | ✅ `radiology-orders/Index.vue` | ✅ "Imaging & radiology" | ✅ Clear name, correct section | ❌ No (7,349 lines) |
| Pharmacy worklist | ✅ `pharmacy-orders/Index.vue` | ✅ "Pharmacy & dispensing" | ✅ Clear name, correct section | ❌ No (16,765 lines — the largest page in the app) |

**Bottom line**: 4 of 6 exist as real, sidebar-linked pages with clear names, but none of those four have been rebuilt to V2 yet — no plan document for any of them exists in `reports/` (checked: only `patients-index-*`, `patient-chart-*`, `medical-records-index-*`, `clinical-notes-*`, `patient-arrival-checkin-*`, and `queue-based-workflow-*` plans exist). The other 2 — Triage Queue and Clinician Queue — are real, working features, but they're hidden inside one generically-named sidebar item, reachable only by a URL query parameter nothing in the sidebar surfaces.

---

## 2. Reception Queue — done, matches every criterion

`reception/Queue.vue` (400 lines). Sidebar: `appNavCatalog.ts:99-106`, title "Reception queue", `front_office` section, grouped directly between "OPD appointments" and "Patient flow board" — sensible clustering of front-desk/queue pages. V2: built this session, uses `useReceptionQueue`/`usePlatformAccess`/TanStack Query, matches the established `ShowV2.vue`/`WorkspaceV2.vue` surface conventions per its own docblock (`reception/Queue.vue:35-47`).

No findings here — this is the reference example the other five should look like.

---

## 3. Triage Queue and Clinician Queue — real, but hidden

Both exist as genuine, working features — not vaporware — but neither is a page in its own right, and neither has a sidebar entry.

### 3.1 Where they actually live

`appointments/Index.vue:62` defines `type QueueMode = 'all' | 'triage' | 'clinical'`. Line 865:

```ts
const queueModeLabel = computed(() => isMyClinicalQueue.value ? 'My patients' : (isTriageQueue.value ? 'Triage queue' : 'All appointments'));
```

So "Triage queue" and "My patients" (the clinician's own queue) are literal, named modes inside the single `/appointments` route — switched via `?view=triage` / `?view=clinical` (`appointments/Index.vue:1437-1441`, `queryQueueModeParam()`). The page is legacy: 8,602 lines, no composable/TanStack-Query rebuild, no plan document scoping one.

### 3.2 Sidebar reachability

`appNavCatalog.ts` has exactly one entry for this page — "OPD appointments" (`appNavCatalog.ts:91-98`), `href: '/appointments'`, no query string, no sub-links. Clicking it always lands on `queueMode: 'all'` ("All appointments"), never on the triage or clinical mode. The `helpNote` ("Check-in queue, triage, and quick booking") hints that triage happens somewhere on this page, but nothing in the sidebar tells a nurse or clinician how to actually get to their specific worklist.

### 3.3 How they're reached today

Only through Dashboard role-based workflow widgets, not the persistent sidebar:
- **Clinician Queue**: `Dashboard.vue:107-124`'s `clinicianQueueHref()` correctly builds `?view=clinical&status=...&clinicianUserId=...` — "Open clinician queue" / "Open my queue" buttons in `workflows/clinician/surface.ts:36-39` do land on the real "My patients" mode.
- **Triage Queue**: no equivalent `triageQueueHref()` helper exists. Every "Triage queue" labeled button across `workflows/nursing/surface.ts:17,104`, `workflows/emergency/surface.ts:35,68,112,130,138,146`, and `workflows/front_desk/surface.ts` uses `?view=queue&status=checked_in...` — and `queryQueueModeParam()` (§3.1) only recognizes `'triage'` or `'clinical'` as valid values for `view`; `'queue'` falls through to `queueMode: 'all'`. These buttons do correctly filter to `waiting_triage`-status appointments (via `status=checked_in` → `queryPresetParam()`'s alias, `appointments/Index.vue:1428-1435`), but they never activate the labeled "Triage queue" mode itself — a real, separate inconsistency from the clinician case, noted here as a finding, not fixed (out of scope for a read-only audit).

### 3.4 What already exists that could have been the fix, but isn't

Two V2 pages deliberately excluded this exact segment rather than absorbing it:
- `patient-flow/Board.vue:14-22`'s own docblock: "`waiting_triage`/`in_triage`/`waiting_clinician`/`waiting_clinician_review` are deliberately excluded from the board component and instead surfaced as a single count linking to `/reception/queue`, which already owns that segment."
- `reception/Queue.vue`'s "Waiting for triage" / "Waiting for provider" tabs (`reception/Queue.vue:316-346`, via `ReceptionQueueList.vue`) show *who* is waiting, front-desk-style — but `ReceptionQueueList.vue` is read-only: no "start triage," "claim," or "open consultation" action anywhere in the component (confirmed by reading the full file — zero `<Button>` elements). A nurse or clinician can see the queue there but has nothing to click to act on it; they still have to navigate to legacy `/appointments` and manually switch modes to actually do the work.

So there is a real gap between "visibility" (built, V2, in the sidebar) and "worklist" (do the actual triage/consultation action) — the former exists twice over (Reception Queue, Patient Flow Board); the latter only exists in the legacy page, undiscoverable from the sidebar.

---

## 4. Laboratory / Radiology / Pharmacy worklists — exist, sidebar-correct, all legacy

All three follow the same shape: real page, real sidebar entry with a clear name and correct section, but no V2 rebuild has been scoped or started.

| Page | Lines | Sidebar entry | Section |
|---|---|---|---|
| `laboratory-orders/Index.vue` | 10,102 | "Laboratory" (`appNavCatalog.ts:163-170`) | `diagnostics` |
| `radiology-orders/Index.vue` | 7,349 | "Imaging & radiology" (`appNavCatalog.ts:171-178`) | `diagnostics` |
| `pharmacy-orders/Index.vue` | 16,765 | "Pharmacy & dispensing" (`appNavCatalog.ts:179-186`) | `diagnostics` |

Names are clear and specific (no ambiguity like "OPD appointments" hiding two worklists). Grouping under one `diagnostics` section with matching icons (`flask-conical`, `activity`, `pill`) is sensible and consistent. `helpNote`s correctly describe each as a queue ("Lab order queue and result status updates", etc.).

The only gap is scale, not naming or reachability: these are the three largest pages in the entire app (pharmacy-orders is the single largest file in the codebase), each a pre-V2 monolith with the same architectural profile `patients/Index.vue` had before this session's rebuild (file-local `apiRequest()`, frozen permission snapshots, no Vitest coverage — not independently re-verified per-file this pass, but consistent with every other un-rebuilt legacy page audited this session). No `reports/*-modernization-plan.md` exists for any of the three.

---

## 5. Adjacent finding: Emergency & triage is a *second*, separate triage flow

Not asked for directly, but relevant to "Likely Triage Queue": `emergency-triage/Index.vue` (4,730 lines, sidebar entry "Emergency & triage", `clinical_care` section, `appNavCatalog.ts:123-130`) is a **second, distinct** triage workflow — ER-specific intake/triage/transfer, gated by `emergency.triage.*` permissions, entirely separate from the OPD triage mode inside `appointments/Index.vue` (§3). Anyone asking "where's the Triage Queue" could reasonably mean either one; today there are two different answers depending on whether the patient came through Emergency or OPD, and neither is named "Triage Queue" in the sidebar.

---

## 6. Not addressed here

Per the read-only scope of this audit: no fixes were made. If any of these gaps are worth closing, the real candidates (in the order the evidence above suggests, most-isolated-first) would be:
1. Add a `triageQueueHref()` helper alongside `clinicianQueueHref()` in `Dashboard.vue` so "Triage queue" buttons actually set `view=triage` — smallest fix, directly closes the labeled-but-wrong-mode inconsistency in §3.3.
2. Give Triage Queue and Clinician Queue their own sidebar entries (or sub-links under "OPD appointments") pointing at `?view=triage` / `?view=clinical` — closes the discoverability gap in §3.2 without touching the legacy page itself.
3. A V2 rebuild plan for `appointments/Index.vue` (the highest-value target of the three remaining legacy monoliths, since it's the one with an undiscoverable feature inside it, not just scale) — same shape as `patients-index-modernization-plan.md`, not started, no audit exists yet.
4. V2 rebuild plans for `laboratory-orders`, `radiology-orders`, `pharmacy-orders` — real, but lower urgency than (3): they're already reachable and clearly named, the gap is architecture/scale, not discoverability.

None of these are scheduled — flagged for a decision, not assumed.

---

## 7. Update: §6 item 1 fixed (`triageQueueHref()`)

Added `triageQueueHref(focusAppointmentId?, triageCategory?)` to `Dashboard.vue`, mirroring `clinicianQueueHref()` exactly: builds `?view=triage&status=checked_in&from=...`, plus `focusAppointmentId`/`focusAction=triage` when deep-linking to a specific patient, and `triageCategory` for the P1/P2 watch items. Registered on `DashboardSurfaceRuntime` (`surfaceTypes.ts`) and the `dashboardSurfaceRuntime` computed object passed to every workflow surface.

Replaced every hand-built `?view=queue&status=checked_in...` href that was labeled "Triage queue" / "Open triage queue" / "Open triage" with `runtime.triageQueueHref(...)`:
- `workflows/nursing/surface.ts` — actions, queue row hrefs, handoff primary action, watch item (4 call sites).
- `workflows/emergency/surface.ts` — actions, queue row hrefs, handoff primary action, watch item, plus the P1/P2 category watch items now pass `triageCategory` (5 call sites).
- `Dashboard.vue`'s own `queueViewAllHref` computed — the nursing/emergency branches had the identical bug.

Deliberately **not** touched: `workflows/front_desk/surface.ts`'s `?view=queue&status=checked_in...` hrefs (labeled "Appointment queue" / "Open checked-in queue" / "Checked-in handoff") — front desk staff are meant to land on the general filtered appointments list, not the nurse-specific triage mode, so `view=queue`'s fallback to `queueMode: 'all'` is correct there, not a bug. Also left `workflows/emergency/surface.ts`'s "Register emergency walk-in" actions alone — they open a create/schedule dialog, not the queue view itself, so the underlying queue mode is irrelevant to that action.

Verified: TS error count unchanged at the 778-error pre-existing baseline (only line-number shifts from the added code, confirmed via diff against the pre-change baseline). 179/179 Vitest passing.

---

## 8. Update: §6 item 2 fixed (sidebar entries for Triage Queue / Clinician Queue)

Added two entries to `appNavCatalog.ts`'s `clinical_care` section, right after "Emergency & triage":
- **"OPD triage queue"** → `/appointments?view=triage&status=checked_in`, icon `heart-pulse`. Title deliberately says "OPD" (not just "Triage queue") to disambiguate from "Emergency & triage" — §5 found these are two genuinely separate triage flows, and a generic name would have recreated the same ambiguity this item exists to resolve.
- **"Clinician queue"** → `/appointments?view=clinical&status=waiting_provider`, icon `stethoscope`, helpNote "Your own patients waiting for review or already in consultation."

Both reuse `/appointments`'s existing route-access rule (`routeAccess.ts`'s `pathPrefix: '/appointments' → appointments.read`) — same as "OPD appointments" already does; the `permissionPrefixes` set on each entry (`emergency.triage.` / `appointments.start-consultation`, matching each mode's actual in-page gate) are correct-but-inert, since `sidebarNavCatalogItemVisible()` prefers the explicit path rule when one exists. Not a regression — the pre-existing "OPD appointments" entry has the identical property.

**A real gap found while wiring this, fixed alongside it**: a static sidebar href has no access to the signed-in user's id, so `/appointments?view=clinical&status=waiting_provider` alone would land on the real "My patients" mode (fixing §3.3's original bug) but with `clinicianUserId` empty — showing *every* clinician's waiting_provider appointments under the "My patients" label, not just the viewer's own. `appointments/Index.vue`'s existing `applyDefaultQueueForSignedInUser()`/`openMyClinicalQueue()` both already populate `clinicianUserId` from `currentUserId` whenever *they* set `queueMode`, but neither runs when `view=clinical` arrives explicitly in the URL (`hasExplicitQueueIntent` gates both). Added one small, additive fix in `onMounted()` (`appointments/Index.vue`): if `queueMode` resolves to `'clinical'` and `clinicianUserId` is still empty once the page mounts, default it to the signed-in user. Idempotent with the existing paths (they already set `clinicianUserId` themselves, so this never overrides an explicit choice) and doesn't touch the `department`/`unassignedClinician` queue variant, which is intentionally unfiltered by clinician.

**Known, accepted trade-off, not fixed**: sidebar active-state highlighting (`useCurrentUrl.ts`'s `isCurrentUrl()`) compares an item's full href (including query string) against the current URL's bare pathname — so neither new entry will show as "highlighted" while the user is actually on that view, even though navigation itself works correctly. This is a pre-existing limitation of the highlighting mechanism (every other sidebar entry happens to have a query-string-free href, so it was never exposed before); fixing it would mean changing shared active-route-matching logic used by every sidebar item, which is out of scope for "add two entries." Flagged here, not fixed.

Verified: TS error count unchanged at 778 (line-number shifts only, confirmed via diff). 179/179 Vitest passing.

§6's items 3–4 (V2 rebuild plans for `appointments/Index.vue`/lab/radiology/pharmacy) remain open, not scheduled.
