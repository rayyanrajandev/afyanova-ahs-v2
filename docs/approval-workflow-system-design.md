# Inventory Approval Workflow — System Design Document

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      HTTP API Layer                          │
│        (Routes: inventory-procurement/*)                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    ApprovalWorkflowEngine                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ initiate()  │  │ recordDec()  │  │ recallWorkflow()   │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                │                    │              │
│  ┌──────▼──────┐  ┌──────▼───────┐  ┌────────▼───────────┐  │
│  │ SOD Check   │  │ SOD Alert    │  │ Version Tracking   │  │
│  │ Validator   │  │ Notifier     │  │ (bumpVersion)      │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    Domain Models (Infrastructure)             │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Workflow  │ │ Instance │ │ Decision │ │ Rule          │  │
│  │ Definition│ │          │ │(Mutable) │ │               │  │
│  └───────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                         Database                              │
│   6 tables: workflows, instances, decisions, rules,           │
│   version_changes, audit_logs                                 │
└──────────────────────────────────────────────────────────────┘
```

## 2. Data Model

### 2.1 Entity-Relationship

```
inventory_approval_workflows (1) ──── (N) inventory_approval_workflow_instances
inventory_approval_workflows (1) ──── (N) inventory_approval_rules
inventory_approval_workflows (1) ──── (N) inventory_approval_workflow_version_changes

inventory_approval_workflow_instances (1) ──── (N) inventory_approval_decisions
inventory_approval_workflow_instances (N) ──── (1) inventory_department_requisitions

inventory_approval_decisions (1) ──── (0..1) inventory_approval_workflow_instances (recalled_decision_id)
```

### 2.2 Table Details

#### `inventory_approval_workflows`
- `id` UUID PK
- `tenant_id`, `facility_id`, `department_id` (FKs)
- `code` unique per tenant/facility (e.g. `PHARMACY_STANDARD`)
- `version` integer (auto-incremented on config changes)
- `approval_steps` JSON — array of step definitions with `type`, `required_approvals`, `role_id`
- `trigger_rules` JSON — conditions that determine when this workflow applies

#### `inventory_approval_workflow_instances`
- `id` UUID PK
- `workflow_id` FK → workflows
- `requisition_id` FK → requisitions
- `workflow_version` integer — snapshot of workflow version at creation time
- `current_step`, `step_number`, `total_steps` — progress tracking
- `timeout_at`, `auto_rejected_at` — timeout handling
- `recalled_decision_id`, `recall_reason` — recall tracking (P1)
- Index: `(status, timeout_at)` for auto-rejection queries

#### `inventory_approval_decisions`
- `id` UUID PK
- `workflow_instance_id` FK → instances
- `approver_user_id` FK → users
- `decision` enum: `approved`, `rejected`
- `sod_violation_flagged` boolean
- Immutability enforced at model level (update/delete throw LogicException)

#### `inventory_approval_workflow_version_changes`
- `id` UUID PK
- `workflow_id` FK → workflows
- `version_number` integer
- `change_type` string (`created`, `updated`, `approval_steps_modified`, etc.)
- `before_state` / `after_state` JSON snapshots
- `changed_by_user_id` nullable FK → users
- Index: `(workflow_id, version_number)`

## 3. Security Architecture

### 3.1 Authentication & Authorization

```
Request → Authenticate (User) → Department Scoped Permission Resolver
  → Approval Workflow Engine → SOD Validator → Audit Logger
```

- **Authentication**: Laravel Fortify with JWT/session
- **Department Scoping**: Query-level filtering via `DepartmentRequisitionScopeResolver`
- **Permission Resolution**: `DepartmentScopedPermissionResolver` checks role + department
- **SOD**: `SegregationOfDutiesValidator` compares requester and approver identities

### 3.2 Compliance Controls

| Control | Implementation | Standard |
|---------|---------------|----------|
| Access Control | Department-scoped query filters + permission resolver | SOC 2 CC6.1 |
| Audit Trail | `InventoryAccessAuditLogger` logs all actions with context | SOC 2 CC5.2 |
| Immutability | Model-level update/delete guards on decisions | SOC 2 CC6.1 |
| SOD | Validator blocks requester-as-approver | CAP/CLIA |
| PII Masking | `PiiSanitizer` patterns + free-text scanning | HIPAA §164.312 |
| Data Retention | Configurable retention periods + archive command | HIPAA §164.316 |
| Version Tracking | Workflow version bump + change log | IEC 62304 §5 |

## 4. Key Design Decisions

### 4.1 Decision Immutability (P1)

**Approach**: Model-level enforcement via `update()`/`delete()` overrides that throw `\LogicException`.

**Rationale**: Simplest implementation that prevents ORM-based mutations. DB-level triggers would be a defense-in-depth addition for production environments (currently blocked by pre-existing FK type mismatch on PostgreSQL dev DB).

**Trade-off**: Direct SQL updates bypass model guards. Acceptable because all application code uses Eloquent.

### 4.2 Recall Pattern (P1)

**Decision**: Store recall reference on the workflow instance (`recalled_decision_id`) rather than mutating the decision record.

**Rationale**: Preserves immutable audit trail. The original approval decision remains as-recorded; the recall is tracked as workflow state.

### 4.3 PII Sanitization (P1)

**Approach**: Regex-based pattern matching applied at audit log write time.

**Patterns covered**: SSN, email, phone, MRN, patient IDs, credit card numbers.

**Integration**: `InventoryAccessAuditLogger` sanitizes `business_context`, `comments`, and `deny_reason` before persistence.

### 4.4 Version Tracking (P2)

**Decision**: Workflow definitions have an auto-incrementing `version` field. Instances capture the version at creation time. Config mutations are logged in a separate version_changes table.

**Rationale**: Enables audit of what workflow configuration was in effect when a given instance was processed. The version_changes table provides before/after snapshots for compliance.

### 4.5 SOD Alerting (P2)

**Approach**: Notification sent during `recordDecision()` when `sodViolationFlagged` is true. Recipients resolved from config (emails) or auto-resolved from facility compliance roles.

**Channels**: Email (Laravel Mail) + optional Webhook (custom channel with HTTP POST).

### 4.6 Approval Timeout (P2)

**Decision**: Timeout is set at instance creation time via `timeout_at`. A scheduled command scans for expired instances and auto-rejects them.

**Default**: 72 hours (configurable). Set to 0 for no timeout.

## 5. Migration Plan

### 5.1 Migration Order

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `2026_06_23_100003` | Base tables (workflows, instances, decisions, rules) |
| 2 | `2026_06_23_100004` | Recall columns (`recalled_decision_id`, `recall_reason`) |
| 3 | `2026_06_23_100005` | Archive columns (`archived_at` on audit_logs, decisions) |
| 4 | `2026_06_23_100006` | Version tracking (`version`, `workflow_version`, version_changes table) |
| 5 | `2026_06_23_100007` | Timeout columns (`timeout_at`, `auto_rejected_at`) |

### 5.2 Rollback Plan

Each migration has a `down()` method that reverses the changes:
- Drop new columns
- Drop new tables
- Remove indexes

## 6. Deployment Considerations

### 6.1 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `INVENTORY_ACCESS_AUDIT_LOG_RETENTION_DAYS` | 2190 | HIPAA 6-year retention |
| `INVENTORY_APPROVAL_TIMEOUT_DEFAULT_HOURS` | 72 | Workflow timeout |
| `INVENTORY_SOD_ALERTING_ENABLED` | true | Enable SOD notifications |
| `INVENTORY_SOD_ALERTING_WEBHOOK_URL` | - | Webhook endpoint for SOD alerts |
| `INVENTORY_SOD_ALERTING_NOTIFICATION_EMAILS` | - | Comma-separated notification recipients |

### 6.2 Scheduled Tasks

```
* * * * * php artisan inventory:auto-reject-expired-workflows        # Every minute
23 3 * * * php artisan inventory:archive-expired-records             # Daily at 3:23 AM
```

### 6.3 Known Limitations

1. **PostgreSQL FK type mismatch**: Migration `2026_06_23_100003` references `users.id` as UUID but the actual column is `bigint`. This blocks base migration on PostgreSQL. Test suite uses SQLite (no FK type checking). Resolution requires upstream schema alignment.
2. **DB-level immutability triggers**: Not yet implemented. Model-level guards prevent ORM mutations but direct SQL can bypass. Add DB triggers as defense-in-depth when PostgreSQL migration is unblocked.
3. **Cold storage export**: Archived records are marked (`archived_at`), not exported to cold storage. Phase 4+ feature.
