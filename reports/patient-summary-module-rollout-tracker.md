# Patient Summary Module — Rollout Tracker

A running checklist of where `PatientSummaryPopover.vue` / `PatientDetailSheet.vue` (`resources/js/components/patients/summary/`) should eventually get wired in. This is a reminder document, not a schedule — each row is real, separate work, done when that page's own V2 pass happens, not bundled into an unrelated change.

**How to wire a page in** (matching `IndexV2.vue`/`ReceptionQueueList.vue`'s precedent): wrap the patient-name element in `<PatientSummaryPopover :patient-id="x"><template #trigger>...</template><template #actions>...</template></PatientSummaryPopover>`. The Sheet tier (`PatientDetailSheet.vue`) comes for free — the popover owns that transition internally, no extra wiring needed. Requires a real `patientId` in scope at the render site; note where that isn't already the case below.

**When the trigger site is already inside another clickable container** (a row-level `<button>`/`CollapsibleTrigger` used for row-select or expand/collapse — the same problem `billing/Index.vue`'s `RegistryListRow` had): don't nest a real `<button>` inside it (invalid HTML, and it fights the outer element's own click handler). Use a `<span role="button" tabindex="0" @click.stop @keydown.enter.stop @keydown.space.stop.prevent>` as the popover's `#trigger` content instead — confirmed working (`PatientOrderGroupList.vue`'s `CollapsibleTrigger` header, `theatre-procedures/IndexV2.vue`'s row-click-opens-detail-sheet button).

## Done

| Page | File | Wired |
|---|---|---|
| Patients list | `resources/js/pages/patients/IndexV2.vue` | Table rows — patient name |
| Reception queue | `resources/js/components/reception/ReceptionQueueList.vue` (used by `pages/reception/Queue.vue`) | Queue card — patient name, guarded by nullable `entry.patientId` |
| Billing — main queue | `resources/js/pages/billing/Index.vue:983-1044` | `#actions` slot — small info-icon trigger, not the name label (see Update below) |
| Laboratory / Pharmacy / Radiology worklists | `resources/js/components/orders/PatientOrderGroupList.vue` (shared by `laboratory-orders/IndexV2.vue`, `pharmacy-orders/IndexV2.vue`, `radiology-orders/IndexV2.vue`) | Group header — patient name, wired once at the shared-component level so all three (and any future consumer) get it for free. Trigger is a `<span role="button">` inside the existing `CollapsibleTrigger`, `@click.stop` so the popover doesn't also toggle the group |
| Theatre worklist | `resources/js/pages/theatre-procedures/IndexV2.vue` | Row — patient name, guarded by `order.patientId`. This domain has no nested `patient` object (see the V2 build's own plan notes) so the row is flat, not grouped — same `<span role="button">` `@click.stop` technique, here to stop the row's own click-to-open-detail-sheet handler |

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

Not a Patient Summary wiring task, but found while answering a related question — `reception/Queue.vue`'s "Check in a walk-in visit" search is genuinely the first check for new-vs-existing (see `Queue.vue:47-52`'s own reasoning), but a not-found result sends the receptionist away to `/patients` to register, then back to check in — a two-page round trip. `PatientRegistrationSheet.vue` already emits `@registered` with the new patient's data; it could be dropped into the "no matches" state of that search inline, auto-selecting the newly-registered patient straight into check-in with no navigation.

**Update**: Fixed. `PatientRegistrationSheet.vue` is now mounted inline on `reception/Queue.vue`, opened from both "Add a new patient" and the "No matching patient. Register them first" empty state (gated on `patients.create`; falls back to the `/patients` link without that permission). Its `registered` event feeds straight into `selectedPatient` via the same `selectPatient()` the search results list already uses, so the receptionist lands back on the check-in form with the new patient pre-selected and can hit "Check in" immediately — one page, one flow, no round trip. 179/179 Vitest passing, no new TypeScript errors.

## Billing — main queue, wired

`billing/Index.vue`'s queue used `RegistryListRow` with `#title` slot content — unlike `ReceptionQueueList.vue`'s plain `<li>` rows, `RegistryListRow`'s custom-body branch (`canUseCustomSelect`) wraps the entire `#title`/`#meta` content in its own `<button>` for row-click-to-select (opens the master-detail billing panel). Nesting a `PatientSummaryPopover` trigger `<button>` inside that would be invalid HTML and would fight the row's own click handler, so the wiring pattern here differs from the "wrap the name" convention documented at the top of this file: the trigger is a small `info`-icon button placed in `#actions` (a DOM sibling of the row's select-button, not nested inside it — confirmed by reading `RegistryListRow.vue`'s template), next to the existing disclosure chevron. Clicking it opens the Popover without triggering row selection; the row's own click-to-select still works unchanged for reaching the full billing detail panel. 179/179 Vitest passing, no new TypeScript errors.
