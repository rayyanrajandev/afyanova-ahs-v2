# V2 Navigation, Buttons & Row-Actions UX Audit

**Scope:** All 11 canonical V2 pages (confirmed as the live-routed, non-legacy implementation via `routes/web.php`).
**Method:** Full read of every page file plus every child component it renders rows/cards/menus through (order lists, popovers, dialogs, sheets). No assumptions — every finding below cites a file and line range.
**Excluded:** Visual/spacing/color redesign, anything not about navigation vs. actions, button/link semantics, row clickability, action-count, consistency, or accessibility of interactive controls.

---

## How to read this report

Each finding:

> **Location:** file : lines
> **Current implementation:** what's actually there
> **Finding / UX issue:** the problem (or "None — positive finding")
> **Severity:** Critical / High / Medium / Low / None
> **Recommendation:** specific fix
> **Rationale:** which 2027 enterprise HIS principle it satisfies or violates

Positive findings are included, not just problems — several patterns in this codebase are already the correct reference implementation and are called out as the standard other pages should copy.

---

## 1. Patients Index

**File:** `resources/js/pages/patients/IndexV2.vue`

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 1.1 | Row identifier, L394–401 | Patient name is a `<button>` opening `PatientSummaryPopover`; inside the popover, "View chart" is a real `<a href>` | Two clicks to reach the chart (name → popover → link); the link uses a raw `<a>` instead of Inertia's `<Link>`, so it forces a full page reload unlike the rest of the app | Medium |
| 1.2 | Row actions, L419–429 | `PatientVisitActionsMenu` dropdown ("Visit") + Edit + Status ghost buttons | None — correct: secondary actions already live behind a dropdown, only 2 buttons + 1 menu visible | None (positive) |
| 1.3 | Header toolbar, L250–274 | Sync offline / Backup-Restore / Register Patient — all real actions as `Button` | None | None (positive) |

**Recommendation for 1.1:** Replace `<a href="/patients/{id}/chart">` with Inertia's `<Link href="...">` for consistency with the rest of the app. Consider making the patient name itself the direct link to the chart, keeping the popover as a secondary quick-glance affordance rather than the only path.

**Rationale:** The primary identifier should be the fastest path to the record (criterion 5); mixing plain `<a>` and Inertia `<Link>` for equivalent navigation is an avoidable, un-flagged inconsistency (criterion 6).

---

## 2. Patient Chart

**File:** `resources/js/pages/patients/chart/ShowV2.vue`

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 2.1 | Overview tab quick-stat tiles, L614–654 | 4 identically-styled, hover-affordant, focusable `<button>` tiles ("Allergy safety," "Active care," "Problem focus," "Next step") | Only tile 4 has an `@click` handler. Tiles 1–3 are dead — they look and behave (focus, hover) exactly like clickable controls but do nothing on click or keyboard activation | **High** |
| 2.2 | Medications tab quick-stat tiles, L1287–1368 | Same visual pattern, but here all 4 are fully wired (open dialogs / scroll to section / real `Link`) | None — this is the correct, fully-wired version of the same component pattern, proving 2.1 is a regression/oversight, not a design choice | None (positive, reference pattern) |
| 2.3 | Billing tab invoice rows, L1663–1683 | Invoice number, date, status, total — **zero interactive elements** on the row | No way to open a specific invoice from the chart; the only path is the header's "Open billing list" button, which drops the user into the general billing list to re-locate the same invoice | **High** |
| 2.4 | Records/Notes tab rows, L1715–1758 | Each row has exactly one `Button as-child > Link` ("Open in records") | None — correct pattern, and it's the template 2.3 should copy | None (positive, reference pattern) |
| 2.5 | Encounter/visit action buttons, L657–694, 908–1106 | "Focus in chart" / "Auto-select visit" are real state-changing buttons (correctly not links); "Open visit" / "Start consultation" are `Button as-child > Link` | None — clean, consistent action-vs-navigation split throughout | None (positive) |
| 2.6 | Order cards (Orders & Results tab), via `PatientChartOrderCard.vue` | One primary `Link`-wrapped action button, optional Reorder/Add-linked-test, secondary lifecycle actions correctly behind a "More" `DropdownMenu` | Card title/order number itself isn't a link, even though a labeled action button exists nearby | Low |
| 2.7 | Vitals history disclosure toggle, L772–775 | `<button>` toggles a collapsible section via chevron + count text | No `aria-expanded` reflecting open/closed state for assistive tech | Low |
| 2.8 | Insurance tab actions, L1797–1814 | "Verify" / "Mark failed" — 2 real actions, permission-gated | None | None (positive) |
| 2.9 | Icon-only button survey (whole file) | Every icon-bearing button pairs the icon with visible text | None found | None (positive) |

**Recommendation for 2.1:** Wire the three dead tiles to navigate to their relevant tab (Medications, Orders & Results, Notes), copying the fully-wired Medications-tab version of the same component.
**Recommendation for 2.3:** Make the invoice number (or the whole row) a `Link` to that invoice's detail page, matching the Records tab's own "Open in records" pattern.

**Rationale:** A control that looks and is technically focusable/clickable but performs no action is a false affordance — it fails accessibility (AT announces it as interactive) and workflow efficiency simultaneously (criteria 7, 9). Dead-end rows force redundant search (criterion 9).

---

## 3. Appointments

**File:** `resources/js/pages/appointments/IndexV2.vue`

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 3.1 | Row identifier, L328–344 | Patient name is a `<button>` opening `PatientSummaryPopover`; "View chart" inside is a raw `<a href>` | No appointment "show" page exists (by design — appointments use an Edit sheet), so the two-tier pattern itself is correct; but the `<a>` should be Inertia's `<Link>` for consistency with the rest of the app | Medium |
| 3.2 | Row actions, L356–387 | Up to 3 ghost buttons simultaneously: Edit, No-show, Cancel — no overflow menu, despite `DropdownMenu` already being this codebase's established pattern (used in 20+ other pages) | Exceeds the ~2-visible-action guideline for a high-volume scheduling table | Medium |
| 3.3 | Row hover style, L327 | `hover:bg-muted/20` on every `<tr>` with no `@click` on the row itself | Hover affordance implies whole-row clickability; only the nested button/popover trigger actually responds | Low |
| 3.4 | Header/pagination | "Schedule appointment" button, Previous/Next pagination | None | None (positive) |

**Recommendation for 3.2:** Keep Edit as the single visible button; move No-show and Cancel into a kebab `DropdownMenu`, consistent with `PatientVisitActionsMenu`/`PatientChartOrderCard`'s "More" pattern used elsewhere.

---

## 4. Admissions

**File:** `resources/js/pages/admissions/IndexV2.vue`

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 4.1 | Ward/bed availability board, occupied-bed tiles, L318–356 | Custom `<div role="button" tabindex="0">` with `@click`/`@keydown.enter` only, no `aria-label` | `Space` (the other standard button-activation key) isn't handled; no accessible name beyond the visible bed number/status | Medium |
| 4.2 | Admissions list row, L382–410 | Entire primary content block (admission #, badges, patient, reason, time) sits inside a `CollapsibleTrigger as-child` — clicking anywhere expands/collapses in place, no separate "View" button | None — textbook clickable-row / progressive-disclosure pattern | None (positive, reference pattern) |
| 4.3 | Row actions, L412–423 | Up to 3 buttons simultaneously: Discharge, Transfer, Cancel — no overflow menu | Same "too many row buttons" issue as Appointments | Medium |
| 4.4 | Expanded-row detail links, L426–453 | "Patient summary" (popover button, correct), "View chart" and "View linked appointment" as raw `<a href>`, "Activity" (sheet button, correct) | Same raw-`<a>`-instead-of-`Link` inconsistency as 3.1/1.1 | Medium |

**Recommendation for 4.1:** Replace the custom `div[role=button]` with a native `<button>` (or add `@keydown.space`); add a descriptive `aria-label`.
**Recommendation for 4.3:** Keep the single most common action (typically Discharge) visible; move Transfer and Cancel into a kebab menu.
**Recommendation for 4.4:** Replace both raw `<a>` tags with `<Link>`.

**Rationale:** Native interactive elements provide keyboard operability (Enter *and* Space) and accessible naming for free; a custom `role="button"` div must reimplement both correctly, and here it's incomplete (criterion 7).

---

## 5. Laboratory Orders

**File:** `resources/js/pages/laboratory-orders/IndexV2.vue`

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 5.1 | Order row, L578–638 | Whole primary-identifier block is a `<button>` opening `LaboratoryOrderDetailSheet` (in-page Sheet, not a route change — `<button>` is semantically correct here); actions toolbar has primary next-action + Cancel + icon-only audit-log button (has `aria-label`) | None — max 3 buttons, correct element choice, accessible icon button | None (positive, reference pattern) |
| 5.2 | Patient group header (shared, see §8.1) | Nested `role="button"` inside a real `<button>` | See cross-cutting finding §8.1 | Medium |

---

## 6. Radiology Orders

**File:** `resources/js/pages/radiology-orders/IndexV2.vue`

Structurally identical to Laboratory Orders — same row-button pattern (L526–587), same shared group-header issue (§8.1). No radiology-specific issues found beyond the cross-cutting ones.

---

## 7. Pharmacy Orders

**File:** `resources/js/pages/pharmacy-orders/IndexV2.vue`

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 7.1 | Row actions toolbar, L646–715 | Up to **4** simultaneous buttons: primary next-action, "Policy," Cancel/Discontinue, icon-only audit-log — denser than Lab/Radiology's max of 3, no overflow menu anywhere in this module | "Policy" is a terse, unexplained label; row is the most cluttered of the three sibling modules | Medium |
| 7.2 | Cancel/Discontinue visibility, L693 vs. Lab L617 / Radiology L565 | Lab and Radiology hide the lifecycle button once `completed`; Pharmacy does **not** exclude the terminal `dispensed` status | Inconsistent terminal-state handling for the same conceptual control, with no comment explaining if it's intentional (this codebase does comment other intentional domain divergences) | Low–Medium |
| 7.3 | Detail-sheet footer (all 3 modules) | "Reorder" / "Add linked X" only reachable after opening the detail sheet, not on the row | None — correct discipline, keeps secondary actions out of the row | None (positive) |

**Recommendation for 7.1:** Move "Policy" (and possibly Cancel/Discontinue) into a kebab overflow menu, matching Lab/Radiology's leaner row.
**Recommendation for 7.2:** If dispensed orders can legitimately still be discontinued, add a short code comment (matching this file's own convention for documented domain differences) so it isn't "fixed" into false parity later; otherwise align the guard with Lab/Radiology.

---

## 8. Cross-cutting findings: Laboratory / Radiology / Pharmacy

**File:** `resources/js/components/orders/PatientOrderGroupList.vue` (shared by all three modules)

**8.1 — Location:** L36–58
**Current implementation:** `CollapsibleTrigger` renders as a real `<button>`; nested inside it is `PatientSummaryPopover`'s trigger — a hand-rolled `<span role="button" tabindex="0" @click.stop @keydown.enter.stop @keydown.space.stop.prevent>`.
**Finding / UX issue:** Interactive-in-interactive nesting (a `role="button"` element inside a real `<button>`). Invalid per HTML/ARIA content model; AT and focus order can mishandle it. Affects every patient group header in Lab, Radiology, *and* Pharmacy simultaneously since the component is shared — one fix benefits all three.
**Severity:** Medium (high leverage — single shared component)
**Recommendation:** Replace the inner `role="button"` span with a real `<button type="button">` outside the outer trigger's DOM nesting, or restructure so only the chevron icon is the collapse toggle and the patient name is a sibling clickable element.
**Rationale:** WCAG/ARIA authoring practices prohibit nested interactive widgets; this is the single highest-leverage accessibility fix in the whole audit.

**8.2 — Positive pattern, all three modules:** `PatientSummaryPopover`'s "View chart" link (`PatientOrderGroupList.vue` L54–58) is a real `<a href>` — correct navigation semantics, consistent across Lab/Radiology/Pharmacy since it's one shared component.

**8.3 — Positive pattern, all three modules:** Every status/dispense/verify/lifecycle dialog across all three modules uses an identical `DialogFooter` (Close outline button + primary/destructive submit with loading state) — fully consistent, a strong reference pattern.

---

## 9. Encounter Workspace

**File:** `resources/js/pages/encounters/WorkspaceV2.vue` (+ `EncounterWorkflowCareStreams.vue`, `EncounterOrdersCommandCenter.vue`, `EncounterOrderProgress.vue`)

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 9.1 | Header patient identity, L627–652 | Patient name is a plain, inert `<h1>`; a separate ghost "View chart" `Button as-child > Link` sits beside it | Textbook "View button navigates, identifier is inert" — the exact anti-pattern criterion 3 calls out, on the highest-traffic page in the app | Medium |
| 9.2 | Header History/Close-encounter buttons, L706–752 | Disabled state paired with a tooltip explaining *why* (e.g. "Save the note first.") | None — strong pattern, avoids silent dead ends | None (positive, reference pattern) |
| 9.3 | Order Command Center (create-order tiles), `EncounterOrdersCommandCenter.vue` | Same tile switches between a real `@click` button (in-page order form) and `Button as-child > Link` (legacy full-workflow page) depending on which is actually happening | None — exemplary: element choice tracks actual behavior, not just visual style | None (positive, reference pattern) |
| 9.4 | Orders tab — order cards (all 4 types), `EncounterWorkflowCareStreams.vue` | One "Actions" trigger button opens a `DropdownMenu` (Reorder / Add linked / Cancel / Discontinue / Entered-in-error) | None on button-count — this is the single-trigger overflow pattern the whole audit recommends elsewhere, applied uniformly | None (positive, reference pattern) |
| 9.5 | Orders tab — order identifier + Actions dropdown, all 4 types | Order/test/medication name is plain text; no "View details" item in any Actions dropdown | No drill-down to full order detail from the Orders tab for *any* order type — clinicians must switch to the Results tab (lab only) or leave the workspace | Medium |
| 9.6 | `LabResultSummaryPopover` usage — Orders tab (`EncounterWorkflowCareStreams.vue` L224) vs. Results tab (`WorkspaceV2.vue` L1301–1305) | Same lab order: Orders tab passes no `show-view-full`; Results tab passes `show-view-full` + `@view-full-result` | The identical entity offers glance-only in one tab and glance+drill-down in another — a real regression given this exact popover was just standardized elsewhere in the app | Medium |
| 9.7 | Results tab — Laboratory vs. Imaging, L1289–1324 | Lab results use `LabResultSummaryPopover` (progressive disclosure); Imaging results render `reportSummary` as a raw `<p class="whitespace-pre-line">` | Same conceptual data (narrative result), two different treatments within the same tab — already acknowledged in code comments as a known, not-yet-addressed gap | Low |
| 9.8 | Diagnoses tab remove button, L1380–1388 | Icon-only `<button>` (`<AppIcon name="x">`), destructive action, no `aria-label` | Screen reader announces an unlabeled destructive control | Medium |
| 9.9 | Medications tab, L1328–1348 | Read-only order list; copy says "Manage in the Pharmacy workflow" as plain text | Names a destination without linking to it — no actual path from the text | Low |
| 9.10 | Overview quick-stat tiles, L915–938 | Raw `<button>` tiles switching `activeTab`, correct element choice (same-page tab, not navigation) | Don't share the shared `Button` component's `focus-visible:ring`, so keyboard focus reverts to browser default, inconsistent with every other control on the page | Low |
| 9.11 | Charges tab | Fully read-only, no buttons | None — correctly excludes actions belonging to a different bounded context (Billing) | None (positive) |

**Recommendation for 9.1:** Make the patient name itself the link to the chart.
**Recommendation for 9.5/9.6:** Add a "View details" item to each order type's Actions dropdown; forward `show-view-full` + `@view-full-result` to the Orders-tab `LabResultSummaryPopover` instance so it matches the Results tab.
**Recommendation for 9.8:** Add `aria-label="Remove diagnosis"` (ideally including the diagnosis code for uniqueness).

---

## 10. Medical Records

**File:** `resources/js/pages/medical-records/IndexV2.vue`

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 10.1 | Records table row, L411–466 | `<tr>` has `hover:bg-muted/20` but no `@click`; record number and patient name are plain `<td>` text | Dead hover affordance (row looks clickable, isn't); the natural primary identifier (record number) carries no navigation at all | **High** |
| 10.2 | Row actions, L421–465 | Up to **4** same-weight outline buttons simultaneously: History, "Open encounter" (real `Link`), Finalize *or* Amend, Archive | No overflow menu anywhere in this table; History and Archive are lower-frequency/compliance-oriented and could be secondary | **High** |
| 10.3 | "Open encounter" button, L426–436 | `Button as-child > Link` | None — correct semantic navigation even though visually a button | None (positive) |
| 10.4 | Pagination, L471–481 | Previous/Next with icon + text, `:disabled` at bounds | None | None (positive) |

**Recommendation for 10.1/10.2:** Make the record number (or the full row) a link/click target that opens the History/detail sheet — reusing the exact pattern already proven in Laboratory/Radiology/Pharmacy order rows (§5.1) and the Admissions list (§4.2). Move Archive (and possibly History) into a kebab overflow menu; keep Finalize/Amend + "Open encounter" as the 1–2 visible primary actions.
**Rationale:** This is the single clearest, most complete violation of criteria 1, 3, 4, and 5 found in the whole audit — and the fix pattern already exists, proven, in four other places in this same codebase.

---

## 11. Theatre Procedures

**File:** `resources/js/pages/theatre-procedures/IndexV2.vue`

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 11.1 | Row, L472–547 | Whole row wrapped in a single `<button>` opening `TheatreProcedureDetailSheet` (in-page Sheet — `<button>` is correct here); nested inside it, the patient-name popover trigger is a hand-rolled `<span role="button" tabindex="0">` with `.stop` handlers | Same interactive-in-interactive nesting problem as §8.1, but a separate, page-local implementation (not the shared `PatientOrderGroupList` component) | Medium |
| 11.2 | Row actions, L514–545 | Up to 3 buttons: primary lifecycle action, Cancel, icon-only "View audit log" (has `aria-label`, correct) | At the edge of the row-button-count guideline | Low–Medium |
| 11.3 | Patient popover "View chart," L503–507 | Real `<a href>` | None — correct navigation semantics | None (positive) |
| 11.4 | Header toolbar, L369–383 | "Full scheduling" is `Button as-child > Link` to the legacy page (real navigation); "Schedule procedure" opens a create sheet (real action) | None — correct link-vs-button separation even though both are styled identically | None (positive) |

**Recommendation for 11.1:** Restructure so the row is not one giant `<button>` — make only the procedure name/status the primary click target, with the patient name as a sibling, not a nested, interactive element.
**Recommendation for 11.2:** Move Cancel and the audit-log icon into a kebab overflow, leaving the primary lifecycle action as the sole visible button.

---

## 12. Ward/Bed Registry

**File:** `resources/js/pages/platform/admin/ward-beds/IndexV2.vue`

**Framing note:** This page is a linear collapsible list (`RegistryListRow` idiom, shared with 11 other platform/admin registry pages), not a visual bed-board/grid — audited as a list accordingly.

| # | Location | Current implementation | Issue | Severity |
|---|---|---|---|---|
| 12.1 | Row toggle, L509–513 (`RegistryListRow.vue` L146–155) | `CollapsibleTrigger` deliberately bypassed (code comment: "would fight Reka UI's asChild merging") — a plain `<button>` drives `open` state manually | Because the library trigger is bypassed, `aria-expanded`/`aria-controls` are never wired; only a visual chevron rotation signals state | **Medium–High** |
| 12.2 | Row actions (desktop), L554–585 | Icon-only "Activity" button (`title` only, no `aria-label`), Edit, Activate/Deactivate — 3 actions, no overflow | (a) 3 actions exceeds the row-button guideline; (b) `title`-only labeling is weaker than Theatre's equivalent button, which correctly uses `aria-label` | Medium |
| 12.3 | Mobile actions, L666–680 | Edit + Activate/Deactivate hidden below `sm`, only reachable after expanding the row | Costs ward staff an extra tap on tablets/phones for a time-pressured bed-turnover workflow | Low–Medium |
| 12.4 | Pagination, L686–709 | Icon-only Prev/Next, **no `aria-label` or `title` at all** | Screen reader hears only "button" — a harder accessibility gap than 12.2 | Medium |
| 12.5 | Occupied-bed badge, L544–552, 638–646 | Shows the occupying admission number as a plain `Badge` with a `title` tooltip | Not clickable — surfaces an identifier without making it actionable, unlike Theatre's "View chart" link pattern | Low |
| 12.6 | "View" button check | No "View"-labeled buttons anywhere; row-click-to-expand used instead | None — correctly avoids the anti-pattern | None (positive) |

**Recommendation for 12.1:** Manually bind `:aria-expanded="isExpanded(item.id)"` (and ideally `aria-controls`) on the toggle button, since the automatic Reka UI wiring was intentionally opted out of.
**Recommendation for 12.2/12.4:** Add `aria-label` to both the Activity button and the pagination Prev/Next buttons, matching Theatre's already-correct pattern.

---

# Final Summary

## Overall Scores

| Dimension | Score (/10) | Notes |
|---|---|---|
| Navigation patterns (link vs. button correctness) | **7 / 10** | Strong foundation — real `<a>`/`Link` used correctly for true page transitions almost everywhere. Recurring failure mode: primary identifiers left inert next to a separately-labeled "View"/nav button (Patients Overview tiles, Medical Records rows, Encounter Workspace header). |
| Button usage (reserved for actions) | **7.5 / 10** | The large majority of buttons surveyed are genuine actions. The Patient Chart Overview tab's 3 dead tiles are the one clear case of a button-shaped control that does nothing. |
| Link usage (semantic correctness) | **6.5 / 10** | Where links exist, they're often correct (`Link as-child`, real `<a>`) — but a recurring raw `<a href>` instead of Inertia `<Link>` (Patients Index, Appointments, Admissions ×2) causes unnecessary full-page reloads in an SPA. |
| Consistency across modules | **6 / 10** | The weakest dimension. Concrete, named divergences: Pharmacy's row-button count vs. Lab/Radiology; Pharmacy's Cancel/Discontinue terminal-state gating vs. Lab/Radiology; `LabResultSummaryPopover`'s glance-vs-glance+drill-down split between Encounter Workspace tabs; Ward-Beds' `title`-only icon labeling vs. Theatre's `aria-label`; raw `<a>` vs. `Link` split across four pages. |
| Accessibility | **6 / 10** | Three separate instances of nested interactive controls (`role="button"` inside a real `<button>`) — one in a shared component affecting Lab+Radiology+Pharmacy at once, one in Theatre, one in Admissions' bed board. Plus missing `aria-expanded` (Ward-Beds), missing `aria-label` on several icon-only buttons (diagnosis remove, Ward-Beds Activity + pagination). |
| Enterprise UX maturity (overflow menus, hierarchy) | **7 / 10** | The codebase has already invented the correct pattern in multiple places (`PatientVisitActionsMenu`, `PatientChartOrderCard`'s "More" menu, `EncounterWorkflowCareStreams`'s single "Actions" dropdown) — the gap is inconsistent *adoption*, not absence of the pattern. Medical Records, Appointments, Admissions, Pharmacy, and Theatre all still show 3–4 raw row buttons instead of reusing it. |
| Workflow efficiency | **7 / 10** | Single-click "row opens detail" is the dominant, correct pattern in most order/queue tables. Clear exceptions: Medical Records' dead row, no drill-down from any Encounter Orders-tab card, 2-click path to the patient chart from the Patients list, dead invoice rows in the Patient Chart Billing tab. |

**Overall UX Score: 6.8 / 10 — Good foundation, inconsistently enforced.**
The codebase already contains the correct answer to almost every finding in this report, proven and working somewhere else in the same app. The dominant issue is not "the team doesn't know the pattern" — it's that the pattern (clickable identifier, single overflow menu, real `Link`, `aria-label` on icon buttons) isn't uniformly applied to every module that needs it.

---

## Highest Priority Fixes (ranked by impact)

1. **Medical Records table — no clickable identifier, dead row-hover, 4 ungrouped buttons** (§10.1–10.2, High). Affects an entire page's primary interaction model; the fix pattern already exists and works in Lab/Radiology/Pharmacy order rows and the Admissions list — this is a matter of reuse, not invention.
2. **Patient Chart Overview — 3 dead quick-stat tiles** (§2.1, High). A direct broken-affordance bug on the highest-traffic patient page in the app; the Medications tab in the *same file* already shows the fully-wired version to copy from.
3. **Patient Chart Billing tab — invoice rows are fully inert** (§2.3, High). Forces reception/billing staff to re-navigate and re-search for a record they can already see; the Records tab's own "Open in records" pattern is the fix.
4. **Shared `PatientOrderGroupList` nested interactive controls** (§8.1, Medium severity but high leverage). One component, one fix, benefits Laboratory, Radiology, *and* Pharmacy simultaneously — the highest fix-to-impact ratio in this report.
5. **Ward-Beds Collapsible `aria-expanded`/`aria-controls` regression** (§12.1, Medium–High). A genuine accessibility compliance gap introduced by deliberately opting out of the library's default wiring, with nothing added back to compensate.
6. **Row-button overload without a kebab menu** — Appointments (3), Admissions (3), Pharmacy Orders (4), Theatre (3) (§3.2, 4.3, 7.1, 11.2, all Medium). All five should adopt the exact overflow-menu pattern this same codebase already ships in `PatientVisitActionsMenu`, `PatientChartOrderCard`, and `EncounterWorkflowCareStreams`.
7. **`LabResultSummaryPopover` inconsistency within Encounter Workspace** (§9.6, Medium). The same lab order offers a "View full result" drill-down in the Results tab but not in the Orders tab — a same-session, same-entity inconsistency that's easy to notice and easy to fix (pass the same two props/listener already used one tab over).
8. **Encounter Workspace header — "View chart" button beside an inert patient name** (§9.1, Medium). High visibility (every encounter session), simple fix (make the name the link).
9. **Missing `aria-label` on icon-only buttons** — diagnosis remove (§9.8), Ward-Beds Activity (§12.2), Ward-Beds pagination (§12.4) — all Medium, all mechanical fixes.
10. **Raw `<a href>` instead of Inertia `<Link>`** — Patients Index (§1.1), Appointments (§3.1), Admissions ×2 (§4.4) — all Medium, all mechanical find-and-replace, all currently causing avoidable full-page reloads in an SPA.

---

## Global Interaction Standards

A definitive standard for this application, derived from the patterns that are *already working correctly* somewhere in this codebase — not invented from scratch:

1. **The primary identifier is the navigation.** Patient name, order number, record number, invoice number, admission number — whichever field a user scans first to find "the record" — must itself be the click target (or wrap the whole row) to open that record. Reference implementations: Admissions list (§4.2), Laboratory/Radiology/Pharmacy order rows (§5.1), Theatre rows (§11.1 minus the nesting defect).
2. **Buttons are reserved for state-changing actions.** Save, Check-in, Admit, Discharge, Cancel, Verify, Dispense, Complete, Transfer, Assign — anything that mutates data or opens a form/dialog to do so. If a control's only effect is "go look at something else," it is navigation, not an action, regardless of how it's styled.
3. **Never leave a "View"-style button next to an inert identifier.** If a `<button>`/`Link` labeled "View X" exists purely to open X, make X itself the link and drop (or demote) the separate button. Violated in §2.1 (patient chart Overview), §9.1 (Encounter Workspace header), §10.1 (Medical Records).
4. **In-page overlays (Sheet/Dialog/Popover) use `<button>`; cross-page navigation uses `<Link>`/`<a>`.** This distinction is already made correctly in the majority of this codebase (e.g., order rows opening a Sheet are `<button>`; "View chart" and "Open encounter" are real `Link`s) — keep enforcing it as new surfaces are built.
5. **Never use a raw `<a href>` where Inertia's `<Link>` applies.** A raw anchor forces a full page reload and discards SPA state (open sheets, scroll position, cached data). Standardize every same-app navigation on `<Link>` (wrapped in `Button as-child` when it needs button styling).
6. **Cap visible row actions at two; everything else goes in a kebab (⋮) overflow menu.** This app already has three working examples of the pattern (`PatientVisitActionsMenu`, `PatientChartOrderCard`'s "More" menu, `EncounterWorkflowCareStreams`'s single "Actions" trigger) — new tables should start from one of these, not reinvent a flat row of buttons.
7. **Never nest one interactive control inside another.** A `role="button"` (or any focusable element) must not live inside a real `<button>`/`<a>`. Found three times in this audit (§8.1 shared component, §11.1 Theatre, §4.1 Admissions bed tiles) — always structurally separate two click targets as siblings, even if it means restructuring the row layout.
8. **Every icon-only control needs an `aria-label`.** `title` alone is not a reliable accessible name (no touch equivalent, inconsistent AT support). Audit every icon-only button for this before shipping it.
9. **Disclosure widgets (`Collapsible`, accordions) must expose `aria-expanded`.** If a library's default trigger is bypassed for layout reasons (as in Ward-Beds, §12.1), the state attributes it would have provided must be added back manually — don't just drop them.
10. **A disabled action button should say why, next to it.** The Encounter Workspace's tooltip-on-disabled pattern (§9.2 — "Save the note first.") is the standard; a control that's inexplicably unclickable is a dead end for the user.
11. **The same entity gets the same interaction, wherever it's shown.** If order X's result has a "view full result" drill-down in one tab, it must have the same drill-down anywhere else that order X's result is rendered (violated in §9.6). Consistency is per-entity, not per-screen.
12. **Domain-specific divergence must be commented, or it reads as a bug.** Where one module genuinely needs different behavior from its siblings (e.g., a dispensed prescription can still be discontinued while a completed lab order cannot, §7.2), say so in a code comment — this codebase already does this well in several places (radiology's missing verify step, pharmacy's extra dialogs) and should do it everywhere behavior intentionally diverges.

---

*Audit conducted by reading all 11 V2 page files in full plus their directly-imported row/card/menu/dialog components. No code was modified as part of this audit.*
