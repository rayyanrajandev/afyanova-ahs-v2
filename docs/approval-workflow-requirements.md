# Inventory Approval Workflow — Requirements Document

## 1. System Overview

The Inventory Approval Workflow module provides multi-level, configurable approval routing for inventory requisitions within a multi-tenant, multi-facility hospital supply chain system. It enforces department-scoped access control, segregation of duties, and regulatory compliance (HIPAA, CAP/CLIA, SOC 2, IEC 62304).

## 2. Stakeholders

| Role | Responsibility |
|------|---------------|
| Requester | Submits inventory requisitions |
| Department Manager | First-level approval authority |
| Director / Executive | Second-level approval authority (configurable) |
| Compliance Officer | Monitors SOD violations, reviews audit logs |
| Facility Admin | Configures workflow definitions and approval rules |
| System Administrator | Manages tenants, facilities, retention policies |

## 3. Functional Requirements

### FR-1: Department-Scoped RBAC (Phase 1)

| ID | Description |
|----|-------------|
| FR-1.1 | Users see only items belonging to their assigned department |
| FR-1.2 | Permission resolver checks department scope before granting access |
| FR-1.3 | Audit log records all access attempts (granted and denied) |
| FR-1.4 | Multiple permission checks can be combined with AND/OR logic |

### FR-2: Approval Workflow Management (Phase 2)

| ID | Description |
|----|-------------|
| FR-2.1 | Workflows are defined per tenant/facility with configurable approval steps |
| FR-2.2 | Each step supports role-based approval rules with authority limits |
| FR-2.3 | Workflow engine processes multi-level approval (approve → next step) |
| FR-2.4 | Rejection at any step terminates the workflow |
| FR-2.5 | Current step is determined by the workflow definition's step configuration |
| FR-2.6 | `workflow_version` is captured when a workflow instance is created |
| FR-2.7 | Version changes are tracked in `inventory_approval_workflow_version_changes` |

### FR-3: Segregation of Duties

| ID | Description |
|----|-------------|
| FR-3.1 | Requester cannot approve their own requisition |
| FR-3.2 | SOD violations are logged in the audit trail |
| FR-3.3 | SOD violations trigger email and/or webhook notifications |
| FR-3.4 | Notification recipients configurable per tenant (compliance officers, facility admins) |

### FR-4: Decision Immutability

| ID | Description |
|----|-------------|
| FR-4.1 | Approved/rejected decision records cannot be modified (model-level enforcement) |
| FR-4.2 | Decision records cannot be deleted (model-level enforcement) |
| FR-4.3 | Recall operations store reference on the workflow instance, never mutate the decision |

### FR-5: Data Retention & PII

| ID | Description |
|----|-------------|
| FR-5.1 | Audit logs retained for configurable period (default 6 years for HIPAA) |
| FR-5.2 | Approval decisions retained for configurable period (default 6 years) |
| FR-5.3 | Archived records marked with `archived_at` timestamp, not physically deleted |
| FR-5.4 | Command `inventory:archive-expired-records` supports dry-run and batch processing |
| FR-5.5 | PII patterns (SSN, email, MRN, phone, credit card) are sanitized from audit logs |
| FR-5.6 | Free-text fields (comments, denial reasons) are scanned and redacted |

### FR-6: Approval Timeout

| ID | Description |
|----|-------------|
| FR-6.1 | Workflow instances can have a configurable timeout (default 72 hours) |
| FR-6.2 | `inventory:auto-reject-expired-workflows` command auto-rejects timed-out instances |
| FR-6.3 | Auto-rejection updates instance status and requisition status atomically |

## 4. Non-Functional Requirements

### NFR-1: Security

| ID | Description |
|----|-------------|
| NFR-1.1 | All approval actions require authenticated user context |
| NFR-1.2 | Department scope enforced at query level (not just UI) |
| NFR-1.3 | Approval authority limited by item count, amount, and category |
| NFR-1.4 | SOD violations are logged with full actor and context metadata |

### NFR-2: Auditability

| ID | Description |
|----|-------------|
| NFR-2.1 | Every approval action is logged with tenant, facility, actor, timestamp, and business context |
| NFR-2.2 | Audit logs track before/after state for all changes |
| NFR-2.3 | Decision records are immutable once created |
| NFR-2.4 | Workflow version changes are tracked with before/after state snapshots |

### NFR-3: Performance

| ID | Description |
|----|-------------|
| NFR-3.1 | Archival command processes records in configurable batch sizes (default 500) |
| NFR-3.2 | Auto-rejection query uses composite index on `(status, timeout_at)` |
| NFR-3.3 | Approval rules are indexed by tenant, facility, and approval type |

### NFR-4: Compliance

| ID | Standard | Requirement |
|----|----------|-------------|
| NFR-4.1 | HIPAA | 6-year retention for audit logs and approval decisions |
| NFR-4.2 | HIPAA | PII masking in audit trail |
| NFR-4.3 | CAP/CLIA | Segregation of duties enforcement |
| NFR-4.4 | SOC 2 Type II | Immutable audit trail for approval decisions |
| NFR-4.5 | SOC 2 Type II | Access controls enforced at API and query level |
| NFR-4.6 | IEC 62304 | Traceable requirements-to-implementation mapping |

## 5. Use Cases

### UC-1: Submit Requisition for Approval
1. User creates a requisition in their department
2. System identifies matching workflow definition based on trigger rules
3. Workflow instance is created with current workflow version and timeout
4. Requisition enters "pending approval" state

### UC-2: Multi-Level Approval
1. Manager approves at step 1 → instance advances to step 2
2. Director approves at step 2 → workflow completes, requisition approved
3. Failure at any step → workflow rejected, requisition returned

### UC-3: SOD Violation Detected
1. Attempted approval by the same user who created the requisition
2. System blocks the approval, logs the violation
3. Email notification sent to compliance officer(s)
4. Optional webhook POST to SIEM system

### UC-4: Timed-Out Workflow
1. Workflow instance remains "in_progress" past its `timeout_at`
2. Scheduled command `inventory:auto-reject-expired-workflows` runs
3. Instance and requisition are marked as rejected with `auto_rejected_at`
4. Audit log records the auto-rejection event

### UC-5: Recall Workflow
1. Authorized user recalls an in-progress workflow
2. Last decision is referenced (not mutated) via `recalled_decision_id`
3. Instance status set to "recalled", requisition returned to "pending"
4. Original decision record remains immutable

## 6. Data Dictionary

| Table | Purpose |
|-------|---------|
| `inventory_approval_workflows` | Workflow definitions (configurable steps, trigger rules) |
| `inventory_approval_workflow_instances` | Active/completed instances of workflow execution |
| `inventory_approval_decisions` | Individual approval/rejection decisions (immutable) |
| `inventory_approval_rules` | Role/department-based approval authority configuration |
| `inventory_approval_workflow_version_changes` | Audit trail for workflow definition mutations |
| `inventory_access_audit_logs` | Comprehensive audit trail for all access and approval actions |
