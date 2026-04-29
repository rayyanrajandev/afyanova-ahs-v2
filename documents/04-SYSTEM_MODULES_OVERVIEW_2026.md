# System Modules Documentation
## Afyanova AHS v2 - Module Overview & Architecture

**Document Version:** 1.0  
**Date:** April 15, 2026  
**Total Modules:** 17 Core Modules  
**Architecture:** Modular Monolith (DDD - Domain-Driven Design)

---

## 📊 Module Summary

| # | Module | Type | Controllers | Purpose |
|----|--------|------|-------------|---------|
| 1 | **Admission** | Clinical | 1 | Hospital admission management |
| 2 | **Appointment** | Clinical | 1 | Appointment scheduling & management |
| 3 | **Authentication** | System | 1 | User authentication & session mgmt |
| 4 | **Billing** | Finance | 4 | Invoicing, contracts, service catalog |
| 5 | **ClaimsInsurance** | Finance | 2 | Insurance claims & case management |
| 6 | **Department** | Operations | 1 | Hospital department management |
| 7 | **EmergencyTriage** | Clinical | 1 | Emergency room triage cases |
| 8 | **InpatientWard** | Clinical | 2 | Ward management & discharge |
| 9 | **InventoryProcurement** | Operations | 3 | Supplies, suppliers, warehouses |
| 10 | **Laboratory** | Clinical | 1 | Lab orders & test results |
| 11 | **MedicalRecord** | Clinical | 2 | Patient records & documents |
| 12 | **Patient** | Clinical | 2 | Patient profiles & medication safety |
| 13 | **Pharmacy** | Clinical | 1 | Medication dispensing & orders |
| 14 | **Platform** | System | 10 | System admin, RBAC, multi-facility |
| 15 | **Radiology** | Clinical | 1 | Imaging orders & DICOM management |
| 16 | **Staff** | Operations | 7 | Staff profiles, credentialing, privileges |
| 17 | **TheatreProcedure** | Clinical | 1 | Surgical theatre procedures |

**Total Controllers:** 41  
**Total API Endpoints:** 100+ (varies by controller)

---

## 📁 Module Structure (DDD Pattern)

Each module follows Domain-Driven Design with this structure:

```
Modules/
└── [ModuleName]/
    ├── Application/           ← Use cases & business logic
    │   ├── Services/         ← Business operations
    │   ├── DTOs/            ← Data transfer objects
    │   └── Support/         ← Helpers & utilities
    ├── Domain/               ← Core domain models
    │   ├── Models/          ← Domain entities
    │   ├── Events/          ← Domain events
    │   └── Repositories/    ← Data access abstractions
    ├── Infrastructure/       ← Implementation details
    │   ├── Repositories/    ← Database implementations
    │   ├── QueryAppliers/   ← Database query logic
    │   └── Observers/       ← Event listeners
    └── Presentation/         ← API layer
        └── Http/
            ├── Controllers/  ← API endpoints
            ├── Requests/     ← Request validation
            └── Transformers/ ← Response formatting
```

---

## 🏥 Clinical Modules (8 Modules)

### 1. **Admission Module**
**Purpose:** Hospital admission & patient admission workflows

**Key Features:**
- Patient admission registration
- Admission history tracking
- Bed/room assignment
- Admission status management

**Controllers:**
- `AdmissionController` - CRUD operations

**Related To:**
- Patient module (patient data)
- InpatientWard (bed assignment)
- Department (ward selection)

---

### 2. **Appointment Module**
**Purpose:** Schedule & manage patient appointments

**Key Features:**
- Appointment scheduling
- Doctor availability slots
- Patient scheduling
- Appointment history & tracking
- Appointment notifications

**Controllers:**
- `AppointmentController` - Schedule management

**Related To:**
- Patient (appointment owner)
- Staff (doctor assignment)
- Department (location)

---

### 3. **EmergencyTriage Module**
**Purpose:** Emergency room operations & patient triage

**Key Features:**
- Triage case creation
- Patient priority assessment
- Emergency history
- ER workflow tracking

**Controllers:**
- `EmergencyTriageCaseController` - ER case management

**Related To:**
- Patient (emergency patient)
- Department (ER location)
- MedicalRecord (clinical notes)

---

### 4. **InpatientWard Module**
**Purpose:** Inpatient ward management & patient care

**Key Features:**
- Ward patient tracking
- Bed assignment & management
- Daily ward rounds
- Discharge planning & checklists
- Patient transfer between wards

**Controllers:**
- `InpatientWardController` - Ward management
- `InpatientWardDischargeChecklistDocumentController` - Discharge docs

**Related To:**
- Admission (admitted patients)
- MedicalRecord (clinical notes)
- Staff (nurses, doctors)

**Special Feature:** Discharge checklists with document attachment

---

### 5. **Laboratory Module**
**Purpose:** Lab test ordering & results management

**Key Features:**
- Lab test orders creation
- Test sample tracking
- Lab results recording
- Result notifications
- Test history

**Controllers:**
- `LaboratoryOrderController` - Lab order management

**Related To:**
- Patient (test owner)
- MedicalRecord (results storage)
- Staff (lab technician)

**Standards:** DICOM compatibility for imaging

---

### 6. **MedicalRecord Module**
**Purpose:** Patient medical records & clinical documentation

**Key Features:**
- Medical record creation & editing
- Clinical notes
- Document attachment (PDFs, images)
- Record versioning & history
- Access audit trail

**Controllers:**
- `MedicalRecordController` - Record management
- `MedicalRecordDocumentController` - Document handling

**Related To:**
- Patient (record owner)
- All clinical modules (data source)

**Documents:** Print-ready medical record generation

---

### 7. **Pharmacy Module**
**Purpose:** Medication dispensing & order management

**Key Features:**
- Medication orders
- Pharmacy inventory
- Dispensing workflows
- Drug interaction checking
- Medication history

**Controllers:**
- `PharmacyOrderController` - Medication order management

**Related To:**
- Patient (medication recipient)
- InventoryProcurement (stock management)
- Staff (pharmacist)

---

### 8. **Radiology Module**
**Purpose:** Medical imaging & radiology management

**Key Features:**
- Imaging orders
- DICOM image storage
- Radiology reports
- Imaging history

**Controllers:**
- `RadiologyOrderController` - Imaging order management

**Related To:**
- Patient (imaging patient)
- MedicalRecord (image storage)
- Staff (radiologist)

**Standards:** DICOM compliant for imaging data

---

### 9. **TheatreProcedure Module**
**Purpose:** Surgical theatre & procedure management

**Key Features:**
- Surgical procedure scheduling
- Theatre availability
- Procedure documentation
- Surgical team assignment

**Controllers:**
- `TheatreProcedureController` - Procedure management

**Related To:**
- Appointment (procedure scheduling)
- Staff (surgical team)
- Patient (procedure patient)

---

## 💰 Finance Modules (2 Modules)

### 10. **Billing Module**
**Purpose:** Invoice generation, billing, & financial management

**Key Features:**
- Invoice generation & management
- Service catalog & pricing
- Payer contracts & agreements
- Bill payment tracking
- Financial reporting

**Controllers:**
- `BillingInvoiceController` - Invoice management
- `BillingPayerContractController` - Payer contract management
- `BillingServiceCatalogController` - Service pricing
- `BillingInvoiceDocumentController` - Invoice documents (PDF)

**Related To:**
- Patient (bill owner)
- All clinical modules (service billing)
- ClaimsInsurance (insurance billing)

**Special Feature:** Multi-payer support, contract management

---

### 11. **ClaimsInsurance Module**
**Purpose:** Insurance claims processing & management

**Key Features:**
- Insurance claim creation
- Claim status tracking
- Claim documents (attachments)
- Insurance case management
- Claim history

**Controllers:**
- `ClaimsInsuranceCaseController` - Claim case management
- `ClaimsInsuranceCaseDocumentController` - Claim documents

**Related To:**
- Billing (claim payment)
- Patient (claim owner)
- MedicalRecord (supporting docs)

---

## 🏢 Operations Modules (3 Modules)

### 12. **Department Module**
**Purpose:** Hospital department management & organization

**Key Features:**
- Department creation & management
- Department hierarchy
- Department staff assignment
- Department specialties

**Controllers:**
- `DepartmentController` - Department management

**Related To:**
- Staff (department staff)
- All clinical modules (department assignment)

---

### 13. **InventoryProcurement Module**
**Purpose:** Medical supplies, procurement, & warehouse management

**Key Features:**
- Inventory tracking
- Purchase orders
- Supplier management
- Warehouse management
- Stock levels & reordering

**Controllers:**
- `InventoryProcurementController` - Purchase management
- `InventorySupplierController` - Supplier management
- `InventoryWarehouseController` - Warehouse operations

**Related To:**
- Pharmacy (medication inventory)
- Billing (cost tracking)

---

### 14. **Staff Module**
**Purpose:** Staff management, credentials, & privilege management

**Key Features:**
- Staff profiles & employee data
- Specialties & certifications
- Clinical privileges
- Credential validation
- Staff documents (licenses, certificates)
- Privilege granting workflows

**Controllers:**
- `StaffProfileController` - Staff profile management
- `StaffCredentialingController` - Credentialing workflows
- `ClinicalPrivilegeCatalogController` - Privilege catalog
- `ClinicalSpecialtyController` - Specialty management
- `StaffProfileSpecialtyController` - Staff specialties
- `StaffPrivilegeGrantController` - Privilege assignment
- `StaffDocumentController` - Document management

**Related To:**
- Patient (clinical staff)
- All clinical modules (staff involvement)
- Platform (user management)

**Special Features:** Comprehensive credentialing system, privilege workflows

---

## 👥 Clinical Support Modules (2 Modules)

### 15. **Patient Module**
**Purpose:** Patient master data & patient-specific management

**Key Features:**
- Patient demographics
- Patient identification (UPI - Unique Patient ID)
- Contact information
- Insurance information
- Medication safety & allergy tracking
- Patient history

**Controllers:**
- `PatientController` - Patient management
- `PatientMedicationSafetyController` - Allergy & safety

**Related To:**
- All clinical modules (patient data)
- Billing (patient financial data)

**Security:** PHI (Protected Health Information) encrypted

---

### 16. **Authentication Module**
**Purpose:** User authentication & security

**Key Features:**
- User login/logout
- Password management
- 2FA (Two-Factor Authentication)
- Session management
- Permission checks

**Controllers:**
- `AuthenticatedUserController` - User auth operations

**Related To:**
- Platform (user management)
- All modules (authentication required)

**Security:** Bcrypt hashing, 2FA support, rate limiting

---

## ⚙️ System/Platform Module (1 Module)

### 17. **Platform Module**
**Purpose:** System administration, multi-facility management, & platform-wide features

**Key Features:**
- User management (create, edit, deactivate)
- Role-based access control (RBAC)
- Facility management (multi-facility support)
- Feature flags & overrides
- Branding & configuration
- Audit logging
- Approval workflows for privileged access
- Cross-tenant admin operations

**Controllers:**
- `PlatformAdminController` - General admin operations
- `PlatformUserAdminController` - User management
- `PlatformRbacController` - Role & permission management
- `PlatformConfigurationController` - System configuration
- `PlatformBrandingController` - Branding management
- `PlatformUserApprovalCaseController` - Approval workflow
- `FacilityConfigurationController` - Facility settings
- `FacilityResourceRegistryController` - Facility resources
- `PlatformClinicalCatalogController` - Clinical catalogs
- `MultiFacilityRolloutController` - Multi-facility deployment

**Related To:**
- All modules (system-wide governance)

**Special Features:**
- Multi-facility tenant isolation
- Privileged access audit logging
- Feature flag management
- Cross-tenant admin controls

---

## 🔀 Data Flow Diagram

```
┌─────────────┐
│   Patient   │  ← Master patient data
└──────┬──────┘
       │
       ├─→ Appointment → Theatre Procedures
       ├─→ Admission → InpatientWard
       ├─→ EmergencyTriage
       ├─→ MedicalRecord → Laboratory, Radiology
       ├─→ Pharmacy (Medication Safety)
       └─→ Billing → ClaimsInsurance

┌─────────────┐
│    Staff    │  ← Clinical staff
└──────┬──────┘
       │
       └─→ All Clinical Modules (staff assignment)

┌─────────────┐
│ Department  │  ← Organization structure
└──────┬──────┘
       │
       └─→ All Modules (department assignment)

┌────────────────┐
│  Inventory     │  ← Supply chain
└────────────────┘
       ↓
    Pharmacy
    Billing

┌────────────────┐
│  Authentication│  ← User & security
└────────────────┘
       ↓
┌────────────────┐
│   Platform     │  ← System-wide governance
└────────────────┘
```

---

## 📊 Module Statistics

```
Clinical Modules:        8 (47%)
  - Direct patient care: 9 controllers
  
Finance Modules:        2 (12%)
  - Revenue management: 4 controllers

Operations Modules:     3 (18%)
  - Support operations: 10 controllers

Support Modules:        2 (12%)
  - System support: 2 controllers

Platform Module:        1 (6%)
  - System-wide: 10 controllers

────────────────────────────────
TOTAL:                 17 modules
                      41 controllers
                    100+ endpoints
```

---

## 🔐 Security & Audit

**All modules include:**
- ✅ Permission-based access control
- ✅ Audit logging (90+ audit tables)
- ✅ User action tracking
- ✅ Data encryption (at rest & transit)
- ✅ Input validation
- ✅ CSRF protection
- ✅ Rate limiting on sensitive endpoints

**Privileged Operations Logged:**
- Super admin access
- Privileged user changes
- Permission modifications
- Cross-tenant operations

---

## 🚀 API Endpoint Examples

```
Clinical APIs:
GET    /api/v1/patients/{id}
POST   /api/v1/appointments
GET    /api/v1/medical-records/{id}
POST   /api/v1/laboratory-orders
GET    /api/v1/pharmacy-orders/{id}

Billing APIs:
POST   /api/v1/billing/invoices
GET    /api/v1/billing/invoices/{id}
POST   /api/v1/billing/contracts

Staff APIs:
GET    /api/v1/staff/{id}
POST   /api/v1/staff/credentials
POST   /api/v1/clinical-privileges

Platform APIs:
POST   /api/v1/platform/users
PATCH  /api/v1/platform/users/{id}/roles
GET    /api/v1/platform/audit-logs
```

---

## 🔄 Module Dependencies

```
Level 1 (Core/Base):
- Authentication
- Patient
- Platform

Level 2 (Operations):
- Department
- Staff
- InventoryProcurement

Level 3 (Clinical):
- Appointment
- Admission
- EmergencyTriage
- TheatreProcedure
- MedicalRecord

Level 4 (Specialized):
- Laboratory
- Radiology
- Pharmacy
- InpatientWard

Level 5 (Finance):
- Billing
- ClaimsInsurance
```

---

## 📋 Feature Matrix

| Feature | Clinical | Finance | Operations | System |
|---------|----------|---------|-----------|--------|
| Patient Data | ✅ | ✅ | ❌ | ✅ |
| Staff Management | ✅ | ❌ | ✅ | ✅ |
| Audit Logging | ✅ | ✅ | ✅ | ✅ |
| Multi-facility | ❌ | ✅ | ✅ | ✅ |
| Permission Control | ✅ | ✅ | ✅ | ✅ |
| Document Management | ✅ | ✅ | ❌ | ✅ |

---

## 🎯 Module Roles in Tanzania Hospital Operations

```
Patient Intake:
  Patient → Appointment → Admission → InpatientWard

Emergency Care:
  Patient → EmergencyTriage → MedicalRecord

Outpatient Care:
  Patient → Appointment → (Lab/Radiology/Pharmacy)

Inpatient Care:
  Admission → InpatientWard → (Lab/Radiology/Pharmacy) → Discharge

Surgical Care:
  Appointment → TheatreProcedure → InpatientWard → Discharge

Billing:
  All Clinical Services → Billing → ClaimsInsurance → Payment

Staff Management:
  Staff → Department → Credentials → Clinical Privileges
```

---

## 📚 Documentation Reference

For detailed module information:
- Architecture: See `03-OPERATIONS_RUNBOOK_2026.md`
- Security: See `02-SECURITY_AUDIT_FINDINGS_2026.md`
- Compliance: See `01-COMPLIANCE_TANZANIA_HEALTHCARE_2026.md`

---

## Document Control

| Version | Date | Status | Created By |
|---------|------|--------|-----------|
| 1.0 | 2026-04-15 | Initial | Copilot |

---

**Classification:** Internal - Development Team  
**Audience:** Developers, Architects, Project Managers  
**Distribution:** Development documentation repository  
**Last Updated:** April 15, 2026

---

## 🎯 Key Takeaway

**Afyanova AHS v2** is a comprehensive **17-module healthcare system** designed for Tanzania hospitals with:
- ✅ 8 clinical modules for patient care
- ✅ 2 finance modules for billing & claims
- ✅ 3 operations modules for supply chain & staff
- ✅ 2 support modules (patient & authentication)
- ✅ 1 platform module for system governance
- ✅ 41 API controllers with 100+ endpoints
- ✅ Enterprise-grade security, audit, and compliance
