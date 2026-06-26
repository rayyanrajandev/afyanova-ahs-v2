# Billing Integrations — Live API Testing Guide

> **Purpose**: Verify each external integration against real/sandbox endpoints.
> **Prerequisites**: Valid credentials in `.env` (see below). Run `php artisan config:clear` after `.env` changes.

---

## 1. Prerequisites — Required .env Variables

```ini
# --- Selcom (M-Pesa / Mobile Money) ---
SELCOM_BASE_URL=https://apipg.selcommobile.com
SELCOM_API_KEY=
SELCOM_API_SECRET=
SELCOM_VENDOR=
SELCOM_PIN=

# --- NHIF API ---
NHIF_API_BASE_URL=https://api.nhif.or.tz
NHIF_CLIENT_ID=
NHIF_CLIENT_SECRET=
NHIF_FACILITY_CODE=
NHIF_API_SCOPE=OMRS

# --- TRA / TotalVFD ---
TOTALVFD_BASE_URL=https://testapi.totalvfd.co.tz
TOTALVFD_API_KEY=
TOTALVFD_API_SECRET=
TOTALVFD_TIN=
TOTALVFD_VRN=
TOTALVFD_BUSINESS_NAME=
TOTALVFD_EFD_SERIAL=
TOTALVFD_TAX_OFFICE=

# --- SMS (Africa's Talking) ---
AFRICASTALKING_USERNAME=
AFRICASTALKING_API_KEY=
AFRICASTALKING_FROM=AFRYA-HS
```

> **Selcom sandbox**: use `https://apipg.selcommobile.com` (not `api.selcommobile.com`).
> **TotalVFD sandbox**: `https://testapi.totalvfd.co.tz`. **Prod**: `https://api.totalvfd.co.tz`.
> **NHIF**: use live `api.nhif.or.tz` — no public sandbox. Contact NHIF for test credentials.

---

## 2. Authentication Flows

### 2.1 NHIF — OMRS STS Identity (Member Verification)

```bash
# Obtain OAuth2 token
curl -s -X POST https://api.nhif.or.tz/omrs/stsidentity \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=OMRS"
# Response: {"access_token":"eyJ...","expires_in":3600}
```

### 2.2 NHIF — API Gateway (e-Claims, Tariff Sync)

```bash
curl -s -X POST https://api.nhif.or.tz/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
# Response: {"access_token":"eyJ...","expires_in":3600}
```

### 2.3 Selcom — Basic Auth Headers

Selcom uses HMAC-SHA256 signed headers. The application builds this automatically; manually:

```bash
# Generate signature
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S%z)
SIGNATURE=$(echo -n "$TIMESTAMP.$API_SECRET" | openssl dgst -sha256 -hmac "$API_SECRET" | awk '{print $NF}')

curl -s -X POST https://apipg.selcommobile.com/v1/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: SELCOM $API_KEY:$SIGNATURE" \
  -H "Timestamp: $TIMESTAMP" \
  -d '{"vendor":"YOUR_VENDOR","pin":"YOUR_PIN","transid":"INV-TEST-001","reference":"REF-001","amount":1000,"msisdn":"255712345678","currency":"TZS","description":"Test payment"}'
```

### 2.4 Africa's Talking — API Key Header

```bash
curl -s -X POST https://api.africastalking.com/version1/messaging \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "apiKey: YOUR_API_KEY" \
  -d "username=YOUR_USERNAME" \
  -d "to=+255712345678" \
  -d "message=Test SMS from AfyaNova" \
  -d "from=AFRYA-HS"
```

---

## 3. Testing Each Integration

### 3.1 NHIF Member Verification

```bash
# Set auth token
TOKEN=$(curl -s -X POST https://api.nhif.or.tz/omrs/stsidentity \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=OMRS" | jq -r '.access_token')

# Get member details by member ID
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.nhif.or.tz/omrs/api/v1/Verification/GetMemberDetails?MemberID=NHIF12345"

# Get card status by card number
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.nhif.or.tz/omrs/api/v1/Verification/GetCardStatus?CardNumber=0123456789012"
```

**App endpoint**: `GET /api/v1/billing-nhif/verify/{memberId}` (requires `billing.insurance.read`).

```bash
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  -H "X-Tenant: YOUR_TENANT_ID" \
  -H "X-Facility: YOUR_FACILITY_ID" \
  "https://your-instance/api/v1/billing-nhif/verify/NHIF12345"
```

### 3.2 NHIF e-Claims Submission

```bash
TOKEN=$(curl -s -X POST https://api.nhif.or.tz/auth/token \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" | jq -r '.access_token')

# Submit claim
curl -s -X POST https://api.nhif.or.tz/claims/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "facilityCode": "YOUR_FACILITY_CODE",
    "memberNumber": "NHIF12345",
    "authorizationNumber": "AUTH67890",
    "claimReference": "CLM-TEST-001",
    "claimDate": "2026-06-25",
    "totalAmount": 50000,
    "items": [
      {"serviceCode":"OPD-CONSULT","serviceName":"OPD Consultation","quantity":1,"unitPrice":30000,"total":30000}
    ]
  }'

# Check claim status
curl -s "https://api.nhif.or.tz/claims/status?claimReference=CLM-TEST-001&facilityCode=YOUR_FACILITY_CODE" \
  -H "Authorization: Bearer $TOKEN"
```

**App endpoint**: `POST /api/v1/billing-nhif/claims/cases/{caseId}/submit` (requires `billing.integrations.nhif.submit`).

### 3.3 NHIF Tariff Sync

```bash
TOKEN=$(curl -s -X POST https://api.nhif.or.tz/auth/token \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" | jq -r '.access_token')

# Fetch tariff schedule
curl -s "https://api.nhif.or.tz/tariffs?facilityCode=YOUR_FACILITY_CODE&effectiveDate=2026-06-25" \
  -H "Authorization: Bearer $TOKEN"
```

**App endpoints**:
- `GET /api/v1/billing-nhif/tariffs/preview` — preview before import (`billing.insurance.read`)
- `POST /api/v1/billing-nhif/tariffs/import` — import into catalog (`billing.integrations.nhif.tariff-sync`)
- `GET /api/v1/billing-nhif/tariffs/history` — import history (`billing.insurance.read`)
- `GET /api/v1/billing-nhif/tariffs/catalog` — catalog items with NHIF codes (`billing.insurance.read`)

### 3.4 Selcom M-Pesa Collection

```bash
curl -s -X POST https://apipg.selcommobile.com/v1/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: SELCOM $API_KEY:$SIGNATURE" \
  -H "Timestamp: $TIMESTAMP" \
  -d '{
    "vendor":"YOUR_VENDOR","pin":"YOUR_PIN",
    "transid":"INV-TEST-001","reference":"REF-001",
    "amount":1000,"msisdn":"255712345678",
    "currency":"TZS","description":"Test payment"
  }'
```

**App endpoint**: `POST /api/v1/billing-payments/collect` (requires `billing.payments.record`).

### 3.5 M-Pesa Self-Payment (Payment Link)

**App endpoint**: `POST /api/v1/billing-payment-links/initiate` (requires `billing.payments.record`).

```bash
curl -s -X POST "https://your-instance/api/v1/billing-payment-links/initiate" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "X-Tenant: YOUR_TENANT_ID" \
  -H "X-Facility: YOUR_FACILITY_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "billing_invoice_id": "INVOICE_UUID",
    "phone_number": "0712345678",
    "amount": 50000
  }'
```

### 3.6 TotalVFD Fiscal Receipt

```bash
# Issue receipt
curl -s -X POST https://testapi.totalvfd.co.tz/api/receipt \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_API_KEY" \
  -H "api_secret: YOUR_API_SECRET" \
  -d '{
    "tin":"YOUR_TIN","vrn":"YOUR_VRN",
    "efd_serial":"YOUR_EFD_SERIAL",
    "receipt_type":"INVOICE",
    "currency":"TZS",
    "total":50000,
    "items":[{"item":"OPD Consultation","qty":1,"price":30000}]
  }'
```

**App endpoints**:
- `POST /api/v1/billing-tra/receipt/issue` — issue fiscal receipt (`billing.integrations.tra.manage`)
- `POST /api/v1/billing-tra/receipt/z-report` — daily Z-report
- `POST /api/v1/billing-tra/receipt/verify` — verify receipt

### 3.7 NHIF Remittance Processor

**App endpoints** (file upload, no external API call):
- `POST /api/v1/billing-nhif/remittances/upload` — upload CSV/JSON remittance (`billing.integrations.nhif.remittance`)
- `GET /api/v1/billing-nhif/remittances/history` — list uploads (`billing.insurance.read`)
- `GET /api/v1/billing-nhif/remittances/{id}` — view remittance detail

```bash
curl -s -X POST "https://your-instance/api/v1/billing-nhif/remittances/upload" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "X-Tenant: YOUR_TENANT_ID" \
  -H "X-Facility: YOUR_FACILITY_ID" \
  -F "file=@remittance.csv"
```

### 3.8 SMS (Africa's Talking)

**App endpoints** (requires `billing.payments.record`):
- `POST /api/v1/billing-sms/payment-link` — send payment link SMS
- `POST /api/v1/billing-sms/receipt` — send receipt SMS
- `POST /api/v1/billing-sms/custom` — send custom SMS
- `GET /api/v1/billing-sms/logs` — view SMS log (`billing.payments.read`)

```bash
curl -s -X POST "https://your-instance/api/v1/billing-sms/custom" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "X-Tenant: YOUR_TENANT_ID" \
  -H "X-Facility: YOUR_FACILITY_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "0712345678",
    "message": "Your bill of TZS 50,000 is due. Pay via M-Pesa: pay.afyanova.health/pay/REF-001"
  }'
```

---

## 4. Quick Validation Script

```bash
#!/usr/bin/env bash
# test-live-integrations.sh — Validate that all external APIs respond

set -euo pipefail

echo "=== 1. Selcom Status ==="
curl -s -o /dev/null -w "%{http_code}" "https://apipg.selcommobile.com/health" || echo "unreachable"

echo -e "\n=== 2. NHIF API ==="
curl -s -o /dev/null -w "%{http_code}" "https://api.nhif.or.tz/health" || echo "unreachable"

echo -e "\n=== 3. TotalVFD (Sandbox) ==="
curl -s -o /dev/null -w "%{http_code}" "https://testapi.totalvfd.co.tz/health" || echo "unreachable"

echo -e "\n=== 4. Africa's Talking ==="
curl -s -o /dev/null -w "%{http_code}" "https://api.africastalking.com" || echo "unreachable"

echo -e "\n=== 5. App Health ==="
curl -s -o /dev/null -w "%{http_code}" "https://your-instance/api/health"

echo -e "\nDone."
```

---

## 5. Credential Sources

| Integration | Sandbox Credentials | Production Credentials |
|---|---|---|
| **Selcom** | Request from Selcom support (sandbox) | Selcom merchant dashboard |
| **NHIF** | Contact NHIF IT — no public sandbox | NHIF onboarding documents |
| **TotalVFD** | TRA EFD test portal | TRA EFD live portal after certification |
| **Africa's Talking** | [AT Sandbox](https://sandbox.africastalking.com) | AT Dashboard → Products → SMS |

---

## 6. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `401 Unauthorized` (NHIF) | Client credentials expired or wrong scope | Verify `NHIF_CLIENT_ID`/`NHIF_CLIENT_SECRET`; check `NHIF_API_SCOPE` |
| `400 Bad Request` (NHIF claims) | `facilityCode` missing or invalid | Ensure `NHIF_FACILITY_CODE` is set |
| `500` from Selcom | HMAC signature mismatch | Regenerate with correct `api_key`/`api_secret` |
| AT SMS shows `Failed` | Sender ID not approved or wrong format | Use alphanumeric `from` (max 11 chars) |
| TotalVFD `VRN_REQUIRED` | VRN not registered with TRA | Complete TRA EFD registration |
| Confusing `422` responses | Usually validation — check `message` field in JSON body | Pass `-v` to curl for full response body |
