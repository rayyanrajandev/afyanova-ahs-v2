# Afyanova AHS v2 - Documentation Index
## Tanzania Healthcare System (2026)

**Last Updated:** April 16, 2026  
**Version:** 2.0 (Fresh Start)

---

## 📚 Documentation Structure

This documentation is organized for Tanzania hospital operations and regulatory compliance.

### 1. **COMPLIANCE & REGULATORY**
- `01-COMPLIANCE_TANZANIA_HEALTHCARE_2026.md` - Tanzania healthcare regulations and requirements
- `01-COMPLIANCE_DATA_PROTECTION_ACT_COMPLIANCE.md` - Tanzania Data Protection Act alignment
- `01-COMPLIANCE_HIPAA_EQUIVALENT_REQUIREMENTS.md` - International healthcare data standards
- `01-COMPLIANCE_AUDIT_TRAIL_REQUIREMENTS.md` - Audit logging & accountability

### 2. **SECURITY & CREDENTIALS**
- `02-SECURITY_CREDENTIALS_MANAGEMENT_2026.md` - Secure credentials & access bootstrap
- `02-SECURITY_ROLE_PERMISSION_MATRIX.md` - Tanzania hospital roles (Doctor, Nurse, Admin, Finance)
- `02-SECURITY_AUDIT_FINDINGS_2026.md` - Security audit findings & implementation status
- `02-SECURITY_ACCESS_CONTROL_POLICY.md` - Multi-facility access control & emergency procedures

### 3. **ARCHITECTURE & DESIGN**
- `03-SYSTEM_MODULES_OVERVIEW_2026.md` - Complete module documentation (17 modules, 41 controllers)
- `05-BILLING_MODULE_ANALYSIS_2026.md` - **[NEW]** Billing module deep-dive (what's good, what's missing)
- `08-POS_AND_RETAIL_GAP_ANALYSIS_2026.md` - Actual POS support today and missing retail workflows (pharmacy OTC, cafeteria, register controls)
- `03-ARCHITECTURE_SYSTEM_ARCHITECTURE_2026.md` - System design for Tanzania hospital network
- `03-ARCHITECTURE_DATABASE_DESIGN.md` - Data model for healthcare operations
- `03-ARCHITECTURE_API_DESIGN.md` - API contracts and endpoints

### 4. **OPERATIONS**
- `03-OPERATIONS_RUNBOOK_2026.md` - Deployment procedures for Tanzania environment
- `03-OPERATIONS_BACKUP_RECOVERY_PROCEDURES.md` - Data backup and recovery
- `03-OPERATIONS_INCIDENT_RESPONSE_PLAYBOOK.md` - Emergency procedures
- `03-OPERATIONS_STAFF_ONBOARDING.md` - User provisioning & offboarding

### 5. **EXECUTION & TRACKING**
- `CURRENT_STATUS_2026.md` - Project status and milestones
- `05-PHASE_ROADMAP.md` - Phase execution plan
- `05-ACTIVE_TASKS.md` - Current sprint board

### 6. **REFERENCE**
- `CREDENTIALS.md` - Local development credentials
- `06-ABBREVIATIONS.md` - Common abbreviations used in documentation
- `06-GLOSSARY.md` - Healthcare and system terminology
- `06-EXTERNAL_REFERENCES.md` - Links to Tanzania MOH resources

---

## 🚀 Quick Start

### **For System Overview:**
1. **Module Architecture:** Start with `03-SYSTEM_MODULES_OVERVIEW_2026.md` (NEW)
2. **System Design:** See `03-ARCHITECTURE_SYSTEM_ARCHITECTURE_2026.md`
3. **Project Status:** Review `CURRENT_STATUS_2026.md`

### **For Compliance:**
1. **Tanzania Requirements:** See `01-COMPLIANCE_TANZANIA_HEALTHCARE_2026.md`
2. **Data Protection:** See supporting compliance docs

### **For Security:**
1. **Audit Results:** Review `02-SECURITY_AUDIT_FINDINGS_2026.md`
2. **Credentials & Roles:** See `02-SECURITY_CREDENTIALS_MANAGEMENT_2026.md`

### **For Operations:**
1. **Deployment:** See `03-OPERATIONS_RUNBOOK_2026.md`
2. **Incidents:** See `03-OPERATIONS_INCIDENT_RESPONSE_PLAYBOOK.md`

---

## 📊 System Modules at a Glance

**17 Total Modules:**
- 8 Clinical modules (Patient care workflows)
- 2 Finance modules (Billing & claims)
- 3 Operations modules (Staff, departments, inventory)
- 2 Support modules (Patient, authentication)
- 1 Platform module (System governance)

**41 API Controllers** with 100+ endpoints

➜ **See:** `03-SYSTEM_MODULES_OVERVIEW_2026.md` for complete module details

---

## ⚠️ Document Authority

**Conflict Resolution (in order of precedence):**
1. `CURRENT_STATUS_2026.md` - Single source of truth for project state
2. Module & architecture documents
3. Operational runbooks

---

## 📝 Document Status

| Document | Status | Owner | Last Updated |
|----------|--------|-------|--------------|
| Modules | ✅ Complete | System | 2026-04-15 |
| Compliance | ✅ Complete | System | 2026-04-15 |
| Security | ✅ Complete | System | 2026-04-15 |
| Operations | ✅ Complete | System | 2026-04-15 |
| Status | ✅ Current | System | 2026-04-15 |

---

## 🔐 Important Notes

- **Credentials:** Never commit actual passwords or tokens (use .env)
- **Compliance:** Tanzania MOH requirements are authoritative
- **Security:** All healthcare data must be encrypted and audited
- **Access:** Use role-based access control for all operations
- **Modules:** Review `03-SYSTEM_MODULES_OVERVIEW_2026.md` for architecture

---

**Questions?** Refer to relevant section or escalate to compliance team.
**Last Updated:** April 16, 2026  
**Modules Added:** April 15, 2026 (Complete module documentation)
