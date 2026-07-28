# Direct Service Request Items Plan

## Problem

The `PatientDirectServiceDialog` only captures a generic `serviceType` (`laboratory`, `pharmacy`, `radiology`, etc.) with no specifics. When a receptionist sends a patient to "lab for HIV rapid test", the system loses what test is needed. The receiving department must create an order from scratch — duplicate work and lost context.

## Solution Overview

Allow the ticket creator to pick specific items (tests, medications, procedures) at creation time. The queue displays these items. When the department staff accepts, the system auto-creates the clinical orders from the ticket items. No second creation step.

Billing flows naturally from this: auto-created clinical orders become **charge capture candidates** via the existing `ListBillingChargeCaptureCandidatesUseCase`, exactly as if they were created manually. No new billing pipeline needed for phase 1.

## Architecture Audit Findings

Before design, these architectural facts were confirmed:

| Aspect | Status |
|---|---|
| `requested_by_user_id` / `requested_at` on `service_requests` | **Already exist** — populated by `CreateServiceRequestUseCase` |
| `service_request_id` on order tables | **Does not exist** — current link is reversed via `linked_order_*` columns on `service_requests` |
| `service_request_item_id` anywhere | **Does not exist anywhere** — needs new migration + model updates |
| Audit system | Dedicated `service_request_audit_events` table with `AppendServiceRequestAuditEventUseCase` — no item-level audit |
| Queue jobs in ServiceRequest module | **None** — fully synchronous. App uses `database` queue driver; other modules have `ShouldQueue` jobs |
| Department ↔ Catalog | `platform_clinical_catalog_items` has `department_id` FK but no Eloquent relationship. Catalog is unified with `catalog_type` discriminator (`lab_test`, `medicine`, `radiology_procedure`) |
| Eager loading | Only `department:id,code,name,service_type` is eager-loaded |

## Data Model

```
service_request_items
├── id (uuid, PK)
├── service_request_id (uuid, FK → service_requests.id)
├── service_type (string: laboratory|pharmacy|radiology|theatre_procedure|clinical_procedure)
├── catalog_item_id (uuid, nullable — FK → platform_clinical_catalog_items.id)
├── item_name (string — denormalized display name)
├── item_code (string, nullable — denormalized code)
├── quantity (int, default 1)
├── status (string: pending|processing|ordered|completed|failed|cancelled, default 'pending')
├── clinical_indication (text, nullable — optional clinical context for the item)
├── instructions (text, nullable — optional processing/admin instructions)
├── requested_by_user_id (int, nullable — FK → users.id, who requested this item)
├── requested_at (timestamp, nullable — when this item was requested)
├── sort_order (int, default 0)
├── ordered_at (timestamp, nullable — when the order was fulfilled)
├── completed_at (timestamp, nullable — when the underlying service finished)
├── failed_at (timestamp, nullable — when fulfillment failed)
├── cancelled_at (timestamp, nullable — when the item was cancelled)
├── failure_reason (text, nullable — reason for failed status)
└── created_at / updated_at
```

Items are stored **denormalized** (no polymorphic FK to 5 different catalog tables) so the queue can display them without joins to domain-specific catalogs. The `catalog_item_id` is optional — it enables auto-fulfillment for known catalog items.

No `unit_price` on items — prices are computed when needed via the billing pipeline's existing pricing resolver, avoiding staleness and keeping the service request layer decoupled from billing.

No `total_estimated` or `billing_status` on `service_requests` — billing state is tracked implicitly through the item-level status and the linked clinical orders' charge capture pipeline. The frontend can compute totals from the billing module when needed.

### Order table additions

Each order table gets a new nullable FK:

**`laboratory_orders`**:
```
├── service_request_item_id (uuid, nullable — FK → service_request_items.id, new)
```

**`pharmacy_orders`**:
```
├── service_request_item_id (uuid, nullable — FK → service_request_items.id, new)
```

**`radiology_orders`**:
```
├── service_request_item_id (uuid, nullable — FK → service_request_items.id, new)
```

This creates a direct link from each clinical order back to its originating item, enabling:
- Easy lookup of which item triggered which order
- Item status updates when the order status changes
- Clean roll-up queries for the queue and billing

## New Files

### 1. Database Migration

**`database/migrations/YYYY_MM_DD_HHMMSS_create_service_request_items_table.php`**

Create `service_request_items` table with the schema above. Add `service_request_id` index + FK.

### 2. Domain Value Object

**`app/Modules/ServiceRequest/Domain/ValueObjects/ServiceRequestItemType.php`**

Enum mapping service types to their order creation use case + catalog source:
```php
enum ServiceRequestItemType: string
{
    case LABORATORY_TEST = 'laboratory_test';
    case PHARMACY_MEDICATION = 'pharmacy_medication';
    case RADIOLOGY_STUDY = 'radiology_study';
    case THEATRE_PROCEDURE = 'theatre_procedure';
    case CLINICAL_PROCEDURE = 'clinical_procedure';
}
```

### 3. Eloquent Model

**`app/Modules/ServiceRequest/Infrastructure/Models/ServiceRequestItemModel.php`**

Standard Eloquent model, `HasUuids`, `belongsTo ServiceRequestModel`.

### 4. Repository Interface

**`app/Modules/ServiceRequest/Domain/Repositories/ServiceRequestItemRepositoryInterface.php`**

```php
interface ServiceRequestItemRepositoryInterface
{
    /** @param array<int, array<string, mixed>> $items */
    public function createMany(string $serviceRequestId, array $items): void;
    public function findByServiceRequestId(string $serviceRequestId): array;
    public function deleteByServiceRequestId(string $serviceRequestId): void;
}
```

### 5. Eloquent Repository

**`app/Modules/ServiceRequest/Infrastructure/Repositories/EloquentServiceRequestItemRepository.php`**

Standard Eloquent implementation.

### 6. Fulfillment Coordinator (Queued Jobs)

**`app/Modules/ServiceRequest/Application/UseCases/FulfillServiceRequestItemsUseCase.php`**

This use case acts as a **coordinator**, not a monolithic switch. On accept (`in_progress`), it iterates items and **dispatches queued jobs** per item. Each item transitions to `processing` immediately to prevent re-dispatch.

```
FulfillServiceRequestItemsUseCase
  └─ for each item with status=pending:
       1. Update item status → processing
       2. Dispatch queued job:
            ├─ FulfillLaboratoryServiceRequestItemJob → creates lab order
            ├─ FulfillPharmacyServiceRequestItemJob → creates pharmacy order
            └─ FulfillRadiologyServiceRequestItemJob → creates radiology order
```

**Queued jobs** (new files, each implements `ShouldQueue`):
- `app/Modules/Laboratory/Application/Jobs/FulfillLaboratoryServiceRequestItemJob.php`
- `app/Modules/Pharmacy/Application/Jobs/FulfillPharmacyServiceRequestItemJob.php`
- `app/Modules/Radiology/Application/Jobs/FulfillRadiologyServiceRequestItemJob.php`

Each job:
1. **Idempotency guard**: Re-checks item status — skip if already `ordered`/`completed`/`cancelled`
2. Creates the clinical order via the module's existing use case, setting `service_request_item_id` on the order
3. On success: item status → `ordered`, `ordered_at` = now, appends audit event
4. On failure: item status → `failed`, `failed_at` = now, `failure_reason` = error message, appends audit event

**Why queued jobs over synchronous event handlers:**
- Accept operation returns instantly — no UI delay while orders are created
- Automatic retry on failure (Laravel queue retries)
- Each item's fulfillment is isolated — one failure doesn't block others
- Compatible with app's existing `database` queue driver

**No auto-complete**: The ticket status is **not** changed when orders are created. The ticket completes only when **all** items reach `completed` or `cancelled` status — i.e., after the underlying service is finished, not when the order is placed.

Items with no `catalog_item_id` skip auto-fulfillment and remain `pending` for manual order creation via the existing workflow.

### 6a. Item Audit Events

Extend the existing `service_request_audit_events` table with an optional `service_request_item_id`:

**Migration**: `database/migrations/YYYY_MM_DD_HHMMSS_add_item_id_to_service_request_audit_events.php`
```php
Schema::table('service_request_audit_events', function (Blueprint $table): void {
    $table->uuid('service_request_item_id')->nullable()->after('service_request_id');
    $table->foreign('service_request_item_id')->references('id')->on('service_request_items')->nullOnDelete();
    $table->index('service_request_item_id');
});
```

New audit actions for items:
- `service_request_item.fulfillment_started` — when queued job begins (status → `processing`)
- `service_request_item.ordered` — when order is created (status → `ordered`)
- `service_request_item.completed` — when underlying service finishes (status → `completed`)
- `service_request_item.failed` — when fulfillment fails (status → `failed`)
- `service_request_item.cancelled` — when item is cancelled (status → `cancelled`)

The existing `AppendServiceRequestAuditEventUseCase` is reused — its payload is extended to accept optional `service_request_item_id`.

### 7. Frontend — Item Selector Component

**`resources/js/components/directService/ServiceRequestItemSelector.vue`**

Props: `departmentId` (which department's catalog to query), `modelValue` (selected items array).

When `departmentId` changes, fetches the catalog items for that department via:
```
GET /platform/catalog/by-department/{departmentId}?status=active
```

This queries `platform_clinical_catalog_items WHERE department_id = ? AND status = 'active'`, returning items with their `catalog_type` (which determines `service_type` routing). The `service_type` on each item is derived from the catalog item's `catalog_type` field.

**Difference from original plan**: Previously, `serviceType` drove catalog selection (e.g., "laboratory" → `fetchLabTestCatalog()`). Now `departmentId` drives it — the department IS the catalog namespace. The `service_type` is still stored on each item for fulfillment routing, but it's derived from the department/catalog rather than selected independently.

Displays a searchable multi-select of catalog items. Each selection adds an item with `catalogItemId`, `itemName`, `itemCode`, and `serviceType` (derived from catalog item's `catalog_type`).

**New API endpoint**: `GET /platform/catalog/by-department/{departmentId}` (or existing catalog search with `department_id` filter).

**Updated composable**: `useServiceRequestItemCatalog.ts`
- Input changes from `serviceType` to `departmentId`
- Fetches catalog items by department

### 8. Frontend — Item List Display

**`resources/js/components/directService/ServiceRequestItemList.vue`**

Props: `items` (array of items). Displays them as a compact list of badges/text on the queue card row.

### 9. Frontend — Catalog Composable

**`resources/js/composables/directService/useServiceRequestItemCatalog.ts`**

```ts
export function useServiceRequestItemCatalog(departmentId: Ref<string | null>): {
    items: ComputedRef<ClinicalCatalogItem[]>;
    loading: Ref<boolean>;
    error: Ref<string | null>;
}
```

Fetches catalog items by `departmentId` from `GET /platform/catalog/by-department/{departmentId}`. No longer maps `serviceType` to a hardcoded fetch function — all catalogs are unified under the central `platform_clinical_catalog_items` table filtered by `department_id`.

### 10. Frontend — Types

**`resources/js/types/serviceRequestItem.ts`**

```ts
export type ServiceRequestItemInput = {
    catalogItemId: string | null;
    itemName: string;
    itemCode: string | null;
    quantity: number;
    clinicalIndication?: string | null;
    instructions?: string | null;
};

export type ServiceRequestItemStatus = 'pending' | 'processing' | 'ordered' | 'completed' | 'failed' | 'cancelled';

export type ServiceRequestItem = ServiceRequestItemInput & {
    id: string;
    serviceRequestId: string;
    serviceType: string;
    status: ServiceRequestItemStatus;
    sortOrder: number;
    requestedByUserId: number | null;
    requestedAt: string | null;
    orderedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    cancelledAt: string | null;
    failureReason: string | null;
};
```

## Modified Files

### Backend

#### 1. `app/Modules/ServiceRequest/Application/UseCases/CreateServiceRequestUseCase.php`

Wrap the SR creation + items persistence + audit event in a `DB::transaction()`, matching the existing pattern in `UpdateServiceRequestStatusUseCase:102`. Validation (patient lookup, active request check, request number generation) stays outside the transaction.

```php
use Illuminate\Support\Facades\DB;

// ... validation unchanged ...

$created = DB::transaction(function () use ($payload, $actorId): array {
    $created = $this->serviceRequestRepository->create($payload);
    $id = (string) $created['id'];

    if (isset($payload['items']) && is_array($payload['items'])) {
        $this->itemRepository->createMany($id, $payload['items']);
    }

    $this->appendServiceRequestAuditEvent->execute(
        $id,
        'service_request.created',
        $actorId,
        null,
        ServiceRequestStatus::PENDING->value,
        [
            'patientId' => $created['patient_id'] ?? null,
            'serviceType' => $created['service_type'] ?? null,
            'departmentId' => $created['department_id'] ?? null,
            'requestNumber' => $created['request_number'] ?? null,
            'itemCount' => isset($payload['items']) ? count($payload['items']) : 0,
        ],
    );

    return $created;
});

return $created;
```

**Backward compatibility**: When no items are present, `$payload['items']` is not set — the `isset` guard skips `createMany()`, and the behavior is identical to today's flow (just wrapped in a transaction for safety).

**Transaction boundary matches `UpdateServiceRequestStatusUseCase`** — the audit event is inside the transaction, the domain event dispatch (`ServiceRequestStatusChanged`) stays outside via `DB::afterCommit()` (if needed later).

Inject `ServiceRequestItemRepositoryInterface` via constructor. Add `use Illuminate\Support\Facades\DB;` import.

#### 2. `app/Modules/ServiceRequest/Presentation/Http/Requests/StoreServiceRequestRequest.php`

Add `items` validation rule:
```php
'items' => ['nullable', 'array', 'max:50'],
'items.*.catalogItemId' => ['nullable', 'uuid'],
'items.*.itemName' => ['required', 'string', 'max:255'],
'items.*.itemCode' => ['nullable', 'string', 'max:50'],
'items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:999'],
'items.*.clinicalIndication' => ['nullable', 'string', 'max:1000'],
'items.*.instructions' => ['nullable', 'string', 'max:1000'],
```

#### 3. `app/Modules/ServiceRequest/Presentation/Http/Controllers/ServiceRequestController.php`

Add `'items' => 'items'` to `toPersistencePayload()` field map.

#### 4. `app/Modules/ServiceRequest/Presentation/Http/Transformers/ServiceRequestResponseTransformer.php`

Include transformed items in response:
```php
'items' => array_map(
    static fn (array $item): array => [
        'id' => $item['id'] ?? null,
        'catalogItemId' => $item['catalog_item_id'] ?? null,
        'itemName' => $item['item_name'] ?? null,
        'itemCode' => $item['item_code'] ?? null,
        'quantity' => $item['quantity'] ?? 1,
        'status' => $item['status'] ?? 'pending',
        'clinicalIndication' => $item['clinical_indication'] ?? null,
        'instructions' => $item['instructions'] ?? null,
        'requestedByUserId' => $item['requested_by_user_id'] ?? null,
        'requestedAt' => $item['requested_at'] ?? null,
        'orderedAt' => $item['ordered_at'] ?? null,
        'completedAt' => $item['completed_at'] ?? null,
        'failedAt' => $item['failed_at'] ?? null,
        'cancelledAt' => $item['cancelled_at'] ?? null,
        'failureReason' => $item['failure_reason'] ?? null,
    ],
    $serviceRequest['items'] ?? [],
),
```

#### 5. `app/Modules/ServiceRequest/Infrastructure/Models/ServiceRequestModel.php`

Add `HasMany` relation to `ServiceRequestItemModel`:
```php
public function items(): HasMany
{
    return $this->hasMany(ServiceRequestItemModel::class, 'service_request_id');
}
```

#### 6. `app/Modules/ServiceRequest/Infrastructure/Repositories/EloquentServiceRequestRepository.php`

Eager load `items` in `create()`, `findById()`, `search()`, `findActiveForPatientAndServiceType()`, `findActiveByPatientIds()`.

Add `->with(['items'])` alongside existing `->with($this->departmentRelation())`.

#### 7. `app/Modules/ServiceRequest/Application/UseCases/UpdateServiceRequestStatusUseCase.php`

When transitioning to `in_progress` (Accept), trigger `FulfillServiceRequestItemsUseCase` which dispatches item-level fulfillment events. The ticket status remains `in_progress` — it is **not** auto-completed.

```php
if ($newStatus === ServiceRequestStatus::IN_PROGRESS->value) {
    $payload['acknowledged_at'] = now();
    $payload['acknowledged_by_user_id'] = $actorId;
    if (! empty($existing['items'])) {
        $this->fulfillItemsUseCase->execute($id, $existing['items'], $actorId);
    }
}
```

**Ticket completion** happens separately when all items are terminal. `failed` is **not** a terminal status — if any item has failed, the ticket stays `in_progress` so staff can retry or take corrective action. Only `completed` and `cancelled` are terminal.

**New file**: `app/Modules/ServiceRequest/Application/UseCases/CompleteServiceRequestIfItemsDoneUseCase.php`

```php
public function execute(string $serviceRequestId): void
{
    $items = $this->itemRepository->findByServiceRequestId($serviceRequestId);
    $statuses = array_column($items, 'status');

    // Terminal statuses — failed items keep the ticket in_progress for retry
    $terminal = ['completed', 'cancelled'];

    // If no items or all items are terminal
    if (empty($statuses) || empty(array_diff($statuses, $terminal))) {
        $this->serviceRequestRepository->update($serviceRequestId, [
            'status' => ServiceRequestStatus::COMPLETED->value,
        ]);
    }
}
```

**Retry mechanism for failed items**: Staff can re-trigger fulfillment for individual `failed` items from the queue. A new action `retry` on the item sends it back to `pending` and re-dispatchs the queued job. This is implemented as a new API endpoint or a dedicated use case:

```php
public function retryItem(string $itemId, int $actorId): void
{
    $item = $this->itemRepository->findById($itemId);

    // Only failed items can be retried
    if ($item['status'] !== 'failed') {
        throw new InvalidStatusTransitionException();
    }

    // Reset to pending, clear failure state
    $this->itemRepository->update($itemId, [
        'status' => 'pending',
        'failed_at' => null,
        'failure_reason' => null,
    ]);

    // Append audit event
    $this->auditUseCase->execute(
        serviceRequestId: $item['service_request_id'],
        action: 'service_request_item.retry',
        metadata: ['item_id' => $itemId],
        actorUserId: $actorId,
    );
}
```

Called by each queued job after updating item status. Failed items keep the ticket `in_progress` so the queue shows them for retry.

Inject `FulfillServiceRequestItemsUseCase` via constructor.

#### 8. `app/Modules/Laboratory/Application/UseCases/CreateLaboratoryOrderUseCase.php`

Extend to accept `service_request_item_id` and store it on the created order. No auto-complete of the ticket — completion is managed by `CompleteServiceRequestIfItemsDoneUseCase`.

#### 9. `app/Modules/Pharmacy/Application/UseCases/CreatePharmacyOrderUseCase.php`

Same — add `service_request_item_id` parameter and persist on the order.

#### 10. `app/Modules/Radiology/Application/UseCases/CreateRadiologyOrderUseCase.php`

Same — add `service_request_item_id` parameter and persist on the order.

#### 11. `app/Modules/ServiceRequest/Domain/Repositories/ServiceRequestRepositoryInterface.php`

No changes needed. Items are managed via a separate repository interface.

### Frontend

#### 1. `resources/js/components/patients/PatientDirectServiceDialog.vue`

- Add `ServiceRequestItemSelector` component below the `departmentId` select
- When `departmentId` changes, the item selector fetches catalog items for that department
- The `service_type` for each item is derived from the selected catalog item's `catalog_type` field
- Selected items are added to the mutation payload

```
[Service Type] → [Department] → [Item Selector: search & select items from department's catalog]
```

**Key change from original**: The item selector previously depended on `serviceType` to determine which catalog to query (e.g., `laboratory` → lab tests). Now it depends on `departmentId` — the department is the catalog namespace. The `serviceType` on each item is derived from the catalog item's `catalog_type`, not from the top-level `serviceType` selector.

#### 2. `resources/js/composables/patientsIndex/useDirectServiceRequest.ts`

Extend `DirectServiceRequestVariables` type:
```ts
export type DirectServiceRequestVariables = {
    patientId: string;
    serviceType: DirectServiceType;
    departmentId?: string | null;
    priority?: 'routine' | 'urgent';
    notes?: string | null;
    items?: ServiceRequestItemInput[];
};
```

Include `items` in the POST body.

#### 3. `resources/js/composables/directService/useDirectServiceRequests.ts`

Extend `DirectServiceRequest` type:
```ts
export type DirectServiceRequest = {
    // ... existing fields
    items: Array<{
        id: string | null;
        catalogItemId: string | null;
        itemName: string | null;
        itemCode: string | null;
        quantity: number;
        status: ServiceRequestItemStatus;
        clinicalIndication: string | null;
        instructions: string | null;
        requestedByUserId: number | null;
        requestedAt: string | null;
        orderedAt: string | null;
        completedAt: string | null;
        failedAt: string | null;
        cancelledAt: string | null;
        failureReason: string | null;
    }>;
};
```

#### 4. `resources/js/pages/directService/Queue.vue`

In each queue card row, show `ServiceRequestItemList` displaying the ticket's items with their status. Example:

```
[John Doe] [in_progress] [Laboratory]
  ├─ ✓ HIV Rapid Test (LAB-HIV-001)  [ordered]
  ├─ ◌ Malaria RDT (LAB-MAL-001)    [processing]
  ├─ ✗ CBC (LAB-CBC-001)            [failed: insufficient sample]
  └─ ○ FBC (LAB-FBC-001)            [pending]
[View Orders] [Cancel]
```

Item status badges use color coding:
- `pending` — gray
- `processing` — blue / animated
- `ordered` — green
- `completed` — green (checkmark)
- `failed` — red (with error tooltip showing `failureReason`)
- `cancelled` — gray strikethrough

#### 5. `resources/js/components/directService/DirectServiceStatusDialog.vue`

When `action === 'in_progress'` and the ticket has items, show a confirmation message:
"This will automatically create orders for the requested items. Continue?"

No structural changes — the auto-fulfillment happens server-side in `UpdateServiceRequestStatusUseCase`.

#### 6. `resources/js/composables/directService/useUpdateDirectServiceStatus.ts`

No changes needed — auto-fulfillment is server-side.

## Billing Integration

The system has **two existing billing pathways** — the feature uses both depending on workflow:

### Post-pay (default, phase 1)

```
Ticket created with items → Accepted → Orders auto-created
    → Orders appear in ListBillingChargeCaptureCandidates
    → Cashier creates invoice from candidates (existing flow)
    → Patient pays later
```

No new billing code needed. The auto-created clinical orders (lab, pharmacy, radiology) already flow through `ListBillingChargeCaptureCandidatesUseCase` — they become selectable line items when the cashier creates an invoice. This is the same pipeline used when those orders are created manually today.

### Pre-pay (phase 2 — optional enhancement)

Some facilities require payment **before** the patient receives the service. The flow:

```
Ticket created with items
    → System shows estimated total
    → Receptionist sets payment mode to "pre-pay"
    → Ticket is held (not in department queue)
    → Patient pays at POS
    → Ticket released → appears in department queue → Auto-fulfilled
```

Implementation details for phase 2:
1. Add `payment_mode` column to `service_requests`: `cash` (pre-pay) | `insurance` | `credit` | `none`
2. Add `requires_payment_before_service` boolean to `service_requests`
3. When a pre-pay ticket is created, invoke `CreateFrontdeskQuickPosSaleUseCase` or create a draft invoice from the items (reusing `BillingInvoiceLineItemAutoPricingResolver` for price resolution)
4. Queue hides pre-pay tickets until payment is confirmed (check via `CashBillingAccountRepository` or invoice status)
5. A webhook/observer on payment confirmation releases the ticket

This can be built as a follow-up phase — the phase 1 post-pay flow works without it.

### Why no direct SR→billing link is needed for phase 1

The billing system recognizes these `sourceWorkflowKind` values:
- `laboratory_order`, `pharmacy_order`, `radiology_order`, `clinical_procedure_order`, `theatre_procedure`

Each corresponds to a clinical order type. When `FulfillServiceRequestItemsUseCase` creates those orders, they become billable through the existing charge capture pipeline. Adding a `service_request` source kind is unnecessary — the orders ARE the billable artifacts.

### What changes for billing in phase 1

**No changes** to the Billing module, POS module, or ChargeResolver — the auto-created clinical orders integrate automatically through the existing charge capture pipeline.

The service request layer remains **billing-agnostic**: no `billing_status`, no `total_estimated`, no `unit_price`. Prices are resolved when needed via `BillingInvoiceLineItemAutoPricingResolver` on the clinical orders.

If the frontend needs to display estimated totals, it can compute them by fetching item prices from the billing module on demand, rather than storing them on the service request.

## Implementation Order

| Phase | Task | Files |
|-------|------|-------|
| 1 | Migration: create `service_request_items` table | `database/migrations/YYYY_MM_DD_HHMMSS_create_service_request_items_table.php` |
| 2 | Migration: add `service_request_item_id` to order tables | 3 migrations for `laboratory_orders`, `pharmacy_orders`, `radiology_orders` |
| 3 | Migration: add `service_request_item_id` to audit events | `database/migrations/YYYY_MM_DD_HHMMSS_add_item_id_to_service_request_audit_events.php` |
| 4 | Domain + Infrastructure: Model, Repository Interface, Eloquent Repository, Enum | `ServiceRequestItemModel`, `ServiceRequestItemRepositoryInterface`, `EloquentServiceRequestItemRepository`, `ServiceRequestItemType`, `ServiceRequestItemStatus` |
| 5 | Backend: persist items on create | `CreateServiceRequestUseCase`, `StoreServiceRequestRequest`, `Controller`, `Transformer`, `ServiceRequestModel` |
| 6 | Backend: return items in list | `EloquentServiceRequestRepository` (eager load), `Transformer` |
| 7 | Frontend: item selector + types (Department → Catalog) | `ServiceRequestItemSelector.vue`, `useServiceRequestItemCatalog.ts` (department-driven), `serviceRequestItem.ts`, update `PatientDirectServiceDialog.vue`, `useDirectServiceRequest.ts`, new API endpoint `GET /platform/catalog/by-department/{departmentId}` |
| 8 | Frontend: display items in queue | `ServiceRequestItemList.vue`, update `Queue.vue`, `useDirectServiceRequests.ts` |
| 9 | Backend: queued fulfillment jobs + coordinator | `FulfillServiceRequestItemsUseCase`, `FulfillLaboratoryServiceRequestItemJob`, `FulfillPharmacyServiceRequestItemJob`, `FulfillRadiologyServiceRequestItemJob`, `CompleteServiceRequestIfItemsDoneUseCase`, update `UpdateServiceRequestStatusUseCase`, extend `CreateLaboratory/Pharmacy/RadiologyOrderUseCase` for `service_request_item_id` |
| 10 | Frontend: show item-level status + audit in queue | `useDirectServiceRequests.ts` (item status), `Queue.vue` (per-item status badges with processing/failed states) |
| 11 | Cleanup & edge cases | Permission gating, validation, error handling, backward compatibility |
| 12 | (Optional) Pre-pay gating | `payment_mode` column, POS integration, queue visibility gating |

## Backward Compatibility

- Tickets created without items continue to work exactly as before
- The queue handles tickets with **no items** (show generic service type as today)
- The auto-fulfillment only triggers when items are present; otherwise the existing manual order creation flow applies
- All existing permissions (`service.requests.create`, `service.requests.update-status`) stay the same
