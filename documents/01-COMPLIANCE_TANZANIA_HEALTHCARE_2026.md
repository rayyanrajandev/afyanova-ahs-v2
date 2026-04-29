# Tanzania Healthcare Compliance & Regulatory Requirements (2026)

**Document Version:** 1.0  
**Date:** April 15, 2026  
**Scope:** Afyanova AHS v2 - Multi-facility Healthcare System

---

## 1. Tanzania Healthcare Regulatory Framework

### 1.1 Ministry of Health Requirements

**Authority:** Tanzania Ministry of Health, Community Development, Gender, Elderly & Children

**Key Regulations:**
- Health Service Quality & Safety Standards (2024)
- National Health Information System Standards
- Patient Rights & Informed Consent Policy
- Emergency Response & Disaster Management

### 1.2 Tanzania Data Protection Act (2024)

**Key Provisions:**
- Personal data of patients must be encrypted at rest and in transit
- Data controller responsible for security incidents
- Data subject rights: access, correction, deletion (right to be forgotten)
- Healthcare data (PHI) = highest protection tier
- Data retention: 7 years for patient records (per MOH requirements)
- Data breach notification: Within 72 hours to authorities

### 1.3 Electronic Health Record (EHR) Standards

**Mandatory Requirements:**
- DICOM compliance for radiology/imaging data
- HL7/FHIR compatibility for interoperability
- Unique patient identification (UPI) system
- Digital audit trail for all data access & modifications

---

## 2. Patient Privacy & Data Protection

### 2.1 Protected Health Information (PHI) Classification

**Tier 1 - Highly Sensitive:**
- Full patient names
- National ID numbers
- Date of birth + age
- Contact information (phone, address)
- Medical diagnoses & treatment plans
- Medication histories
- Laboratory results

**Tier 2 - Sensitive:**
- Facility location/department
- Appointment schedules
- Insurance/payment information
- Staff names (non-clinical)

**Tier 3 - General:**
- Aggregated statistics
- De-identified research data
- Public health information

### 2.2 Access Control

**Role-Based Permissions:**

| Role | View PHI | Create Records | Edit Records | Delete Records | Audit Access |
|------|----------|----------------|--------------|----------------|--------------|
| Super Admin | ✅ All | ✅ | ✅ | ✅ | ✅ |
| Facility Admin | ✅ Facility | ✅ | ✅ | ❌ | ✅ |
| Doctor | ✅ Assigned Patients | ✅ | ✅ | ❌ | Limited |
| Nurse | ✅ Assigned Patients | ✅ | Limited | ❌ | Limited |
| Pharmacist | ✅ Medications | ✅ | Medications | ❌ | Limited |
| Finance Staff | ✅ Billing Only | ✅ | ✅ | ❌ | Limited |
| Clerical | ✅ Demographics | ✅ | Demographics | ❌ | Limited |
| Lab Technician | ✅ Lab Orders | ✅ | Lab Results | ❌ | Limited |

### 2.3 Informed Consent

**Requirements:**
- Written consent for data processing & treatment
- Consent must be explicit, unambiguous, freely given
- Right to withdraw consent at any time
- Special consent for research/data sharing
- Minors: Parental/guardian consent required

---

## 3. Security & Audit Requirements

### 3.1 Data Security Standards

**Encryption:**
- ✅ **At Rest:** AES-256 encryption for all PHI
- ✅ **In Transit:** TLS 1.3 minimum for all communications
- ✅ **Database:** Encrypted at application level + database level

**Authentication:**
- ✅ Bcrypt password hashing (min 12 rounds)
- ✅ Two-factor authentication (2FA) for admin/clinical staff
- ✅ Session timeout: 60 minutes for healthcare data
- ✅ Multi-facility support with facility-level context

**Access Logging:**
- ✅ All PHI access logged (user, timestamp, action)
- ✅ Modification tracking (before/after values)
- ✅ Administrative actions logged
- ✅ Failed login attempts tracked

### 3.2 Audit Trail Requirements

**Mandatory Audit Events:**
- Patient record access (who, when, why)
- Data modifications (original vs. new value)
- User login/logout
- Permission changes
- Administrative actions
- Failed security attempts
- Data exports/downloads
- System configuration changes

**Audit Log Retention:**
- **7 years** for patient-specific records
- **3 years** for administrative/system audit logs
- **Immutable storage** - cannot be altered retroactively
- **Regular export** for compliance review

### 3.3 Security Incident Response

**Response Timeline:**
- **Immediate:** Contain incident, assess scope
- **24 hours:** Internal investigation initiated
- **48 hours:** MOH notification if PHI affected
- **72 hours:** Formal incident report to authorities
- **5 days:** Remediation plan to stakeholders

**Reportable Incidents:**
- Unauthorized access to PHI
- Data breach (deliberate or accidental)
- System compromise/malware
- Failed authentication attacks (5+ attempts)
- Unauthorized data export

---

## 4. Multi-Facility & Cross-Tenant Isolation

### 4.1 Facility Isolation Requirements

**Mandatory Controls:**
- ✅ Data isolation by facility (no cross-facility data leakage)
- ✅ Separate audit logs per facility
- ✅ Super Admin (platform-level) cannot access facility data directly
- ✅ Approval workflow for cross-facility operations
- ✅ Privileged access auditing (when admins access patient data)

### 4.2 Cross-Tenant Admin Audit Logs

**When Super Admin accesses facility data:**
- Action must be logged with justification
- Limited to auditing/compliance purposes
- Requires approval case tracking
- Subject to quarterly review

---

## 5. Compliance Checklist

### ✅ Data Protection

- [ ] All PHI encrypted at rest (AES-256)
- [ ] All PHI encrypted in transit (TLS 1.3)
- [ ] Database password protected & not in version control
- [ ] Session encryption enabled (SESSION_ENCRYPT=true)
- [ ] Session timeout: 60 minutes

### ✅ Access Control

- [ ] Role-based access control implemented
- [ ] Multi-facility isolation enforced
- [ ] Permission matrix documented & reviewed
- [ ] Admin access limited to necessity basis
- [ ] Service accounts use strong credentials

### ✅ Authentication & Audit

- [ ] Password hashing: BCRYPT_ROUNDS=12 minimum
- [ ] 2FA enabled for clinical/admin staff
- [ ] All PHI access logged
- [ ] Failed login tracking implemented
- [ ] Audit logs immutable & retention policy defined

### ✅ Incident Response

- [ ] Incident response plan documented
- [ ] MOH contact information current
- [ ] Breach notification procedure in place
- [ ] Security incidents logged & tracked
- [ ] Post-incident reviews conducted

### ✅ Training & Awareness

- [ ] Staff trained on data protection
- [ ] Confidentiality agreements signed
- [ ] Policies accessible to all staff
- [ ] Annual refresher training scheduled
- [ ] Incident response team designated

---

## 6. MOH Reporting Requirements

### 6.1 Annual Compliance Report

**Required by:** June 30, 2026 (fiscal year end)

**Contents:**
- Data security audit results
- Incident summary (if any)
- Staff training completion
- System uptime/availability
- Disaster recovery test results
- Patient complaint resolution

### 6.2 Quarterly Security Reviews

**Required by:** End of each quarter

**Contents:**
- Access control audit
- Permission matrix review
- Audit log review for anomalies
- System vulnerability scan results
- Remediation tracking

---

## 7. References

- **Tanzania Ministry of Health:** https://www.moh.go.tz/
- **Tanzania Data Protection Authority:** https://data-protection-authority.go.tz/
- **WHO Healthcare Data Standards:** https://www.who.int/standards
- **HL7 FHIR Standard:** https://www.hl7.org/fhir/

---

## Document Control

| Version | Date | Changes | Approved By |
|---------|------|---------|------------|
| 1.0 | 2026-04-15 | Initial creation | System |

---

**Compliance Owner:** [To be assigned]  
**Last Reviewed:** 2026-04-15  
**Next Review:** 2026-07-15 (Q3 review)
