# Patient Summary Module — Rollout Tracker

A running checklist of where `PatientSummaryPopover.vue` / `PatientDetailSheet.vue` (`resources/js/components/patients/summary/`) should eventually get wired in. This is a reminder document, not a schedule — each row is real, separate work, done when that page's own V2 pass happens, not bundled into an unrelated change.

**How to wire a page in** (matching `IndexV2.vue`/`ReceptionQueueList.vue`'s precedent): wrap the patient-name element in `<PatientSummaryPopover :patient-id="x"><template #trigger>...</template><template #actions>...</template></PatientSummaryPopover>`. The Sheet tier (`PatientDetailSheet.vue`) comes for free — the popover owns that transition internally, no extra wiring needed. Requires a real `patientId` in scope at the render site; note where that isn't already the case below.

## Done

| Page | File | Wired |
|---|---|---|
| Patients list | `resources/js/pages/patients/IndexV2.vue` | Table rows — patient name |
| Reception queue | `resources/js/components/reception/ReceptionQueueList.vue` (used by `pages/reception/Queue.vue`) | Queue card — patient name, guarded by nullable `entry.patientId` |

## Candidates — has a V2 route already

| Page | File | Notes |
|---|---|---|
| Medical records | `resources/js/pages/medical-records/IndexV2.vue` | Route exists (`/medical-records/v2`); patient-identity rendering site not yet confirmed — check field name before wiring (legacy `Index.vue` uses `patientName(activePatientSummary)`, V2 file didn't match that pattern in a first pass) |
| Encounters workspace | `WorkspaceV2` at `/encounters/{id}/v2` | Exact V2 file path not confirmed in the survey — locate before wiring |

## Candidates — legacy only (wire when that page gets its own V2 pass, not before)

| Area | File | Identity rendering site | `patientId` available? |
|---|---|---|---|
| Appointments | `resources/js/pages/appointments/Index.vue:2322` | `[firstName, middleName, lastName]` join | Yes — patient object |
| Emergency triage | `resources/js/pages/emergency-triage/Index.vue:414,641` | `patientName(summary)` on active-case context | Yes |
| Laboratory orders | `resources/js/pages/laboratory-orders/Index.vue:7253` (active-context header; worklist rows are grouped, no inline name) | `patientName(activePatientSummary)` | Yes — `LaboratoryOrder.patientId` |
| Radiology orders | `resources/js/pages/radiology-orders/Index.vue:709,4537` | Same active-context pattern | Yes |
| Pharmacy orders | `resources/js/pages/pharmacy-orders/Index.vue:6305,10401` | Same active-context pattern | Yes |
| Billing — main queue | `resources/js/pages/billing/Index.vue:983-991` | **Best candidate for a quick win** — `RegistryListRow`-shaped list, `entry.patientName`/`entry.patientId` directly on the row, structurally identical to `ReceptionQueueList.vue`'s already-wired pattern | Yes, directly on row |
| Billing — invoices | `resources/js/pages/billing/invoices/Index.vue` | Only form-level `patientId` (search/create forms), not a display row | Form-level only |
| Billing — cash, claims | `resources/js/pages/billing/cash/Index.vue`, `resources/js/pages/billing/components/ClaimsDashboard.vue` | Not inspected in depth — confirm before wiring | Unconfirmed |
| Encounters list | `resources/js/pages/encounters/List.vue:192` | `row.patientName`, new-convention page (no legacy predecessor) | Yes — `patientId` on `useEncounterList.ts`'s list-item type |
| Walk-in service requests | `resources/js/pages/walk-in-service-requests/Index.vue:252-276` | Custom `patientNames` cache keyed by id | Yes (already keyed by patientId) |
| Patient-flow board | `resources/js/components/patient-flow/VisitJourneyBoard.vue:80` | `entry.patientName`, new-convention (built this session) | Yes, nullable — same guard pattern as `ReceptionQueueList.vue` |
| Admissions | `resources/js/pages/admissions/Index.vue:2711,4386` | `patientName(summary)` pattern | Likely yes, unconfirmed field name |
| Inpatient ward | `resources/js/pages/inpatient-ward/RebuiltPage.vue:2817,2827,2898,3211` | `admission.patientName`, ward/bed board | Yes — `record.patientId` at line 758 |

## Shared components (not page-level — used by consumers above)

| Component | Notes |
|---|---|
| `resources/js/components/GlobalPatientSearch.vue:210-211` | Sets `patientId`/`patientName` on selection — could offer a summary preview inline in search results |
| `resources/js/components/patients/PatientLookupField.vue:597-711` | Hydrates full patient by id on selection — same opportunity |

## Separately flagged: reception check-in friction

Not a Patient Summary wiring task, but found while answering a related question — `reception/Queue.vue`'s "Check in a walk-in visit" search is genuinely the first check for new-vs-existing (see `Queue.vue:47-52`'s own reasoning), but a not-found result sends the receptionist away to `/patients` to register, then back to check in — a two-page round trip. `PatientRegistrationSheet.vue` already emits `@registered` with the new patient's data; it could be dropped into the "no matches" state of that search inline, auto-selecting the newly-registered patient straight into check-in with no navigation. Real, separate improvement — not done here.
