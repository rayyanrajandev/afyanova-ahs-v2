# Clinical Note Module — Reverse Engineering Report

Scope: this report documents **exactly how the Clinical Note module currently works**, as implemented in code, with no recommendations, no best-practice comparisons, and no invented functionality. Every non-trivial claim is cited as `file:line`. Where something could not be verified from the implementation, it is explicitly marked **"Not found in code."**

**Terminology note (important, non-obvious):** there is no class or table literally named "ClinicalNote" in this codebase. The clinical note itself — the SOAP-style free-text encounter note (subjective/objective/assessment/plan) — is implemented as the **`MedicalRecord`** module (`app/Modules/MedicalRecord`), specifically records where `record_type = consultation_note` (and six other note types). The **`Encounter`** module (`app/Modules/Encounter`) is a separate aggregate representing the clinical visit/episode that a medical record belongs to, and owns a distinct sub-resource called `EncounterClinicalDocument` which is a **file attachment** (PDF/image/Word upload), not the note text. All three concepts are covered in this report because together they implement what a user would call "the clinical note workflow."

## Documents in this folder

1. [01-executive-summary.md](01-executive-summary.md) — Executive Summary
2. [02-architecture-overview.md](02-architecture-overview.md) — Architecture Overview
3. [03-workflow-reconstruction.md](03-workflow-reconstruction.md) — Workflow Reconstruction (appointment → encounter → note → orders → diagnosis → prescriptions → finalization)
4. [04-clinical-note-lifecycle.md](04-clinical-note-lifecycle.md) — Clinical Note & Encounter Lifecycle States
5. [05-saving-mechanism.md](05-saving-mechanism.md) — Saving Behaviour (manual/auto/draft/final)
6. [06-frontend-behaviour.md](06-frontend-behaviour.md) — Frontend Behaviour
7. [07-backend-behaviour.md](07-backend-behaviour.md) — Backend Behaviour / Request Trace
8. [08-api-inventory.md](08-api-inventory.md) — API Inventory
9. [09-database-structure.md](09-database-structure.md) — Database Structure
10. [10-configuration-inventory.md](10-configuration-inventory.md) — Configuration Inventory
11. [11-integration-points.md](11-integration-points.md) — Integration Points
12. [12-state-machine.md](12-state-machine.md) — State Machine (text diagram)
13. [13-code-references.md](13-code-references.md) — Consolidated Code Reference Index
14. [14-unknown-missing-information.md](14-unknown-missing-information.md) — Unknown / Missing Information
15. [15-critical-system-integrity-review.md](15-critical-system-integrity-review.md) — Critical System Integrity Review (risks only, no fixes)

## Primary source locations

- `app/Modules/MedicalRecord/**` — the note itself (content, status, versions, audit log, signer attestations)
- `app/Modules/Encounter/**` — the visit/episode aggregate, clinical-document uploads, close-readiness, cross-module workspace assembly
- `resources/js/pages/encounters/Workspace.vue` — the primary note-composer/editor page (10,151 lines)
- `resources/js/pages/medical-records/*` — note list, print/PDF view, note-type metadata
- `resources/js/components/domain/clinical/*` — workspace sub-panels and dialogs
- `database/migrations/2026_02_25_*`, `2026_03_16_*`, `2026_04_18_*`, `2026_05_21_*` — schema history for these tables
- `routes/api.php`, `routes/web.php` — route registration
