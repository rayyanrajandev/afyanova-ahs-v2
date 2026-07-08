# 12. State Machine

## 12.1 Does the implementation behave like a state machine?

**Partially, and asymmetrically between the two aggregates.**

- The **`Encounter`** aggregate behaves like a genuine (if informally implemented) state machine: `EncounterLifecycleService` centralizes every transition, each method explicitly checks the current status against an allow-list before mutating it, and disallowed transitions throw a dedicated `InvalidEncounterStatusTransitionException`. This is transition-table behavior, just expressed as imperative guard clauses across five methods rather than a declarative table or a dedicated state-machine library.
- The **`MedicalRecord`** aggregate is a **weaker** state machine: `UpdateMedicalRecordStatusUseCase::isTransitionAllowed()` does check current-status → target-status validity and throws `InvalidMedicalRecordStatusTransitionException` on violation, so a transition table does exist. However, the *effect* of an allowed transition is not always what was requested — the code silently substitutes a different stored value in two cases (`amended` request → stores `draft`; `finalized` request on an already-signed record → stores `amended`). This means the externally-observable state graph (what a caller can request) and the internally-persisted state graph (what actually lands in the `status` column) are not identical — a caller requesting `finalized` cannot always predict from the request alone whether the stored result will be `finalized` or `amended` without also knowing whether `signed_at` was already set.
- No dedicated state-machine library, package, or declarative transition-table data structure was found anywhere in either module (**Not found in code** for e.g. Spatie's `laravel-model-states`, a `TransitionTable` class, or similar) — all transition logic is bespoke conditional code.

## 12.2 MedicalRecord status transition diagram (as coded, in `UpdateMedicalRecordStatusUseCase`)

```
                    ┌────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
   [create] ──► DRAFT ──(request: finalized, not previously signed)──► FINALIZED
                 ▲  │                                                    │
                 │  │                                                    │ (request: finalized,
                 │  │                                                    │  signed_at already set)
                 │  │                                                    ▼
                 │  │                                                 AMENDED
                 │  │                                                    │
                 │  └──(request: amended  — STORED AS DRAFT, see 12.1)───┘
                 │
                 │  (request: archived, from draft/finalized/amended, reason required)
                 └────────────────────────────────────────────────► ARCHIVED

   Same-status request (from === to): always allowed, no-op.
   Any other from→to pair not shown above: InvalidMedicalRecordStatusTransitionException.
```

Textual transition table:

| From | Request | Allowed? | Actual stored `to` |
|---|---|---|---|
| draft | finalized | yes | `finalized` (or `amended` if `signed_at` was already non-null from a prior sign) |
| draft | archived | yes (reason required) | `archived` |
| finalized | amended | yes | `draft` (override) |
| finalized | archived | yes (reason required) | `archived` |
| finalized | finalized (re-request) | yes | `amended` (because `signed_at` is now set) |
| amended | archived | yes (reason required) | `archived` |
| any | same status | yes (no-op) | unchanged |
| archived | anything | not listed as allowed → exception | — |
| draft | anything else (e.g. directly to amended without having been finalized) | not allowed → exception | — |

## 12.3 Encounter status transition diagram (as coded, in `EncounterLifecycleService`)

```
                    markInProgress()
        OPENED ─────────────────────────► IN_PROGRESS
          │                                  │  ▲
          │ syncFromMedicalRecordStatus()     │  │ syncFromMedicalRecordStatus()
          │ (note finalized, downgrades       │  │ (note reverted to draft, unless
          │  target from SIGNED)              │  │  current is READY_FOR_SIGN, which
          │                                   │  │  is preserved instead)
          ▼                                   ▼  │
       (also reachable from SIGNED/AMENDED/IN_PROGRESS/OPENED via markReadyForSign())
                                     READY_FOR_SIGN
                                        │      ▲
             syncFromMedicalRecordStatus()     │ (also enterable from IN_PROGRESS/OPENED/
             (note finalized)                  │  SIGNED/AMENDED via markReadyForSign())
                                        ▼
                                     SIGNED ──(note amended)──► AMENDED

   From {OPENED, SIGNED, AMENDED, IN_PROGRESS, READY_FOR_SIGN}, close() ──(readiness gate)──► CLOSED
   From CLOSED, reopen() ──► IN_PROGRESS  (the only way out of CLOSED; all other methods no-op on CLOSED)

   CANCELLED exists as an enum value; no code path assigning it was found (Not found in code).
```

Textual transition table:

| From | To | Trigger |
|---|---|---|
| OPENED | IN_PROGRESS | `markInProgress()` (note content saved) |
| any non-CLOSED | SIGNED | `syncFromMedicalRecordStatus()`, note→finalized (downgraded to IN_PROGRESS if current was OPENED) |
| any non-CLOSED | AMENDED | `syncFromMedicalRecordStatus()`, note→amended |
| any non-CLOSED | IN_PROGRESS | `syncFromMedicalRecordStatus()`, note→draft (preserved as READY_FOR_SIGN instead, if that was current) |
| {IN_PROGRESS, OPENED, SIGNED, AMENDED} | READY_FOR_SIGN | `markReadyForSign()` (else exception) |
| {OPENED, SIGNED, AMENDED, IN_PROGRESS, READY_FOR_SIGN} | CLOSED | `close()`, gated by close-readiness (else exception) |
| CLOSED | IN_PROGRESS | `reopen()` (else exception for any other current status) |
| CLOSED | CLOSED (any method) | no-op, returns unchanged |

## 12.4 EncounterClinicalDocument status (not a real state machine)

Two values (`active`, `archived`); either can be set from either via `UpdateEncounterClinicalDocumentStatusUseCase` with no `InvalidTransitionException`-equivalent guard — this is a plain field update with a conditional side-effect (a reason is required/persisted only when archiving), not a transition-validated state machine.
