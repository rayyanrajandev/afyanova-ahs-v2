You are building a modern Hospital Information System (HIS) in 2026. Before writing any code or suggesting architecture, review and strictly follow these principles.

## Core Architecture
- Use role-based dashboards: each role gets a dedicated dashboard optimized for its workflow.
- Use permission-based access control underneath roles. Roles define defaults; permissions decide actual access.
- Users may have multiple roles, facilities, departments, and responsibilities.
- Auto-detect the user’s primary role on login and route to the best default dashboard.
- Allow authorized users to switch role contexts when they have multiple approved roles.
- Store role, permission, dashboard, and navigation configuration centrally.
- New roles must be addable without rewriting layout code.
- Use shared patient-centered views where appropriate, with actions and data adapted by permission.
- Avoid hard data silos between roles; clinical workflows must support safe cross-role collaboration.

## Supported Roles
- Registration Clerk
- Nurse
- Doctor
- Pharmacist
- Lab Technician
- Radiologist
- Ward Manager
- Billing / Claims Officer
- IT Admin
- Hospital Administrator
- C-Suite / Executive
- Other configurable custom roles

## Frontend / UX
- Each role dashboard should load only relevant data, actions, and components.
- Clinical roles should be mobile-first and fast for ward rounds, bedside care, and urgent decisions.
- Administrative roles should be desktop-first for data entry, reporting, billing, and management workflows.
- Put the most urgent and frequently used information above the fold.
- Avoid mega-menus, excessive toggles, and hidden critical actions.
- Navigation should follow the user’s workflow, not the database structure.
- Use skeleton loaders instead of spinners where possible.
- Show clear empty, loading, error, offline, and permission-denied states.
- Use progressive disclosure: show essential information first, details second.
- Critical clinical alerts must be visible, prioritized, and hard to miss without being noisy.

## Data & API
- APIs must enforce authorization server-side. Never rely on frontend role checks alone.
- API responses should be permission-aware, based on role, facility, department, patient relationship, assigned care team, encounter context, and emergency access rules.
- Return only the minimum necessary data for the user’s task.
- Use real-time updates for vitals, orders, alerts, bed status, lab results, and other time-sensitive clinical data using WebSockets, SSE, or an equivalent mechanism.
- Support offline or poor-connectivity workflows for approved clinical use cases.
- Offline mode must cache only minimum necessary data, encrypt local data, expire cached records, and handle sync conflicts safely.
- All data access, changes, exports, failed access attempts, and emergency overrides must be audit logged.
- Audit logs must include user, role/context, patient/record, action, timestamp, device/session, and reason where required.

## Security & Compliance
- Apply least-privilege access by default.
- Use RBAC plus ABAC/context-aware rules where needed.
- Support audited break-glass access for emergencies, requiring reason capture and post-event review.
- Follow HL7 FHIR standards for clinical data interchange where appropriate.
- Ensure HIPAA and applicable local health data compliance.
- Protect PHI/PII in storage, transit, logs, analytics, screenshots, exports, and notifications.
- Use role- and risk-based session policies.
- Clinical users should have secure fast re-authentication rather than unsafe long sessions or disruptive constant logouts.
- Enforce MFA for privileged, administrative, remote, and high-risk access.
- Never expose unauthorized data in UI state, API payloads, logs, browser storage, analytics, or error messages.

## Code Quality
- Build modular, role-agnostic components.
- Inject role, permission, facility, department, and patient context instead of hardcoding them.
- Keep dashboard layout config separate from business logic.
- Every clinical workflow must have error boundaries and safe fallback states.
- A crash in one module must not take down the whole dashboard.
- Write tests for permission logic, audit logging, emergency access, offline sync, and critical clinical workflows.
- Treat authorization, data integrity, and audit behavior as critical-path features.
- Use feature flags or configuration for new roles, dashboards, and workflows where possible.

## Feature Design Rule
When I describe a feature or screen, always clarify before writing code:

1. Which role(s) does it serve?
2. What task or decision is the user trying to complete?
3. What data is needed?
4. What permissions are required?
5. What should be visible on mobile vs desktop?
6. What needs real-time updates?
7. What happens offline or on poor connectivity?
8. What must be audit logged?
9. What are the error, empty, loading, and permission-denied states?
10. What is the safest fallback if the workflow fails?

Do not suggest code or architecture until these are clear or until reasonable assumptions are explicitly stated.