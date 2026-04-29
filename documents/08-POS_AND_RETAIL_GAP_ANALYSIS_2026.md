# POS and Retail Gap Analysis 2026
## Afyanova AHS v2

**Document Version:** 1.0  
**Date:** April 16, 2026  
**Status:** Current-state gap analysis based on the codebase

---

## Executive Summary

Afyanova AHS v2 already supports core hospital cashier operations without a dedicated POS module.

The system is strong for:
- billing invoices
- cashier and front-desk collection
- walk-in patient cash billing
- lab, radiology, theatre, consultation, and pharmacy charge capture into billing
- patient-linked pharmacy dispense billing

The system is not yet a full retail POS platform.

The biggest gaps are:
- anonymous or rapid pharmacy OTC sales
- cafeteria or canteen sales
- register and cashier shift controls
- barcode-first counter selling
- device-oriented POS workflows such as terminal and printer integrations

The right product decision is to keep the current Billing and Cash Billing flows for hospital services, and add a complementary POS layer only for true retail-style operations.

---

## Decision Matrix

| Use Case | Current State | Notes |
|----------|---------------|-------|
| Front-desk invoice payment collection | Supported | Existing billing invoice payment and cashier queue flows |
| Walk-in patient cash billing | Supported | Existing cash account, charge, and payment workboard |
| Cash-based lab or service desk settlement | Supported | Can use billing invoices or cash billing |
| Patient-linked pharmacy dispense billing | Supported | Dispensed pharmacy orders can flow into billing |
| Anonymous pharmacy OTC sale | Missing | No retail sale/register flow exists |
| Cafeteria or canteen sale | Missing | No cafeteria module exists |
| Cash drawer / register shift open-close | Missing | No register session workflow found |
| Barcode-driven counter POS | Missing | No barcode-first retail flow found |

---

## What Already Works

### 1. Hospital cashier and front-desk billing already work

The project already contains:
- `billing-invoices` page and APIs for invoice creation, issue, payment posting, reversal, audit, print, and PDF
- `billing-cash` page and `cash-patients` APIs for walk-in patient cash accounts
- payment methods such as cash, mobile money, card, bank transfer, insurance claim, cheque, waiver, and other

Relevant code paths:
- `routes/web.php`
- `routes/api.php`
- `routes/billing-phase1.php`
- `app/Modules/Billing/Presentation/Http/Controllers/BillingInvoiceController.php`
- `app/Modules/Billing/Presentation/Http/Controllers/CashBillingController.php`
- `app/Modules/Billing/Application/UseCases/RecordBillingInvoicePaymentUseCase.php`
- `app/Modules/Billing/Application/UseCases/RecordCashPaymentUseCase.php`

### 2. Walk-in patient cash billing is first-class

The `Cash Billing` workboard already supports:
- opening a cash patient account
- posting manual service charges
- recording cashier payments
- generating receipt numbers
- tracking remaining balance

This is already good enough for many private-hospital front-desk and same-day cash workflows.

### 3. Clinical services can already become billable lines

Billing charge capture already includes:
- consultation
- laboratory
- radiology
- pharmacy
- theatre

That means a lot of hospital revenue can already flow through Billing without a separate POS layer.

Relevant code path:
- `app/Modules/Billing/Application/UseCases/ListBillingChargeCaptureCandidatesUseCase.php`

### 4. Pharmacy already integrates with billing, but through patient orders

The pharmacy module is not isolated from billing. Patient-linked pharmacy orders can be billed after dispense.

Important nuance:
- pharmacy orders require `patientId`
- `appointmentId` and `admissionId` can be null
- dispensed or partially dispensed pharmacy orders are charge-capture candidates in Billing

That means the project supports patient-linked pharmacy billing, including walk-in patients who are still registered as patients.

It does not mean the project already supports anonymous OTC pharmacy sales.

Relevant code paths:
- `app/Modules/Pharmacy/Presentation/Http/Requests/StorePharmacyOrderRequest.php`
- `app/Modules/Pharmacy/Application/UseCases/CreatePharmacyOrderUseCase.php`
- `app/Modules/Billing/Application/UseCases/ListBillingChargeCaptureCandidatesUseCase.php`
- `resources/js/pages/pharmacy-orders/Index.vue`

### 5. Inventory foundations already exist for pharmacy retail expansion

The codebase already has:
- inventory items
- stock movement ledger
- stock issue flows
- pharmacy dispense stock movement integration

This is a strong foundation for pharmacy OTC POS because stock deduction patterns already exist in the system.

Relevant code paths:
- `app/Modules/InventoryProcurement`
- `app/Modules/Pharmacy/Application/UseCases/UpdatePharmacyOrderStatusUseCase.php`

---

## What Is Missing

### 1. Pharmacy walk-in POS is missing as a retail workflow

The current pharmacy workflow is clinically anchored.

What is missing for a true pharmacy walk-in POS:
- sale header model for a retail counter transaction
- sale line model for multiple OTC items in one checkout
- direct cart-based checkout screen
- barcode or fast medicine scan workflow
- anonymous customer or retail-customer sale path
- cashier register session and shift controls
- direct sale-to-stock-issue transaction outside clinical pharmacy orders
- receipt optimized for counter sale instead of invoice workflow

In short:
- `patient-linked pharmacy billing` exists
- `anonymous OTC pharmacy POS` does not

### 2. Cafeteria or canteen sales are missing entirely

I found no dedicated support for:
- cafeteria items
- food or beverage catalog
- cafeteria sales page
- cafeteria order or receipt models
- canteen cashier operations

This is a net-new capability, not an extension of an existing module.

### 3. Retail register operations are missing

The system does not currently appear to model:
- cash drawer opening
- cash drawer closing
- per-register daily totals
- cashier handover by register session
- till discrepancy logging
- Z-report style cashier closeout

These are normal POS controls, but they are not required for the hospital billing workflows that already exist.

### 4. Device-first POS behavior is missing

I did not find evidence of:
- receipt printer integration
- barcode scanner workflow
- card terminal callback or direct device integration
- offline or quick-key retail checkout mode

The current system supports payment references and receipt numbers, but not device-oriented POS operations.

---

## Interpretation by Business Scenario

### Scenario A: Front desk collects money for consultation, lab, or radiology

Current support: **Yes**

Recommended path:
- use `billing-invoices` when the service belongs to the patient billing context
- use `billing-cash` for quick walk-in cash accounts and manual service posting

### Scenario B: Lab patient pays cash immediately at the desk

Current support: **Yes**

Recommended path:
- charge capture from completed laboratory orders into billing
- or post a direct cash-billing charge for a walk-in patient account

### Scenario C: Registered walk-in patient buys medicine from pharmacy

Current support: **Partially yes**

Recommended path today:
- create or continue a patient-linked pharmacy order
- dispense medication
- let billing capture the dispensed pharmacy order

Limitation:
- this is slower than a true OTC counter-sale flow

### Scenario D: Anonymous customer buys OTC medicine without patient registration

Current support: **No**

Reason:
- pharmacy ordering is patient-based
- no retail sale model exists

### Scenario E: Staff or visitors buy food from cafeteria

Current support: **No**

Reason:
- no cafeteria domain or retail sale domain exists

---

## Recommended Build Strategy

### Recommendation 1. Do not replace Billing or Cash Billing

The existing hospital billing stack should remain the primary engine for:
- patient invoicing
- cashier collection
- self-pay and insured settlement
- governed reversals and finance posting
- document print and audit

POS should be added as a separate complementary workflow for retail-style sales only.

### Recommendation 2. Build a reusable POS foundation once

Before building pharmacy and cafeteria separately, add a small shared POS core:

Suggested domain objects:
- `PosRegisterModel`
- `PosRegisterSessionModel`
- `PosSaleModel`
- `PosSaleLineModel`
- `PosSalePaymentModel`
- `PosReceiptModel`

Suggested core capabilities:
- open register
- close register
- start sale
- add line
- take payment
- print receipt
- void sale
- refund sale
- reconcile shift totals

### Recommendation 3. Implement Pharmacy OTC POS first

This should be the first retail slice because:
- pharmacy already has stock and approved medicines
- pharmacy already has inventory issue patterns
- pharmacy has the clearest operational need for rapid counter sale

Suggested first release:
- registered patient optional, not mandatory
- sell approved medicines from a retail counter screen
- post payment immediately
- create stock movement issue entries
- print simple OTC receipt
- optional link to patient when known

### Recommendation 4. Build Cafeteria POS second

Cafeteria is a greenfield module and should reuse the shared POS core.

Suggested cafeteria-specific additions:
- menu item catalog
- tax handling if needed
- simple category search
- receipt-only checkout
- no clinical linkage

### Recommendation 5. Keep lab and front-desk on current flows unless speed becomes a problem

For hospital operations, Billing and Cash Billing are already enough for many lab and front-desk scenarios.

Only add a dedicated quick-service POS lane for lab/front desk if users prove that:
- invoice flow is too slow for same-minute counter collection
- staff need a lighter checkout screen than billing drafts and invoice issue

---

## Smallest Viable Roadmap

### Phase 1: POS Foundation

Build:
- register and register session tables
- sale, sale line, and sale payment tables
- cashier shift totals and closeout
- receipt rendering
- basic payment methods

Outcome:
- reusable POS engine for pharmacy and cafeteria

### Phase 2: Pharmacy OTC

Build:
- OTC pharmacy sale page
- approved medicine retail search
- stock issue on sale completion
- receipt print
- optional patient linkage

Outcome:
- true pharmacy walk-in counter sales

### Phase 3: Cafeteria POS

Build:
- cafeteria item catalog
- simple counter checkout
- receipt and cashier day totals

Outcome:
- non-clinical food and beverage sales

### Phase 4: Lab Quick Cashier

Status:
- implemented on the shared POS foundation

Build delivered:
- payable laboratory order queue with governed billing price lookup
- one-patient quick cashier basket and checkout
- duplicate protection against already invoiced or already POS-settled lab orders
- patient-linked POS sale capture under the `lab_quick` channel

Outcome:
- faster laboratory desk collection without disturbing the invoice engine

---

## Reuse Opportunities in This Codebase

The project already contains patterns worth reusing:

### Billing reuse
- payment methods and payment references
- receipt number behavior in cash billing
- invoice print and PDF branding
- refund and reversal governance

### Pharmacy reuse
- approved medicine selection
- dispense lifecycle states
- patient-aware pharmacy context

### Inventory reuse
- issue stock movement logic
- inventory stock summaries and ledger
- insufficient stock protection patterns

### UI reuse
- Inertia page structure
- queue-based workboards
- permission-driven navigation
- branded print and document patterns

---

## Final Conclusion

Afyanova AHS v2 is already strong enough to operate modern hospital billing and cashier workflows without a traditional POS module.

What it lacks is not hospital billing.  
What it lacks is retail POS.

That distinction matters:
- if the goal is hospital billing, the current system is already usable
- if the goal is pharmacy OTC or cafeteria retail selling, a POS layer still needs to be added

The best next step is:
1. keep the current Billing and Cash Billing flows as the hospital finance backbone
2. add a shared POS foundation
3. implement Pharmacy OTC POS first
4. implement Cafeteria POS second

---

**Analysis Complete:** April 16, 2026  
**Confidence Level:** High  
**Basis:** Repository routes, controllers, requests, billing workflows, pharmacy workflows, inventory movement patterns, and billing-related tests
