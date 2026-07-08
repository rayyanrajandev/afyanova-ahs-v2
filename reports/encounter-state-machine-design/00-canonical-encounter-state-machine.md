# Canonical Encounter State Machine — Design Specification (Conceptual Overlay)

**Document type**: Architecture / conceptual design specification.
**Status**: Design only. Not implemented. Not scheduled.

> **Amendment note (added after `03-implementation-readiness-audit.md`)**: the governing constraints below ("no existing code is modified," "no implementation changes are proposed") described the status of *this document* at the time it was written. They were later, explicitly and separately, superseded by direct user request: a Shadow Mode implementation of the model described here was built (`app/Support/CanonicalEncounterState/*`), and two existing production files (`app/Modules/Encounter/Presentation/Http/Controllers/EncounterController.php`, `config/logging.php`) were modified to wire it in — see `01-integration-and-migration-architecture.md`'s own amendment note, `02-validation-and-rollout-execution-plan.md`, and `03-implementation-readiness-audit.md` for what actually exists in code today. This document's *model* (the 8 states, dimensions, mapping, and conflict rules) remains unchanged and authoritative — only the "no code exists" framing is out of date.

## ⚠️ Governing constraints (apply to every section of this document)

1. **No existing code is modified by this document.** Every table, rule, and diagram below is a conceptual overlay described in prose and tables only.
2. **No refactor of current architecture is proposed.** The existing `MedicalRecord`/`Encounter` module boundaries, layering, and use cases (as documented in `../clinical-note-audit/02-architecture-overview.md`) are treated as fixed.
3. **No existing status field is removed, renamed, or replaced.** `medical_records.status`, `encounters.status`, and all order-module status/entry-state fields continue to exist and continue to mean exactly what `../clinical-note-audit/04-clinical-note-lifecycle.md` and `../clinical-note-audit/09-database-structure.md` say they mean today.
4. **This is an overlay, not a replacement.** The canonical state described here is a *derived, read-only interpretation* computed from existing fields — it does not require a new column, a new write path, or a new authority to be granted anywhere, in this document's scope. Where a future evolution is described (§5), it is explicitly marked as future and out of scope for adoption here.
5. **No implementation changes are proposed.** This document does not specify a migration plan, does not name a class to create, and does not instruct any modification to the systems audited in the companion report set (`../clinical-note-audit/`).

Every finding in this document traces back to a fact already established in the reverse-engineering audit (`../clinical-note-audit/00-INDEX.md`) or the critical integrity review (`../clinical-note-audit/15-critical-system-integrity-review.md`), cited inline as `[C-n]` or by document number.

---

## 1. Canonical Encounter State Machine

### 1.1 Design intent

Real hospital workflow (Epic-style ambulatory/ED encounter tracking) does not treat "the encounter" as a single flat status field — it treats it as a **composite clinical case status** derived from the joint state of documentation, orders, and disposition readiness. The current system, by contrast, has two *independent* status fields (`encounter.status`, `medical_record.status`) plus several *unlinked* order-module statuses, each evolving on its own — a fact already established in `../clinical-note-audit/04-clinical-note-lifecycle.md` and flagged as a source of risk in `../clinical-note-audit/15-critical-system-integrity-review.md` (C-6, C-7, C-14).

The canonical state machine below is a **computed view**: a function of the existing fields, not a new field. It exists conceptually "beside" the current system, reading what already exists, and answering one question the current system cannot answer from a single field: *"Where is this case, clinically, right now?"*

### 1.2 Canonical states

| # | State | Definition | Terminal? |
|---|---|---|---|
| 1 | **REGISTERED** | The visit/episode shell exists (patient + appointment/admission context resolved). No consultation note has been started. No orders exist. | No |
| 2 | **IN_CONSULTATION** | A consultation note is open in draft. The clinician is actively documenting. Orders may or may not yet exist. | No |
| 3 | **WORKUP_IN_PROGRESS** | At least one order (lab, radiology, pharmacy, or theatre) has been placed and is not yet resolved, **and** the consultation note is still in draft. Represents "the provider has moved from pure documentation into active diagnostic/therapeutic workup." | No |
| 4 | **AWAITING_RESULTS** | The consultation note has been signed (finalized/amended, per the "noteSigned" definition already used in `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3), **and** at least one order is still unresolved. The clinician's documentation is done; the case is now waiting on ancillary departments. | No |
| 5 | **READY_FOR_REVIEW** | All orders have reached a resolved/terminal state, but the note is still in draft (results have come back and require the ordering clinician's review and sign-off before disposition). This is the conceptual home of the current system's literal `ready_for_sign` encounter status (see §3, mapping row for `ready_for_sign`). | No |
| 6 | **READY_FOR_DISCHARGE** | Note is signed, all orders are resolved, a diagnosis is documented, and billing has no outstanding charge-capture candidates. This is the case in which every dimension the current close-readiness checklist evaluates (`../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3) is fully green — not merely "acknowledged." | No |
| 7 | **CLOSED** | The encounter has been formally closed. | **Yes** (subject to §1.4 reopening) |
| 8 | **CANCELLED** | The encounter/visit was voided before or without completion. | **Yes** |

### 1.3 Cross-cutting overlay flags (not separate states)

Real EHR workflows have conditions that modify a state without being a new stage of the linear pipeline. These are modeled as **flags that can be true alongside any of states 1–6** (and, in the amendment case, can reactivate a case out of state 7):

| Flag | Meaning | Can co-occur with |
|---|---|---|
| `AMENDMENT_IN_PROGRESS` | A previously signed note for this encounter is currently being corrected/amended. | Any state 2–7 (an amendment can be opened after discharge-readiness or even after close, per current system behavior traced in `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.1) |
| `CLOSE_ACKNOWLEDGED_WITH_WARNINGS` | The encounter was moved to `CLOSED` via the acknowledgement path (warnings present but overridden) rather than with every checklist item fully green. | `CLOSED` only |
| `MULTIPLE_NOTES_UNRESOLVED` | More than one consultation-type note exists for this encounter and at least one is not in the same signed/unsigned state as the others. | Any state 2–7 — this flag is a **conflict signal**, defined fully in §4 (CONFLICT-03) |

### 1.4 Reopening

`CLOSED` is drawn as terminal in §1.2 for the primary pipeline, but the current system supports reopening (`encounters.status: closed → in_progress`, per `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.2). In the canonical model, reopening does not introduce a new state — it transitions the case back to whichever of states 2–5 its underlying note/order dimensions currently indicate (see the derivation rule in §1.5). This mirrors the current system's own behavior: `reopen()` always targets `IN_PROGRESS`, and the canonical layer simply recomputes from there rather than assuming a fixed reentry point.

### 1.5 State derivation (how the canonical state is computed, conceptually)

The canonical state is not stored — it is **derived** at read time from three input dimensions, each itself already derivable from existing fields (see §3 for the exact mapping):

- **N (Note dimension)**: `NONE` | `DRAFT` | `SIGNED`
- **O (Orders dimension)**: `NONE` | `PENDING` | `RESULTED` | `EXCEPTION` (see §3.3 for why `EXCEPTION` is distinguished from `RESULTED` in this overlay, unlike in the current system)
- **B (Billing dimension)**: `NOT_READY` | `READY`
- **D (Diagnosis-documented dimension)**: `NO` | `YES`
- **E (raw `encounter.status`)**: used only for the terminal/exception states and as a tie-breaker

Derivation is evaluated as an **ordered rule cascade** (first matching rule wins), the same modeling technique used by the current system's own `GetEncounterCloseReadinessUseCase` checklist-building logic (`../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3) — this overlay simply extends that existing pattern one level higher, to the whole-case status, rather than inventing a new technique:

| Priority | Condition | Canonical state |
|---|---|---|
| 1 | `E = cancelled` | CANCELLED |
| 2 | `E = closed` | CLOSED |
| 3 | `N = NONE` and `O = NONE` | REGISTERED |
| 4 | `N = DRAFT` and `O ∈ {NONE, PENDING}` | IN_CONSULTATION (if O=NONE) or WORKUP_IN_PROGRESS (if O=PENDING) |
| 5 | `N = SIGNED` and `O ∈ {PENDING, EXCEPTION}` | AWAITING_RESULTS |
| 6 | `N = DRAFT` and `O = RESULTED` | READY_FOR_REVIEW |
| 7 | `N = SIGNED` and `O = RESULTED` and (`D = NO` or `B = NOT_READY`) | AWAITING_RESULTS *(disposition not yet complete — see note below)* |
| 8 | `N = SIGNED` and `O = RESULTED` and `D = YES` and `B = READY` | READY_FOR_DISCHARGE |

*Note on rule 7*: this rule intentionally keeps a case in `AWAITING_RESULTS` rather than inventing a ninth state for "signed, resulted, but diagnosis or billing incomplete" — this is a deliberate simplification for a first-pass overlay design and is flagged, not hidden: a future revision of this design (out of scope here) could split rule 7 into its own `PENDING_DISPOSITION` state if operationally useful.

### 1.6 Canonical transition diagram (text)

```
REGISTERED
   │  note_draft_created
   ▼
IN_CONSULTATION ───────────────┐
   │  lab_order_created /       │  note_signed (no orders pending)
   │  radiology_order_created / │
   │  pharmacy_order_created    ▼
   ▼                        READY_FOR_REVIEW ──┐
WORKUP_IN_PROGRESS               │              │ note_signed
   │  note_signed                │ all orders    │ (with all orders
   │  (orders still pending)     │ resolved      │  already resolved)
   ▼                              ▼              ▼
AWAITING_RESULTS ◄────────────────────────────────
   │  all orders resolved AND diagnosis documented AND billing ready
   ▼
READY_FOR_DISCHARGE
   │  encounter_closed
   ▼
CLOSED ──(encounter_reopened)──► [recompute: IN_CONSULTATION / WORKUP_IN_PROGRESS /
                                              AWAITING_RESULTS / READY_FOR_REVIEW]

Side paths (any non-terminal state):
   * ──(encounter_cancelled)──► CANCELLED
   * ──(note_amended, on a previously SIGNED note)──► same state, AMENDMENT_IN_PROGRESS flag set
```

---

## 2. Event Model

### 2.1 Design intent

Epic-style systems drive workflow status off **discrete clinical events**, not off polling a status column. This section defines a canonical event catalog. Each event is described as a **conceptual signal** that would, if this overlay were wired up (it is not, per the governing constraints), cause the derivation in §1.5 to be recomputed. Each event is mapped to the existing system action that already, today, produces the underlying data change the event represents — no new event bus, queue, or table is proposed; this is a naming/interpretation layer over actions that already occur.

### 2.2 Event catalog

#### Registration / visit domain

| Event | Conceptually raised when (existing action) | Canonical effect |
|---|---|---|
| `encounter_opened` | `EncounterResolverService::findOrCreateForVisit()` creates a new `EncounterModel` row (`../clinical-note-audit/03-workflow-reconstruction.md` §3.1) | Sets N=NONE, O=NONE → REGISTERED |
| `encounter_reused` | `findOrCreateForVisit()` finds and returns an existing encounter rather than creating one | No state change by itself; triggers a recompute in case underlying dimensions changed since last read |
| `duplicate_encounter_detected` | Two `EncounterModel` rows are found sharing the same `patient_id` + `appointment_id`/`admission_id` | Not a transition — raises CONFLICT-05 (§4) |

#### Consultation / note domain

| Event | Conceptually raised when | Canonical effect |
|---|---|---|
| `note_draft_created` | `CreateMedicalRecordUseCase` inserts a `medical_records` row with `status=draft` (`../clinical-note-audit/03-workflow-reconstruction.md` §3.2) | N: NONE → DRAFT |
| `note_content_saved` | `UpdateMedicalRecordUseCase` updates a draft note's content (autosave or manual save, `../clinical-note-audit/05-saving-mechanism.md` §5.5) | No dimension change (N stays DRAFT); recompute is a no-op unless O also changed |
| `note_signed` | `UpdateMedicalRecordStatusUseCase` stores `status=finalized` (and the note was not previously signed) (`../clinical-note-audit/04-clinical-note-lifecycle.md` §4.1) | N: DRAFT → SIGNED |
| `note_amended` | `UpdateMedicalRecordStatusUseCase` processes a status-update request of `amended` (today, stored as `draft` per the finding in `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.1 and `15-critical-system-integrity-review.md` C-3) | Sets `AMENDMENT_IN_PROGRESS` flag; N reverts to DRAFT per current system behavior — **this is the single most important nuance in this entire event model and is elaborated in §3.2** |
| `note_re-finalized_after_sign` | `UpdateMedicalRecordStatusUseCase` processes a `finalized` request where `signed_at` was already set, and the override to `amended` fires (`../clinical-note-audit/04-clinical-note-lifecycle.md` §4.1) | N: stays SIGNED; `AMENDMENT_IN_PROGRESS` cleared |
| `note_archived` | `status=archived` stored | Note excluded from N-dimension resolution going forward (archived notes are not considered when computing N for this encounter, mirroring how `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3 already excludes non-finalized/amended records from "primary record" resolution) |
| `signer_attestation_recorded` | `CreateMedicalRecordSignerAttestationUseCase` writes an attestation row | No dimension change — this event exists in the current system independently of the N dimension (per `../clinical-note-audit/03-workflow-reconstruction.md` §3.9, attestation does not itself change `status`) |

#### Orders domain (lab / radiology / pharmacy / theatre)

| Event | Conceptually raised when | Canonical effect |
|---|---|---|
| `lab_order_created` / `radiology_order_created` / `pharmacy_order_created` / `theatre_procedure_scheduled` | A new order row is created with the encounter's `encounter_id` and a non-terminal status (order-module internals not in this system's audited MedicalRecord/Encounter scope, but their read path is confirmed in `../clinical-note-audit/11-integration-points.md`) | O: NONE → PENDING (if this is the first open order) |
| `lab_result_received` / `radiology_result_received` / `medication_dispensed` / `theatre_procedure_completed` | The corresponding order's status moves to its module's terminal-status set (`../clinical-note-audit/11-integration-points.md` §11.2–§11.4, §11.8) | O: recomputed — PENDING → RESULTED only once **all** open orders for the encounter reach a terminal state |
| `medication_reconciliation_exception_raised` | A pharmacy order enters `reconciliation_exception` | O: recomputed to `EXCEPTION` (not `RESULTED` — see §3.3 for why this overlay treats this differently than the current system's own close-readiness count does, per finding C-11) |
| `medication_reconciliation_exception_resolved` | The exception is cleared | O: recomputed from remaining open orders |
| `order_cancelled` (lab/radiology/pharmacy/theatre) | Any order status moves to its module's `cancelled` value | Removes that order from the pending set; O recomputed from remaining open orders |

#### Billing domain

| Event | Conceptually raised when | Canonical effect |
|---|---|---|
| `charge_capture_candidate_identified` | `ListBillingChargeCaptureCandidatesUseCase` reports a pending candidate for this encounter (`../clinical-note-audit/11-integration-points.md` §11.5) | B: READY → NOT_READY |
| `billing_marked_ready` | The candidate count for the encounter reaches zero | B: NOT_READY → READY |

#### Disposition / closure domain

| Event | Conceptually raised when | Canonical effect |
|---|---|---|
| `close_readiness_evaluated` | `GetEncounterCloseReadinessUseCase::execute()` runs | No state change — this event only *reads* current dimensions; included here because it is the existing system's closest analogue to a canonical-state recompute trigger |
| `close_acknowledged_with_warnings` | `EncounterLifecycleService::close()` proceeds via the `acknowledgeCloseGaps=true` path (`../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3) | Sets `CLOSE_ACKNOWLEDGED_WITH_WARNINGS` flag; E → closed |
| `encounter_closed` | `EncounterLifecycleService::close()` succeeds | State → CLOSED |
| `encounter_reopened` | `EncounterLifecycleService::reopen()` | State recomputed per §1.4 |
| `encounter_cancelled` | (no confirmed trigger exists in the audited code — `../clinical-note-audit/15-critical-system-integrity-review.md` C-15) | State → CANCELLED, **conceptually**; flagged as an event with no confirmed real-world producer today |

---

## 3. Mapping Layer (CURRENT → CANONICAL)

This section is the literal, field-by-field translation of existing values into the dimensions used by §1.5. **No existing field is touched — this is a read-only lookup table.**

### 3.1 `encounter.status` → contributes to dimension E (and indirectly gates N/O relevance)

| Current value | Meaning today (`../clinical-note-audit/04-clinical-note-lifecycle.md` §4.2) | Canonical contribution |
|---|---|---|
| `opened` | Encounter shell created, nothing else has happened yet | E permits REGISTERED (if N=NONE, O=NONE) or IN_CONSULTATION/WORKUP_IN_PROGRESS (if N/O indicate activity — the raw `opened` value under-reports actual progress once a note/order exists, since `markInProgress` may not have fired yet; this is itself a mapping caveat, not a new finding — it is consistent with `../clinical-note-audit/15-critical-system-integrity-review.md` C-14) |
| `in_progress` | Active documentation/workup | E permits IN_CONSULTATION / WORKUP_IN_PROGRESS / AWAITING_RESULTS depending on N/O |
| `ready_for_sign` | "Results ready — review and sign" (frontend label, per `../clinical-note-audit/06-frontend-behaviour.md` §6.4) | Maps directly to canonical **READY_FOR_REVIEW** when N=DRAFT; if N has since become SIGNED without the raw field catching up, canonical layer would show READY_FOR_DISCHARGE-track states instead — the canonical layer resolves this by deriving from N/O directly rather than trusting the raw `ready_for_sign` label alone |
| `signed` | Note-driven sync marked this encounter signed | E permits AWAITING_RESULTS or READY_FOR_DISCHARGE depending on O/D/B |
| `amended` | Note-driven sync marked this encounter amended | E permits AWAITING_RESULTS or READY_FOR_DISCHARGE (same as `signed`, since canonical N=SIGNED covers both `finalized` and `amended` note statuses identically); `AMENDMENT_IN_PROGRESS` flag set |
| `closed` | Terminal | Canonical CLOSED |
| `cancelled` | Enumerated but no confirmed assignment path exists (`../clinical-note-audit/15-critical-system-integrity-review.md` C-15) | Canonical CANCELLED, if ever observed |

### 3.2 `medical_record.status` → dimension N — **the single most important, most nuanced row in this whole mapping layer**

| Current stored value | What it actually represents today (per `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.1) | Canonical N |
|---|---|---|
| `draft` | Either (a) a genuinely new, never-signed note, or (b) a previously-signed note that has just been through an `amended`-status **request**, which the current system stores back as `draft` | `DRAFT` — **the canonical model cannot distinguish case (a) from case (b) using the status field alone**; distinguishing them requires also reading `signed_at`/`signed_by_user_id` (non-null in case (b), null in case (a)). This is called out explicitly because it is exactly the ambiguity behind `../clinical-note-audit/15-critical-system-integrity-review.md` C-3. |
| `finalized` | Signed, content locked | `SIGNED` |
| `amended` | Reached only via the finalize-after-already-signed override (re-finalizing a previously signed note) — **not** reached via a direct "amend" request | `SIGNED` (canonical model treats `finalized` and `amended` identically for the N dimension, matching the current system's own `noteSigned` definition in `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3) |
| `archived` | Retired from active consideration | Excluded from N resolution for this encounter (see §2.2, `note_archived` event) |

**Multiple notes per encounter**: because an encounter can have more than one `medical_records` row (e.g., a second consultation note, per `../clinical-note-audit/15-critical-system-integrity-review.md` C-2), the mapping above is defined **per note row**, and the encounter-level N dimension used in §1.5 is a rule, not a raw lookup: *N = SIGNED only if every non-archived consultation-type note for the encounter is `finalized` or `amended`; otherwise N = DRAFT if any is `draft`, else N = NONE.* This is a deliberate, stricter definition than the current system's own `resolvePrimaryMedicalRecord()` (which accepts *any one* finalized note as sufficient, per C-2) — the discrepancy between "current behavior" and "this overlay's stricter definition" is itself surfaced as CONFLICT-03 in §4, not silently resolved.

### 3.3 Lab / Radiology / Pharmacy / Theatre order states → dimension O

| Current concept | Source | Canonical O contribution |
|---|---|---|
| `entry_state = ACTIVE` and `status` not in the module's terminal-status list (`../clinical-note-audit/11-integration-points.md` §11.2–§11.4, §11.8) | Laboratory/Radiology/Pharmacy/Theatre order rows | `PENDING` |
| `status` in the module's terminal-status list (e.g., lab/radiology `completed`/`cancelled`; pharmacy `dispensed`/`cancelled`/`reconciliation_completed`) | same | `RESULTED` |
| `status = reconciliation_exception` (pharmacy only) | same | **`EXCEPTION`** — deliberately *not* folded into `RESULTED`, unlike the current system's own close-readiness computation, which does treat it as terminal/non-pending (`../clinical-note-audit/15-critical-system-integrity-review.md` C-11). This overlay's O dimension is defined to keep `EXCEPTION` distinct precisely so that AWAITING_RESULTS (§1.5, rule 5) does not silently resolve to a "done" state while a reconciliation exception is open. |
| `entered_in_error_at` non-null | any order type | Excluded entirely from the O computation (matches current system exclusion logic) |

Encounter-level O is: `NONE` if no non-excluded orders exist; `EXCEPTION` if any order is in exception state; else `PENDING` if any remaining order is pending; else `RESULTED`.

### 3.4 Billing charge-capture candidates → dimension B

| Current concept | Source | Canonical B |
|---|---|---|
| `ListBillingChargeCaptureCandidatesUseCase` reports `meta.pending > 0` | Billing module, called from `GetEncounterCloseReadinessUseCase` (`../clinical-note-audit/11-integration-points.md` §11.5) | `NOT_READY` |
| `meta.pending === 0` | same | `READY` |

### 3.5 Diagnosis documentation → dimension D

| Current concept | Source | Canonical D |
|---|---|---|
| Resolved primary note's `diagnosis_code` or `assessment` field non-empty | `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3 (`diagnosis_documented` checklist item) | `YES` |
| Both empty | same | `NO` |

---

## 4. Conflict Detection Rules

Each rule below is a **read-only comparison** across existing fields (no new field, no write). Each is traced to a finding already documented in the critical integrity review.

| Code | Rule (evaluated over existing data) | Why it is a conflict | Source finding | Severity |
|---|---|---|---|---|
| **CONFLICT-01** | `encounter.status = closed` AND at least one non-excluded lab/radiology/pharmacy/theatre order for that `encounter_id` has O-dimension `PENDING` | An encounter cannot be clinically "done" while ordered workup is still outstanding | C-5 | Critical |
| **CONFLICT-02** | A `medical_records` row reaches `status = finalized`/`amended` but the linked `encounters` row's `status` has not been updated to a state consistent with N=SIGNED within an expected window, with no corresponding `encounter_audit_logs` entry evidencing the sync ran | The two aggregates that should move together have visibly diverged | C-7 | High |
| **CONFLICT-03** | More than one non-archived `medical_records` row of a consultation-type note exists for the same `encounter_id`, and they are not all in the same signed/unsigned state | The encounter can appear "note signed" (per the current system's own single-record check) while a second note for the same encounter is still open | C-2 | Critical |
| **CONFLICT-04** | A `medical_records` row has `status = draft` AND `signed_at` is non-null | A note that is actively editable/unlocked is simultaneously carrying a "this was signed" timestamp | C-3 | Critical |
| **CONFLICT-05** | Two or more `encounters` rows share the same `patient_id` and the same non-null `appointment_id` (or the same non-null `admission_id`) | The same physical visit has been split into two case records; orders/notes attached to one are invisible from the other | C-4 | High |
| **CONFLICT-06** | `encounter.status = closed` AND dimension B = `NOT_READY` | Revenue/documentation for services rendered during the visit was never reconciled before the case was closed | C-5 | High |
| **CONFLICT-07** | The "primary note" resolved by one code path (workspace display logic) differs from the "primary note" resolved by another code path (close-readiness logic) for the same `encounter_id` | Two parts of the system disagree, at the same instant, about which note represents this encounter | C-6 | High |
| **CONFLICT-08** | A pharmacy order for the encounter is in `reconciliation_exception` AND the encounter's close-readiness (as currently computed) reports `pending_orders` as passing | An unresolved medication-safety flag has stopped generating any signal | C-11 | Medium-High |
| **CONFLICT-09** | `encounter.status` moves to a "more advanced" value (e.g., `in_progress → signed`) with no corresponding explicit user-initiated status-change audit entry — i.e., the change is attributable only to the note-status-sync side channel | The case's stage advanced without going through the same validated transition guard applied to explicit user actions | C-14 | Medium |
| **CONFLICT-10** | An `encounters` row has `status = cancelled` | This value has no confirmed, audited assignment path in the current system; its presence would indicate an unaudited write | C-15 | Low-Medium |

---

## 5. "Truth Source" Strategy

### 5.1 What is system-of-record today (confirmed by audit — no change proposed)

| Data domain | System-of-record today |
|---|---|
| Note content (SOAP text, diagnosis code) | `medical_records` table, owned exclusively by the `MedicalRecord` module (`../clinical-note-audit/09-database-structure.md` §9.1) |
| Note lifecycle status | `medical_records.status`, governed by `MedicalRecord\Application\UseCases\UpdateMedicalRecordStatusUseCase` |
| Encounter/visit lifecycle status | `encounters.status`, governed by `Encounter\Application\Services\EncounterLifecycleService` |
| Lab / radiology / pharmacy / theatre order status | Each order module's own table and status field, read (not owned) by the Encounter module via direct Eloquent queries (`../clinical-note-audit/11-integration-points.md`) |
| Billing readiness | `Billing\Application\UseCases\ListBillingChargeCaptureCandidatesUseCase`, called (not owned) by the Encounter module |
| "Is this whole case done" | **No system-of-record exists today.** This question currently has no single authoritative answer — it is independently, and inconsistently, re-derived by `GetEncounterWorkspaceUseCase` and `GetEncounterCloseReadinessUseCase` (per CONFLICT-07 / C-6), and by whatever the frontend separately infers from `encounter.status` labels. |

### 5.2 What could become system-of-record later (aspirational — explicitly not adopted by this document)

This subsection is a statement of design direction only. It does not propose a timeline, a migration, or an implementation step.

- The **canonical derivation in §1.5** could, in a future phase, become the single authoritative answer to "is this whole case done," consumed by every part of the system that currently re-derives that answer independently (workspace display, close-readiness, any future reporting/dashboard).
- Each underlying domain (note content, order status, billing) would **continue to be system-of-record for its own narrow fact** exactly as today — the canonical layer's role would be aggregation and interpretation, not ownership. Nothing above proposes taking authority away from `MedicalRecord`, `Encounter`, or any order module over their own data.
- The two currently-divergent primary-note-resolution implementations (`GetEncounterWorkspaceUseCase` vs. `GetEncounterCloseReadinessUseCase`, per CONFLICT-07) would, under this future direction, both defer to a single canonical resolution — but this document does not specify how, only that doing so is the direction this design points toward.

### 5.3 Boundary statement

Between "today" (§5.1) and "later" (§5.2) there is no committed intermediate state described here. This document stops at describing the target concept; it does not authorize or schedule movement toward it.

---

## 6. Safety Rules (conceptual invariants)

Each rule is stated as a **policy assertion** the canonical overlay is designed to make observable. None of these rules describe new enforcement code — they describe what the overlay, if consulted, would flag as violated. Enforcement mechanism, if any, is future work outside this document's scope.

### 6.1 No premature encounter closure

**Invariant**: An encounter should not be considered canonically ready for `READY_FOR_DISCHARGE`/`CLOSED` while dimension O is `PENDING` or `EXCEPTION`, dimension D is `NO`, or dimension B is `NOT_READY`.
**Relates to**: CONFLICT-01, CONFLICT-06, CONFLICT-08.
**Observation, not enforcement**: the current system already allows closure past three of these four conditions via the acknowledgement path (`../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3); this canonical rule states the stricter ideal against which that existing acknowledgement path can be measured, without asserting the existing path must change.

### 6.2 No silent missing results

**Invariant**: Every order contributing to dimension O must be accounted for in the canonical O computation for its encounter — none may be excluded from consideration by a display-only limit (such as the current system's 6-row workspace cap, `../clinical-note-audit/15-critical-system-integrity-review.md` C-8) or by a status miscategorization (such as `reconciliation_exception` being folded into "terminal," C-11).
**Relates to**: CONFLICT-08; the O-dimension definition in §3.3 (which deliberately keeps `EXCEPTION` distinct) is this rule's direct expression.

### 6.3 No duplicate encounters

**Invariant**: At most one `encounters` row should exist per (`patient_id`, `appointment_id`) or (`patient_id`, `admission_id`) pair for a given visit.
**Relates to**: CONFLICT-05. This canonical rule states the ideal; the current system's actual creation path (`EncounterResolverService::findOrCreateForVisit`, per `../clinical-note-audit/15-critical-system-integrity-review.md` C-4) has a known check-then-create race that can violate it.

### 6.4 No conflicting states across modules

**Invariant**: The N, O, B, D dimensions computed for a given `encounter_id` must agree regardless of which use case or module performs the computation. Two independent resolutions of "the primary note" for the same encounter must return the same note.
**Relates to**: CONFLICT-02, CONFLICT-07, CONFLICT-09. This is the invariant most directly violated today by the divergent `resolvePrimaryMedicalRecord()` implementations documented in `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3.

### 6.5 Signature integrity

**Invariant**: A note's `signed_at`/`signed_by_user_id` fields should be trustworthy only when the note's current status is `finalized` or `amended`; a `draft`-status note displaying a non-null `signed_at` is a contradiction, not a valid intermediate state.
**Relates to**: CONFLICT-04, directly corresponding to `../clinical-note-audit/15-critical-system-integrity-review.md` C-3.

---

## 7. Summary

This document defines a read-only, additive conceptual overlay — an 8-state canonical encounter model (§1), a catalog of clinical events that would drive it (§2), an explicit field-by-field mapping from every existing status source into that model (§3), ten named cross-module conflict rules derived from the prior integrity review (§4), a truth-source boundary statement separating today's reality from a possible future direction without committing to it (§5), and five safety invariants stated as policy, not code (§6).

No file in `app/Modules/**`, `database/migrations/**`, or `resources/js/**` is referenced as a target for modification anywhere in this document.
