# Nurse-Led Walk-In: Implementation Plan

## Why This Is Better Than The Current Approach

### Current flow (broken)
```
Receptionist checks in patient
    → Receptionist picks medications/tests at the desk (non-clinical user)
    → Items auto-fulfill to departments as draft orders
    → Pharmacist sees "Walk-in" tab in worklist
    → Pharmacist reviews & signs
```

**Problems:**
- A receptionist (non-clinician) decides what medication a patient needs — unsafe, no clinical judgment
- No clinical note documents why the patient was given the medication — missing medical record
- The "assessment" step is skipped entirely — patient walks in, receptionist guesses what they need, medication is ordered
- The nurse is the one who actually sees the patient, but has no system workflow — works outside the system
- Creates a gap in the patient chart: the encounter exists but no clinical documentation is attached to it
- Billing ambiguity — no clinical justification trail for why a service was rendered

### Proposed flow (correct)
```
Receptionist checks in patient
    → Patient appears in Nurse Queue
    → Nurse opens Quick Assessment form
    → Nurse writes clinical note (presenting complaint, vitals, assessment)
    → Nurse selects required services (medication, lab test, procedure)
    → Services fulfill to departments as draft orders (existing pipeline)
    → Pharmacist sees "Walk-in" tab in worklist
    → Pharmacist reviews & signs (same as before)
    → Patient chart has: Encounter + Nurse Note + Linked Orders (complete trail)
```

**Why it's better:**

| Concern | Before (Receptionist-led) | After (Nurse-led) |
|---------|--------------------------|-------------------|
| **Clinical decision** | Made by non-clinician | Made by licensed nurse |
| **Documentation** | No clinical note | SOAP/subjective nursing note on record |
| **Patient safety** | No triage/assessment | Nurse assesses before ordering |
| **Legal trail** | Gaps — no clinical justification | Complete: note + orders linked to encounter |
| **Audit** | "Who ordered this?" → receptionist | "Who assessed and ordered?" → nurse |
| **Reusability** | Only pharmacy works | Any service type (lab, radiology, procedure) |
| **Charge model** | Hard to separate "nurse visit" from "service" | Nurse note = no billing event; service item = charges |
| **Scalability** | Breaks for complex cases | Nurse can assess, triage, escalate to clinician if needed |

---

## UI Sketch

### Page 1: Nurse Queue (`/nurse-queue`)

Replaces the current Direct Service Queue. Shows checked-in patients awaiting nurse assessment.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Nurse Queue                                  12 waiting                │
│  ┌──────────────┬──────────────┬──────────────┐                        │
│  │  Waiting     │  Assessed    │  Completed   │  ← status tabs         │
│  │  8           │  3           │  1           │                        │
│  └──────────────┴──────────────┴──────────────┘                        │
│                                                                         │
│  [Search by patient name or MRN…]                [Department filter]   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Doe, John      42M   PT-20260727-8HGVS   ⏱ 12 min     🟢 Routine  ││
│  │ "Fever, body aches"                                                ││
│  │                                      [▶ Start Assessment]          ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Smith, Jane    28F   PT-20260727-9ABCD  ⏱ 5 min     🟡 Urgent     ││
│  │ "Severe headache, needs pain relief"                               ││
│  │                                      [▶ Start Assessment]          ││
│  └─────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### Page 2: Quick Assessment Form (modal or page)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ◀ Back to Queue              Quick Assessment                          │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  Patient: John Doe  |  42M  |  PT-20260727-8HGVS  |  Routine           │
│                                                                          │
│  ── Clinical Note ────────────────────────────────────────────────────  │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ Patient presents with fever (38.5°C), body aches, and headache      ││
│  │ x2 days. No vomiting, no rigor. Alert, oriented x3. Vital signs:    ││
│  │ BP 120/80, HR 88, RR 18, Temp 38.5°C. Assessment: likely viral      ││
│  │ illness. Plan: symptomatic treatment + malaria RDT to rule out.      ││
│  │                                                                      ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ── Services Required ─────────────────────────────────────────────────  │
│                                                                          │
│  + Add service                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ 🔍 Search medication, lab test, procedure…                          ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  Selected (2):                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ 🟦  Malaria Rapid Test                     x1          [Remove]     ││
│  │     (Laboratory)                                                     ││
│  │ 🟦  Paracetamol 500mg tablet               x4          [Remove]     ││
│  │     (Pharmacy — oral)                                                ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │        Cancel            │  │  Complete Assessment & Send Orders   │ │
│  └──────────────────────────┘  └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Reuse: Pharmacy Worklist (already done)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┬──────────────┐                                        │
│  │  Clinician   │  Walk-in     │  ← segmented control (built)          │
│  └──────────────┴──────────────┘                                        │
│                                                                          │
│  Walk-in orders appear as drafts → pharmacist reviews → signs → active  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## What Gets Removed

### Backend

| File / Component | Reason |
|------------------|--------|
| `CreateServiceRequestUseCase` auto-fulfill call (line ~67) | No items to fulfill at SR creation — nurse adds them later |
| `StoreServiceRequestRequest` items field (simplify) | Items handled by nurse assessment endpoint, not at SR creation |
| *Nothing structural — no models or pipelines are deleted* | |

### Frontend

| File / Component | Reason |
|------------------|--------|
| Direct Service Queue (`Queue.vue`) | Replaced by Nurse Queue |
| `DirectServiceStatusDialog.vue` (may be repurposed) | Status transitions change |

---

## What Gets Changed

### Backend

| File | Change |
|------|--------|
| `database/migrations/` — new migration | Add `encounter_id` (FK → encounters), `assessed_by_user_id` (FK → users), `assessed_at` (timestamp) to `service_requests` table |
| `CreateServiceRequestUseCase.php` | Remove auto-fulfill `FulfillServiceRequestItemsUseCase` call. Remove items processing from the use case. Accept optional `encounter_id` |
| `StoreServiceRequestRequest.php` | Remove `items` validation rules (receptionist no longer picks items). Add optional `encounterId` |
| `ServiceRequestController.php` | Add `addItem()` and `completeAssessment()` methods for nurse workflow |
| `routes/api.php` | Add `POST /service-requests/{id}/items` and `POST /service-requests/{id}/complete-assessment` |
| `ServiceRequestResponseTransformer.php` | Add `encounterId`, `assessedByUserId`, `assessedAt` to response |
| Direct Service Queue → Nurse Queue page permission | `service.requests.read` now applies to nurses (not just reception view) |

### Frontend

| File | Change |
|------|--------|
| `Queue.vue` → rename/repurpose to `NurseQueue.vue` | Change columns, actions, layout. "Start Assessment" replaces "Accept/Close/Cancel" |
| `useDirectServiceFilters.ts` | Add `status=waiting_triage` support |
| `useDirectServiceRequests.ts` | Update query to support nurse queue filters |
| `ServiceRequestItemSelector.vue` | Already exists — ensure it's reusable in the nurse assessment form |
| `routes.ts` (if any) | Update route from `/direct-service` to `/nurse-queue` |

---

## What Gets Added

### Backend (4-5 new files + 1 migration)

| File | Purpose |
|------|---------|
| `App\Modules\ServiceRequest\Application\UseCases\AddServiceRequestItemsUseCase.php` | Adds items to an existing service request (catalog lookup + validation). Reuses same `FulfillServiceRequestItemsUseCase` for auto-fulfillment. |
| `App\Modules\ServiceRequest\Application\UseCases\CompleteNurseAssessmentUseCase.php` | Orchestrates: validate note is present → save note as `medical_record` (type `nursing_note`) → trigger fulfillment for added items → update SR status to `in_progress` → set `assessed_at`. |
| `App\Modules\ServiceRequest\Presentation\Http\Requests\AddServiceRequestItemRequest.php` | Validation for adding items (same rules as existing `StoreServiceRequestRequest` items). |
| `App\Modules\ServiceRequest\Presentation\Http\Requests\CompleteNurseAssessmentRequest.php` | Validation: `note` (required, string, max:5000). |
| `App\Modules\MedicalRecord\Application\UseCases\CreateNurseNoteUseCase.php` | Creates a `medical_record` with `record_type = NURSING_NOTE`, linked to the encounter. Accepts SOAP fields (at minimum the note text goes into `subjective` or a combined `assessment`). |
| Migration: `add_nurse_assessment_fields_to_service_requests` | Add `encounter_id`, `assessed_by_user_id`, `assessed_at`. |

### Frontend (4 new files)

| File | Purpose |
|------|---------|
| `resources/js/pages/nurse-queue/NurseQueue.vue` | Full page — list of checked-in patients awaiting nurse assessment. Reuses patterns from `Queue.vue`. |
| `resources/js/components/nurse-queue/QuickAssessmentDialog.vue` | Modal with: clinical note textarea + `ServiceRequestItemSelector` + submit button. |
| `resources/js/composables/nurse-queue/useNurseAssessment.ts` | Composables: `useNurseQueue` (list), `useSubmitAssessment` (mutation). |
| `resources/js/composables/nurse-queue/useNurseQueueFilters.ts` | Filter/sort state for the nurse queue page. |

### Routes (API)

```
GET    /nurse-queue                  (list checked-in patients awaiting nurse)
POST   /service-requests/{id}/items  (add item to existing SR → triggers fulfillment)
POST   /service-requests/{id}/complete-assessment  (save note + mark assessed)
```

### Routes (Web/Inertia)

```
/nurse-queue          → NurseQueue.vue
```

---

## Why The Implementation Fits The Current Architecture

### No model changes to fulfillment pipeline

The existing `FulfillServiceRequestItemsUseCase` → `Fulfill*ServiceRequestItemJob` → `Create*OrderUseCase` chain is **untouched**. Items added by the nurse go through the same pipeline. The only difference is the trigger point: it runs when the nurse submits the assessment, not when the receptionist creates the SR.

### No changes to pharmacy order model

Draft creation, signing, the "Walk-in" tab — all already built and working.

### No changes to encounter model

The encounter already exists (created at check-in). The nurse assessment reuses it. `medical_records` already has `encounter_id`.

### No changes to billing

No "nurse visit" charge is created because no new encounter type is needed. The nurse note is documented on the existing encounter. The service items (medication, lab test) generate their own charges through the existing billing pipeline when fulfilled.

### The existing Direct Service Queue can coexist

For clinics that want both models, the old receptionist-led flow can remain active. Add a permission gate so only nurses see the nurse queue.

### Minimal database migration

Just 3 new nullable columns on `service_requests` — no new tables, no complex schema changes.

---

## Effort Estimate

| Layer | New Files | Changed Files | Effort |
|-------|-----------|---------------|--------|
| Backend | 4-5 | 4-5 | 1-2 days |
| Frontend | 4 | 3-4 | 1-2 days |
| Migration | 1 | — | < 1 day |
| **Total** | **~9-10** | **~8-9** | **2-3 days** |

---

## Rollout Strategy

1. **Phase 1**: Create migration + backend use cases + controller endpoints (no UI changes yet — testable via API)
2. **Phase 2**: Build Nurse Queue page + Quick Assessment dialog (nurse can see patients and submit assessments)
3. **Phase 3**: Remove old Direct Service Queue for the nurse role (receptionist retains access if needed)
4. **Phase 4**: Retrain staff — receptionist checks in, nurse assesses, pharmacist signs
