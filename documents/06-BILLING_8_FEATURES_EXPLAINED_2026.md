# 8 Missing Billing Features - Detailed Breakdown
## How They Work, Why We Need Them, Tanzania Context

**Document Version:** 1.0  
**Date:** April 15, 2026  
**Context:** Afyanova AHS v2 Billing Module Enhancement  
**Target:** Tanzania Hospital Network Operations

---

## 🎯 Executive Summary

The Billing module is **enterprise-grade for insurance/payer billing**, but lacks features essential for **Tanzania hospital operations**. The 8 missing features represent real cash flow, revenue, and operational challenges.

| # | Feature | Priority | Why Tanzania Needs It | Impact |
|---|---------|----------|----------------------|--------|
| 1 | **Cash Billing** | 🔴 CRITICAL | 40-60% of patients pay cash | Revenue collection |
| 2 | **Exemptions** | 🔴 CRITICAL | MOH mandates (pregnant, kids, elderly) | Legal compliance |
| 3 | **Billing Routing** | 🔴 CRITICAL | Route insured vs. self-pay patients | Clean separation |
| 4 | **Discounts/Waivers** | 🟡 HIGH | Staff benefits, charity cases | Operational flexibility |
| 5 | **Refunds** | 🟡 HIGH | Return money to patients | Patient satisfaction |
| 6 | **Payment Plans** | 🟡 HIGH | Installments for large bills | Improve collection |
| 7 | **Financial Reports** | 🟢 MEDIUM | Revenue by payer/department | Management visibility |
| 8 | **Revenue Recognition** | 🟢 MEDIUM | GL integration for accounting | Audit compliance |

---

## 1. 🏪 CASH BILLING (CRITICAL)

### Current Problem
```
Current Workflow (Insurance Only):
Patient → Appointment → Insurance Verified → Invoice Created → Insurance Pays
                           ↑
                    Patient must have insurance contract
                    What about patients WITHOUT insurance?
                    → SYSTEM FAILS
```

### Feature: How It Works

**Component 1: Cash Patient Account**
```php
// New Model needed
class CashPatientAccount {
    - patient_id
    - outstanding_balance  // Money owed
    - total_paid
    - status (active, suspended, closed)
    - payment_method (cash, mobile_money, check, card)
    - created_at
    - updated_at
}

Example:
Patient ID: P12345
Name: Juma Mwambi
Outstanding: 250,000 TSh (unpaid bills)
Paid so far: 50,000 TSh
Status: Active (can still get treatment)
```

**Component 2: Cash Invoice Workflow**
```
Step 1: Service Provided (no pre-authorization needed)
- Doctor provides treatment
- Service logged in system

Step 2: Invoice Generated (same day, not insurance contract)
- Invoice created with flat rate (not negotiated)
- Service price = Standard Catalog Price (no payer override)
- Patient notified immediately (SMS/paper)

Step 3: Payment Recording (flexible)
- Patient pays PARTIAL amount (e.g., 100,000 of 250,000 TSh)
- Invoice status: "partially_paid"
- Outstanding balance: 150,000 TSh tracked

Step 4: Collection Follow-up
- System reminds of outstanding balance
- Can't get new treatment until SOME payment made
- Can negotiate payment plans (Feature #6)

Example:
Service: Lab test (Malaria screening)
Standard price: 15,000 TSh
Invoice created: immediately
Patient pays: 5,000 TSh (partial)
Outstanding: 10,000 TSh
```

**Component 3: Cash Payment Methods**
```php
// Support multiple payment types
enum PaymentMethod {
    CASH,           // Physical money
    MOBILE_MONEY,   // M-Pesa, Airtel Money, Tigo Pesa
    CHECK,          // Post-dated checks
    BANK_TRANSFER,  // Bank deposit
    CREDIT_CARD,    // Card reader (if available)
    CREDIT_ACCOUNT  // "Patient credit" (customer account)
}

// Each payment tracked separately
CashPayment {
    - cash_account_id
    - amount_paid
    - payment_method
    - reference (M-Pesa transaction ID, check #, etc)
    - receipt_number
    - paid_at
    - recorded_by (which cashier)
}
```

### Why We Need It (Tanzania Context)

**Reality of Tanzania Hospitals:**
- 🏥 **40-60% of patients are uninsured** (no insurance company)
- 💰 **Self-pay patients are majority revenue source**
- 📱 **Mobile money is primary payment method** (M-Pesa, Airtel Money)
- 🤝 **Relationship-based credit** ("Pay when you can")
- 📊 **Government subsidies don't cover all costs**
- ⚠️ **Current system can't handle these patients at all**

**Revenue Impact:**
```
If hospital serves 1000 patients/month:
- 400 insured (handled by current system)
- 600 uninsured (NO BILLING POSSIBLE without this feature)

Missing 600 patients = 60% of revenue uncaptured!

Example: Lab test
- 600 uninsured patients × 15,000 TSh = 9,000,000 TSh/month
- 400 insured patients × 12,000 TSh = 4,800,000 TSh/month
Total revenue lost: ~4.2M TSh/month = 50M TSh/year 🔴
```

**Business Logic:**
```php
// Pseudocode for cash billing routing
function createInvoice(Patient, Service) {
    if (patient.hasInsurance()) {
        // Use insured workflow (current)
        return createInsuredInvoice(patient, service);
    } else {
        // NEW: Use cash workflow
        return createCashInvoice(patient, service);
    }
}

function createCashInvoice(patient, service) {
    // Get standard price (no contract override)
    price = ServiceCatalog.getPrice(service);
    
    // Create invoice
    invoice = new Invoice();
    invoice.patient_id = patient.id;
    invoice.type = "cash";  // Flag as cash invoice
    invoice.price = price;  // Use standard, not negotiated
    invoice.status = "pending_payment";  // Not "draft" like insurance
    invoice.due_date = TODAY + 14 days;  // Grace period for payment
    
    // Create cash account entry
    CashAccount.recordTransaction(
        patient.id,
        amount: price,
        type: "charge",
        invoice_id: invoice.id
    );
    
    return invoice;
}
```

---

## 2. 🏥 EXEMPTIONS (CRITICAL)

### Current Problem
```
Current: All patients charged full price
What about: Pregnant women (free by MOH law)
            Children under 5 (free by MOH law)
            Elderly over 60 (hospital policy)
            Disabled persons (MOH requirement)
Result: Hospital breaking government health policy 🚨
```

### Feature: How It Works

**Component 1: Exemption Categories**
```php
enum ExemptionCategory {
    PREGNANT_WOMEN,      // 100% discount - MOH mandate
    CHILDREN_UNDER_5,    // 100% discount - MOH mandate
    ELDERLY_OVER_60,     // 50% discount - facility policy
    DISABLED_PERSON,     // 80% discount - MOH mandate
    ULTRA_POOR,          // Means-tested discount (varies)
    STAFF_MEMBER,        // 50% discount - employee benefit
    REFERRAL_CASE,       // 25% discount - referred from partner
}

// Store exemption eligibility
ExemptionEligibility {
    - patient_id
    - category (enum above)
    - discount_percentage (0-100%)
    - verified_by (staff member ID)
    - verified_at (timestamp)
    - expiry_date (some exemptions temporary)
    - reason_notes (why exempted)
    - status (active, expired, revoked)
}
```

**Component 2: Automatic Discount Application**
```
Step 1: Patient comes for service
- DOB checked → "Pregnant women" or "under 5" detected
- Or exemption flag already in system

Step 2: Service pricing calculated
Price before exemption: 50,000 TSh

Step 3: Exemption applied automatically
if (patient.isPregnantWoman()) {
    discount = 100%;  // Free
    final_price = 0;
} else if (patient.isUnder5()) {
    discount = 100%;  // Free
    final_price = 0;
} else if (patient.isElderly60()) {
    discount = 50%;
    final_price = 25,000;
} else if (patient.isDisabled()) {
    discount = 80%;
    final_price = 10,000;
}

Step 4: Invoice created with exemption note
Invoice shows:
- Original price: 50,000 TSh
- Exemption: "Pregnant woman (MOH mandate)" -50,000 TSh
- Amount owed: 0 TSh
- Status: "Exempt"
```

**Component 3: Reporting & Audit Trail**
```php
// Every exemption tracked for compliance reporting
ExemptionAuditLog {
    - exemption_id
    - patient_id
    - category
    - discount_amount
    - action (applied, removed, expired, auto-renewed)
    - actor_id (who approved)
    - actor_type (doctor, nurse, admin)
    - created_at
    - reason (why changed)
}

// Monthly report for MOH
MOH Exemption Report:
- Pregnant women exempted: 245 patients
- Children under 5 exempted: 389 patients
- Disabled persons exempted: 78 patients
- Total revenue exempted: 2.5M TSh
- Authorized by: [Staff names]
```

### Why We Need It (Tanzania Context)

**Government Policy Requirements:**
- 🤰 **Free Maternity:** MOH mandates free care for all pregnant women
- 👶 **Free Pediatric:** Children under 5 receive heavily subsidized/free care
- 👴 **Senior Care:** Elderly 60+ entitled to discounts (varies by facility)
- ♿ **Disability Support:** Persons with disabilities get relief
- 📋 **Legal Requirement:** Hospital must report exemptions to MOH quarterly

**Financial Impact:**
```
Hospital serves 500 patients/month:
- Pregnant women: 50 patients × 100,000 TSh = 5,000,000 TSh (free)
- Children under 5: 120 patients × 50,000 TSh = 6,000,000 TSh (free)
- Elderly 60+: 45 patients × 50,000 TSh (50% discount) = 1,125,000 TSh
- Disabled: 30 patients × 60,000 TSh (80% discount) = 360,000 TSh

Total revenue foregone (by policy): ~12.5M TSh/month

✅ This is EXPECTED and REQUIRED by government
❌ But must be tracked for:
   - MOH reporting
   - Subsidy reimbursement
   - Revenue analysis
   - Audit trail
```

**Compliance Risk:**
```
WITHOUT exemptions feature:
- Hospital not complying with MOH policy
- Can't prove exemptions to auditors
- May face penalties/license suspension
- Revenue reporting inaccurate

WITH exemptions feature:
- Automatic enforcement of policy
- Complete audit trail
- MOH-ready reporting
- Hospital protected from compliance violations
```

---

## 3. 🛣️ BILLING ROUTING LOGIC (CRITICAL)

### Current Problem
```
Current system treats all patients as "insured"
Same workflow for:
- Patient with insurance contract
- Cash-paying patient
- Exempt patient (pregnant, child)
- Patient with discount/waiver

This causes:
- Insurance pricing applied to cash patients (wrong)
- Pricing conflicts
- Exemptions can't be applied
- Routing decisions scattered in code
```

### Feature: How It Works

**Component 1: Billing Path Determination**
```php
class BillingPathRouter {
    // Single responsibility: determine correct billing path
    
    public function determinePath(Patient, Service): BillingPath {
        // Check in order of precedence
        
        // 1. Check exemptions first (highest priority)
        if (patient.isExempt()) {
            return BillingPath.EXEMPTED;  // Free or discounted
        }
        
        // 2. Check if patient has active discount/waiver
        if (patient.hasActiveWaiver()) {
            return BillingPath.WAIVED;  // Discounted by approval
        }
        
        // 3. Check if patient has valid insurance for this service
        if (patient.hasInsurance() && 
            patient.insurance.coversService(service)) {
            return BillingPath.INSURED;  // Use payer contract pricing
        }
        
        // 4. Check if patient is in a payment plan
        if (patient.hasActivePaymentPlan()) {
            return BillingPath.PAYMENT_PLAN;  // Installment tracking
        }
        
        // 5. Default: Cash/self-pay patient
        return BillingPath.CASH;  // Standard catalog price
    }
}

enum BillingPath {
    INSURED,        // Use insurance contract pricing
    CASH,           // Use standard catalog price
    EXEMPTED,       // 0 cost (pregnant, child, etc)
    WAIVED,         // Discounted (approved waiver)
    PAYMENT_PLAN,   // Installment tracking
    UNCOVERED,      // Service not covered, patient pays all
}
```

**Component 2: Service Coverage Logic**
```php
// For each billing path, apply correct pricing rules

function resolveInvoicePrice(Patient, Service, BillingPath): Price {
    switch (BillingPath) {
        case INSURED:
            // Use payer contract (existing logic)
            return PayerContractResolver.resolve(
                patient.insurance.payerId,
                service.id
            );
        
        case CASH:
            // Use standard catalog (no discount)
            return ServiceCatalog.getPrice(service.id);
        
        case EXEMPTED:
            // Check exemption type
            if (patient.exemption.category == PREGNANT_WOMEN) {
                return 0;  // 100% exempt
            } else if (patient.exemption.category == ELDERLY_60) {
                basePrice = ServiceCatalog.getPrice(service.id);
                return basePrice * 0.5;  // 50% of price
            }
            // ... other exemptions
        
        case WAIVED:
            // Apply approved waiver discount
            basePrice = ServiceCatalog.getPrice(service.id);
            discount = patient.waiver.discount_percentage;
            return basePrice * (1 - discount/100);
        
        case PAYMENT_PLAN:
            // First installment uses standard price
            // Subsequent installments may vary
            return calculateInstallmentAmount(patient, service);
    }
}
```

**Component 3: API Routing**
```php
// Different endpoints for different paths
// All go through same pricing logic, but separated concerns

Route::post('/billing/insured-invoices', 
    [BillingInsuredController::class, 'create']);
// → Uses insurance contract pricing

Route::post('/billing/cash-invoices', 
    [BillingCashController::class, 'create']);
// → Uses standard pricing, cash account tracking

Route::post('/billing/exempt-invoices', 
    [BillingExemptController::class, 'create']);
// → Uses exemption pricing, compliance tracking

Route::post('/billing/payment-plan-invoices', 
    [BillingPaymentPlanController::class, 'create']);
// → Uses installment logic
```

### Why We Need It (Tanzania Context)

**Operational Clarity:**
```
Current confusion:
Doctor: "Is this patient insured?"
Finance: "I don't know - system doesn't track clearly"
Result: Wrong pricing, angry patients, lost revenue

With routing logic:
Doctor: "System shows: CASH patient"
Finance: "Use standard price: 50,000 TSh"
Patient: "Ok, I pay 50,000"
Everyone knows exactly what to do
```

**Revenue Accuracy:**
```
Routing logic enables reporting by patient type:
- Insured revenue: 500M TSh (from insurance)
- Cash revenue: 400M TSh (from patients)
- Exempt revenue impact: -150M TSh (foregone)
- Waived revenue: -50M TSh (approved discounts)

Without routing, all mixed together → can't analyze
```

**System Integrity:**
```
Without clear routing:
- Insurance pricing applied to cash patients (losses)
- Exemptions ignored (compliance violations)
- Pricing logic scattered (maintenance nightmare)
- Business rules enforced randomly

With routing:
- Each path has clear pricing rules
- Pricing applied consistently
- Business rules enforced systematically
- Easy to audit and maintain
```

---

## 4. 💳 DISCOUNTS & WAIVERS (HIGH)

### Current Problem
```
Current: No discount capability
Hospital needs to:
- Offer staff 30% discount
- Provide charity waiver for very poor patients
- Give referral partner 15% discount
- Handle government health programs

System response: Not possible 🚫
```

### Feature: How It Works

**Component 1: Discount Types**
```php
enum DiscountType {
    STAFF_DISCOUNT,      // 30% - employee benefit
    LOYALTY_DISCOUNT,    // 10% - regular patients
    REFERRAL_DISCOUNT,   // 15% - referred cases
    CHARITY_WAIVER,      // 50-100% - approved by admin
    GOVERNMENT_SUBSIDY,  // Variable - MOH agreement
    BULK_DISCOUNT,       // 5-10% - family package
    SEASONAL_PROMO,      // Marketing campaigns
}

// Store discount/waiver request
BillingDiscount {
    - patient_id
    - invoice_id (optional - applied to specific invoice)
    - discount_type
    - discount_amount (fixed: 10,000 TSh) OR percentage (30%)
    - reason ("Staff member", "Charity case", "Referral")
    - requested_by (staff ID)
    - approved_by (admin/manager ID)
    - status (pending, approved, rejected, applied, cancelled)
    - approval_notes
    - created_at
    - expires_at (some discounts temporary)
}
```

**Component 2: Discount Workflow**
```
FOR AUTOMATIC DISCOUNTS (Staff, Loyalty):
┌─────────────────┐
│ Invoice Created │
└────────┬────────┘
         │
    Check patient type
         │
    ┌────┴─────┐
    │           │
Staff?      Regular?
    │           │
    ↓           ↓
30% off   No discount
    │           │
    └────┬─────┘
         ↓
  Discount Applied Automatically
  (No approval needed)

FOR APPROVAL-BASED DISCOUNTS (Charity, Waiver):
┌──────────────────┐
│ Staff Requests   │
│ Discount/Waiver  │
└────────┬─────────┘
         │
    ┌────────────────┐
    │ Admin Reviews  │
    │ Amount & Reason│
    └────────┬───────┘
             │
     ┌───────┴────────┐
     │                │
  Approved        Rejected
     │                │
     ↓                ↓
Applied          Denied
Recorded        Recorded
```

**Component 3: Audit & Budget Control**
```php
// Prevent abuse - track who approved what
DiscountApprovalLog {
    - discount_id
    - approver_id
    - approval_reason
    - amount_approved
    - timestamp
    - notes
}

// Budget limits on waivers
BillingWaiverBudget {
    - month
    - total_waiver_budget (e.g., 5M TSh/month for charity)
    - amount_used_so_far
    - amount_remaining
    - waiver_count
    - max_per_waiver (e.g., max 500K per patient)
}

// When approving discount:
if (totalWaiverThisMonth + requestedAmount > monthlyBudget) {
    throw DiscountBudgetExceededException();
}
```

### Why We Need It (Tanzania Context)

**Operational Reality:**
```
Every hospital has:
- Staff who get discounts (retain employees)
- Very poor patients (charity cases)
- Referral networks (send patients to partners)
- Government programs (health ministry support)

Current system: Can't handle ANY of this
This feature: Enables all of it
```

**Financial Impact:**
```
Hospital budget: 100M TSh/month revenue
Expected discounts:
- Staff discounts: 2M TSh (employees, families)
- Charity waivers: 1M TSh (approved poor cases)
- Referral discounts: 0.5M TSh (network partners)
Total: 3.5M TSh = 3.5% of revenue

Must be tracked for:
- Accurate revenue reporting
- Tax deductions (if applicable)
- Budget compliance
- Audit trail
```

---

## 5. 🔄 REFUNDS (HIGH)

### Current Problem
```
Current: "Payment reversal" exists (undo a payment on same invoice)
BUT: What if patient already paid, wants money back?

Example scenario:
- Patient paid 100,000 TSh for surgery
- Surgery cancelled due to emergency
- Patient wants refund of 100,000 TSh
- System: Has payment reversal, but that's different
- Confusion: What's the difference?
```

### Feature: How It Works

**Component 1: Payment Reversal vs. Refund (DIFFERENCE)**
```
PAYMENT REVERSAL (Exists):
┌─────────────────────────────────────┐
│ Invoice: 100,000 TSh (pending)      │
│ Payment: 50,000 TSh received        │
│ Invoice Status: Partially Paid      │
│                                     │
│ Admin realizes: "Wrong amount"      │
│ Action: Reverse the 50,000 TSh      │
│ Result: Invoice back to 100,000 owed│
│ Notes: "Data entry error"           │
└─────────────────────────────────────┘
Use case: Correcting mistakes BEFORE full payment

REFUND (NEW):
┌─────────────────────────────────────┐
│ Invoice: 100,000 TSh (paid)         │
│ Payment: 100,000 TSh received ✓     │
│ Invoice Status: Paid                │
│ Patient Account Balance: 0 TSh      │
│                                     │
│ Service: CANCELLED                  │
│ Patient requests: Money back        │
│ Action: Create REFUND               │
│ Refund Type: Full refund 100,000    │
│ Refund Status: Pending Approval     │
│ Approval: Manager must approve      │
│ After Approval: Process refund      │
│ Result: Patient credit +100,000     │
│ Notes: "Surgery cancelled by doctor"│
└─────────────────────────────────────┘
Use case: Returning money AFTER payment received
```

**Component 2: Refund Workflow**
```
Step 1: Initiate Refund
- Service cancelled/not provided
- Patient requests money back
- Staff submits refund request

BillingRefund {
    - invoice_id
    - payment_id
    - patient_id
    - refund_amount (full or partial)
    - refund_reason (cancelled service, duplicate charge, 
                     overpayment, customer request, etc)
    - refund_method (cash, cheque, mobile money, credit account)
    - requested_by (staff)
    - created_at
}

Step 2: Approval
- Manager reviews refund request
- Checks if amount valid
- Checks if reason legitimate
- Approves or rejects

BillingRefundApproval {
    - refund_id
    - approved_by (manager)
    - approved_amount
    - approval_notes
    - approval_reason
    - status (approved, rejected, hold_for_director)
    - approved_at
}

Step 3: Process Refund
Once approved, refund processed by method:

IF cash:
    - Patient goes to cashier
    - Cashier verifies approval
    - Pays cash to patient
    - Issues receipt
    - Marks refund as "completed"

IF cheque:
    - Finance writes cheque
    - Patient signs cheque log
    - Cheque mailed/collected
    - Marks refund as "completed"

IF mobile money:
    - Finance initiates M-Pesa transfer
    - Patient receives SMS confirmation
    - Patient confirms receipt
    - Marks refund as "completed"

IF credit account:
    - Amount credited to patient account
    - Can use for future services
    - No cash leaves hospital
    - Marks refund as "completed"
```

**Component 3: Tracking & Audit**
```php
// Every refund step tracked
BillingRefundAuditLog {
    - refund_id
    - action (requested, approved, rejected, processing, completed)
    - actor_id
    - actor_role (staff, manager, finance)
    - timestamp
    - notes
}

// Monthly refund report
Refund Report:
- Total refunds: 2.5M TSh
- By reason:
  * Cancelled service: 1.5M TSh (60%)
  * Duplicate charge: 0.5M TSh (20%)
  * Overpayment: 0.3M TSh (12%)
  * Customer request: 0.2M TSh (8%)
- By method:
  * Cash: 1.8M TSh
  * Cheque: 0.4M TSh
  * Mobile money: 0.3M TSh
- Pending refunds: 0.8M TSh
- Completion rate: 94%
```

### Why We Need It (Tanzania Context)

**Patient Satisfaction:**
```
Scenario: Patient paid for lab test, test came back inconclusive
Current: "System has reversal, not quite refund, let's try..."
         (Confusing, patient gets upset)
Result: Lost trust, negative review

With refunds:
- Clear process
- Patient knows timeline
- Professional handling
- Increased trust
```

**Financial Integrity:**
```
Must account for:
- Money leaving hospital (cash refunds)
- Cheques issued (reconciliation)
- Mobile money transfers (M-Pesa records)
- Credit accounts (internal balance)

Without tracking:
- Unaccounted cash disappearances
- Audit failures
- Revenue misstatement
```

---

## 6. 💳 PAYMENT PLANS / INSTALLMENTS (HIGH)

### Current Problem
```
Current: Invoice is due in full
Patient with large bill: "I can't pay 500,000 TSh today"
Hospital: "Sorry, must pay in full"
Patient: Goes to competitor OR doesn't get treatment
Result: Lost revenue + patient worse off
```

### Feature: How It Works

**Component 1: Payment Plan Setup**
```php
// When invoice is large, offer installment option
BillingPaymentPlan {
    - invoice_id
    - patient_id
    - total_amount
    - installment_count (3, 6, 12 months)
    - installment_amount (calculated)
    - first_due_date
    - frequency (monthly, weekly, bi-weekly)
    - status (active, on_track, late, completed, defaulted)
    - started_at
    - last_payment_date
}

// Example: 600,000 TSh surgery bill
Invoice Total: 600,000 TSh
Option 1: Pay full now: 600,000 TSh
Option 2: 6 installments: 100,000 TSh × 6 months
Option 3: 12 installments: 50,000 TSh × 12 months

Patient chooses: 6 monthly payments of 100,000 TSh
```

**Component 2: Installment Tracking**
```
Payment Schedule:
┌──────────┬────────────┬─────────┬───────────────┐
│ Month    │ Due Amount │ Paid    │ Balance       │
├──────────┼────────────┼─────────┼───────────────┤
│ March    │ 100,000    │ 100,000 │ 500,000 owed  │ ✓
│ April    │ 100,000    │ 100,000 │ 400,000 owed  │ ✓
│ May      │ 100,000    │ 50,000  │ 350,000 owed  │ ⚠️ Late
│ June     │ 100,000    │ 0       │ 350,000 owed  │ ❌ Miss
│ July     │ 100,000    │ 100,000 │ 250,000 owed  │ ✓ Catch up
│ August   │ 100,000    │ 100,000 │ 150,000 owed  │ ✓
└──────────┴────────────┴─────────┴───────────────┘

System tracks:
- On-time payments (green)
- Late payments (yellow) - send reminder SMS
- Missed payments (red) - escalate
- Catch-up payments (progress restored)
- Default (after 3 consecutive missed) - escalate to director
```

**Component 3: Late Payment Handling**
```
Days Late      Action
─────────────────────────────────────────
0-7 days       SMS reminder "Payment due: 100K TSh"
8-14 days      Phone call reminder
15-30 days     Formal notice letter
31+ days       Escalation to account director
60+ days       Legal collection action

Consequences of Default:
- Patient flagged in system
- Cannot get new services without advance payment
- May be referred to debt collector
- Can be reported to credit bureau (if exists)
- Hospital can pursue legal action

BUT: Hospital can FORGIVE late payments as credit/goodwill
```

**Component 4: Payment Plan Approval**
```php
// Large payment plans need approval
BillingPaymentPlanApproval {
    - plan_id
    - approver_id
    - approval_reason
    - risk_assessment (low, medium, high)
    - notes
    - approved_at
}

// Approval rules
if (total_amount > 1M TSh) {
    // Must be approved by Finance Manager
    require_approval = true;
    required_approver = FINANCE_MANAGER;
}

if (patient.has_history_of_default) {
    // High risk - needs director approval
    risk_level = HIGH;
    required_approver = HOSPITAL_DIRECTOR;
}
```

### Why We Need It (Tanzania Context)

**Revenue Recovery:**
```
Scenario: Patient needs 500,000 TSh surgery

Without payment plans:
- Patient can't pay full amount
- Surgery doesn't happen
- Hospital revenue: 0 TSh
- Patient stays sick

With payment plans:
- Patient pays 83,000 TSh/month × 6 months
- Surgery happens
- Patient gets better
- Hospital revenue: 500,000 TSh ✓
```

**Collection Improvement:**
```
Collection rates:
- Full payment required: 60% collection rate
  (40% patients can't pay in full, defaults)

- Payment plans offered: 85% collection rate
  (More patients can afford monthly payment)

Revenue difference:
100 invoices × 100,000 TSh each = 10M TSh total

Without plans: 60% × 10M = 6M TSh collected
With plans: 85% × 10M = 8.5M TSh collected
Improvement: +2.5M TSh = 25% revenue increase! 📈
```

---

## 7. 📊 FINANCIAL REPORTS & ANALYTICS (MEDIUM)

### Current Problem
```
Current dashboard: Only "financial controls summary"
Shows: Total invoiced, total paid, collection rate

Hospital director: "I need more details:"
- "How much did each department earn?"
- "Which payers are profitable?"
- "What's our collection rate by payer?"
- "Which services are popular?"
- "Revenue trend over 12 months?"

System: "Can't provide any of that" 😕
```

### Feature: How It Works

**Component 1: Revenue Reports**
```
REPORT 1: Daily Revenue Summary
├─ Date
├─ Total Revenue (Cash + Insurance)
├─ Cash Revenue
├─ Insurance Revenue (by payer)
├─ Exemptions Granted (-value)
├─ Discounts Applied (-value)
├─ Collections Rate
└─ Outstanding Receivables

REPORT 2: Revenue by Department
├─ Department: Laboratory
│  ├─ Services rendered: 145
│  ├─ Revenue: 2.8M TSh
│  ├─ Collection rate: 92%
│  └─ Top service: Malaria test (340 cases)
├─ Department: Radiology
│  ├─ Services rendered: 78
│  ├─ Revenue: 3.1M TSh
│  └─ Collection rate: 85%
└─ [More departments...]

REPORT 3: Revenue by Payer
├─ Insurance A (NHIF)
│  ├─ Invoices: 450
│  ├─ Revenue: 4.2M TSh
│  ├─ Average claim amount: 9,333 TSh
│  └─ Payment time: 14 days average
├─ Insurance B (Private)
│  ├─ Invoices: 120
│  ├─ Revenue: 1.8M TSh
│  └─ Payment time: 7 days average
├─ Cash Patients
│  ├─ Invoices: 600
│  ├─ Revenue: 3.5M TSh
│  └─ Collection rate: 78%
└─ [More payers...]

REPORT 4: Service Popularity
├─ Top 10 most-billed services
├─ Revenue per service
├─ Volume trends
├─ Price variations (cash vs insured)
└─ Physician referral patterns
```

**Component 2: Collection Analytics**
```
AGED RECEIVABLES REPORT:
┌──────────────────┬─────────┬────────┬──────────┐
│ Age of Invoice   │ Count   │ Amount │ Percent  │
├──────────────────┼─────────┼────────┼──────────┤
│ 0-30 days        │ 450     │ 4.5M   │ 30%      │ ✓ Current
│ 31-60 days       │ 280     │ 2.8M   │ 19%      │ ⚠️ Overdue
│ 61-90 days       │ 150     │ 1.5M   │ 10%      │ ⚠️ Very late
│ 90+ days         │ 220     │ 2.2M   │ 15%      │ ❌ Bad debt
│ Paid/Collected   │ 900     │ 9.0M   │ 60%      │ ✓
│ Written off      │ 50      │ 0.5M   │ 3%       │ Loss
└──────────────────┴─────────┴────────┴──────────┘

Collection Rate by Age:
- 0-30 days: 95% collected (recent invoices)
- 31-60 days: 70% collected (starting to age)
- 61-90 days: 40% collected (very late)
- 90+ days: 15% collected (mostly uncollectable)
```

**Component 3: Trend Analysis**
```
Year-over-Year Comparison:
                    2025        2026      Change
─────────────────────────────────────────────────
Total Revenue      120M TSh    150M TSh  +25% ✓
Avg Invoice         45K TSh     52K TSh  +15%
Collection Rate     78%         85%      +7 pts ✓
Days to Collect     21 days     18 days  -3 days ✓
Bad Debt %          5.2%        3.1%     -2.1 pts ✓

Monthly Trend:
        Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
2025    ███ ███ ██░ ███ ███ ███ ██░ ███ ███ ███ ███ ███
2026    ███ ███ ███ ███ ███ ███ ███ ███ ███ ███ ███ ███
        └─ Low  ─┘ └──── High ────┘
        (Seasonal pattern visible)
```

### Why We Need It (Tanzania Context)

**Management Decision Making:**
```
Director needs to know:
- Which departments are most profitable?
  → Can expand profitable departments
  
- Which payers pay slowest?
  → Can change payment terms or reduce reliance
  
- What's our collection efficiency?
  → Can identify billing/collection issues
  
- Is revenue growing?
  → Can demonstrate success to board
  
Without reports: Flying blind
With reports: Data-driven decisions
```

**Hospital Planning:**
```
Example: Hospital considering new lab equipment (10M TSh investment)

Without reports: "Um, we have some revenue..."
With reports: "Laboratory department generates 2.8M TSh/month, 
              92% collection rate, growing 8% YoY. 
              Equipment ROI: ~42 months. Recommendation: Proceed."
```

---

## 8. 💼 REVENUE RECOGNITION (MEDIUM)

### Current Problem
```
Current: Invoice created = Revenue recorded
Problem: Accounting doesn't work that way

Example:
- Invoice created: 100,000 TSh
- Revenue recorded: 100,000 TSh ✓
- But: Patient hasn't paid yet ❌
- Accounts receivable still owed

This is ACCRUAL ACCOUNTING problem:
- Revenue recognized when SERVICE PROVIDED (not when paid)
- Must reconcile with cash actually received
- Creates difference between "revenue" and "cash"
```

### Feature: How It Works

**Component 1: Service vs. Payment Recognition**
```
Timeline of Events:
─────────────────────────────────────────────────────

Day 1: Service Provided
       Action: Recognize revenue (ACCRUAL METHOD)
       Journal Entry:
         Debit: Accounts Receivable  100,000
         Credit: Medical Revenue              100,000
       (Revenue recognized even if not paid)

Day 15: Payment Received
        Action: Reduce receivables (CASH METHOD)
        Journal Entry:
          Debit: Cash                 100,000
          Credit: Accounts Receivable         100,000
        (No new revenue - already recognized)

RESULT:
- Revenue: 100,000 TSh (recognized on Day 1)
- Cash: 100,000 TSh (received on Day 15)
- Days outstanding: 14 days
- This is WHY hospitals have "accounts receivable" balance
```

**Component 2: GL Integration**
```
Current: Billing system generates invoices
Needed: Accounting system receives journal entries

BillingRevenueJournalEntry {
    - invoice_id
    - department (Lab, Radiology, etc)
    - service_type (Diagnostic, Surgical, etc)
    - patient_type (Insured, Cash, Exempt)
    - amount
    - revenue_account (specific GL account)
    - receivable_account (A/R account)
    - posting_date
    - posted_to_gl (yes/no)
    - posting_timestamp
}

Example journal entries generated automatically:

When invoice created:
  Debit: 4110 - Accounts Receivable (Lab)  100,000
  Credit: 7201 - Lab Revenue                        100,000

When invoice marked as exempt (pregnant woman):
  Debit: 4120 - Exemption Expense           100,000
  Credit: 7201 - Lab Revenue                        100,000
  (Revenue forgone, tracked as expense)

When payment received:
  Debit: 1010 - Cash                         100,000
  Credit: 4110 - Accounts Receivable (Lab)          100,000
```

**Component 3: Monthly Reconciliation**
```
Revenue Reconciliation Report:
                           Amount        GL Balance
─────────────────────────────────────────────────────
Revenue from Invoices    25,000,000
  less: Exempt/Waived    (2,000,000)    REVENUE: 23,000,000
  less: Bad Debt Write-off (500,000)
Cash Received            19,500,000

Accounts Receivable:
  Current (0-30 days)     4,200,000
  Overdue (31-90 days)    1,800,000
  Very Late (90+ days)    1,500,000
  Total A/R                           A/R: 7,500,000

Verification:
Revenue recognized:                   23,000,000
Less: Cash collected                 (19,500,000)
Should equal: Outstanding A/R          3,500,000
Actual A/R balance:                    3,500,000 ✓
Match: YES (reconciliation clean)
```

### Why We Need It (Tanzania Context)

**Financial Reporting:**
```
Hospital financial statement needs to show:
- Medical Revenue: 25M TSh (amount earned)
- Less: Bad debt provision: (1M TSh) (estimated uncollectable)
- Net Revenue: 24M TSh

But if billing system doesn't tie to accounting:
- Revenue overstated (includes exemptions/waivers)
- A/R not tracked accurately
- Cash position unclear
- Auditors can't verify numbers
- Bank won't give loans (can't prove cash flow)
```

**Compliance & Audit:**
```
External auditors will ask:
- "What revenue did you earn?" 
  → Must match GL revenue accounts
  
- "How much cash did you collect?"
  → Must match cash received
  
- "What's outstanding?"
  → Must match A/R balance
  
- "Why doesn't revenue equal cash?"
  → Must be explained by A/R aging

WITHOUT integration:
- Can't answer these questions
- Audit fails
- Hospital loses credibility
- Donors/lenders lose confidence

WITH integration:
- Numbers match
- Audit passes
- Hospital credible
- Can raise loans/grants
```

---

## 🎯 Priority & Timeline Summary

| # | Feature | Priority | Effort | Timeline | Impact |
|---|---------|----------|--------|----------|--------|
| 1 | Cash Billing | 🔴 CRITICAL | 40 hrs | Week 1 | +60% revenue |
| 2 | Exemptions | 🔴 CRITICAL | 20 hrs | Week 1 | MOH compliance |
| 3 | Billing Routing | 🔴 CRITICAL | 15 hrs | Week 1 | System clarity |
| 4 | Discounts/Waivers | 🟡 HIGH | 35 hrs | Week 2 | Operational |
| 5 | Refunds | 🟡 HIGH | 30 hrs | Week 3 | Patient satisfaction |
| 6 | Payment Plans | 🟡 HIGH | 50 hrs | Week 4 | +25% collection |
| 7 | Reports | 🟢 MEDIUM | 45 hrs | Week 5 | Management visibility |
| 8 | Revenue Recognition | 🟢 MEDIUM | 30 hrs | Later | Audit compliance |

---

## 🚀 Recommended Implementation Sequence

**Phase 1 (Week 1) - CRITICAL:**
```
1. Billing Routing Logic (15 hrs)
   → Foundation for all others
   
2. Cash Billing (40 hrs)
   → Enable 60% more patients
   
3. Exemptions (20 hrs)
   → MOH compliance
   
Total: 75 hours = Launch ready ✓
```

**Phase 2 (Week 2) - HIGH PRIORITY:**
```
4. Discounts & Waivers (35 hrs)
   → Operational flexibility
   
Total: 35 hours = Full operational support ✓
```

**Phase 3 (Weeks 3-5) - IMPORTANT:**
```
5. Refunds (30 hrs)
6. Payment Plans (50 hrs)
7. Financial Reports (45 hrs)

Total: 125 hours = Complete system ✓
```

**Phase 4 (Later) - ACCOUNTING:**
```
8. Revenue Recognition (30 hrs)
   → After system stable
```

---

## 📞 Recommendation

**Can we launch WITHOUT these features?**
- YES, technically (core billing works)
- But you'll lose 60% of revenue (no cash patients)
- MOH compliance violations (no exemptions)
- Operational chaos (no routing logic)

**Recommended approach:**
1. **Implement Phase 1 (75 hrs) BEFORE go-live**
   - Cash + exemptions + routing = core working system
   - 2 weeks development
   
2. **Implement Phase 2-3 (160 hrs) in first month**
   - Discounts, refunds, payment plans
   - Reports for management
   
3. **Implement Phase 4 (30 hrs) when stable**
   - Revenue recognition
   - Accounting integration

**Total effort: ~290 development hours (~7 weeks for 1 developer)**

---

**Analysis Complete**  
**Confidence: VERY HIGH**  
**Ready for Implementation Planning**
