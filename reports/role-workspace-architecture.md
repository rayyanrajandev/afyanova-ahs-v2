# Role → Workspace Architecture

**Document type**: Definitive reference answering "where does each hospital role work, and what is their workspace?" — the question the navigation never made legible. This documents what the code **already does** (role-based dashboard home + role worklists + shared chart/encounter surfaces), plus the navigation clarifications shipped alongside it. It is not aspirational: every role→workspace mapping is grounded in `app/Modules/Platform/Application/Services/DashboardWorkflowRegistry.php` and the `resources/js/workflows/*/surface.ts` builders that already exist.

## 1. The model (Epic/Cerner-aligned)

Modern EHRs don't organize around a flat list of modules — they organize around **each role's home**, a **shared patient record**, and the **encounter as the unit of work**. This system already implements all three:

```
My Workspace  (role HOME — /dashboard renders your role's surface: KPIs, quick actions, worklist, shift handoff)
   └── your role's live WORKLIST  (Reception / Triage / Clinician / Emergency / Lab / Pharmacy / Theatre / …)
          ├── Patient Chart      (/patients/{id}/chart — shared, READ-ONLY longitudinal reference, opened from anywhere)
          └── Encounter Workspace (/encounters/{id} — where clinical work is DONE for one visit:
                                    notes, orders, diagnoses, referrals)

Health Information  (records lookup + governance — HIM/supervisor surfaces, NOT daily clinical work)
```

- **My Workspace / Dashboard** — one URL (`/dashboard`, Fortify's post-login home in `config/fortify.php:76`). The backend `DashboardWorkflowRegistry` resolves the signed-in user's role codes → their workflow surface and renders it. Users with more than one eligible workflow can switch. This *is* each role's home; it was just labeled the generic "Dashboard" before.
- **Patient Chart** — the longitudinal record. Read-only aggregation; every action links out to the module that owns the write (see `reports/patient-chart-rebuild-plan.md`). This is Epic's "Chart Review": reference, not a place you document.
- **Encounter Workspace** — the unit of clinical work. One encounter = one visit/episode (DB-enforced 1:1 with its appointment/admission). Notes, orders, diagnoses, referrals all happen here. See `reports/medical-record-encounter-note-modeling-decision.md`.
- **Health Information** — the records/HIM surfaces (Medical Records, Encounter records). Cross-patient lookup and note governance. Owned by the Medical Records role — **not** where clinicians do daily work.

## 2. Role → Workspace map

Role→workflow mapping is from `DashboardWorkflowRegistry.php:54-138`. "Primary worklist" = the sidebar worklist(s) that role lives in day to day.

| Role (code) | Home surface | Primary worklist(s) | Where they DO the work | Shared reference |
|---|---|---|---|---|
| **Front desk / Registration** (`ADMIN.REGISTRATION`) | front_desk | Reception queue (`/reception/queue`), OPD appointments (`/appointments`), Patient registry (`/patients`) | Register & check in patients, schedule visits | Patient Chart (read) |
| **Physician / Clinical Officer** (`CLINICAL.PHYSICIAN`, `CLINICAL.GENERAL`) | clinician | Clinician queue (`/clinician/queue`) | **Encounter Workspace** — notes, orders, diagnoses, referrals | Patient Chart |
| **Nurse** (`CLINICAL.NURSE`) | nursing | OPD triage queue (`/triage/queue`), Ward management (`/inpatient-ward`) | Triage assessment & vitals; nursing notes in the Encounter Workspace | Patient Chart |
| **Emergency clinician** (`CLINICAL.EMERGENCY`) | emergency | Emergency queue (`/emergency/queue`) | Encounter Workspace | Patient Chart |
| **Lab / Pharmacy / Radiology tech** (`LAB.STAFF`, `PHARMACY.STAFF`, `RADIOLOGY.STAFF`) | direct_service | Direct Service Queue (`/direct-service/queue`) + departmental worklist (`/laboratory-orders`, `/pharmacy-orders`, `/radiology-orders`) | Fulfill orders / collect specimens / dispense | Patient Chart (read) |
| **Theatre team** (`THEATRE.STAFF/SUPERVISOR/MANAGER`) | theatre | Operating theatre (`/theatre-procedures`) | Procedure scheduling & perioperative workflow | Patient Chart |
| **Medical Records / HIM** (`ADMIN.MEDICAL.RECORDS`) | records | **Medical Records (`/medical-records`)** + **Encounter records (`/encounters`)** — the Health Information section | Govern note completeness: finalize / amend / archive / audit / release | Patient Chart |
| **Cashier / Finance** (`FINANCE.CASHIER/OFFICER/CONTROLLER`, `FINANCE.CLAIMS`) | cashier | Invoices (`/billing-invoices`), Cash payments, POS counters, NHIF & claims | Take payments, invoice, adjudicate claims | — |
| **HR / Operations** (`ADMIN.HR`) | operations | Staff directory / attendance / credentialing / privileges | Staff & credentialing administration | — |
| **Supply / Inventory** (`INVENTORY.STAFF/SUPERVISOR/MANAGER`) | supply | Supply chain (`/inventory-procurement`) + receive / issue / count / approvals | Stock movements, procurement, requisitions | — |
| **Facility / Platform admin** (`ADMIN.FACILITY`, `PLATFORM.USER.ADMIN`, `PLATFORM.RBAC.ADMIN`, `PLATFORM.SUBSCRIPTION.ADMIN`) | admin | Facility setup, Users & access, Roles & permissions, Subscriptions | Configuration & access administration | — |

Notes:
- **Supervisor/Manager tiers** (LAB/RADIOLOGY/PHARMACY/THEATRE/INVENTORY) inherit their department's worklist as their primary workspace, plus oversight KPIs — the registry maps `.STAFF` explicitly to `direct_service`/`supply`/`theatre` (`DashboardWorkflowRegistry.php:95-138`); higher tiers resolve through the same workflows plus their broader permission set.
- `PLATFORM.SUPER.ADMIN` has universal access via `Gate::before()` and sees every workspace.

## 3. What the two flagged pages are for (and are NOT)

- **Medical Records (`/medical-records`)** — the **Medical Records / HIM department's workspace**. The `records` dashboard surface (`resources/js/workflows/records/surface.ts`) is built entirely around it: draft/finalized/amended counts, "Records governance," "chart completeness and release readiness," "HIM shift." Clinicians do **not** manage notes here — they finalize their *own* notes inside the Encounter Workspace. HIM uses this registry to govern completeness across *all* patients.
- **Encounter records (`/encounters`)** — a **cross-patient visit lookup / oversight** surface: find any visit, see its documentation/close status, open its Encounter Workspace. A records/supervisory tool, **not** a clinician's daily worklist (that's the Clinician Queue).

Both were previously mis-filed in the "Clinical care" sidebar section, sitting next to the live Clinician Queue — which made them look like clinician worklists. They are now in the dedicated **Health Information** section, matching their real owner (the records role) and purpose.

## 4. Navigation changes made to expose this model

- New **"Health Information"** sidebar section (`resources/js/config/appNavCatalog.ts`), placed after "Clinical care". "Encounters" → **"Encounter records"** and "Clinical note registry" → **"Medical Records"** moved here, with help text reframed as lookup/govern rather than clinical work. (The *page* is "Medical Records" — the HIM department's name — while an individual row is a "clinical note"; a single note is not itself "a medical record".)
- The home nav item renamed **"Dashboard" → "My Workspace"** (`AppSidebar.vue`, `AppHeader.vue`) — it already renders the role-resolved surface; the label now says so.
- Access is **unchanged** — the sidebar remains permission-gated exactly as before (`routeAccess.ts`). Only grouping, labels, and help text changed.

## 5. Rejected alternative — role-scoped sidebar hiding

Considered hiding non-workspace modules per role so each user sees only their own tools. **Rejected**: this is not how Epic/Cerner work — they grant clinicians broad access and organize by *activity*, they don't hide the chart, orders, or other tools. A physician legitimately needs to reach Lab, Pharmacy, Admissions, and the registries. The correct modern pattern is **legibility through clear sectioning + an unambiguous role home**, not access restriction. Permission and facility-entitlement gating already remove what a user genuinely may not use; role does not need to further hide the rest.
