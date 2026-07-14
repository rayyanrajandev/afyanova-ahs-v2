# Medical Record / Encounter / Clinical Note — Modeling Decision

**Document type**: Architecture decision record. Written to close out an investigation triggered by a report that Medical Record, Encounter, and Clinical Note appeared to be conflated in this codebase — clicking "Encounters" seemed to open the same thing as "Medical Records," and opening an encounter immediately showed one clinical note as if the encounter and the note were the same object. This records what was found, what was decided, and why, so the question isn't re-investigated from scratch later.

## 1. The reported problem, and what was actually true

"Encounters" and "Medical Records" are not literally the same page — they render distinct components (`encounters/List.vue`, one row per visit; `medical-records/IndexV2.vue`, one row per note). But the deeper complaint held up: `MedicalRecordModel` is, in substance, a `ClinicalNote` — a SOAP-note row (`subjective`/`objective`/`assessment`/`plan`, `record_type` values that are all literally `*_note`, draft/finalized/amended status) — and the Encounter Workspace (`encounters/WorkspaceV2.vue`) only ever surfaced one `primaryMedicalRecord` per encounter, even though the schema already supports many notes per encounter. That gap is what produced the "encounter and note are the same object" impression.

## 2. Domain model — confirmed correct, evidenced

```
Patient (1) ── Encounter (many, DB-enforced 1:1 with its Appointment/Admission context)
Encounter (1) ── Clinical Note (many, some singular-per-encounter, some repeatable)
Encounter (1) ── Diagnosis (many), Order (many), Procedure (many), Referral (many)
Patient Chart = an aggregation VIEW over a patient's Encounters — not a stored entity
```

- `encounters.appointment_id` and `encounters.admission_id` both carry unique database indexes (`app/Modules/Encounter/Application/Services/EncounterResolverService.php`) — a whole inpatient admission is always exactly one Encounter, with daily progress notes as multiple Clinical Note rows inside it. No separate "Visit" layer (as some EHRs use above Encounter) is needed here — Encounter already plays that role.
- Diagnoses, lab/pharmacy/radiology orders, theatre procedures, and billing invoices are all correctly keyed to `encounter_id`, not `medical_record_id` (`database/migrations/2026_05_21_000002_add_encounter_id_to_clinical_artifacts.php`).
- `CreateMedicalRecordUseCase.php:128-147` already allows multiple `progress_note`/`referral_note`/`procedure_note` drafts per encounter, restricting only `consultation_note`/`admission_note`/`discharge_note` to one open draft — this is deliberate, pre-existing, correct design (`reports/clinical-note-audit/`), not something this pass changed.
- Patient Chart (`patients/chart/ShowV2.vue`) is documented and implemented as a **read-only aggregation** — "no writes happen here at all, every action is a link-out to the module that owns that write" (`reports/patient-chart-rebuild-plan.md`). This matches how modern EHRs (Epic Chart Review, Cerner MPage) structure the longitudinal record: a computed view, not a stored document.

**Conclusion**: the relational model was already correct. Nothing here required a schema or migration change.

## 3. Workflow validation: Encounter-centric vs. Patient-Chart-centric

Compared against FHIR (no single "medical record" resource — always an aggregate over `Encounter`-scoped resources), Epic/Cerner (active clinical work anchored to the encounter, chart kept as an always-reachable reference), Athenahealth (strongly visit-centric), and OpenMRS (`Visit` → `Encounter` → `Obs`). Verdict: **Encounter-centric for active clinical work, with fast reference access to the Patient Chart** is the dominant modern pattern, and this codebase had already chosen it (see §2's Patient Chart evidence) — the only real gap was that the reverse link (Workspace/Queue → Chart) didn't exist yet, making it "naive Encounter-centric" rather than the genuine hybrid pattern. Folding documentation/orders/diagnoses/referrals into the Chart page itself was considered and rejected: it would duplicate functionality the Encounter Workspace already owns, contradict Patient Chart's own documented read-only design, and reintroduce a known EHR safety failure mode (acting on the wrong encounter's data while looking at a chart full of history).

## 4. What changed

**Terminology** (display strings only — no renamed backend identifiers, routes, or database objects):
- `appNavCatalog.ts`'s "Clinical records" nav entry retitled "Clinical note registry"; its `helpNote` corrected from "Consultation workspace and clinical documentation" (wrong — that's the Encounter Workspace's job) to an accurate description of a cross-patient governance registry.
- `medical-records/IndexV2.vue` page title, breadcrumb, empty states, and dialog copy changed from "Medical Record(s)" to "Clinical Note(s)" wherever an individual note is meant.

**Encounter Workspace** (`encounters/WorkspaceV2.vue`):
- Fixed a real bug: the "Encounters" breadcrumb linked to `/medical-records` instead of `/encounters`.
- Added a Notes panel/tab listing every clinical note belonging to the encounter (type, status, date, author), letting a clinician see and switch between multiple notes instead of only ever the one primary note — backed by the already-existing, already-filterable `GET /medical-records?encounterId=X` endpoint. Zero backend changes.
- Added a Referrals entry point inside the Workspace (reusing `ReferralManagementSheet.vue` unchanged) — previously referrals were only reachable from the Clinician Queue, disconnected from the encounter a clinician was actively documenting.
- Added a "View chart" link in the header, next to patient identity.

**Clinician Queue** (`clinician/Queue.vue`):
- Added a "View chart" row action, giving a direct, in-context path to a patient's longitudinal chart without leaving the queue to search the Patient registry from scratch.

## 5. What was explicitly deferred, not silently dropped

- **Backend rename** (`MedicalRecordModel`/`medical_records` table/`app/Modules/MedicalRecord`/`/medical-records` API routes → `ClinicalNote*`): the class/enum naming (`MedicalRecordNoteType`) is a real smell for future engineers, independent of the user-facing fix above, but is a large (~50+ file) mechanical change with zero behavioral difference. Scoped as an explicit, separately-greenlit follow-up rather than bundled into this pass.
- **ED-to-Admission Encounter continuity**: whether an ED visit that converts into an inpatient admission gets a new Encounter or updates the existing one in place was not verified — flagged as worth a dedicated investigation if it's a real clinical workflow in use, not assumed resolved either way.
- **Referral ownership enforcement** and **triage-claim advisory-only enforcement** — pre-existing, separately-documented gaps (`reports/clinician-workflow-actions-reference.md §7`), unrelated to this investigation.
