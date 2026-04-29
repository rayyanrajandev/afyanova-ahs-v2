# Security & Credentials Management (2026)
## Afyanova AHS v2 - Tanzania Healthcare System

**Document Version:** 1.0  
**Date:** April 15, 2026  
**Classification:** CONFIDENTIAL - Restricted to Authorized Personnel Only

---

## 1. Security Audit Summary (April 2026)

### 1.1 Overall Security Posture: ✅ EXCELLENT

| Category | Status | Risk Level |
|----------|--------|-----------|
| Authentication | ✅ Strong | LOW |
| SQL Injection | ✅ Secure | LOW |
| Authorization/RBAC | ✅ Comprehensive | LOW |
| API Rate Limiting | ✅ Complete | LOW |
| Sensitive Data Protection | ✅ Secure | LOW |
| CSRF Protection | ✅ Secure | LOW |
| Audit Logging | ✅ Extensive | LOW |
| Session Security | ✅ Hardened | VERY LOW |

### 1.2 Recent Security Hardening (April 2026)

✅ **Fixes Applied:**
1. Database credentials protected (removed from .env)
2. API rate limiting implemented (CSRF endpoint: 30 req/min)
3. Session encryption enabled (all session data encrypted at rest)
4. Session timeout reduced to 60 minutes (healthcare compliance)

**Details:** See `02-SECURITY_AUDIT_FINDINGS_2026.md`

---

## 2. Credentials Management Framework

### 2.1 Password Policy

**Requirements:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- No dictionary words or common patterns
- No reuse of last 5 passwords
- Expiration: 90 days for admins, 180 days for clinical staff
- Failed login lockout: 5 attempts in 1 minute

**Password Hashing:**
- Algorithm: BCRYPT
- Cost factor: 12 rounds minimum
- All passwords hashed server-side (never stored plain text)

### 2.2 Credential Storage

**DO NOT commit to repository:**
```
❌ .env (environment variables with secrets)
❌ .env.backup or .env.production
❌ Database credentials
❌ API tokens or keys
❌ SSL certificates
```

**Proper Credential Management:**

| Environment | Storage Method | Access Control |
|-------------|----------------|----------------|
| **Local Development** | `.env` (local only, not committed) | Developer machine |
| **Staging** | AWS Secrets Manager / HashiCorp Vault | CI/CD system |
| **Production** | AWS Secrets Manager / HashiCorp Vault | Authorized ops only |

**Git Protection:**
```bash
# Verify .env is properly ignored
cat .gitignore | grep "\.env"

# Output should show:
# .env
# .env.*.local
# .env.backup
```

### 2.3 Credential Rotation Schedule

**Monthly Rotation (1st of month):**
- Database user password
- System service account passwords
- API keys for external integrations

**Quarterly Rotation (Every 90 days):**
- Admin user passwords (if not auto-rotated)
- SMTP/Email credentials
- S3/Cloud storage credentials

**Annual Review:**
- All service accounts
- Inactive account cleanup
- Access rights audit

---

## 3. Role-Based Access Control (RBAC)

### 3.1 Tanzania Hospital Roles

**Clinical Roles:**

| Role | Permissions | Session Timeout | 2FA Required |
|------|------------|-----------------|--------------|
| **Super Admin** | All system access, multi-facility | 60 min | ✅ Yes |
| **Facility Admin** | Facility-level admin, user management | 60 min | ✅ Yes |
| **Doctor** | Patient records, orders, treatment plans | 60 min | ✅ Yes |
| **Nurse** | Patient care, vital signs, medications | 60 min | ✅ Yes |
| **Pharmacist** | Medications, inventory, dispensing | 60 min | ✅ Yes |
| **Lab Technician** | Lab orders, results, tests | 60 min | ✅ Yes |
| **Radiologist** | Imaging orders, results, reports | 60 min | ✅ Yes |

**Administrative Roles:**

| Role | Permissions | Session Timeout | 2FA Required |
|------|------------|-----------------|--------------|
| **Finance Manager** | Billing, invoices, payments (no clinical data) | 60 min | ✅ Yes |
| **Clerical Staff** | Patient demographics, scheduling | 60 min | ❌ No |
| **IT Support** | System monitoring, troubleshooting | 60 min | ✅ Yes |
| **Audit Officer** | View-only access, audit logs | 60 min | ✅ Yes |

### 3.2 Permission Matrix

**Patient Data Access:**

```
Super Admin:    Can view ALL patient data across facilities ⚠️ (logged)
Facility Admin: Can view facility patients + staff data
Doctor:         Can view assigned patients only
Nurse:          Can view assigned patients only
Pharmacist:     Can view medications for assigned patients
Lab Tech:       Can view lab orders/results
Finance:        Can view billing data only (NO clinical)
Clerical:       Can view demographics only
```

**System Administration:**

```
Super Admin:    Full system access (create users, change roles, configs)
Facility Admin: Facility users + roles, local settings
IT Support:     Monitor systems, view logs, restart services
Audit Officer:  View-only access to all logs
```

### 3.3 Access Request & Approval

**New User Provisioning:**

1. **Request:** Department head submits access request form
2. **Verify:** IT confirms role matches job description
3. **Approve:** Facility admin approves
4. **Provision:** IT creates account with temporary password
5. **Activate:** User logs in, sets permanent password
6. **Audit:** Access logged in audit system

**Privileged Access:**

For Facility Admin or higher:
- Requires second-level approval
- Logged as "privileged change" in audit trail
- Quarterly review for necessity

---

## 4. Authentication & Session Security

### 4.1 Multi-Factor Authentication (2FA)

**Required for:**
- ✅ Super Admin
- ✅ Facility Admin
- ✅ Clinical staff (Doctor, Nurse, Lab Tech, etc.)
- ✅ Finance staff
- ✅ IT Support

**Optional for:**
- Clerical staff (recommended)

**Methods Supported:**
- TOTP (Time-based One-Time Password) via authenticator app
- SMS-based OTP (secondary fallback)
- Backup codes (account recovery)

### 4.2 Session Management

**Session Configuration:**
- **Timeout:** 60 minutes of inactivity
- **Encryption:** All session data encrypted at rest
- **Cookie:** Secure, HttpOnly, SameSite=Lax
- **Database:** Sessions stored in encrypted database table

**Session Events Logged:**
- Login (success & failure)
- Logout
- Session timeout
- Manual session termination (admin)
- Multiple concurrent sessions (alert if >2)

### 4.3 Password Reset

**Self-Service Reset:**
1. User clicks "Forgot Password"
2. Enters registered email
3. Receives reset link (expires in 1 hour)
4. Sets new password
5. Must be different from last 5 passwords

**Admin Reset:**
1. Facility admin generates temporary password
2. User receives via secure channel (not email)
3. User must change on first login
4. Action logged as privileged operation

---

## 5. Bootstrap & Initial Setup

### 5.1 First-Time Credential Setup (Deployment)

**For Super Admin (Platform Owner):**

```bash
# 1. System generates temporary super admin account
# Email: system-admin@afyanova-ahs.local
# Temporary Password: [Provided during deployment]

# 2. On first login:
php artisan tinker
>>> $user = App\Models\User::where('email', 'system-admin@afyanova-ahs.local')->first();
>>> $user->assignRole('super_admin');
>>> $user->givePermissionTo('platform.*');
>>> exit

# 3. Super admin then creates facility admins
# Login to system → Platform Settings → Users → Create New User
# Select Role: "Facility Admin"
# Assign to specific facility
```

### 5.2 Facility Admin Bootstrap

**Create Initial Facility Users:**

```bash
# Login as super admin
# Go to: Facilities → [Facility Name] → Users

# Create accounts for:
□ Facility Admin (1-2 people)
□ Department Heads (Doctors, Nurses, Finance)
□ IT Support (1-2 people)

# Each user receives:
- Email with account creation notification
- Temporary password (via secure channel)
- Link to change password on first login
- 2FA setup instructions
```

### 5.3 Post-Deployment Verification

**Checklist:**
- [ ] Super admin account created and passwordless 2FA enabled
- [ ] Facility admin accounts created per facility
- [ ] Clinical staff accounts created
- [ ] All accounts have unique email addresses
- [ ] Passwords are complex and not default
- [ ] 2FA configured for admin/clinical staff
- [ ] Audit logs recording all access
- [ ] Database encryption verified
- [ ] Session encryption verified

---

## 6. Security Best Practices

### 6.1 For System Administrators

✅ **DO:**
- Rotate credentials monthly
- Enable 2FA on all admin accounts
- Monitor failed login attempts
- Review user permissions quarterly
- Keep audit logs secured
- Report suspicious activity immediately

❌ **DON'T:**
- Share credentials via email or chat
- Use default passwords in production
- Disable authentication checks
- Export patient data without encryption
- Leave debug mode enabled
- Log passwords or tokens

### 6.2 For Clinical Staff

✅ **DO:**
- Lock computer when away from desk
- Use strong, unique passwords
- Report lost credentials immediately
- Log out when finished
- Question unfamiliar system behavior
- Report security concerns

❌ **DON'T:**
- Share login credentials
- Write passwords on sticky notes
- Use hospital WiFi for unencrypted apps
- Access patient data without need
- Leave patient data visible on screen
- Connect personal devices without permission

### 6.3 For Developers

✅ **DO:**
- Never commit secrets to repository
- Use environment variables for config
- Validate all user input
- Use parameterized queries
- Enable HTTPS only
- Keep dependencies updated

❌ **DON'T:**
- Log sensitive data
- Hardcode credentials
- Use raw SQL queries
- Disable CSRF protection
- Allow SQL injection
- Trust client-side validation

---

## 7. Incident Response

### 7.1 Suspected Security Breach

**IMMEDIATE (First hour):**
1. Isolate affected systems
2. Preserve logs & evidence
3. Notify IT Security Lead
4. Document timeline

**URGENT (Next 24 hours):**
1. Assess scope (which data affected)
2. Notify MOH if PHI compromised
3. Begin investigation
4. Prepare incident report

**FOLLOW-UP (Within 72 hours):**
1. Complete investigation
2. Notify affected patients (if required)
3. Implement remediation
4. Review security controls

### 7.2 Escalation Path

```
Clinical Staff → Department Head → Facility Admin → IT Lead → MOH (if PHI affected)
```

**Contacts:**
- IT Security Lead: [TBD]
- Facility Admin: [TBD]
- MOH Contact: [TBD]

---

## 8. Compliance & Audit

### 8.1 Regular Security Reviews

- **Weekly:** Monitor failed login attempts, unusual access
- **Monthly:** Credential rotation, access control review
- **Quarterly:** Full security audit, permission matrix review
- **Annually:** Penetration testing, policy updates

### 8.2 Documentation

- All access requests documented
- All privilege escalations logged
- All credential rotations recorded
- All incidents investigated
- All training tracked

---

## Document Control

| Version | Date | Changes | Approved By |
|---------|------|---------|------------|
| 1.0 | 2026-04-15 | Initial creation | System |

---

⚠️ **CONFIDENTIAL - Handle with care**  
**Distribution:** IT Team, Facility Admins, Compliance Officer  
**Retention:** 7 years (compliance requirement)  
**Last Updated:** April 15, 2026  
**Next Review:** July 15, 2026 (Q3)
