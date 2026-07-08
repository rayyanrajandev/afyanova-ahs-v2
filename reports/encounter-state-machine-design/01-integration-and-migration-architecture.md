# Safe Integration & Migration Architecture — Canonical Encounter State Machine

**Document type**: Architecture / integration & rollout specification.
**Status**: Design only. Not implemented. Not scheduled.

> **Amendment note (added after `03-implementation-readiness-audit.md`)**: "Status: Design only. Not implemented." and "No code is specified; no refactor is instructed" (below) described this document at the time it was written. A subsequent, explicit user request authorized building exactly the Shadow Mode implementation this document scoped for Phases 1–2 — see `02-validation-and-rollout-execution-plan.md` and `03-implementation-readiness-audit.md` for what was actually built, verified, and tested. Two existing production files were modified as part of that work (the one integration hook this document's §1 and §3 anticipated). The architecture, placement, and phasing decisions described below remain the accurate account of *why* it was built the way it was — only the "not implemented" status line is stale.
**Prerequisite**: `00-canonical-encounter-state-machine.md` (the canonical model, its 8 states, event catalog, mapping layer, conflict rules, truth-source strategy, and safety invariants). **That document is treated as final and unchanged here** — no state, event, or mapping rule defined there is altered, renamed, or reinterpreted below.

## Governing constraints (carried forward, still binding)

The current system — `Encounter`, `MedicalRecord`, `Laboratory`, `Radiology`, `Pharmacy`, `Billing`, and every write path, transaction boundary, and status field documented in `../clinical-note-audit/` — is treated here as a **live, production, legacy system**. This document proposes no change to any of it. Everything below describes how a new, additive, read-only layer could be introduced *around* that system without altering it. No code is specified; no refactor is instructed.

---

## 1. Placement Architecture

### 1.1 Where the canonical layer does *not* belong, and why

| Candidate location | Verdict | Reasoning |
|---|---|---|
| Inside `Encounter`'s or `MedicalRecord`'s **Domain layer** | Rejected | The audited architecture (`../clinical-note-audit/02-architecture-overview.md` §2.1) uses Domain layers to express single-aggregate invariants (`MedicalRecordStatus`, `EncounterStatus` value objects, repository interfaces scoped to one aggregate). The canonical state is a composite fact spanning six modules — it is not one aggregate's invariant, and forcing it into one module's Domain layer would make that module's Domain layer aware of aggregates it does not own, which the existing architecture deliberately avoids everywhere else. |
| **Middleware** | Rejected | Middleware operates on the request/response lifecycle for concerns like auth and tenant scoping (`../clinical-note-audit/07-backend-behaviour.md` §7.1) — it runs on *every* matching request regardless of whether that request has anything to do with encounter status. Computing a six-module derived projection in middleware would (a) impose cost on unrelated requests, (b) couple an orthogonal cross-cutting concern (request plumbing) to a business-read concern (clinical case status), and (c) make the computation implicit and hard to reason about, contrary to the "read-only, explicitly-invoked" nature specified in the canonical model document. |
| **A new column on `encounters` or `medical_records`** | Rejected | This would make the canonical layer a *write* participant in tables owned by other modules — directly contradicting the "read-only derived layer" premise of the prerequisite document and the "Do Not Break These" rules in §8 below. |
| **A cross-module Application-layer read/query service, external to every existing module** | **Accepted** | This is the correct tier: an Application-layer concept (it orchestrates reads across use cases and repositories, the same tier where the existing modules already do their own orchestration), but it is *cross-cutting* rather than belonging to any one module, analogous to a CQRS "read model" or "query service" sitting beside, not inside, the write-owning modules. |

### 1.2 Structural placement

The canonical layer is conceived as a **new, additive, read-only bounded context** — call it, purely for reference in this document, the **Canonical State Query Layer** — positioned architecturally *beside* the six contributing modules, at the same tier as their own Application layers, but with a strict one-directional dependency arrow: it depends on them; none of them depend on it.

```
        ┌─────────────────────────────────────────────────────────┐
        │            Canonical State Query Layer (NEW)             │
        │   - Reads only. Owns nothing. Writes nothing.            │
        │   - Implements the derivation table from                 │
        │     00-canonical-encounter-state-machine.md §1.5          │
        │   - Implements the mapping layer from §3                  │
        │   - Implements conflict detection from §4                 │
        └───────────────────┬───────────────────────────────────────┘
                            │ read-only calls, via existing public
                            │ interfaces only — no new coupling to
                            │ any module's internals
        ┌────────────┬──────┴──────┬─────────────┬─────────────┐
        ▼            ▼             ▼             ▼             ▼
  Encounter    MedicalRecord   Laboratory /   Billing      (Platform,
  module       module          Radiology /    module       for diagnosis
  (unchanged)  (unchanged)     Pharmacy /      (unchanged)  catalog —
                               Theatre                       unchanged)
                               (unchanged)
```

### 1.3 Integration points, module by module

- **Encounter module**: the Canonical layer's *primary* integration point. Rather than re-deriving the Orders (O) and Billing (B) dimensions from scratch — which would mean adding four *new* direct cross-module dependencies of its own — the Canonical layer consumes the outputs already assembled by `GetEncounterWorkspaceUseCase` and `GetEncounterCloseReadinessUseCase` (`../clinical-note-audit/03-workflow-reconstruction.md` §3.4; `../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3). These two use cases already do the cross-module aggregation work today, in production, for a different purpose. Piggy-backing on their existing, already-audited output is deliberately chosen over independently re-implementing the same aggregation a second time, because a second independent implementation would itself become a new source of the exact "divergent resolution" problem named as CONFLICT-07.
- **MedicalRecord module**: consumed via the existing `MedicalRecordRepositoryInterface::search()`/`findById()` read methods (`../clinical-note-audit/09-database-structure.md` §9.9) — used for one purpose neither existing use case currently performs: enumerating *every* non-archived consultation-type note for an encounter, needed to evaluate the multi-note rule in the mapping layer (`00-canonical-encounter-state-machine.md` §3.2) and CONFLICT-03. This is a new *query*, not a new *interface* — it uses a repository method that already exists and is already read-only.
- **Laboratory / Radiology / Pharmacy / Theatre modules**: **no new direct dependency is introduced.** These are consumed exclusively indirectly, through the Encounter module's existing aggregation (previous bullet). This is a deliberate constraint of this design: the current architecture already has one instance of Encounter directly importing these modules' Eloquent models (`../clinical-note-audit/02-architecture-overview.md` §2.5) — an existing, audited shortcut. This design does not add a second, parallel instance of that same shortcut from a different caller; it reuses the one that already exists.
- **Billing module**: likewise consumed only indirectly, via `GetEncounterCloseReadinessUseCase`'s already-computed `billingSummary` — no new direct dependency on `ListBillingChargeCaptureCandidatesUseCase` is introduced.

### 1.4 Exposure surface

The Canonical State Query Layer's output is exposed as a **new, additive query surface** — conceptually, a new read-only capability that existing consumers *may* call, not a modification of any existing endpoint's contract. In Modes A and B (§3) this surface is not called by anything user-facing at all. In Mode C, exactly one thing changes: an existing response payload gains one additional, clearly-namespaced field (e.g., a `canonicalState` block) — additive only, never replacing or removing an existing field, per the "Do Not Break These" rules (§8).

---

## 2. Computation Strategy

### 2.1 Strategy selection by phase

| Strategy | When appropriate | Why |
|---|---|---|
| **On-demand (query-time) computation** | Phases 1–3 (default, primary strategy for this entire design) | Requires no new infrastructure — no cache, no invalidation logic, no background workers, no message bus. Matches the idiom the current system already uses for comparable work: `GetEncounterCloseReadinessUseCase` itself is already a synchronous, query-time aggregation across four order modules and Billing (`../clinical-note-audit/04-clinical-note-lifecycle.md` §4.3). The Canonical layer is architecturally the same *shape* of thing, one level higher. |
| **Cached projection** | Only considered as a *future* refinement, and only for aggregate/list contexts (e.g., a status-counts or list view across many encounters) where recomputing per-row on every read would be materially expensive — never for the single-encounter workspace view, where currency matters most and the encounter count per computation is exactly one (cheap regardless). | Deferred; not needed for the phases this document authorizes. See §7 (Stale Projections) for the caution that applies if this is ever adopted. |
| **Event-driven projection** | Not adopted by this design at all. Requires domain events / a message bus, which do not exist in the audited codebase today (see §5). | Explicitly out of scope; see §5 for the full reasoning. |

### 2.2 Performance considerations

- The dominant cost of on-demand computation is the same cost the existing `GetEncounterCloseReadinessUseCase` already pays — this design adds at most one further read (the multi-note enumeration in §1.3) on top of work already being done. Where the Canonical layer is invoked at a moment when `GetEncounterWorkspaceUseCase`/`GetEncounterCloseReadinessUseCase` have *already run in the same request* (e.g., a workspace page load), the Canonical layer should consume their already-produced output rather than re-invoking them a second time in the same request — avoiding duplicate cross-module querying within a single page load.
- In Shadow Mode (§3), computation should not be allowed to add user-perceptible latency to the legacy request it rides alongside. Two acceptable postures are named, without mandating either (an implementation decision deferred beyond this document): (a) compute after the legacy response has already been sent, or (b) compute only for a sampled subset of requests during the observation window. Either posture keeps the guarantee in §2.4 (failure/latency isolation) trivially true.
- No computation is proposed to run on a schedule/cron or continuously in the background in Phases 1–3 — it is triggered only by the same real events that already cause the legacy aggregation use cases to run (a workspace load, a close attempt).

### 2.3 Consistency guarantees

- The Canonical layer's reads across Encounter / MedicalRecord / Orders / Billing are **not** wrapped in a shared transaction or snapshot — consistent with the fact that no existing use case in the audited system wraps its own cross-module reads that way either (`../clinical-note-audit/07-backend-behaviour.md` §7.5). This means the Canonical layer is subject to ordinary **read skew**: if a lab result is recorded by a concurrent request in the middle of the Canonical layer's computation, different dimensions of the same computed result could reflect slightly different instants in time.
- This is stated explicitly as an **inherited**, not introduced, characteristic: the Canonical layer does not make the underlying system any less consistent than it already is — it observes the same absence of cross-module transactional consistency that `GetEncounterCloseReadinessUseCase` already has today.
- The Canonical layer's output is therefore defined as **"accurate as of the moment each underlying read completed,"** never as a transactionally-consistent snapshot, and never labeled or displayed (in Mode C) without an accompanying "as of" timestamp.

### 2.4 Failure handling

- **Fail-closed, never fail-open.** If any one contributing read fails or times out (e.g., the Billing call), the affected dimension is reported as `UNKNOWN`, and any canonical-state derivation that depends on an `UNKNOWN` dimension resolves to an explicit `INDETERMINATE` result — never to a default that looks "safe" or "complete" (e.g., it must never silently resolve to `READY_FOR_DISCHARGE` just because the Billing dimension couldn't be read). This mirrors the "no premature closure" safety invariant from the prerequisite document (§6.1 there) applied to the Canonical layer's own failure modes.
- **Total isolation from the legacy request path.** A failure, exception, or timeout anywhere inside the Canonical layer's computation must never propagate to, delay, or alter the outcome of the legacy request it is riding alongside — in Shadow Mode this means a Canonical-layer error must be caught and logged as a Canonical-layer diagnostic event, with the underlying legacy request completing exactly as it would have if the Canonical layer did not exist. This guarantee is the load-bearing property that makes Shadow Mode safe to run against live production traffic at all.

---

## 3. Integration Modes

### MODE A — Legacy Only

The Canonical layer is not invoked anywhere. The system behaves exactly as documented across `../clinical-note-audit/00-INDEX.md` through `15-critical-system-integrity-review.md`, with zero deviation. This is the mode the system is in today, and the mode it remains in for the entirety of Phase 0.

### MODE B — Shadow Mode

The Canonical layer is invoked automatically, riding alongside the same real triggers that already cause the legacy aggregation to run (a workspace load, a close-readiness evaluation, a status change), computing the canonical state and every dimension behind it, and **only logging the result** (see §4 for exactly what is logged). Nothing computed in this mode is returned in any API response, rendered in any UI, or consulted by any decision the legacy system makes. A user of the system in Shadow Mode experiences literally no difference from Mode A — same screens, same fields, same behavior, same latency (per the isolation guarantee in §2.4). Shadow Mode's sole purpose is to accumulate real-world evidence of how often, and in what way, the canonical derivation agrees or disagrees with the legacy system's own status fields, without any risk to production behavior.

### MODE C — Advisory Mode

The canonical state becomes visible — as a clearly and consistently labeled, additive, non-blocking indicator — somewhere in the existing UI (e.g., alongside the existing encounter/note status displays already documented in `../clinical-note-audit/06-frontend-behaviour.md` §6.9's status-mapping discussion). Critically:

- It does **not** gate, enable, disable, or validate any existing action. The "Finalize," "Close encounter," "Save," and every other button continues to be governed exclusively by the existing legacy status fields and permission checks, exactly as documented in `../clinical-note-audit/08-api-inventory.md`.
- It does **not** replace any existing status label — it is shown *in addition to* the existing `encounter.status`/`medical_record.status` labels, never instead of them.
- It carries explicit, consistent visual/textual framing distinguishing it as a *derived, advisory* signal (e.g., a distinct visual treatment and a label along the lines of "computed case status" as opposed to "official status") — this is a patient-safety-motivated requirement, not a cosmetic one: a clinician must never be able to mistake the advisory signal for an authoritative one.
- Divergences (§4) become user-visible in this mode as a non-blocking notice, not as an error state and not as anything that interrupts workflow.

A fourth mode — enforcement, where canonical state actually gates behavior — is intentionally **not** defined as "Mode D" with the same weight as A/B/C. It is addressed only as an optional, explicitly-deferred future phase in §6 (Phase 4), because enforcement is the one posture that would require touching legacy write/guard logic, which this document's constraints forbid designing now.

---

## 4. Divergence Handling Strategy

"Divergence" means: the canonical state (or one of its underlying dimensions) disagrees with what the legacy system's own fields would suggest, or two independent legacy resolution paths disagree with each other (CONFLICT-07 from the prerequisite document).

### 4.1 What is logged

Every divergence detected in Shadow Mode or later is logged with: the `encounter_id`, the computed canonical state and all four dimension values (N/O/B/D), the corresponding legacy field values consulted (`encounter.status`, every relevant `medical_record.status` + `signed_at`, the raw order-module statuses read), which named conflict rule from `00-canonical-encounter-state-machine.md` §4 matched (if any), and a timestamp. This is logged to a **new, separate diagnostic/observability channel** — deliberately *not* written into `medical_record_audit_logs` or `encounter_audit_logs`, because those are clinical audit trails documented as serving a specific compliance purpose (`../clinical-note-audit/09-database-structure.md` §9.3, §9.7) and mixing system-diagnostic noise into them would degrade their existing purpose — itself a "Do Not Break These" concern (§8).

### 4.2 What is displayed

In Mode C only: a non-blocking, advisory-framed notice that the computed case status and the recorded system status differ, without asserting which one is "correct." The notice does not name internal conflict-rule codes to end users; it surfaces in plain clinical language (e.g., "this visit shows outstanding orders that may not be reflected in its current status") only for the conflict categories judged clinically meaningful to surface at all (a judgment call explicitly deferred to a future design pass — not resolved by this document).

### 4.3 What is ignored

Momentary, self-correcting divergence caused by ordinary read skew (§2.3) — for example, a lab result landing in the instant between two of the Canonical layer's reads — is not logged as a divergence "incident" on a single observation. A divergence is only escalated (logged as notable, and eligible for alerting per §4.4) if it is confirmed by **at least two independent computations separated by a short interval**, filtering out transient timing artifacts that are an expected, inherited property of the underlying system's non-transactional cross-module writes (§2.3), not a new defect.

### 4.4 What triggers alerts

Persistent (post-debounce) divergences matching a **Critical or High** severity conflict rule from `00-canonical-encounter-state-machine.md` §4 — i.e., CONFLICT-01 (closed with pending orders), CONFLICT-02 (note finalized, encounter not synced), CONFLICT-03 (multiple unresolved notes), CONFLICT-04 (stale signature on a draft note), CONFLICT-05 (duplicate encounters), CONFLICT-06 (closed with unbilled services), CONFLICT-07 (divergent primary-note resolution) — are routed to an **engineering/operations alert channel, never directly to clinical end users**, because a persistent divergence at this severity indicates the *legacy system itself* is very likely already in one of the inconsistent states named in the prior critical review (`../clinical-note-audit/15-critical-system-integrity-review.md`), independent of whether the Canonical layer exists at all. Medium/Low severity persistent divergences (CONFLICT-08, 09, 10) are aggregated into periodic (not real-time) reporting, to avoid alert fatigue.

---

## 5. Event Sourcing vs. Derived Model Decision

### 5.1 What this model is

The canonical layer, as specified in the prerequisite document and integrated here, is a **derived read model / computed projection**. It inspects the *current* values of existing mutable-state fields at query time (or, if a future cached-projection refinement is adopted, recomputes and stores a materialized snapshot on trigger). It does **not** reconstruct state by replaying a sequence of historical events, and it does not treat any event log as authoritative.

### 5.2 This is explicitly not event sourcing

No component of the audited system today functions as an authoritative, replayable event store. `medical_record_audit_logs` and `encounter_audit_logs` are append-only *records of actions taken*, but they are written as terminal audit facts, not dispatched as first-class domain events consumed by other parts of the system to reconstruct state (`../clinical-note-audit/09-database-structure.md` §9.3, §9.7). The canonical layer designed here does not read those audit-log tables to reconstruct state, and does not require them to be complete or replayable in order to function — it reads current field values directly.

### 5.3 Should it evolve into one?

**Arguments in favor of eventual evolution toward real domain events (not full event sourcing, but a step toward it):**

- The event catalog already defined in `00-canonical-encounter-state-machine.md` §2 (`note_signed`, `lab_result_received`, `encounter_closed`, etc.) is already expressed in domain-event vocabulary. If the organization later chooses to introduce a real domain-event dispatch mechanism, this catalog is a ready-made naming scheme — no redesign of the event *model* would be needed, only a decision to actually dispatch these as first-class events rather than treating them as this document's conceptual labels for "existing actions that already happen."
- A true event-driven mechanism would let the Canonical layer's projection be updated reactively (only when something relevant changes) rather than recomputed on every read — a genuine efficiency gain if usage volume ever makes on-demand computation costly.

**Arguments against adopting it now, or soon:**

- Event sourcing is a foundational architecture decision — the event log becomes the system of record and current tables become derived projections *of it*. That is the inverse of everything this document specifies (here, the *existing tables* remain the system of record, and the new layer is the derived projection). Adopting real event sourcing would be a genuine rewrite of write paths across at least two modules and likely the order modules too — squarely the kind of "architecture refactor" this task, and the prior one, explicitly forbid.
- The audit already documents that current cross-module writes are **not** transactionally coordinated and are **not** currently emitted as reliable, ordered domain events (`../clinical-note-audit/07-backend-behaviour.md` §7.5; `../clinical-note-audit/15-critical-system-integrity-review.md` C-1, C-7). Introducing event sourcing *on top of* a system with unreliable event-emission characteristics, without first addressing that reliability gap (e.g., via a transactional outbox pattern), would risk producing an event log that is itself incomplete or misordered — a foundation you would be building new trust on top of prematurely.

**Position taken by this document**: the Canonical layer should be **vocabulary-compatible** with a future event-sourced or event-driven evolution (its event catalog can be reused as-is), but it must not **require or presuppose** that such an evolution has happened. It is designed to work correctly, today, purely as a query-time derived projection over the existing mutable-state system. Whether to ever pursue true domain events is a separate, future decision this document does not make.

---

## 6. Migration Phases (staged, no big-bang)

Every phase up to and including Phase 3 shares one property, stated once here rather than repeated per phase: **it is fully and instantly reversible by ceasing to invoke or display the Canonical layer.** Because the layer never writes to any legacy table and never gates any legacy behavior through Phase 3, "rolling back" is never a data migration — it is simply turning off a caller.

### Phase 0 — Baseline

Current system, entirely unchanged. This phase *is* the state documented across `../clinical-note-audit/`. No Canonical-layer code exists yet. Purpose: this is the confirmed, evidence-based starting point (the audit itself) against which every later phase is validated.

### Phase 1 — Read-only computation

The Canonical layer is built as a new, additive, read-only component per §1, invocable only through internal/engineering-facing means (e.g., an ad hoc tool, a script, an internal-only query path) against real or representative encounter data — but wired into **no** user-facing or automatically-triggered flow. Nothing in the live system calls it yet. Purpose: validate that the derivation logic (from the prerequisite document) produces plausible, explainable results across a representative range of real encounters, entirely offline from production traffic.

### Phase 2 — Shadow validation (Mode B)

The Canonical layer is wired to compute automatically alongside real, live traffic (per §3, Mode B), logging results and divergences (per §4) with the isolation guarantees from §2.4 strictly enforced. Run for a defined observation window at real production volume. Purpose: measure real-world divergence rate and pattern; distinguish transient/benign divergence from persistent, meaningful divergence; build confidence (or identify problems) before anything becomes visible to any user.

### Phase 3 — UI adoption (Mode C)

The Canonical layer's output becomes visible as a non-blocking, clearly-labeled advisory signal (per §3, Mode C), with divergence notices surfaced per §4.2. No permission, gate, or write path changes. Purpose: let clinical/operational users benefit from the canonical signal as *information*, while the legacy fields remain the sole operative truth for every actual decision the system makes.

### Phase 4 — Enforcement (optional, future, explicitly not designed here)

A possible future phase in which canonical state (or specific safety invariants from the prerequisite document's §6) could begin to actually influence behavior — for example, requiring acknowledgement of a Critical conflict before a close action proceeds. This phase is named for completeness only. It is explicitly **not** specified, authorized, or scheduled by this document, because it is the one phase that would necessarily touch legacy write/guard logic — outside the scope this task and its predecessor both explicitly forbid. Any future decision to pursue Phase 4 would require its own dedicated design exercise.

---

## 7. Risk Controls

### 7.1 Race conditions (e.g., C-1, C-4)

The Canonical layer has no write path, so it cannot itself introduce a race condition — it can only *observe* races that already exist in the legacy system (the autosave-vs-finalize race behind C-1; the check-then-create encounter-resolution race behind C-4). A race condition manifesting in the legacy system will surface in the Canonical layer as a transient divergence, handled per §4.3 (debounced, not treated as a new incident) unless it persists, in which case it is handled per §4.4 (alerted, correctly, as evidence of a pre-existing legacy condition — not a Canonical-layer defect). For C-4 specifically: if two duplicate `EncounterModel` rows exist for one visit, the Canonical layer computes and reports two independent canonical states — one per `encounter_id` — because it has no authority to decide which duplicate is "real" or to merge them. This is deliberate: silently merging would require judgment and write authority the layer must not have.

### 7.2 Dual-write inconsistency

The Canonical layer never writes to any table owned by `Encounter`, `MedicalRecord`, or any order/billing module — this is not a mitigation of dual-write risk, it is the structural absence of a second write path in the first place. Its own output (logs in Shadow Mode; a possible future cache, per §2.1) lives in storage no legacy code reads from or depends on, so even a fault in the Canonical layer's own storage cannot desynchronize any legacy behavior.

### 7.3 Stale projections

Applies only if the future cached-projection refinement (§2.1) is ever adopted — not a concern for the on-demand strategy this document specifies for Phases 1–3. If adopted later: any cached value shown anywhere must carry an explicit "as of" timestamp; caching should be considered only for aggregate/list contexts, never for the single-encounter advisory display, where an on-demand read is cheap (one encounter) and currency matters most.

### 7.4 Conflicting state sources

Where two legacy resolution paths already disagree (CONFLICT-07 — `GetEncounterWorkspaceUseCase` vs. `GetEncounterCloseReadinessUseCase`), the Canonical layer must surface the disagreement itself as a divergence event rather than silently preferring one source over the other. Inventing a rule to silently pick a winner would only produce a third, equally unauthoritative opinion — the correct behavior is to make the existing disagreement visible (per §4), not to paper over it.

---

## 8. "Do Not Break These" Rules

These are stated as absolute invariants for every phase up to and including Phase 3 (Phase 4, if ever pursued, would require its own explicit re-examination of these same rules):

1. **Encounter creation logic is untouched.** `EncounterResolverService::findOrCreateForVisit()` remains the sole creator/resolver of `EncounterModel` rows. The Canonical layer only ever performs pure lookups against existing encounters — it never calls the create branch of that service, and its mere act of computing canonical state must never, as a side effect, cause a new encounter to be created.
2. **Note lifecycle writes are untouched.** `CreateMedicalRecordUseCase`, `UpdateMedicalRecordUseCase`, and `UpdateMedicalRecordStatusUseCase` remain the only writers of `medical_records` rows, with every validation, lock, and transition rule documented in `../clinical-note-audit/04-clinical-note-lifecycle.md` and `05-saving-mechanism.md` continuing to apply exactly as today. The Canonical layer only reads via existing repository query methods.
3. **Order-module independence is preserved.** Laboratory, Radiology, Pharmacy, and Theatre keep their own status vocabularies, terminal-status lists, and write paths unchanged. No "canonical status" column, flag, or write is added to any of their tables. The mapping from their existing values into the O dimension (already fixed in the prerequisite document and not altered here) remains a read-only translation performed entirely inside the Canonical layer.
4. **Billing pipeline independence is preserved.** `ListBillingChargeCaptureCandidatesUseCase` and the Billing module's own logic continue exactly as today; the Canonical layer only ever consumes already-computed output surfaced through Encounter's existing aggregation (§1.3) and never calls into any Billing write path.
5. **No schema change to any legacy table** is introduced by Phases 0–3 for the purpose of storing canonical state. Canonical output lives exclusively in new, separate, additive storage (logs, and — only if later adopted — a dedicated cache) that no legacy code path reads or depends on.
6. **No existing endpoint response contract is altered** in Modes A or B. In Mode C, exactly one additive field is introduced to a response already documented in `../clinical-note-audit/08-api-inventory.md`; no existing field in that contract is renamed, removed, retyped, or repurposed.
7. **No existing permission or authorization check is altered, bypassed, or supplemented** by canonical state in any phase this document authorizes (0–3). Every `can:` middleware rule and every `FormRequest::authorize()` check documented in `../clinical-note-audit/08-api-inventory.md` §8.6 continues to be the sole authorization mechanism.
8. **No existing concurrency-control mechanism is touched.** `UpdateMedicalRecordUseCase`'s `updateWithOptimisticLock()`, `UpdateMedicalRecordStatusUseCase`'s transition-validation logic, and every guard method inside `EncounterLifecycleService` (`markInProgress`, `syncFromMedicalRecordStatus`, `markReadyForSign`, `close`, `reopen`) continue to run exactly as documented, uncalled-into and unmodified by the Canonical layer for any write purpose.

---

## 9. Summary

This document places the canonical encounter state machine (defined, unchanged, in `00-canonical-encounter-state-machine.md`) into a new, additive, read-only cross-module query layer that sits beside — never inside — the six existing modules it observes; specifies on-demand, query-time computation as the only strategy authorized for Phases 1–3, with explicit fail-closed and request-isolation guarantees; defines three non-destructive integration modes (Legacy Only, Shadow, Advisory) plus an explicitly-deferred, unspecified Enforcement phase; defines what divergence between canonical and legacy state is logged, displayed, ignored, and alerted on; states plainly that this is a derived projection, not event sourcing, while leaving a vocabulary-compatible door open to a future evolution; lays out a four-phase rollout in which every phase through Phase 3 is instantly and safely reversible; and closes with eight explicit invariants that the legacy production system's creation logic, write paths, module independence, and concurrency controls must never be altered by any part of this design.
