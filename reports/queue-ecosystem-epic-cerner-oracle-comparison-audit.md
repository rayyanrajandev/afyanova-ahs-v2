# Queue Ecosystem Audit — Comparison Against Modern EHR Track Boards (Epic / Cerner / Oracle Health)

**Document type**: Read-only audit, no code changes. Prompted by "does reception queue need a completed tab, based on modern health systems like Epic?" — answering that required auditing every queue/worklist/board page in the app first, not just reception. Builds directly on `reports/queue-based-workflow-audit.md`, `reports/queue-worklist-navigation-audit.md`, and `reports/queue-based-workflow-modernization-plan.md` (Phases 0–4 shipped: domain events, `GetActiveVisitJourneyUseCase`, triage claim/lock, Patient-Flow Board) — those three predate this session's four V2 order-worklist builds (lab/pharmacy/radiology/theatre) and, in the first two cases, predate the Patient-Flow Board's existence entirely. This audit brings the inventory current and adds the comparison those didn't attempt.

---

## 1. Inventory — every queue/board page in the app today

| Page | Structure | Tabs/columns | Completed/discharged visible? | Elapsed-time shown? | Priority/acuity shown? | Refresh | V2? |
|---|---|---|---|---|---|---|---|
| `reception/Queue.vue` | Flat list | Waiting triage / Waiting provider (+ Scheduled today) | ❌ No | ✅ `waitLabel()` — min/hour, arrival- or consultation-relative | ❌ | 30s poll | ✅ |
| `triage/Queue.vue` (OPD) | Flat list | All / Waiting / In progress / Completed | ✅ Yes | ✅ Same `waitLabel()` (shared component) | ❌ | 30s poll | ✅ |
| `emergency/Queue.vue` (ED, serves both `/emergency-triage` and `/emergency/queue`) | Flat list, expand-in-place | All / Waiting / Triaged / In treatment | ⚠️ Only via "All" — no dedicated tab | ❌ Absolute timestamps only | ✅ Red/yellow/green triage-level badge | None (mutation/nav only) | ✅ |
| `patient-flow/Board.vue` | **Kanban** (10 columns) | with_clinician, waiting_lab, waiting_imaging, waiting_lab_and_imaging, in_lab, in_imaging, in_lab_and_imaging, waiting_pharmacy, waiting_direct_service, in_direct_service | ❌ Deliberately excluded both ends (earlier stages roll into one link-out badge, nothing past waiting_pharmacy) | ❌ Patient name + department only, no timer | ❌ | 30s poll | ✅ |
| `directService/Queue.vue` | Flat list | All / Pending / In progress / Completed | ✅ Yes | ❌ Absolute timestamp only | ❌ | 30s poll | ✅ |
| `walk-in-service-requests/Index.vue` (legacy, un-nav-linked) | Flat list | All / Waiting / Accepted / Closed / Cancelled | ✅ Yes | ❌ | ❌ | None | ❌ Legacy |
| `inpatient-ward/RebuiltPage.vue` | **Bed grid** (census card) + separate task-queue view | queue / board / documentation toggle; census grouped by ward → bed | N/A (discharge removes from board) | ❌ Only absolute `admittedAt`, no length-of-stay computed | ❌ | None (manual refresh) | ✅ |
| `laboratory-orders/IndexV2.vue` | Flat/grouped-by-patient | All + 5 statuses | ✅ Yes | ❌ | ✅ Urgent/stat badge (routine hidden) | 30s poll | ✅ |
| `pharmacy-orders/IndexV2.vue` | Grouped-by-patient | All + 5 statuses | ✅ Yes | ❌ | N/A (no priority field) | 30s poll | ✅ |
| `radiology-orders/IndexV2.vue` | Grouped-by-patient | All + 5 statuses | ✅ Yes | ❌ | N/A (modality, not priority) | 30s poll | ✅ |
| `theatre-procedures/IndexV2.vue` | Flat list | All + 5 statuses | ✅ Yes | ❌ | N/A (no priority field) | 30s poll | ✅ |

**Immediate answer to the original question**: reception and OPD triage's parent-queue are the *only two* active-patient queues in the entire app without completed-tab visibility — every department worklist (lab/pharmacy/radiology/theatre) and both service-request queues already have one. Emergency's is present but demoted (buried in "All," no dedicated tab or count) despite being the highest-acuity area. So the gap isn't reception being behind Epic specifically — it's reception being behind this codebase's *own* already-established convention.

---

## 2. What Epic/Cerner/Oracle Health track boards actually foreground

Grounding the comparison in what these systems' ED/ambulatory/inpatient tracking boards (Epic's ED/OpTime SnapBoard, Cerner/Oracle Health's PowerChart Tracking Board and FirstNet) share as conventions, independent of this codebase:

1. **Elapsed time in current status, color-escalating** (green → yellow → red as a configurable threshold is crossed) — the single most recognizable visual element of any track board. Not just "when did this happen" but "how long has this been true," visually urgent by default.
2. **Acuity/priority as a persistent, color-coded badge** — ESI 1–5 in ED contexts, always visible, never a click away.
3. **Physical location (room/bed) as the primary grouping axis** wherever one exists — the board mirrors the floor plan, not an arbitrary list order.
4. **Inline order-status glyphs per patient row** — small icons/chips showing "lab pending," "rad pending," "med due," directly on the tracking row, so a glance tells you what's outstanding without opening the chart.
5. **A visible completed/discharged lane** that patients move into (rather than disappearing), typically with a configurable auto-drop-off window — for staff reassurance ("did they actually get seen") and at-a-glance audit trail.
6. **Fewer, broader, role-filtered boards** rather than one page per segment — a unit typically has one tracking board with filters/views, not a different page for triage vs. provider vs. results.
7. **Near-real-time refresh** — often push-based internally, but functionally similar in latency to a 15–60s poll.

---

## 3. Gap analysis

### 3.1 Elapsed-time visibility — real but narrow, not a house-wide pattern

Two independent implementations exist — `ReceptionQueueList.vue:63-83`'s `waitLabel()` (shared by reception + OPD triage) and legacy `laboratory-orders/Index.vue:4220-4245`'s `minutesSince()`/`formatElapsedMinutes()` (used only for a couple of exception badges on the pre-V2 lab page) — but there's no shared composable or component (`useElapsedTime`, `<ElapsedBadge>` don't exist), and neither pattern reached `Board.vue`, `emergency/Queue.vue`, `directService/Queue.vue`, the ward bed-board, or any of this session's four V2 order-worklist builds. This is the single largest gap versus Epic/Cerner: their boards make "how long has this been true" the dominant visual signal, and this app currently shows it in exactly two places, both pre-existing, neither reused since.

### 3.2 Acuity/priority — ED has it properly, elsewhere is inconsistent or absent

`emergency/Queue.vue`'s red/yellow/green triage-level badge is a genuine Epic/Cerner-style feature (a 3-level scheme, not 5-level ESI, but the same "always-visible color badge" convention). Laboratory's V2 worklist shows a badge for urgent/stat orders (confirmed: `laboratory-orders/IndexV2.vue:549-550`, hidden for routine to reduce noise). Pharmacy, radiology, and theatre have no priority concept in their data model at all (radiology has modality instead; theatre has neither) — not a gap to fix, since the underlying field doesn't exist, but worth noting the app's priority signaling is genuinely inconsistent across domains rather than a deliberate, unified scheme.

### 3.3 Location as an organizing axis — only the ward does this

`inpatient-ward/RebuiltPage.vue`'s census card groups by ward → bed with occupied/maintenance/available color coding — the most Epic/Cerner-like layout in the app. Everywhere else organizes by patient list or order list; theatre shows room name as a per-row badge but doesn't group by it. This is appropriate for ambulatory/order-worklist contexts (there's no "room" concept for a lab order), so this isn't really a gap outside inpatient/theatre contexts specifically.

### 3.4 Inline order-status visibility on the journey board — partial

`Board.vue`'s Kanban columns *do* show which lane a patient is in (waiting_lab vs. in_lab vs. waiting_pharmacy, etc.) — genuinely useful and better than nothing. But a card shows only patient name + department, not *what* is pending (which specific test/medication), so a clinician still has to click through to see if it's a CBC or a culture. Epic/Cerner boards typically show a small icon/chip per pending order type right on the row.

### 3.5 Completed/discharged visibility — the actual finding, restated precisely

- **Reception + OPD triage's own tabs**: no completed view. (OPD's `triage/Queue.vue` does have one — it's specifically the reception-adjacent parent queue and pure ED that don't.)
- **Emergency**: present but effectively hidden (bundled into "All," no dedicated tab/count) — the highest-acuity queue in the app has the weakest completed-visibility.
- **Direct-service queues (both)**: already have it.
- **All four department worklists**: already have it (built with this convention deliberately this session, mirroring the pattern already established in direct-service).
- **Patient-flow board**: excludes it by design (explicit scope decision, documented in its own docblock) — not a gap, a deliberate choice already reasoned through.
- **Ward**: N/A — discharge naturally removes a bed from the census.

### 3.6 Fragmentation — more pages than Epic/Cerner would typically have

Counting just the ambulatory/ED/reception segment (excluding department worklists): direct-service, reception, patient-flow board, emergency, OPD triage, clinician queue, ward — seven distinct pages covering what a single Epic/Cerner unit tracking board with role-based filters would often present as one. This isn't a defect — the existing modernization plan explicitly reasoned through non-duplication at each step (Patient-Flow Board deliberately excludes reception's stages, etc.) — but it is a structural difference worth naming: there is no single "everything about this unit right now" board, and Patient-Flow Board, the closest candidate, explicitly excludes both ends of the journey by design.

### 3.7 Refresh cadence — already reasonably aligned

30-second polling across most V2 pages is a fair analog to Epic/Cerner's typical near-real-time refresh. True push (WebSockets) doesn't exist in this stack yet, but that's already an identified, deliberately deferred decision in `queue-based-workflow-modernization-plan.md` §5 — not a new finding here.

---

## 4. Recommendations (ranked by cost/isolation, none scheduled)

1. **Add a Completed tab to `reception/Queue.vue` and (if not already sufficient) promote emergency's completed/discharged view to a real tab with a count.** Cheapest fix, closes the one real inconsistency, brings both in line with this app's *own* established convention — not just Epic's. Directly answers the original question: yes, worth doing, and low-risk since `AppointmentStatus::COMPLETED` and the ED equivalent already exist as real statuses.
2. **Extract a shared elapsed-time component** (`useElapsedTime.ts` / `<ElapsedBadge>`) from the two existing implementations and apply it to `Board.vue`'s cards, `emergency/Queue.vue`'s rows, and `directService/Queue.vue` — closes the largest visual gap versus Epic/Cerner. Needs a product decision on color-escalation thresholds per queue (clinical judgment, not an engineering default) before rollout.
3. **Give `Board.vue` cards a compact inline order-summary chip** (what's pending, not just which lane) — bigger scope, needs product input on what to show without cluttering a 10-column board.
4. **Location/room-based grouping elsewhere** (e.g., theatre by room) — lowest priority; theatre already shows room as a badge, and full grouping is a larger UI change for uncertain benefit outside genuinely spatial contexts like the ward.

Per this repo's established audit convention: none of this is implemented here — flagged for a decision, not assumed.
