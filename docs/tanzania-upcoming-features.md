# Tanzania Billing — Upcoming Features (Backlog)

> Created: 2026-06-25
> These features are planned but not yet implemented. They address MOH regulatory
> compliance and reporting requirements for Tanzania healthcare facilities.

---

## 1. MOH Exemption Engine

### Why

Tanzania's Ministry of Health mandates specific patient categories to receive
free or subsidized care. Facilities must track these separately for quarterly
MOH reporting and accreditation.

### Required Exemption Categories

| Category | Discount | Legal Basis |
|---|---|---|
| Pregnant women | 100% | MOH Maternal Health Policy |
| Children under 5 | 100% | MOH Child Health Policy |
| Elderly (60+) | Subsidized (varies) | MOH Senior Citizen Policy |
| Disabled persons | 80% | Persons with Disability Act |
| HIV/AIDS patients | Exempt | Vertical program funding |
| TB patients | Exempt | Vertical program funding |

### Implementation Outline

#### A. Database

Add columns to `billing_invoices` or create a new `billing_exemptions` table:

```php
Schema::create('billing_exemptions', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->uuid('tenant_id');
    $table->uuid('facility_id');
    $table->uuid('billing_invoice_id');
    $table->uuid('patient_id');
    $table->string('exemption_type');       // pregnant, under_5, elderly, disabled, hiv, tb
    $table->string('exemption_category');    // full, partial
    $table->decimal('exemption_percent', 5, 2);
    $table->decimal('exempted_amount', 15, 2);
    $table->string('verification_document')->nullable(); // e.g. clinic card, referral letter
    $table->text('notes')->nullable();
    $table->timestamps();

    $table->foreign('billing_invoice_id')->references('id')->on('billing_invoices')->cascadeOnDelete();
    $table->index(['tenant_id', 'facility_id']);
    $table->index(['exemption_type', 'created_at']);
});
```

Alternatively, extend the existing `billing_discounts` table:
- Add `exemption_category` nullable string
- Add `auto_apply` boolean for MOH-mandated exemptions
- Add seed data for each exemption category as a `BillingDiscountPolicy`

#### B. Backend

- `Domain/ValueObjects/BillingExemptionType.php` — enum for categories
- `Domain/Repositories/BillingExemptionRepositoryInterface.php`
- `Infrastructure/Models/BillingExemptionModel.php`
- `Application/UseCases/ApplyMohExemptionUseCase.php` — auto-detect and apply
- Service to check patient age/gender/diagnosis at billing time

#### C. Auto-Application Logic

During invoice creation, check patient demographics and encounter diagnoses:

```
Patient.age < 5        → auto-apply "under_5" exemption (100%)
Patient.is_pregnant    → auto-apply "pregnant" exemption (100%)
Patient.age >= 60      → auto-apply "elderly" subsidy
Patient.has_diagnosis('HIV')  → auto-apply "hiv" exemption
Patient.has_diagnosis('TB')   → auto-apply "tb" exemption
```

These should apply **after** insurance coverage is calculated but **before**
the final invoice total is computed.

#### D. Reporting

Quarterly MOH exemption report:
- Count of patients by exemption category
- Total amount exempted by category
- Comparison to previous quarter

---

## 2. DHIS2 / MTUHA Monthly Report Export

### Why

All Tanzania health facilities must submit monthly HMIS reports (MTUHA format)
to the Ministry of Health via DHIS2. This is required for facility accreditation
and regulatory compliance.

### Regulatory Reference

- **MTUHA** — Mfumo wa Taarifa za Uendeshaji wa Huduma za Afya (Health Management
  Information System)
- **HMIS 071** — Monthly outpatient report form
- **HMIS 072** — Monthly inpatient report form
- Generated via CSV or JSON for import into DHIS2

### Report Data Required

#### Revenue by Payer Type (HMIS-compatible)

| Column | Source |
|---|---|
| Month/Year | Invoice created_at |
| Facility Name | Facility context |
| Cash/Out-of-pocket | Invoice.payer_type = 'cash' |
| NHIF Claims | Invoice.payer_type = 'insurance_claim' |
| Private Insurance | Invoice.payer_type = 'insurance' via private contract |
| Employer/Corporate | Invoice.payer_type = 'corporate' |
| Donor/NGO | Invoice.payer_type = 'donor' |
| MOH Exemptions | billing_exemptions total |
| Total Revenue | Sum of all invoice totals |

#### Service Volumes by Department

| Column | Source |
|---|---|
| Department | invoice line items → catalog → department mapping |
| OPD visits | appointment counts |
| IPD admissions | admission counts |
| Lab tests | procedure counts via service_catalog |
| Radiology exams | procedure counts |
| Pharmacy dispensations | linked pharmacy orders |

#### Exemption Summary

| Column | Source |
|---|---|
| Pregnant women exempted | billing_exemptions where type = 'pregnant' |
| Under-5 exempted | billing_exemptions where type = 'under_5' |
| Elderly subsidized | billing_exemptions where type = 'elderly' |
| Disabled exempted | billing_exemptions where type = 'disabled' |
| HIV exempted | billing_exemptions where type = 'hiv' |
| TB exempted | billing_exemptions where type = 'tb' |

### Implementation Outline

#### A. Create Report Service

```
app/Modules/Billing/Infrastructure/Reporting/
├── MohMonthlyReportService.php      # Generates MTUHA-compatible dataset
├── Dhis2ExportService.php           # Formats for DHIS2 CSV/JSON import
├── ReportPeriod.php                 # Value object for month/year
└── Exceptions/
    └── ReportGenerationException.php
```

#### B. Report Generation Flow

```php
class MohMonthlyReportService
{
    public function generate(string $facilityId, int $year, int $month): array
    {
        // 1. Query billing_invoices for the period
        // 2. Group by payer_type, department
        // 3. Sum totals, count encounters
        // 4. Aggregate exemptions
        // 5. Return structured array matching MTUHA format
    }
}
```

#### C. Export Formats

- **CSV** — Column-mapped to HMIS 071/072 paper forms
- **JSON** — For direct DHIS2 API import (future)
- **PDF** — Printable summary for hard-copy submission

#### D. Controller & Route

```
GET /api/v1/billing-reports/mtuha?year=2026&month=6&format=csv
GET /api/v1/billing-reports/mtuha?year=2026&month=6&format=json
GET /api/v1/billing-reports/mtuha?year=2026&month=6&format=pdf
```

#### E. Scheduled Task

```php
// app/Console/Kernel.php
$schedule->command('billing:generate-mtuha-report --last-month')
    ->monthlyOn(1, '06:00')
    ->onOneServer();
```

---

## 3. NHIF Remittance Processor

Implemented in Phase 3. See:

- `Infrastructure/Integrations/NHIF/NhifRemittanceProcessor.php` — CSV/JSON file parser + claim reconciliation
- `Infrastructure/Models/BillingNhifRemittanceModel.php` — remittance header records
- `Infrastructure/Models/BillingNhifRemittanceItemModel.php` — individual claim line items
- `Presentation/Http/Controllers/BillingNhifRemittanceController.php` — upload, history, show

### NHIF Claim Adjudication Flow

```
1. Invoice is issued with insurance route (NHIF) ✓
2. Service lines have NHIF tariff codes in catalog ✓
3. User clicks "Submit Claim" → API call to NHIF ✓
4. NHIF returns claim reference number ✓
5. Claim status tracks: submitted → acknowledged → rejected ✓
6. NHIF remittance file arrives → auto-reconcile against claims ✓
```

### Upload API

```
POST /api/v1/billing-nhif/remittances/upload
Content-Type: multipart/form-data
file: remittance.csv (CSV or JSON)
```

CSV expected columns: `claim_reference`, `member_number`, `patient_name`, `claimed_amount`, `approved_amount`, `rejected_amount`, `settled_amount`, `decision`, `decision_reason`

JSON expected structure: `{ "items": [{ "claimReference": "...", ... }] }` or flat array.

---

## 4. SMS Integration

Implemented in Phase 3. Uses Africa's Talking API via Laravel's HTTP client (no external package needed).

- `Domain/Integrations/SmsProviderInterface.php` — `send(phone, message): SmsResult`
- `Infrastructure/Integrations/Sms/AfricasTalkingSmsProvider.php` — concrete implementation
- `Infrastructure/Integrations/Sms/BillingSmsService.php` — service with `sendPaymentLinkSms()`, `sendReceiptSms()`, `sendCustomSms()`
- `Infrastructure/Models/BillingSmsLogModel.php` — audit trail for all sent SMS
- `Presentation/Http/Controllers/BillingSmsController.php` — send payment link SMS, receipt SMS, custom SMS, view log
- Auto-sends SMS when M-Pesa push is initiated via `BillingPaymentLinkController`

### Configuration

Add to `.env`:
```
AFRICASTALKING_USERNAME=
AFRICASTALKING_API_KEY=
AFRICASTALKING_FROM=
AFRICASTALKING_BASE_URL=https://api.africastalking.com
```

---

## Priority Matrix

| Feature | Effort | Impact | Regulatory | Status |
|---|---|---|---|---|
| MOH Exemption Engine | 1-2 weeks | High | ✅ Required | Pending |
| DHIS2 / MTUHA Export | 3-4 weeks | Medium | ✅ Required | Pending |
| NHIF e-Claims | — | High | ✅ Required | ✅ Phase 2 — Done |
| Patient M-Pesa Self-Service | — | Medium | ❌ Optional | ✅ Phase 2 — Done |
| NHIF Tariff Sync | — | Low | ❌ Nice-to-have | ✅ Phase 2 — Done |
| NHIF Remittance Processor | — | High | ✅ Required | ✅ Phase 3 — Done |
| SMS Integration | — | Low | ❌ Optional | ✅ Phase 3 — Done |
