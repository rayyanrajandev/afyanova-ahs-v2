# Clinician Workflow Actions Reference

**Document type**: Action-by-action reference, written alongside the terminology and ownership-enforcement fixes it documents (see the corresponding session plan). Covers every workflow-state-changing button across Reception → Triage → Clinician → Encounter Workspace → Referral sheet — what each one mutates, who may perform it, whether confirmation is required, and the resulting state. Written because several of these actions previously shared ambiguous labels (four different "Complete" buttons touching four different entities) and two had no ownership check at all, letting a user with only front-desk permissions alter another clinician's active consultation.

**How to read "Permission type"**: most actions are gated by a plain, grantable Spatie permission (`user.can('x.y')`). A few are `Gate::define()` closures in `app/Providers/AppServiceProvider.php` with real business logic beyond a yes/no permission check (role/staff-profile inspection, ownership, draft authorship) — these are marked **Gate (logic)** below, since granting the underlying permission string alone is not sufficient to pass them.

---

## 1. Reception Queue (`resources/js/pages/reception/Queue.vue`)

| Label | What it does | Entity / column changed | Available when | Who may perform it | Confirmation | Resulting state |
|---|---|---|---|---|---|---|
| **Start visit** | Registers/checks in a patient and opens (or reuses) their `Encounter` for today | `Appointment.status: scheduled → waiting_triage`; `Encounter` created if none exists | Patient selected, walk-in or scheduled visit type chosen | `appointments.create` **and** `appointments.update-status` | No | Patient enters the triage queue |
| **Add Direct service request** | Creates a standalone `ServiceRequest` not tied to a full visit (e.g. a lab-only walk-in) | `ServiceRequest` created | `direct_service` visit type selected | `service.requests.create` | No | Appears on the relevant department's own worklist |
| **Register patient** | Creates a new `Patient` record | `Patient` created | Always (via sheet) | `patients.create` | No | Patient searchable for future visits |

Reception's queue is otherwise read-only (live triage/provider queue counts) — no Cancel/Complete actions live here.

---

## 2. Triage Queue (`resources/js/pages/triage/Queue.vue`)

| Label | What it does | Entity / column changed | Available when | Who may perform it | Confirmation | Resulting state |
|---|---|---|---|---|---|---|
| **Claim** | Marks the current nurse as the exclusive triage owner of this visit | `Appointment.triage_owner_user_id = actor` | `status = waiting_triage`, unclaimed | `appointments.record-triage` (**Gate — checks role/staff-profile for a triage-eligible title**, not a plain permission) | No | Entry shows "Claimed by \[you\]"; other nurses see "Claimed by \[name\]" |
| **Release** | Gives up triage ownership without recording triage | `Appointment.triage_owner_user_id = null` | Claimed by the current user | Same as Claim | No | Entry returns to unclaimed |
| **Record triage** | Opens the vitals/notes/routing form; on submit, hands the visit to the provider queue | `Appointment.status: waiting_triage → waiting_provider`, vitals/notes/routing written | `appointments.record-triage` (**Gate**) | Same as Claim | No (form submit) | Visit appears in the clinician queue |
| **Cancel visit** | Cancels the appointment entirely | `Appointment.status → cancelled`, reason recorded | Any non-terminal status, `appointments.update-status` held | `appointments.update-status` (plain permission) | Yes — reason required (`AppointmentClosureDialog`) | Visit removed from all active queues |
| **Completed tab** | Read-only list of today's triaged visits | — | — | `appointments.read` | — | — |

**Ownership gap, not fixed in this pass**: triage-claim exclusivity (`triage_owner_user_id`) is advisory only — `Record triage` does not currently re-check that the submitting user is still the claimed owner at submit time. See §7 below.

---

## 3. Clinician Queue (`resources/js/pages/clinician/Queue.vue`)

| Label | What it does | Entity / column changed | Available when | Who may perform it | Confirmation | Resulting state |
|---|---|---|---|---|---|---|
| **Start consultation** | Begins the consultation and claims ownership | `Appointment.status: waiting_provider → in_consultation`, `consultation_owner_user_id = actor`, `consultation_started_at` set | `status = waiting_provider`, never yet started | `appointments.start-consultation` (**Gate — provider-keyword staff profile or `CLINICAL.PHYSICIAN`/`CLINICAL.GENERAL` role**) | No | Encounter workspace opens automatically |
| **Resume consultation** | Re-enters an in-progress consultation the same clinician previously put on hold | `Appointment.status: waiting_provider → in_consultation` (same owner) | `status = waiting_provider`, `consultation_started_at` already set (was on hold) | Same as Start consultation | No | Encounter workspace opens |
| **Claim** | Takes ownership of an `in_consultation` visit with no explicit owner (legacy/orphaned session) | `consultation_owner_user_id = actor` | `status = in_consultation`, no owner assigned | Same as Start consultation | No | Visit now owned by the claiming clinician |
| **Take over** | Reassigns an active consultation from another clinician to the current one, after explicit confirmation | `consultation_owner_user_id = actor`, `consultation_takeover_count += 1`; previous owner notified by email | `status = in_consultation`, owned by someone else | Same as Start consultation | Yes — `TakeoverConsultationDialog`, reason optional | Previous owner loses write access to this consultation |
| **Open clinical workspace** | Navigates to the Encounter Workspace for an already-active, self-owned consultation. Does **not** change any status — pure navigation | none | `status = in_consultation`, owned by current user | Same as Start consultation | No | Opens `encounters/{id}` |
| **Hold** | Releases the consultation back to the provider queue without closing it, preserving `consultation_started_at` so it shows as "on hold" rather than "never seen" | `Appointment.status: in_consultation → waiting_provider`, `consultation_owner_user_id = null` | `status = in_consultation`, owned by current user | `appointments.manage-provider-session` (**Gate**) | No | Visit reappears in the provider queue as resumable |
| **Send to triage** | Sends the visit back to the triage queue (e.g. vitals need repeating) | `Appointment.status: in_consultation → waiting_triage`, reason required | Same as Hold | Same as Hold | Yes — `SendToTriageDialog`, reason required | Visit reappears in the triage queue |
| **Complete visit** | Marks the visit itself (not the note) as finished | `Appointment.status: in_consultation → completed` | Same as Hold, **and** the linked consultation note must be finalized or amended (not draft) | Same as Hold | No | Visit leaves all active queues |
| **Referrals** | Opens the referral management sheet for this visit (see §5) | none directly | `status = in_consultation` | `appointments.manage-referrals` (plain permission, independent of consultation ownership) | No | Sheet opens |
| **Cancel visit** | Cancels the appointment | `Appointment.status → cancelled`, reason recorded | Any non-terminal status | `appointments.update-status` (plain permission) | Yes — reason required | Visit removed from all active queues |

**Fixed this pass**: `Complete visit`/`Cancel visit`/any other transition reachable via the generic `PATCH /appointments/{id}/status` endpoint is now blocked with `409 CONSULTATION_OWNER_REQUIRED` when the visit is `in_consultation` and the actor is neither the resolved consultation owner nor a facility super admin — previously a user holding only `appointments.update-status` (e.g. front desk) could cancel or force-complete another clinician's active consultation through this endpoint, bypassing both ownership and the finalized-note requirement that `Hold`/`Complete` on this page already enforced. See `app/Modules/Appointment/Application/UseCases/UpdateAppointmentStatusUseCase.php`.

---

## 4. Encounter Workspace (`resources/js/pages/encounters/WorkspaceV2.vue`)

| Label | What it does | Entity / column changed | Available when | Who may perform it | Confirmation | Resulting state |
|---|---|---|---|---|---|---|
| **Save draft** (note composer) | Saves the consultation note in progress | `MedicalRecord.status = draft` | Note not yet finalized | `medical.records.create`, and if editing someone else's draft: `medical-records.update-draft` (**Gate — draft authorship check**) | No | Note persists as draft |
| **Finalize** (note composer) | Signs the note, locking it from further plain edits | `MedicalRecord.status → finalized`; `Encounter.status` syncs to `signed`; diagnosis synced to `Encounter` diagnoses list | Draft note with required fields present | `medical.records.finalize` | No (form submit) | Note becomes read-only except via Amend |
| **Amend** (note composer) | Reopens a finalized note for correction, preserving the original as history | `MedicalRecord.status → amended`; `Encounter.status` syncs to `amended` | Note is finalized | `medical.records.amend` | No (form submit) | Note editable again, audit trail preserved |
| **Close encounter** | Closes the encounter's documentation lifecycle; when linked to an appointment and the actor can manage provider sessions, also completes that appointment as a side effect | `Encounter.status → closed`, `closed_at` set, disposition recorded; **also** `Appointment.status → completed` (via a second, separate API call) | Note is `finalized`/`amended`, not already closed | `medical.records.finalize`; disposition required; if close-readiness has unresolved warnings, a meaningful (≥10 char, non-placeholder) reason is required to acknowledge them | Yes — `EncounterCloseChecklistDialog`, disposition + reason | Encounter locked; if an appointment was linked, it also moves to `completed` (reported as a separate outcome if that half fails) |

**Fixed this pass**: `Close encounter` (and the `reopen`/`in_progress` transition it shares an endpoint with — see below) is now blocked with `409 ENCOUNTER_OWNER_REQUIRED` when the encounter has a `primary_clinician_user_id` set to someone other than the actor, unless the actor is a facility super admin. Previously any user holding `medical.records.finalize`/`medical.records.amend` could close or reopen an encounter primarily assigned to a different clinician. See `app/Modules/Encounter/Application/Services/EncounterLifecycleService.php::assertEncounterOwnership()`.

**Not yet exposed in the UI**: the backend supports reopening a closed encounter (`PATCH /encounters/{id}/status` with `status: reopened` or `in_progress`, which sets `Encounter.status → in_progress` and reassigns `primary_clinician_user_id` to whoever reopens it) — this is now ownership-protected identically to Close, but there is currently no button anywhere in the frontend that calls it. Worth noting for future work: reopening is not currently reachable outside direct API use.

**Naming note**: "Close encounter" here is unambiguous by itself — the corresponding *trigger button* ambiguity the user originally flagged was "Open chart," which has been renamed to **Open clinical workspace** (§3), not this button.

---

## 5. Referral Management Sheet (`resources/js/components/clinician/ReferralManagementSheet.vue`)

Distinct entity: `AppointmentReferral`, not the `Appointment`/`Encounter` itself.

| Label | What it does | Entity / column changed | Available when | Who may perform it | Confirmation | Resulting state |
|---|---|---|---|---|---|---|
| **Accept** | Accepts an inbound referral | `Referral.status: requested → accepted` | `status = requested` | `appointments.manage-referrals` | No | Referral moves to accepted |
| **Reject** | Declines an inbound referral | `Referral.status: requested → rejected`, reason required | `status = requested` | Same | Yes — reason required | Referral closed as rejected |
| **Cancel referral** | Cancels a referral before or during handoff | `Referral.status → cancelled`, reason required | `status = requested` or `accepted` | Same | Yes — reason required | Referral closed as cancelled |
| **Start handoff** | Begins the physical/clinical handoff to the receiving party | `Referral.status: accepted → in_progress` | `status = accepted` | Same | No | Referral marked in progress |
| **Complete referral** | Marks the referral as fulfilled | `Referral.status: in_progress → completed` | `status = in_progress` | Same | No | Referral closed as completed |

**Ownership gap, not fixed in this pass**: referral status transitions are gated only by the plain `appointments.manage-referrals` permission — there is no check that the acting user is the referral's creator, the receiving clinician, or otherwise specifically responsible for it. Any user with that permission can Accept/Reject/Cancel/Complete any referral in scope. See §7.

---

## 6. Terminology renamed in this pass

| Old label | New label | Where | Why |
|---|---|---|---|
| Open chart | **Open clinical workspace** | Clinician Queue | "Chart" implies the full longitudinal record; this button opens the current encounter's documentation workspace, a narrower and more specific target — matches the user's own suggested EHR terminology |
| Complete (visit-level) | **Complete visit** | Clinician Queue | Disambiguates from the referral sheet's "Complete referral" and triage's "Complete triage" wording elsewhere in the same patient journey |
| Cancel (visit-level) | **Cancel visit** | Clinician Queue, Triage Queue | Disambiguates from the referral sheet's "Cancel referral" |
| Complete (referral) | **Complete referral** | Referral sheet | Disambiguates from the visit-level "Complete visit" one screen away |
| Cancel (referral) | **Cancel referral** | Referral sheet | Disambiguates from the visit-level "Cancel visit" |

`AppointmentClosureDialog.vue`'s own copy ("Cancel appointment" title) was already unambiguous and was left unchanged.

---

## 7. Known gaps, documented but not fixed in this pass

Surfaced during this review; the user's confirmed fixes for this pass were specifically the Appointment generic-status-endpoint gap and the Encounter close/reopen gap (both above, both fixed). These two remain open:

1. **Referral ownership** (§5): no check ties Accept/Reject/Cancel/Start handoff/Complete to a specific responsible user — any holder of `appointments.manage-referrals` can act on any referral in scope.
2. **Triage claim exclusivity is advisory only** (§2): `Claim`/`Release` set `triage_owner_user_id`, but `Record triage` does not re-verify the submitting user still holds the claim at submit time — a second nurse with `appointments.record-triage` could submit triage for a visit claimed by someone else.

Both would follow the same pattern already established for Appointment/Encounter ownership (`resolvedConsultationOwnerUserId`-style resolution, a dedicated conflict exception, a 409 response, facility-super-admin bypass) if picked up in a future pass.
