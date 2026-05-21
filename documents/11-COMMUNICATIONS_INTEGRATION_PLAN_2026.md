# Communications Integration Plan 2026

## Afyanova AHS v2
## Date: 2026-05-15

## Purpose

This document is the master plan for adding a safe, modular communications system to the existing Laravel + Vue clinic and dispensary management platform.

It captures:

- what the project already has
- what is missing
- what must be built
- the safest architecture to use
- the exact implementation phases to follow
- the risks, controls, and rollout rules

The goal is to add:

- WhatsApp messaging
- SMS fallback
- automated appointment reminders
- patient feedback collection

without tightly coupling communication logic into the existing patient, appointment, pharmacy, or clinical workflow modules.

---

## Executive Summary

The current system is already structured in a modular way and is a strong candidate for a dedicated `Communication` module.

The safest path is:

1. create a new isolated backend module under `app/Modules/Communication`
2. create separate communication tables instead of modifying core patient and appointment tables heavily
3. create communication-specific routes, controllers, jobs, services, and webhook handlers
4. use queue-based delivery and webhook processing
5. read existing patient and appointment data through current repositories and scoped queries
6. avoid changing core appointment and patient workflows until the communication module is stable

For the first implementation, communication should be additive, not invasive.

---

## Scope

### In Scope

- outbound WhatsApp messaging
- outbound SMS messaging
- SMS fallback after WhatsApp delivery failure or policy-based downgrade
- manual staff-triggered messaging
- scheduled appointment reminders
- patient feedback request links
- patient communication consent and opt-in storage
- message logging and delivery auditability
- provider webhook intake
- queue-based background processing
- admin or staff-facing communication UI

### Out of Scope for Initial Rollout

- inbound clinical conversations becoming part of the medical record
- chatbot diagnosis or symptom triage
- free-text patient support inbox
- voice calls
- patient portal authentication
- deep edits to core appointment flow logic

---

## What We Have Today

## 1. Framework and Frontend Versions

- Laravel: `^12.0`
- PHP: `^8.2`
- Vue: `^3.5.13`
- Inertia: `@inertiajs/vue3 ^2.3.7`
- TypeScript: enabled
- Vite: `^7.0.4`
- Tailwind: `^4.1.1`

### Why this matters

This is a modern stack that already supports:

- modular service classes
- queue jobs
- clean JSON APIs
- typed frontend pages and components
- isolated feature modules

---

## 2. Current Backend Architecture

The system is already split into domain modules under:

`app/Modules/*`

Current modules include:

- `Admission`
- `Appointment`
- `Authentication`
- `Billing`
- `ClaimsInsurance`
- `Department`
- `EmergencyTriage`
- `InpatientWard`
- `InventoryProcurement`
- `Laboratory`
- `MedicalRecord`
- `Patient`
- `PatientVitals`
- `Pharmacy`
- `Platform`
- `Pos`
- `Radiology`
- `ServiceRequest`
- `Staff`
- `TheatreProcedure`

Each module follows a familiar structure:

- `Application`
- `Domain`
- `Infrastructure`
- `Presentation`

### Why this matters

This is the strongest reason to create a separate `Communication` module instead of embedding communication logic inside `PatientController`, `AppointmentController`, or other existing modules.

---

## 3. API Structure

Authenticated JSON APIs are mounted under:

`/api/v1`

The API stack currently uses:

- `web`
- `auth`
- platform scope resolution
- tenant isolation middleware
- facility entitlement middleware

The frontend uses a shared `apiClient` in:

`resources/js/lib/apiClient.ts`

That client already supports:

- session-authenticated requests
- CSRF handling
- `X-Idempotency-Key`
- `X-Request-Id`

### Why this matters

The communication module should reuse the current API conventions for internal staff actions.

However, provider webhooks must not be placed behind the authenticated `/api/v1` middleware stack.

---

## 4. Authentication and Security Model

Current authentication uses:

- Laravel Fortify
- session guard
- email verification
- password reset
- two-factor authentication

Authorization uses:

- custom roles
- custom permissions
- gate definitions
- facility subscription entitlement middleware

Users implement:

- `MustVerifyEmail`
- `Notifiable`

### Why this matters

Internal messaging tools should remain staff-authenticated and permission-protected.

Public webhook routes and public feedback routes must use signed tokens, secrets, and rate limits instead of normal staff authentication.

---

## 5. Queue and Background Processing

The current project already uses:

- `QUEUE_CONNECTION=database`
- `jobs`
- `failed_jobs`
- `job_batches`

Existing queue usage includes:

- `GenerateAuditExportCsvJob`

Existing scheduled commands already run from:

`routes/console.php`

Examples already in use:

- inventory expiry checks
- auto reorder
- retention cleanup commands

### Why this matters

The communications module should follow the same operational style:

- scheduled commands for scanning and enqueueing work
- queue jobs for external API calls
- fast webhook persistence followed by queued processing

Important note:

`config/queue.php` currently uses `after_commit => false`.

This means communication jobs must be dispatched carefully after successful transaction completion.

---

## 6. Existing Notifications and Integrations

Current notification-related code exists, but it is limited.

Current notifications:

- `UserEmailVerificationNotification`
- `UserCredentialLinkNotification`
- `InventoryExpiryAlertNotification`
- `AppointmentConsultationTakenOverNotification`

Current outbound channels observed:

- mail only

Current service configs observed:

- SMTP / mail
- SES
- Postmark
- Resend
- Slack notifications config

No current evidence of:

- WhatsApp integration
- SMS integration
- Twilio
- Africa's Talking
- Vonage / Nexmo
- public webhook processing
- communication consent storage
- patient feedback system

### Why this matters

We should not try to stretch the existing mail-focused notification layer into a full patient communications platform.

Patient communications need:

- consent rules
- provider abstractions
- message status tracking
- retry rules
- webhook receipts
- delivery and failure audit logs

---

## 7. Existing Patient Data Model

Current `patients` data already includes:

- patient number
- names
- gender
- date of birth
- phone
- email
- national ID
- country code
- region
- district
- address line
- next of kin contact
- status
- tenant scope

Patient-adjacent records already include:

- allergies
- medication profiles
- insurance records
- vital sets

### Important observations

- `phone` exists and is required on patient creation
- phone values are not guaranteed to be normalized to E.164 format
- there is no dedicated communication preference table
- there is no opt-in / opt-out record
- there is no destination verification workflow

### Why this matters

We should not overload `patients.phone` with consent or provider status fields.

Instead, patient communication preferences should be stored separately.

---

## 8. Existing Appointment and Workflow Model

Appointments already contain:

- patient linkage
- tenant and facility scope
- scheduled datetime
- department
- appointment type
- check-in timestamps
- triage fields
- provider queue status
- consultation ownership
- consultation type
- financial coverage

Appointment statuses include:

- `scheduled`
- `waiting_triage`
- `waiting_provider`
- `in_consultation`
- `completed`
- `cancelled`
- `no_show`

Additional related workflows already exist:

- appointment referrals
- admissions
- medical records
- pharmacy orders
- laboratory orders
- radiology orders
- theatre procedures
- walk-in service requests

### Why this matters

Appointment reminders and post-visit feedback are possible without changing the core appointment model.

The communication module can read appointment state and act on it externally.

---

## What We Need

## 1. New Domain Module

We need a new isolated backend module:

`app/Modules/Communication`

### Why

The existing project already uses module boundaries well. Matching that convention reduces future maintenance cost and makes the integration easy to disable or remove.

---

## 2. Communication Provider Abstractions

We need:

- `WhatsAppProviderInterface`
- `SmsProviderInterface`
- optional higher-level `CommunicationDispatchServiceInterface`

### Why

WhatsApp and SMS are related but not identical:

- delivery receipts differ
- payload formats differ
- failure semantics differ
- inbound webhook events differ

Keeping them separate avoids leaky abstractions while still allowing a higher-level channel router.

---

## 3. Patient Consent and Preference Storage

We need a dedicated preference model for:

- WhatsApp opt-in
- SMS opt-in
- email opt-in if needed later
- consent source
- consent timestamps
- destination verification status
- unsubscribe / stop handling

### Why

This keeps legal and operational communication state separate from demographic identity state.

---

## 4. Message Logging

We need a durable outbound log that records:

- who triggered the message
- why it was sent
- which patient and visit it related to
- which channel was requested
- which channel actually delivered
- provider IDs
- provider errors
- current status

### Why

Healthcare communication must be auditable, support troubleshooting, and avoid duplicate sends.

---

## 5. Webhook Processing

We need public inbound webhook endpoints for:

- WhatsApp delivery status
- SMS delivery status
- optional inbound reply tracking

### Why

The current authenticated API stack is not suitable for provider callbacks.

Webhook handlers must:

- verify signatures
- persist the raw event
- acknowledge quickly
- process asynchronously

---

## 6. Reminder Scheduling

We need scheduled reminder generation that scans appointments and queues eligible reminder jobs.

### Why

This is the safest way to add reminders without touching appointment creation or appointment status transitions during the first rollout.

---

## 7. Feedback Collection

We need a tokenized patient feedback flow that sends a secure link and stores structured responses.

### Why

Feedback should be lightweight and accessible without creating a patient account.

---

## Recommended Target Architecture

## Backend Folder Structure

```text
app/Modules/Communication/
  Application/
    Commands/
    Jobs/
    UseCases/
  Domain/
    Enums/
    Repositories/
    Services/
    ValueObjects/
  Infrastructure/
    Models/
    Repositories/
    Services/
  Presentation/
    Http/
      Controllers/
      Requests/
      Transformers/
```

## Frontend Folder Structure

```text
resources/js/pages/communications/
  Index.vue
  ManualMessaging.vue
  ReminderRuns.vue
  FeedbackRequests.vue
  Settings.vue

resources/js/pages/communications/feedback/
  Show.vue

resources/js/components/communications/
  MessageComposer.vue
  ConsentPanel.vue
  MessageLogTable.vue
  ReminderQueuePanel.vue
  FeedbackResponseForm.vue
  CommunicationStatusBadge.vue
```

## Supporting Files

```text
config/communications.php
routes/communications.php
routes/communications_public.php
tests/Feature/Communication/
tests/Unit/Communication/
tests/e2e/communications/
```

---

## Recommended Backend Components

## Services

- `CommunicationDispatchService`
- `WhatsAppDispatchService`
- `SmsDispatchService`
- `ReminderEligibilityService`
- `FeedbackLinkService`
- `ConsentPolicyService`
- `PhoneNormalizationService`
- `WebhookSignatureVerifier`

## Interfaces

- `WhatsAppProviderInterface`
- `SmsProviderInterface`
- `CommunicationMessageRepositoryInterface`
- `CommunicationAttemptRepositoryInterface`
- `PatientCommunicationPreferenceRepositoryInterface`
- `WebhookEventRepositoryInterface`
- `FeedbackRequestRepositoryInterface`
- `FeedbackResponseRepositoryInterface`

## Jobs

- `SendCommunicationMessageJob`
- `SendAppointmentReminderJob`
- `ProcessCommunicationWebhookJob`
- `ProcessCommunicationFallbackJob`
- `CreateFeedbackRequestJob`
- `ExpireFeedbackRequestsJob`

## Commands

- `communications:queue-appointment-reminders`
- `communications:expire-feedback-requests`
- `communications:retry-stuck-messages`

## Events and Listeners

Recommended for internal decoupling:

- `CommunicationMessageQueued`
- `CommunicationMessageDelivered`
- `CommunicationMessageFailed`
- `PatientFeedbackReceived`

Do not use events as the only persistence mechanism. Persist first, then emit events.

---

## Proposed Database Changes

## 1. `patient_communication_preferences`

Purpose:

- stores channel consent and destination metadata

Suggested fields:

- `id`
- `tenant_id`
- `facility_id`
- `patient_id`
- `channel` (`whatsapp`, `sms`, later `email`)
- `destination`
- `normalized_destination`
- `is_opted_in`
- `opted_in_at`
- `opted_out_at`
- `opt_in_source`
- `opt_out_reason`
- `is_verified`
- `verified_at`
- `metadata`
- timestamps

## 2. `communication_messages`

Purpose:

- one logical outbound communication record

Suggested fields:

- `id`
- `tenant_id`
- `facility_id`
- `patient_id`
- `appointment_id`
- `admission_id`
- `service_request_id`
- `feedback_request_id`
- `created_by_user_id`
- `message_purpose`
- `template_key`
- `channel_requested`
- `channel_used`
- `fallback_channel`
- `destination`
- `normalized_destination`
- `subject`
- `body_text`
- `body_payload`
- `status`
- `scheduled_for`
- `queued_at`
- `sent_at`
- `delivered_at`
- `failed_at`
- `cancelled_at`
- `provider_name`
- `provider_message_id`
- `dedupe_key`
- `error_code`
- `error_message`
- `metadata`
- timestamps

## 3. `communication_message_attempts`

Purpose:

- records each provider-level attempt

Suggested fields:

- `id`
- `communication_message_id`
- `provider_name`
- `channel`
- `attempt_number`
- `request_payload`
- `response_payload`
- `provider_message_id`
- `status`
- `error_code`
- `error_message`
- `sent_at`
- `delivered_at`
- `failed_at`
- timestamps

## 4. `communication_webhook_events`

Purpose:

- stores raw inbound provider callbacks

Suggested fields:

- `id`
- `provider_name`
- `channel`
- `provider_event_id`
- `event_type`
- `signature_valid`
- `headers_json`
- `payload_json`
- `received_at`
- `processed_at`
- `processing_status`
- `processing_error`
- timestamps

## 5. `feedback_requests`

Purpose:

- links a patient visit to a single feedback invitation

Suggested fields:

- `id`
- `tenant_id`
- `facility_id`
- `patient_id`
- `appointment_id`
- `communication_message_id`
- `token_hash`
- `status`
- `sent_at`
- `opened_at`
- `submitted_at`
- `expires_at`
- `metadata`
- timestamps

## 6. `feedback_responses`

Purpose:

- stores the actual patient response

Suggested fields:

- `id`
- `feedback_request_id`
- `rating`
- `comment`
- `sentiment`
- `needs_follow_up`
- `follow_up_reason`
- `submitted_ip`
- `submitted_user_agent`
- `submitted_at`
- timestamps

---

## Migration Examples

### Example 1: patient communication preferences

```php
Schema::create('patient_communication_preferences', function (Blueprint $table): void {
    $table->uuid('id')->primary();
    $table->uuid('tenant_id')->nullable()->index();
    $table->uuid('facility_id')->nullable()->index();
    $table->uuid('patient_id')->index();
    $table->string('channel', 20)->index();
    $table->string('destination', 80);
    $table->string('normalized_destination', 80)->index();
    $table->boolean('is_opted_in')->default(false)->index();
    $table->timestamp('opted_in_at')->nullable();
    $table->timestamp('opted_out_at')->nullable();
    $table->string('opt_in_source', 60)->nullable();
    $table->string('opt_out_reason', 255)->nullable();
    $table->boolean('is_verified')->default(false);
    $table->timestamp('verified_at')->nullable();
    $table->json('metadata')->nullable();
    $table->timestamps();
});
```

### Example 2: communication messages

```php
Schema::create('communication_messages', function (Blueprint $table): void {
    $table->uuid('id')->primary();
    $table->uuid('tenant_id')->nullable()->index();
    $table->uuid('facility_id')->nullable()->index();
    $table->uuid('patient_id')->index();
    $table->uuid('appointment_id')->nullable()->index();
    $table->uuid('admission_id')->nullable()->index();
    $table->uuid('service_request_id')->nullable()->index();
    $table->uuid('feedback_request_id')->nullable()->index();
    $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->string('message_purpose', 40)->index();
    $table->string('template_key', 80)->nullable()->index();
    $table->string('channel_requested', 20);
    $table->string('channel_used', 20)->nullable();
    $table->string('fallback_channel', 20)->nullable();
    $table->string('destination', 80);
    $table->string('normalized_destination', 80)->index();
    $table->string('subject', 255)->nullable();
    $table->text('body_text')->nullable();
    $table->json('body_payload')->nullable();
    $table->string('status', 30)->default('queued')->index();
    $table->timestamp('scheduled_for')->nullable()->index();
    $table->timestamp('queued_at')->nullable();
    $table->timestamp('sent_at')->nullable();
    $table->timestamp('delivered_at')->nullable();
    $table->timestamp('failed_at')->nullable();
    $table->string('provider_name', 40)->nullable()->index();
    $table->string('provider_message_id', 120)->nullable()->index();
    $table->string('dedupe_key', 120)->nullable()->index();
    $table->string('error_code', 80)->nullable();
    $table->text('error_message')->nullable();
    $table->json('metadata')->nullable();
    $table->timestamps();
});
```

---

## Proposed API Endpoints

## Internal Staff APIs

### Message Management

- `GET /api/v1/communications/messages`
- `POST /api/v1/communications/messages`
- `GET /api/v1/communications/messages/{id}`
- `POST /api/v1/communications/messages/{id}/retry`
- `POST /api/v1/communications/messages/{id}/cancel`

### Patient Preferences

- `GET /api/v1/communications/patients/{patientId}/preferences`
- `PATCH /api/v1/communications/patients/{patientId}/preferences`

### Reminders

- `GET /api/v1/communications/reminders/runs`
- `POST /api/v1/communications/reminders/dispatch-now`
- `GET /api/v1/communications/appointments/{appointmentId}/reminder-preview`

### Feedback Operations

- `GET /api/v1/communications/feedback-requests`
- `POST /api/v1/communications/feedback-requests/{id}/resend`
- `GET /api/v1/communications/feedback-responses`

## Public Endpoints

- `POST /webhooks/communications/whatsapp/{provider}`
- `POST /webhooks/communications/sms/{provider}`
- `GET /feedback/{token}`
- `POST /feedback/{token}`

---

## Webhook Structure Recommendation

## Route Separation

Use a dedicated public routes file such as:

- `routes/communications_public.php`

This should not sit under the existing authenticated API group.

## Webhook Processing Flow

1. receive request
2. verify provider signature
3. persist raw webhook event
4. return success response immediately
5. dispatch queue job to process the event
6. update `communication_messages` and `communication_message_attempts`

## Required Controls

- signature verification
- provider event idempotency
- replay resistance
- payload logging with masking where appropriate
- fast response to provider

---

## Queue and Job Recommendations

## Dedicated Queues

Recommended queue names:

- `communications-outbound`
- `communications-webhooks`
- `communications-feedback`

## Job Rules

- send jobs must run outside core DB transactions
- use stable dedupe keys for reminders
- store provider request and response metadata per attempt
- split scanning jobs from sending jobs

## Scheduled Commands

Recommended schedule:

- `communications:queue-appointment-reminders` every 5 minutes
- `communications:expire-feedback-requests` hourly
- `communications:retry-stuck-messages` every 15 minutes

## Reminder Queue Strategy

Use a scan-and-enqueue pattern:

1. scan eligible appointments
2. apply consent and channel rules
3. generate dedupe key
4. create `communication_messages` rows
5. dispatch outbound jobs

This is safer than injecting provider calls directly into `CreateAppointmentUseCase` or `UpdateAppointmentStatusUseCase`.

---

## Frontend Vue Work Needed

## New Pages

- `resources/js/pages/communications/Index.vue`
- `resources/js/pages/communications/ManualMessaging.vue`
- `resources/js/pages/communications/ReminderRuns.vue`
- `resources/js/pages/communications/FeedbackRequests.vue`
- `resources/js/pages/communications/Settings.vue`
- `resources/js/pages/communications/feedback/Show.vue`

## New Components

- `MessageComposer.vue`
- `ConsentPanel.vue`
- `MessageLogTable.vue`
- `ReminderQueuePanel.vue`
- `FeedbackResponseForm.vue`
- `CommunicationStatusBadge.vue`

## Reuse Existing Components

Reuse current UI patterns and lookup components such as:

- patient lookup fields
- searchable select fields
- sheet, dialog, tabs, tables, badges
- current `apiClient`

## What Not To Do

Do not embed full communication UI directly inside:

- `patients/Index.vue`
- `appointments/Index.vue`
- `pharmacy-orders/Index.vue`

At most, these pages may later show links, badges, or summaries.

---

## Environment Variables Needed

Recommended additions:

```env
COMMUNICATIONS_ENABLED=true
COMMUNICATIONS_MANUAL_MESSAGING_ENABLED=true
COMMUNICATIONS_REMINDERS_ENABLED=true
COMMUNICATIONS_FEEDBACK_ENABLED=true
COMMUNICATIONS_SMS_FALLBACK_ENABLED=true

COMMUNICATIONS_DEFAULT_COUNTRY_CODE=255
COMMUNICATIONS_APPOINTMENT_REMINDER_LEAD_MINUTES=1440
COMMUNICATIONS_FEEDBACK_REQUEST_DELAY_MINUTES=180
COMMUNICATIONS_FEEDBACK_TOKEN_TTL_HOURS=168

COMMUNICATIONS_QUEUE=communications-outbound
COMMUNICATIONS_WEBHOOK_QUEUE=communications-webhooks
COMMUNICATIONS_FEEDBACK_QUEUE=communications-feedback

WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_WEBHOOK_SECRET=
WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER=
WHATSAPP_TEMPLATE_FEEDBACK_REQUEST=

SMS_PROVIDER=africastalking
SMS_API_KEY=
SMS_API_SECRET=
SMS_FROM=
SMS_WEBHOOK_SECRET=
SMS_TEMPLATE_APPOINTMENT_REMINDER=
SMS_TEMPLATE_FEEDBACK_REQUEST=
```

Optional later:

```env
COMMUNICATIONS_LOG_RAW_PROVIDER_PAYLOADS=false
COMMUNICATIONS_MASK_DESTINATIONS_IN_UI=true
COMMUNICATIONS_RATE_LIMIT_MANUAL_SEND_PER_MINUTE=10
COMMUNICATIONS_RATE_LIMIT_WEBHOOK_PER_MINUTE=300
```

---

## Security Concerns

## 1. PHI Leakage

Risk:

- message text may expose sensitive clinical details

Control:

- keep reminders generic
- never include diagnosis, medication, lab result, or claims details in SMS or WhatsApp by default

## 2. Bad Phone Data

Risk:

- current patient phone values may not be normalized

Control:

- normalize before send
- store normalized destination separately
- fail safely if destination cannot be normalized

## 3. Missing Consent

Risk:

- sending to patients without recorded permission

Control:

- block outbound messaging unless channel consent is present
- maintain opt-in and opt-out timestamps

## 4. Webhook Forgery

Risk:

- fake delivery callbacks could corrupt message status

Control:

- verify webhook signatures
- use provider event idempotency keys
- queue post-processing only after validation

## 5. Duplicate Sends

Risk:

- scheduled scans may enqueue repeated reminders

Control:

- use dedupe keys like `appointment_id + template + reminder window`
- unique DB constraint where appropriate

## 6. Cross-Tenant Leakage

Risk:

- wrong facility or tenant data used during send

Control:

- all communication records must carry tenant and facility context
- all repository reads must apply the same platform scope patterns used elsewhere

## 7. Public Feedback Abuse

Risk:

- token guessing or spam submissions

Control:

- use strong random tokens
- store token hashes, not raw tokens
- expire links
- rate limit public endpoints

---

## Rate Limiting Recommendations

## Internal Staff APIs

- manual send create endpoint: `10/minute/user`
- retry endpoint: `10/minute/user`
- bulk reminder dispatch endpoint: `5/minute/user`

## Public Webhooks

- WhatsApp webhook: `300/minute/route` minimum
- SMS webhook: `300/minute/route` minimum

## Public Feedback Routes

- feedback form GET: `60/minute/ip`
- feedback submit POST: `10/minute/token`

## Why

Current project already uses explicit rate limiting in Fortify and selected routes. The communication module should follow the same pattern instead of leaving public routes unbounded.

---

## Testing Strategy

## Feature Tests

Create:

- `tests/Feature/Communication/CommunicationMessageApiTest.php`
- `tests/Feature/Communication/CommunicationConsentApiTest.php`
- `tests/Feature/Communication/AppointmentReminderCommandTest.php`
- `tests/Feature/Communication/CommunicationWebhookTest.php`
- `tests/Feature/Communication/FeedbackFlowTest.php`

Test coverage should include:

- permissions
- facility entitlement checks
- tenant and facility scope
- consent required before send
- reminder eligibility rules
- dedupe behavior
- fallback behavior
- webhook signature validation
- webhook idempotency
- feedback token expiry

## Unit Tests

Create tests for:

- phone normalization
- message routing policy
- fallback decision rules
- reminder window logic
- consent policy decisions
- feedback token generation and hashing

## Queue Tests

Use queue fakes and provider fakes to verify:

- jobs are dispatched
- retries happen correctly
- failures update logs properly

## E2E Tests

Create UI coverage for:

- manual staff messaging
- preference management
- feedback public form submission

---

## Recommended Implementation Phases

## Phase 0 - Foundation and Guardrails

### Goal

Create isolated module structure and storage model without affecting live workflows.

### Steps

1. create `Communication` backend module skeleton
2. create configuration file
3. create communication database tables
4. create internal routes and public routes
5. create provider interfaces and fake provider implementations
6. create phone normalization service
7. create consent policy service
8. add permissions for communication access

### Exit Criteria

- module compiles
- migrations run
- no existing workflow changed
- feature tests for base APIs pass

---

## Phase 1 - Manual Messaging

### Goal

Allow authorized staff to send individual WhatsApp or SMS messages manually.

### What We Build

- message composer UI
- preference and consent UI
- outbound job
- message logs
- attempt logs
- provider abstraction

### Steps

1. build staff messaging APIs
2. build Vue communication page
3. add message creation and queue dispatch
4. log outbound attempts
5. add masking rules for destinations in UI
6. add retry flow

### Exit Criteria

- staff can send manual messages
- messages respect consent
- all messages are logged
- failures are visible and retryable

---

## Phase 2 - Automated Appointment Reminders

### Goal

Send reminders for eligible upcoming appointments using scheduled background processing.

### What We Build

- reminder eligibility service
- reminder scanning command
- reminder queue jobs
- reminder preview API

### Steps

1. define reminder window policy
2. scan appointments by scope and status
3. filter out cancelled, completed, or no-show appointments
4. filter out missing consent or invalid destinations
5. create dedupe keys
6. queue messages

### Exit Criteria

- eligible appointments are reminded once per defined policy
- no duplicate reminders within the same reminder window
- no modification to appointment core use cases required

---

## Phase 3 - WhatsApp with SMS Fallback

### Goal

Use WhatsApp as the primary channel and SMS as a fallback when appropriate.

### What We Build

- fallback policy engine
- failure classification logic
- follow-up fallback job

### Fallback Triggers

- WhatsApp hard failure
- WhatsApp not deliverable for destination
- provider timeout after configured threshold
- patient not opted in to WhatsApp but opted in to SMS

### Exit Criteria

- channel fallback is logged clearly
- logical message record remains single
- attempt records show both WhatsApp and SMS attempts

---

## Phase 4 - Patient Feedback Automation

### Goal

Send tokenized post-visit feedback requests and store structured responses.

### What We Build

- feedback request generator
- public feedback page
- feedback response storage
- simple review dashboard

### Suggested Trigger

Feedback request should be generated only after:

- appointment status is `completed`
- patient has valid consent
- destination is valid

For safety, use a scheduled scan first instead of wiring directly into appointment completion logic.

### Exit Criteria

- patients receive secure feedback links
- responses can be stored without account login
- low ratings can be surfaced for staff follow-up

---

## Rollout Rules

## Rule 1

Do not inject provider API calls directly into:

- `CreatePatientUseCase`
- `UpdatePatientUseCase`
- `CreateAppointmentUseCase`
- `UpdateAppointmentStatusUseCase`
- pharmacy, laboratory, or radiology ordering flows

## Rule 2

All outbound communication should be asynchronous.

## Rule 3

All public callbacks must be isolated from staff-authenticated API middleware.

## Rule 4

All communication behavior must be feature-flag or config-toggle controllable.

## Rule 5

All communication records must be removable by disabling the module, not by altering core tables.

---

## Disable and Rollback Strategy

The module should be easy to disable by:

- turning off communication config flags
- removing communication routes
- stopping communication queue workers
- disabling reminder schedule commands

Because the data model is isolated, removing the module does not require reverting patient or appointment business logic.

---

## What Must Not Be Changed Early

Avoid early changes to:

- patient creation flow
- appointment creation flow
- appointment status transitions
- pharmacy clinical workflow
- laboratory clinical workflow
- medical record authoring

The communication module should observe these workflows first, not control them.

---

## Final Build Order Checklist

## Step 1

Create the `Communication` module skeleton.

## Step 2

Add migrations for:

- patient communication preferences
- communication messages
- communication message attempts
- communication webhook events
- feedback requests
- feedback responses

## Step 3

Add provider interfaces and fake adapters.

## Step 4

Add internal staff APIs and public webhook routes.

## Step 5

Build manual messaging UI.

## Step 6

Add reminder scanning command and outbound reminder jobs.

## Step 7

Add WhatsApp primary with SMS fallback logic.

## Step 8

Add feedback request generation and public feedback page.

## Step 9

Add tests across feature, unit, queue, and UI layers.

## Step 10

Roll out behind config toggles and phased enablement.

---

## Recommended Immediate Next Action

Start with Phase 0 and Phase 1 only.

That means:

- create isolated communication storage
- create provider abstractions
- create manual staff messaging
- defer automated reminders and feedback until logs, consent, and webhook handling are stable

This is the lowest-risk path and best matches the current project architecture.
