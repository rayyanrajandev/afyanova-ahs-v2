# Inventory Approval Workflow — Frontend Integration Plan

## 1. Current State Assessment

### 1.1 Existing Approval Infrastructure
- ✅ Approval API endpoints registered (`inventory-department/approvals/*`)
- ✅ Backend controllers implemented (listPendingApprovals, approveRequisition, rejectRequisition, recallRequisition)
- ✅ Audit logging integrated
- ✅ Workflow engine with SOD validation + alerting ready
- ✅ Database schema complete (5 migrations + tables)

### 1.2 Existing Frontend Components
- ✅ Requisition listing: `WorkspaceRequisitionsTab.vue`
- ✅ Requisition detail sheet: `WorkspaceRequisitionDetailsSheet.vue`
- ✅ Audit timeline viewer: `AuditTimelineList.vue` (reusable)
- ✅ API client: `resources/js/lib/apiClient.ts` (with CSRF handling)
- ✅ Existing approval UI: `PlatformUserApprovalCaseController` has production UI (copy patterns)

### 1.3 Gap Analysis

| Feature | Backend | Frontend | Gap |
|---------|---------|----------|-----|
| List pending approvals | ✅ listPendingApprovals | ❌ No dedicated screen | Need new screen |
| Approve workflow | ✅ approveRequisition | ⚠️ Basic button only | Need form + validation |
| Reject workflow | ✅ rejectRequisition | ⚠️ Basic button only | Need form + reason capture |
| Recall workflow | ✅ recallRequisition | ❌ Not implemented | Need modal |
| SOD violation alert | ✅ Email + webhook | ❌ Not shown in UI | Need toast notification |
| Approval timeout display | ✅ timeout_at stored | ❌ No countdown | Need visual indicator |
| Audit trail for approvals | ✅ Logged (inventory_access_audit_logs) | ❌ No viewer | Can reuse AuditTimelineList |
| Workflow version history | ✅ Tracked (version_changes table) | ❌ Not exposed | Nice-to-have |

---

## 2. Frontend Architecture

### 2.1 Screen Map

```
/inventory-procurement/approvals
├── Pending Approvals List
│   ├── Approval Queue (table/cards)
│   ├── SOD violation indicators (red badge)
│   ├── Timeout countdown (amber if <24h)
│   └── Quick actions (Approve, Reject, View Details)
│
└── Approval Detail Modal
    ├── Requisition summary (items, cost)
    ├── Approval workflow progress (step 1 of 2, etc)
    ├── Decision form (Approve/Reject with reason)
    ├── SOD warning banner (if applicable)
    ├── Audit log (timeline of past decisions)
    └── Timeout info (if applicable)

/inventory-procurement/requisitions/{id}
├── Requisition detail (existing)
└── Add approval section:
    ├── Workflow status (In Progress, Approved, Rejected, Timed Out)
    ├── Current approvers
    ├── Recall button (if owner)
    └── Audit trail (timeline)
```

### 2.2 Component Structure

```
PendingApprovalsPage.vue (New)
├── PendingApprovalsTable.vue (New)
│   └── ApprovalRow.vue (New)
│       ├── StatusBadge.vue (existing pattern)
│       ├── TimeoutCountdown.vue (New)
│       └── SodIndicator.vue (New)
│
└── ApprovalDetailModal.vue (New)
    ├── RequisitionSummary.vue (New)
    ├── WorkflowProgress.vue (New)
    ├── DecisionForm.vue (New)
    │   ├── ApproveButton
    │   └── RejectReasonInput
    ├── SodWarningBanner.vue (New)
    ├── TimeoutInfo.vue (New)
    └── AuditTimelineList.vue (existing - reuse)
```

---

## 3. API Contract Validation

### 3.1 GET /inventory-department/approvals/pending

**Request**
```bash
GET /api/v1/inventory-department/approvals/pending
Authorization: Bearer {token}
```

**Response**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "requisition_id": "..."
      "requisition_number": "REQ-2026-001",
      "requesting_department": "Pharmacy",
      "workflow_status": "in_progress",
      "current_step": 1,
      "total_steps": 2,
      "created_at": "2026-06-23T10:30:00Z",
      "timeout_at": "2026-06-26T10:30:00Z",
      "sod_violation_flagged": false
    }
  ],
  "meta": { "total": 5 }
}
```

**Frontend Integration**
```typescript
// Use in PendingApprovalsPage.vue
const { data: approvals } = await apiClient.get('/inventory-department/approvals/pending')
```

---

### 3.2 POST /inventory-department/approvals/{workflowInstanceId}/approve

**Request**
```json
{
  "decision": "approved",
  "comments": "Approved - stock available"
}
```

**Response**
```json
{
  "success": true,
  "workflow_instance": {
    "id": "...",
    "status": "approved" | "in_progress",
    "current_step": "approved" | "step_2",
    "step_number": 2
  }
}
```

**Frontend Integration**
```typescript
const response = await apiClient.post(
  `/inventory-department/approvals/${instanceId}/approve`,
  { decision: 'approved', comments: formData.comments }
)
```

---

### 3.3 POST /inventory-department/approvals/{workflowInstanceId}/reject

**Request**
```json
{
  "decision": "rejected",
  "comments": "Insufficient stock"
}
```

**Response**
```json
{
  "success": true,
  "workflow_instance": {
    "id": "...",
    "status": "rejected",
    "current_step": "rejected"
  }
}
```

---

### 3.4 POST /inventory-department/approvals/{workflowInstanceId}/recall

**Request**
```json
{
  "reason": "Need to add more items"
}
```

**Response**
```json
{
  "success": true,
  "workflow_instance": {
    "id": "...",
    "status": "recalled",
    "recalled_decision_id": "...",
    "recall_reason": "Need to add more items"
  }
}
```

---

## 4. Implementation Priority

### Phase 1: Core Approval UI (Weeks 1-2)
- [ ] PendingApprovalsPage + table
- [ ] DecisionForm (approve/reject with comments)
- [ ] API integration for list + approve + reject
- [ ] Basic error handling + loading states
- [ ] Unit + integration tests

### Phase 2: Enhanced UX (Weeks 3)
- [ ] Timeout countdown (visual + state)
- [ ] SOD violation indicator + warning banner
- [ ] Approval detail modal with requisition summary
- [ ] AuditTimelineList integration (show past approvals)
- [ ] Toast notifications for actions

### Phase 3: Compliance Features (Weeks 4)
- [ ] Recall functionality (modal + form)
- [ ] Workflow version history viewer
- [ ] Audit log export (CSV) - copy from PlatformUserApprovalCases
- [ ] Permission checks (e.g., only requester can recall)

---

## 5. Design Patterns (Follow Existing Code)

### 5.1 Color & Status Badges
Reuse from existing approval case UI:
- `status === 'in_progress'` → Blue badge "Pending Approval"
- `status === 'approved'` → Green badge "Approved"
- `status === 'rejected'` → Red badge "Rejected"
- `status === 'recalled'` → Amber badge "Recalled"
- `sod_violation_flagged === true` → Red dot indicator

### 5.2 Forms
Use existing form patterns:
- `ApproveRequisitionRequest` validation rules (check backend)
- Textarea for comments/reasons (max 500 chars, validation in form)
- Loading spinner on submit
- Toast on success/error (use existing toast lib)

### 5.3 API Error Handling
Reuse `apiClient.ts` patterns:
```typescript
try {
  const response = await apiClient.post(url, data)
  showToast.success('Approved')
} catch (error) {
  if (error.response?.status === 422) {
    // Validation error - show field errors
    handleValidationErrors(error.response.data.errors)
  } else if (error.response?.status === 403) {
    // Permission denied (SOD violation, not allowed to approve)
    showToast.error(error.response.data.message)
  }
}
```

---

## 6. Data Flow Diagram

```
User navigates to /inventory-procurement/approvals
         ↓
PendingApprovalsPage calls listPendingApprovals()
         ↓
GET /inventory-department/approvals/pending
         ↓
Backend returns array of workflow instances
         ↓
Frontend displays table with:
- Requisition number, department, status
- Current step (1 of 2, etc)
- Timeout countdown
- SOD violation indicator
         ↓
User clicks "View Details" or "Approve"
         ↓
ApprovalDetailModal opens with:
- Requisition summary (items, cost breakdown)
- Workflow progress (steps completed)
- Approval form (Approve/Reject dropdown + comments)
         ↓
User submits form
         ↓
POST /inventory-department/approvals/{id}/approve
         ↓
Backend:
1. Checks SOD (requester ≠ approver) ✓
2. Checks authority limits (amount, category) ✓
3. Records decision (immutable) ✓
4. Logs audit entry ✓
5. Sends SOD alert if violation ✓
6. Advances workflow to next step
         ↓
Frontend receives response with new workflow status
         ↓
Toast "Approved" + refresh list or navigate away
```

---

## 7. Testing Strategy

### 7.1 Unit Tests (Vue components)
```typescript
// tests/unit/PendingApprovalsTable.test.ts
describe('PendingApprovalsTable', () => {
  it('renders pending approvals list', () => { ... })
  it('shows SOD violation indicator when flagged', () => { ... })
  it('shows timeout countdown when timeout_at is set', () => { ... })
  it('emits approve-clicked event', () => { ... })
})
```

### 7.2 Integration Tests
```typescript
// tests/integration/ApprovalWorkflow.test.ts
describe('Approval Workflow', () => {
  it('user can list and approve pending requisition', async () => {
    const approvals = await api.get('/approvals/pending')
    const result = await api.post(`/approvals/${approvals[0].id}/approve`, {...})
    expect(result.workflow_instance.status).toBe('approved')
  })
  
  it('SOD violation prevents same-user approval', async () => {
    const response = await api.post(`/approvals/${id}/approve`, {...})
    expect(response.status).toBe(403)
    expect(response.data.message).toContain('SOD')
  })
})
```

### 7.3 E2E Tests (if Cypress/Playwright available)
```typescript
// tests/e2e/approvalWorkflow.spec.ts
describe('Approval Workflow E2E', () => {
  it('manager approves requisition through full flow', () => {
    cy.login('manager@facility.local')
    cy.visit('/inventory-procurement/approvals')
    cy.contains('REQ-2026-001').click()
    cy.get('[data-testid="approve-btn"]').click()
    cy.get('[data-testid="comments"]').type('Approved')
    cy.get('[data-testid="submit"]').click()
    cy.contains('Approved').should('be.visible')
  })
})
```

---

## 8. Known Issues & Mitigations

| Issue | Impact | Mitigation |
|-------|--------|-----------|
| PostgreSQL FK mismatch in base migration | Dev DB blocked, but tests pass on SQLite | Not a frontend blocker; tests run fine |
| SOD alerting via email/webhook | External system dependency | Frontend shows SOD banner; email is fire-and-forget |
| Timeout auto-rejection runs async | Approval instance might not immediately reflect rejection | Add polling or WebSocket listener for real-time updates |

---

## 9. Success Criteria

- [ ] All 67 backend tests passing (done ✅)
- [ ] PendingApprovalsPage displays list correctly
- [ ] Approve/Reject forms submit and update workflow status
- [ ] SOD violations prevented at API + shown in UI
- [ ] Timeout countdown displays and auto-refreshes
- [ ] Audit logs visible in detail modal
- [ ] 90%+ API contract test coverage
- [ ] No TypeScript errors
- [ ] Production build succeeds
