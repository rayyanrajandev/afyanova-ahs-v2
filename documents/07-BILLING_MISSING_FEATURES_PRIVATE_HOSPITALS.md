# Missing Billing Features for Private Hospitals
## AHS (Arusha Health Services) - Private Hospital Context

**Document Version:** 1.0  
**Date:** April 15, 2026  
**Target:** Private hospitals targeting affluent clients  
**Status:** Specification for Implementation

---

## 📋 Executive Summary

After analyzing your **private hospital context**, here are the **ACTUAL missing features** that apply to private healthcare:

### **Removed (Public Hospital Only):**
- ❌ Patient Exemptions (MOH mandate - doesn't apply to private)
- ❌ Payment Plans (not appropriate for affluent, upfront-pay market)

### **Core Missing Features for Private Hospital:**

| # | Feature | Why Private Hospitals Need It |
|---|---------|-------------------------------|
| **1** | **Cash Billing** | Affluent walk-in patients, tourists, business people |
| **2** | **Selective Discounts** | Corporate contracts, VIP agreements, partnerships |
| **3** | **Refunds** | Premium clients expect accuracy in payments |
| **4** | **Billing Routing** | Route insured vs cash patients correctly |
| **5** | **Financial Reports** | Board/owner needs profitability insights |
| **6** | **Revenue Recognition** | GL integration for accurate accounting |

---

## 🏪 Feature #1: CASH BILLING (Affluent Walk-ins)

### **What It Is**
System to bill patients who pay cash directly - primary revenue stream for private hospitals

### **How It Works**

**Scenario: International Patient at Private Hospital**
```
Patient: James (UK tourist)
Service: Urgent consultation + lab tests
Payment: Cash (USD or TZS)

Step 1: Register Patient
├─ Name: James Smith
├─ Passport: Required for ID
├─ No appointment needed
└─ Create temporary record

Step 2: Receive Treatment
├─ Doctor consultation: 200,000 TZS
├─ Lab tests: 150,000 TZS
├─ Total: 350,000 TZS

Step 3: Immediate Billing
├─ Generate invoice
├─ Accept USD or TZS
├─ Process payment immediately
└─ Issue receipt

Step 4: Payment Options
├─ Cash (USD/TZS)
├─ Credit card
├─ Mobile money
└─ All accepted at desk
```

### **Why Private Hospitals Need It**
- **Primary revenue:** Affluent patients expect walk-in service
- **International patients:** Tourists, expats, business travelers
- **Immediate payment:** No credit needed
- **Multiple currencies:** Handle USD, EUR, TZS
- **Speed:** Quick billing process

### **Models Needed**
```php
CashPatientAccountModel
├─ patient_id
├─ account_balance
├─ currency: TZS, USD, EUR
├─ status: active, settled
└─ created_at

CashPaymentModel
├─ cash_account_id
├─ amount_paid
├─ currency_paid
├─ payment_method: cash, card, mobile_money
├─ card_reference (if card)
├─ paid_at
└─ receipt_number
```

---

## 💳 Feature #2: SELECTIVE DISCOUNTS (Corporate & VIP)

### **What It Is**
Flexible discounting for corporate contracts, VIP clients, partnership agreements

### **How It Works**

**Scenario 1: Corporate Contract**
```
Client: ABC Manufacturing Company
Agreement: Provide health services to employees
Discount: 15% on all services

Step 1: Patient presents
├─ Employee ID: ABC-5234
├─ Company: ABC Manufacturing
└─ Service: Checkup + treatment

Step 2: Apply corporate discount
├─ Policy: ABC Manufacturing = 15% off
├─ Price: 100,000 TZS
├─ Discount: 15,000 TZS
├─ Patient pays: 85,000 TZS

Step 3: Bill to company
├─ Create invoice to ABC Manufacturing
├─ Employee: Name
├─ Amount: 85,000 TZS
└─ Monthly consolidation

Step 4: Company payment
├─ ABC pays monthly
├─ All employee services consolidated
└─ Process at month end
```

**Scenario 2: VIP Discount**
```
Patient: High-profile client (CEO, diplomat)
Relationship: Long-term client
Request: 10% professional courtesy discount

Step 1: Request
├─ Patient asks: "Can I get professional courtesy?"
└─ Manager approves: YES (existing relationship)

Step 2: Apply discount
├─ Discount rate: 10%
├─ Amount: 100,000 TZS
├─ Discount: 10,000 TZS
├─ Final: 90,000 TZS

Step 3: Record discount
├─ Reason: "VIP professional courtesy"
├─ Approved by: Manager
└─ Audit trail for accounting
```

### **Why Private Hospitals Need It**
- **Corporate contracts:** Major revenue source
- **Competitive advantage:** Attract corporate clients
- **VIP relations:** Retain high-value patients
- **Partnerships:** Insurance companies, foreign clinics
- **Revenue control:** Track discounts for budgeting

### **Models Needed**
```php
DiscountPolicyModel
├─ code: "CORPORATE_ABC", "VIP_ELITE"
├─ name: "ABC Manufacturing Corp Discount"
├─ discount_type: percentage, fixed
├─ discount_value: 15 (%)
├─ applicable_services: array (or null = all)
├─ auto_apply: true (or require approval)
├─ active_from_date
├─ active_to_date
├─ status: active, inactive
└─ created_at

BillingDiscountModel
├─ invoice_id
├─ discount_policy_id
├─ original_amount
├─ discount_amount
├─ final_amount
├─ applied_by
├─ applied_at
└─ reason
```

---

## 💸 Feature #3: REFUNDS (Payment Accuracy)

### **What It Is**
Return money to premium clients for overpayments or service cancellations

### **How It Works**

**Scenario: VIP Client Overpayment**
```
Patient: Sarah (high-value client)
Invoice: 500,000 TZS
Payment: 600,000 TZS (overpaid 100,000)

Step 1: Identify overpayment
├─ System detects: Payment > Invoice
└─ Flag for refund

Step 2: Create refund
├─ Refund amount: 100,000 TZS
├─ Refund method: Credit card (original payment method)
└─ Status: "Pending"

Step 3: Approve & process
├─ Process refund immediately
├─ Confirmation to client
└─ Premium client satisfaction

Step 4: Record transaction
├─ Document for accounting
└─ GL entry for cash flow
```

### **Why Private Hospitals Need It**
- **Premium service expectation:** Clients expect accuracy
- **Payment security:** Handle overpayments properly
- **Trust:** Accurate refunds build reputation
- **International clients:** Multi-currency refunds
- **Accounting accuracy:** Track cash flow correctly

---

## 🔀 Feature #4: BILLING ROUTING (Insurance vs Cash)

### **What It Is**
Auto-route patients to correct billing path based on insurance/payment method

### **How It Works**

**Scenario 1: Insured Patient**
```
Patient: Amina
Insurance: Private insurance (Salama, AAR)
Service: Consultation

Step 1: Check insurance
├─ Query: Salama insurance active? YES
└─ Coverage status: Active

Step 2: Route decision
├─ Has active insurance: YES
└─ Route: "Insurance billing path"

Step 3: Use insurance pricing
├─ Apply Salama contract rates
├─ Insurance pays: 95%
├─ Patient pays: 5% (copay)
└─ Create insurance invoice
```

**Scenario 2: Cash Patient**
```
Patient: Michael (no insurance)
Service: Consultation

Step 1: Check insurance
├─ Insurance: NO
└─ Route: "Cash billing path"

Step 2: Use cash pricing
├─ Apply private hospital premium rates
├─ Patient pays: 100%
├─ Immediate payment expected

Step 3: Process
├─ Accept cash/card
├─ Issue receipt immediately
└─ Complete transaction
```

### **Why Private Hospitals Need It**
- **Accuracy:** Correct billing method every time
- **Efficiency:** Automatic routing, no manual decisions
- **Insurance compliance:** Proper authorization
- **Revenue optimization:** Correct payment method = more revenue

### **Models Needed**
```php
PatientInsuranceModel
├─ patient_id
├─ insurance_type: private, none
├─ insurance_provider: "SALAMA", "AAR", "AON"
├─ policy_number
├─ coverage_level: basic, premium
├─ status: active, inactive
└─ created_at

BillingRouteModel
├─ invoice_id
├─ routing_decision: cash, insurance
├─ payer_id
├─ decided_at
└─ created_at
```

---

## 📊 Feature #5: FINANCIAL REPORTS (Board Insights)

### **What It Is**
Dashboard reports for owners/board to track financial performance

### **Reports Needed**

**1. Daily Revenue Report**
```
Date: April 15, 2026

CASH PAYMENTS: 2,500,000 TZS
├─ Walk-in patients: 1,500,000
├─ Tourists: 600,000
└─ Business clients: 400,000

INSURANCE PAYMENTS: 1,800,000 TZS
├─ Salama Insurance: 900,000
├─ AAR Insurance: 600,000
└─ Other private: 300,000

OUTSTANDING:
├─ Insurance pending: 800,000 TZS
├─ Corporate accounts: 1,200,000 TZS
└─ Total: 2,000,000 TZS

DAILY TOTAL: 4,300,000 TZS
COLLECTION RATE: 68%
```

**2. Revenue by Payer**
```
Private Insurance (Salama, AAR, AON):
├─ Invoiced: 5,000,000 TZS (40%)
├─ Received: 4,500,000 TZS
├─ Outstanding: 500,000 TZS
└─ Collection: 90%

Corporate Accounts:
├─ Invoiced: 3,000,000 TZS (24%)
├─ Received: 2,400,000 TZS
├─ Outstanding: 600,000 TZS
└─ Collection: 80%

Cash/Walk-in:
├─ Invoiced: 4,000,000 TZS (32%)
├─ Received: 3,900,000 TZS
├─ Outstanding: 100,000 TZS
└─ Collection: 97.5%

TOTAL: 12,000,000 TZS
```

**3. Revenue by Department**
```
Surgery:
├─ Revenue: 4,000,000 TZS
├─ Collection: 85%
└─ Top payer: Private Insurance

Obstetrics:
├─ Revenue: 2,500,000 TZS
├─ Collection: 92%
└─ Top payer: Cash

Consulting:
├─ Revenue: 2,000,000 TZS
├─ Collection: 98%
└─ Top payer: Cash/Walk-in

Laboratory:
├─ Revenue: 1,500,000 TZS
├─ Collection: 100%
└─ Top payer: Cash
```

**4. Outstanding Receivables by Age**
```
Current (0-30 days): 500,000 TZS (25%)
31-60 days: 600,000 TZS (30%)
61-90 days: 400,000 TZS (20%)
> 90 days: 500,000 TZS (25%)
```

### **Why Private Hospitals Need It**
- **Owner visibility:** Track profitability
- **Decision making:** Where is revenue coming from?
- **Cash flow:** When will money arrive?
- **Performance:** Compare to targets
- **Planning:** Forecast revenue

---

## 💼 Feature #6: REVENUE RECOGNITION (GL Integration)

### **What It Is**
GL (General Ledger) entries to track revenue for financial statements and accounting

### **How It Works**

**Scenario: Patient Treated & Paid**
```
Patient: Ahmed
Service: Surgery
Amount: 1,000,000 TZS
Payment: Received immediately

Step 1: Invoice created
├─ Amount: 1,000,000 TZS
└─ Date: April 10

Step 2: Revenue recognition
├─ Trigger: Service delivered + payment received
├─ GL Entry:
│  ├─ DEBIT: Cash - 1,000,000 TZS
│  └─ CREDIT: Revenue - 1,000,000 TZS
└─ Date: April 10

Step 3: Financial statement impact
├─ Cash increased: +1,000,000 TZS
├─ Revenue increased: +1,000,000 TZS
└─ Net income increased: +1,000,000 TZS

Step 4: End of month
├─ Balance Sheet shows: Cash +1,000,000
├─ P&L shows: Revenue +1,000,000
└─ Accounting reconciles
```

**Scenario: Insurance Billing (Delayed Payment)**
```
Patient: Zainab
Service: Consultation
Amount: 500,000 TZS
Payer: Salama Insurance (pays later)

Step 1: Invoice submitted
├─ Amount: 500,000 TZS
└─ Date: April 10

Step 2: Recognize revenue immediately
├─ GL Entry (Apr 10):
│  ├─ DEBIT: Accounts Receivable (Salama) - 500,000 TZS
│  └─ CREDIT: Revenue - 500,000 TZS

Step 3: Insurance pays (Apr 25)
├─ GL Entry (Apr 25):
│  ├─ DEBIT: Cash - 500,000 TZS
│  └─ CREDIT: Accounts Receivable (Salama) - 500,000 TZS

Step 4: Financial impact
├─ Apr 10: Revenue recognized, A/R increased
├─ Apr 25: Cash received, A/R decreased
└─ Net: Revenue = 500,000 TZS on Apr 10
```

### **GL Accounts Needed**
```
1000: Cash
1200: Accounts Receivable
├─ 1210: Insurance Receivable
└─ 1220: Corporate Receivable

4000: Revenue
├─ 4100: Surgery Revenue
├─ 4200: Consultation Revenue
├─ 4300: Lab Revenue
└─ 4400: Other Revenue

6100: Bad Debt Expense
```

### **Why Private Hospitals Need It**
- **Financial statements:** Show profit/loss
- **Tax compliance:** TRA requires GL
- **Accounting accuracy:** Match invoices to cash
- **Audit ready:** Support financial statements
- **Owner reporting:** "How much profit did we make?"

---

## 📋 Summary Table: Private Hospital Features

| Feature | Priority | Effort | Payoff |
|---------|----------|--------|--------|
| **1. Cash Billing** | 🔴 CRITICAL | 20 hours | Primary revenue stream |
| **2. Selective Discounts** | 🟡 HIGH | 15 hours | Corporate contracts |
| **3. Refunds** | 🟡 HIGH | 15 hours | Client satisfaction |
| **4. Billing Routing** | 🟡 HIGH | 10 hours | Billing accuracy |
| **5. Financial Reports** | 🟡 HIGH | 25 hours | Owner visibility |
| **6. Revenue Recognition** | 🟡 MEDIUM | 15 hours | Accounting accuracy |

---

## 🚀 Implementation Roadmap (Private Hospital)

### **Phase 1 (Week 1): MUST HAVE**
- ✅ Cash Billing (walk-in revenue)
- ✅ Billing Routing (insurance vs cash)
- ✅ Selective Discounts (corporate support)

**Effort:** 45 hours  
**Outcome:** Handle all private hospital billing scenarios

### **Phase 2 (Week 2-3): IMPORTANT**
- ✅ Refunds (client satisfaction)
- ✅ Financial Reports (board visibility)

**Effort:** 40 hours  
**Outcome:** Financial transparency

### **Phase 3 (Week 4): NICE TO HAVE**
- ✅ Revenue Recognition (GL integration)

**Effort:** 15 hours  
**Outcome:** Accounting accuracy

---

## ✅ WHAT TO REMOVE FROM PREVIOUS DOC

**These do NOT apply to private hospitals:**

### ❌ Patient Exemptions
- **Why removed:** No MOH mandate for private hospitals
- **Context:** Only public hospitals must provide free maternity, pediatric care
- **Private logic:** Charge all patients, selective charity only

### ❌ Payment Plans
- **Why removed:** Affluent market expects upfront payment
- **Context:** "Can I pay in 3 installments?" Not typical private client expectation
- **Private logic:** Accept immediate payment or full insurance coverage

---

## 🎯 Key Differences: Private vs Public

| Aspect | Public Hospital | Private Hospital |
|--------|-----------------|------------------|
| **Exemptions** | MOH mandate ✅ | No exemptions ❌ |
| **Payment Plans** | Common practice ✅ | Rare exception ❌ |
| **Cash Billing** | Necessary ✅ | Primary revenue ✅ |
| **Discounts** | Limited ❌ | Selective ✅ |
| **Collections** | Flexible ❌ | Strict ✅ |
| **Client base** | Poor-to-middle | Affluent-to-elite |
| **Payment expectation** | Delayed OK | Immediate preferred |
| **Focus** | Access & equity | Quality & profit |

---

**Document Status:** Ready for development  
**Next Step:** Begin Phase 1 (Cash Billing, Routing, Discounts)  
**Target:** Private hospital billing excellence
