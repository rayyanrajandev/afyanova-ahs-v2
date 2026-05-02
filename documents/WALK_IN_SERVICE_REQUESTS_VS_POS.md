# Walk-in service requests vs POS (existing code)

Before implementing the walk-in **service request** plan, treat **`app\Modules\Pos`** as already in scope. These are complementary rails—not duplicates.

## What POS does today

- Module root: [`app/Modules/Pos`](../app/Modules/Pos).
- Channels include **`lab_quick`**, **`pharmacy_otc`**, **`cafeteria`**, etc. ([`PosSaleChannel`](../app/Modules/Pos/Domain/ValueObjects/PosSaleChannel.php)).
- Sales live on **`pos_sales`** / register sessions (`CreateLabQuickPosSaleUseCase`, `CreatePharmacyOtcSaleUseCase`, `CreateCafeteriaPosSaleUseCase`, …).
- **Lab quick** cashier attaches lines to **`laboratory_order`** sources via [`LabQuickCashierSupport`](../app/Modules/Pos/Application/Support/LabQuickCashierSupport.php) (billing/catalog integration), **not** to `service_requests`.

Broader POS vs billing narrative: [`documents/08-POS_AND_RETAIL_GAP_ANALYSIS_2026.md`](08-POS_AND_RETAIL_GAP_ANALYSIS_2026.md).

## What service requests do

- **Intent**: “Patient should present at Lab / Imaging / Pharmacy counter”—a **department queue ticket** (`CreateServiceRequestUseCase`, [`service_requests`](../app/Modules/ServiceRequest/Infrastructure/Models/ServiceRequestModel.php)).
- Departments consume queues in [`WalkInServiceRequestsPanel.vue`](../resources/js/components/service-requests/WalkInServiceRequestsPanel.vue).

## How they combine in hospital operations

| Step | Typical system artefact |
|------|-------------------------|
| Reception directs walk-in patient to lab (visibility) | `service_requests` row (needs `service.requests.create`) |
| Lab receives patient / starts work | Queue acknowledge → lab order lifecycle |
| Patient pays at dedicated lab cashier / OTC lane | **`lab_quick`** or **billing invoices** / **billing-cash**—unchanged POS/billing stacks |

Do **not** replace `service_requests` with POS “just to show routing.” POS is settlement/retail-oriented; **`service_requests` is routing/queue-oriented**.

Operational checklist for RBAC drift and exports: **`documents/SERVICE_REQUEST_RBAC_RUNBOOK.md`**.

## Implementation plan checklist (POS-aware)

1. Walk-in RBAC and `routingHandoffSummary` policy stay in **Patient** / **ServiceRequest** APIs—no POS permission required unless UX explicitly deep-links into `/pos`.
2. If later linking artefacts (e.g. optional `appointment_id`), consider **optional metadata** cross-references (SR id ↔ POS sale id) only where finance needs a single reconciliation story—defer until billing owners define it.
3. Lab roadmap: clarify training/docs—**SR = “expected at desk”**, **Lab quick POS = “take payment against an order.”**
