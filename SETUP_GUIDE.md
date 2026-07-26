# Afyanova AHS — Full Setup Guide (Zero to Production)

**Scope:** private health facilities only, spanning dispensary → health centre → hospital → referral hospital. This guide assumes you have just run `php artisan migrate:fresh` and deleted all seeder classes (`database/seeders/*`), so the database is schema-only with **zero** tenants, facilities, users, and roles. The permission catalog (278 rows) is already present because it is seeded inside migrations, not by `DatabaseSeeder`.

Current confirmed state at time of writing:
- `permissions`: 278 rows (from migrations — correct, leave as-is)
- `roles`, `facilities`, `tenants`, `users`: 0 rows, except one stray `PLATFORM.SUBSCRIPTION.ADMIN` role left over from an earlier manual test run — harmless, Phase 4 below fixes it automatically (upsert by `code`)

---

## Phase 0 — Prerequisites

| Tool | Version | Notes |
|---|---|---|
| PHP | 8.2+ (Docker image uses 8.4) | needs `pdo_pgsql`, `zip` extensions |
| Composer | 2.x | |
| Node.js | 22.x | matches `Dockerfile` |
| PostgreSQL | 14+ | local dev DB is `afyanova_ahs` per `.env` |
| Git | any recent | repo is on `main` |

---

## Phase 1 — Local Environment Bootstrap

```bash
composer install
npm install
php artisan key:generate   # only if APP_KEY is empty
```

Confirm `.env` points at your local Postgres:

```
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=afyanova_ahs
DB_USERNAME=afyanova_ahs
DB_PASSWORD=...
```

---

## Phase 2 — Database Foundation

```bash
php artisan migrate:fresh
```

This rebuilds every table from the 339 migration files and re-seeds the **baseline permission catalog only** (278 permission rows). It does **not** create roles, tenants, facilities, or users — those no longer come from seeders and must be created explicitly in Phase 3.

Verify:

```bash
php artisan tinker --execute="echo DB::table('permissions')->count();"   # expect 278
php artisan tinker --execute="echo DB::table('roles')->count();"          # expect 0 (or 1 stray row, fine)
```

---

## Phase 3 — Platform & Facility Bootstrap

Do **not** hand-build the tenant/facility/admin user through raw SQL. There is already a purpose-built artisan command for exactly this:

```bash
php artisan app:bootstrap-staging-minimum \
  --tenant-code=TESTDISP \
  --tenant-name="Test Dispensary Ltd" \
  --facility-code=DISP1 \
  --facility-name="Test Dispensary" \
  --admin-email=admin@disp1.com \
  --admin-name="Rajani Diwani" \
  --admin-password="Bulle@1591@"
```

If you hit `No arguments expected for "app:bootstrap-staging-minimum" command, got " "` when running the multi-line (`\`-continued) version, run it as a single line instead — that error means a stray blank argument slipped in from a broken line-continuation, most often from pasting into a shell/tool that doesn't handle trailing `\` the same way bash does:

```bash
php artisan app:bootstrap-staging-minimum --tenant-code=TESTDISP --tenant-name="Test Dispensary Ltd" --facility-code=DISP1 --facility-name="Test Dispensary" --admin-email=admin@disp1.com --admin-name="Rajani Diwani" --admin-password="Bulle@1591@"
```

Expected output on success:

```text
Minimum staging data is ready.
Admin email: admin@disp1.com
Tenant: TESTDISP
Facility: DISP1
Created/updated: tenant, facility, facility subscription (active plan), departments, permissions, roles, admin user, facility assignment.
```

What this single command creates, in one DB transaction:
- The tenant (organization) row
- The facility row
- Baseline departments for that facility (`BaselineDepartmentCatalog::seedForScope`)
- An active facility subscription plan (`FacilitySubscriptionBootstrap`)
- Your admin user, with **every existing permission granted directly** (not via a role — this is a deliberate bootstrap-only bypass so you have a working login before the role system is fully wired up)
- A `facility_user` pivot row marking that admin as `super_admin` / primary for the facility

**Four things to fix immediately after running it:**

1. **Facility type is hardcoded.** The command always sets `facility_type = 'hospital'`, regardless of what you intend. Since your first test facility is a dispensary or health centre, go to **Platform → Facilities** in the app UI (or `FacilityConfigurationController`) right after bootstrapping and correct `facility_type` to `dispensary` or `health_centre`. It's a free-text field, not a locked enum, so this is safe to edit.
2. **Skip `--registration-email` for now.** If you pass it, the command tries to assign role code `HOSPITAL.REGISTRATION.CLERK` to that user — but that code is part of a **dead legacy role-naming scheme** (same family flagged in the 2026-07-23 RBAC audit as `HOSPITAL.FACILITY.ADMIN` and friends): several migrations grant permissions to `HOSPITAL.REGISTRATION.CLERK`, but no seeder or config ever creates a `roles` row with that code, so the assignment silently no-ops and that user ends up with a `facility_user` pivot entry but no real role. Create your Receptionist user manually afterward (Phase 5) using the real role code `ADMIN.REGISTRATION` instead. This is a genuine pre-existing gap worth fixing in the migrations before production (see Phase 9).
3. **Upgrade the subscription plan to unlock everything for testing.** The bootstrap command auto-attaches the **Clinical Operations Plus** plan (TZS 450,000/mo) — it covers registration, appointments, encounters, orders, lab, pharmacy, and clinical stock issue, but *not* multi-facility operations, advanced audit/export, integrations, full revenue-cycle billing, or procurement/inventory. Those are gated behind `EnsureFacilitySubscriptionEntitlement` middleware with **no bypass for any role, including `PLATFORM.SUPER.ADMIN`** — confirmed by reading `FacilitySubscriptionAccessService`, which checks the facility's plan entitlements only, never the acting user's role. Since this is test data anyway, upgrade it to **Enterprise Hospital Network** (`hospital_network`, the top tier) so nothing is off-limits during testing:
   - **Preferred:** log in as your platform super admin, go to the facility's subscription management screen (`platform.facilities.manage-subscriptions`), and switch the plan there — this also exercises a real admin feature you'll need later for actual customers.
   - **Quick one-off alternative:**

     ```bash
     php artisan tinker --execute="
     \$plan = DB::table('platform_subscription_plans')->where('code', 'hospital_network')->first();
     DB::table('facility_subscriptions')->where('facility_id', DB::table('facilities')->where('code','DISP1')->value('id'))
       ->update(['plan_id' => \$plan->id, 'price_amount' => \$plan->price_amount]);
     "
     ```

4. **This admin is not actually a "super admin" yet — it just has a lot of individual permissions.** Checked in `app/Models/User.php`: the app's real super-admin check, `isPlatformSuperAdmin()`, only returns `true` if the `is_platform_admin` column is `true` **or** the user holds an active role literally coded `PLATFORM.SUPER.ADMIN`. `bootstrap-staging-minimum` sets neither — it only calls `givePermissionTo()` per permission. So this account will pass ordinary permission checks (`->can('billing.invoices.create')`, etc.) but will **fail** anything that checks `isPlatformSuperAdmin()`/`hasUniversalAdminAccess()` directly (e.g. cross-tenant admin screens, the universal-bypass logic itself). Fix with one more command, same email, password untouched:

   ```bash
   php artisan app:grant-system-super-admin admin@disp1.com
   ```

   This assigns the real `PLATFORM.SUPER.ADMIN` role to the existing account (creating the role row if needed) and syncs every permission to both the role and the user. Use this — not `app:bootstrap-super-admin` — when you already have an account from Phase 3 and just want to upgrade it; `app:bootstrap-super-admin` is for creating a brand-new standalone account from scratch instead.

---

## Phase 4 — Full Role Catalog

Now that a facility exists, sync the full role catalog from `config/roles.php`:

```bash
php artisan roles:sync
```

This is idempotent (upsert by `code`) — safe to re-run any time. It will:
- Fix/complete the 4 platform roles (`PLATFORM.SUPER.ADMIN`, `PLATFORM.USER.ADMIN`, `PLATFORM.RBAC.ADMIN`, `PLATFORM.SUBSCRIPTION.ADMIN`) — the stray existing row gets corrected in place
- Create all 27 facility-scoped roles (Clinical Officer, Nurse Officer, Nurse Midwife, Dispenser, Pharmacist, Cashier, Receptionist, Accountant, Insurance Claims Officer, etc.) against your new facility, with their permission grants attached

Run this command again **every time `config/roles.php` changes**, and again after creating any additional facility.

---

## Phase 5 — Staff & Users for Dispensary/Health-Centre Testing

Your bootstrap admin currently has permissions granted directly, bypassing roles entirely — that's fine for the one login you used to get in, but every other user should go through the real role system. Through the app's Staff/Users UI, create one user per role you're actually testing at this tier:

| Role | Code |
|---|---|
| Facility Administrator | `ADMIN.FACILITY` |
| Clinical Officer | `CLINICAL.GENERAL` |
| Nurse Officer | `CLINICAL.NURSE` |
| Nurse Midwife | `CLINICAL.NURSE.MIDWIFE` |
| Dispenser | `PHARMACY.STAFF` |
| Cashier | `FINANCE.CASHIER` |
| Receptionist | `ADMIN.REGISTRATION` |
| Accountant | `FINANCE.OFFICER` |
| Insurance Claims Officer | `FINANCE.CLAIMS` |

(Health-centre only, not dispensary: also add Medical Officer `CLINICAL.PHYSICIAN` and basic Laboratory Technologist `LAB.STAFF`.)

Consider also converting your bootstrap admin from the direct-permission bypass to a real `ADMIN.FACILITY` role assignment once you've confirmed the role-based path works, so your test environment matches how production accounts will actually behave.

---

## Phase 6 — Reference & Master Data

With seeders deleted, none of the following auto-populates anymore — it must come from the app itself:
- **Chargeable items & price book entries** — create through Billing → Chargeable Items (the pricing engine migrated off legacy pricing tables; this is now the only path)
- **Departments** — already handled by Phase 3's `BaselineDepartmentCatalog::seedForScope` call, nothing further needed
- **Clinical / lab / pharmacy / radiology catalogs** — previously came from demo seeders (`LaboratoryClinicalCatalogSeeder`, `PharmacyClinicalCatalogSeeder`, etc.), now deleted. Decide deliberately: either populate these manually through the relevant admin catalog screens as real reference data, or write new, lean, production-appropriate seeders before go-live — don't leave this as an accidental gap discovered mid-QA.

---

## Phase 7 — Functional Verification

```bash
./vendor/bin/pest                     # full test suite
php artisan rbac:audit-permissions    # RBAC tripwire: every permission literal checked in code
                                       # must be seeded AND reachable by a real role
```

Then manually walk the golden path in a browser, logged in as each role from Phase 5: patient registration → consultation → lab/pharmacy order → dispensing → billing/cashier payment. Static checks confirm the code runs; only driving it in the browser confirms the workflow actually works end to end.

---

## Phase 8 — Staging Deployment

Follow the existing `FREE_HOSTING_SETUP.md` in this repo:
1. Push to a private GitHub repo
2. Provision free Postgres on Neon (`sslmode=require`)
3. Deploy the `Dockerfile` to a Docker-capable host (Koyeb/Render/etc.), port `10000`
4. Set env vars from `.env.staging.example` (`APP_ENV=staging`, `APP_DEBUG=false`, `RUN_MIGRATIONS=true`, real `DB_*`, `APP_KEY`)

**Important:** `docker/start.sh` runs `php artisan migrate --force` automatically on boot (when `RUN_MIGRATIONS=true`), but it does **not** run `roles:sync` or `app:bootstrap-staging-minimum`. After the very first successful staging deploy, SSH/exec into the running container (or run a one-off job on your host) and repeat Phases 3–4 against staging once.

---

## Phase 9 — Production Readiness Gate

This repo already has a dedicated CI workflow for this: `.github/workflows/retention-readiness-gate.yml`. Before a real production launch (i.e., before real patient data enters the system), it requires these GitHub Environment secrets/variables to be set for the `production` environment:

- `APP_KEY` (secret)
- `PLATFORM_CROSS_TENANT_AUDIT_LOG_RETENTION_SCHEDULE_ENABLED`
- `PLATFORM_CROSS_TENANT_AUDIT_LOG_RETENTION_SCHEDULE_ALLOWED_ENVS`
- `PLATFORM_CROSS_TENANT_AUDIT_LOG_HOLDS_ENFORCE_TWO_PERSON_CONTROL`
- `PLATFORM_CROSS_TENANT_AUDIT_LOG_RETENTION_REQUIRE_TWO_PERSON_CONTROL_FOR_SCHEDULED_PURGE`
- `PLATFORM_CROSS_TENANT_AUDIT_LOG_RETENTION_SCHEDULE_TWO_PERSON_CONTROL_WAIVER_ENABLED` (+ waiver reference if used)

Trigger it manually (`workflow_dispatch`, `target_environment: production`) and confirm it passes before cutover.

**Infrastructure processes required in production** (none of these run inside `docker/start.sh` — they must be separate long-running processes):
- **Queue worker** — `QUEUE_CONNECTION=database`, so something must run `php artisan queue:work` continuously (supervisor/systemd)
- **Scheduler** — a real cron entry running `* * * * * php artisan schedule:run` is required to drive: expiring-batch checks/quarantine, auto-reorder, warehouse-transfer-reservation expiry, expired-role revocation, and — critically — the cross-tenant audit log retention purge and audit-export cleanup jobs gated above
- **Reverb websocket server** if you rely on real-time channels (billing queue, patient flow board)

**Known open gaps to close before handling real patient data** (carried over from the 2026-07-23 RBAC audit, plus one found while writing this guide):
- `HOSPITAL.REGISTRATION.CLERK` and the wider `HOSPITAL.*` legacy-role-naming-drift cleanup (permissions granted to role codes that are never instantiated as real rows) — not yet scoped as its own fix
- Task 2.3: product sign-off on `ADMIN.FACILITY` permission-list completeness — needs a human decision, not code
- RBAC audit Phase 7 backlog (deliberately not started): break-glass emergency access, system-wide segregation of duties, read-access audit logging for PHI, periodic access recertification — each needs its own scoping discussion before you're handling live patient data

**Backups:** set up automated Postgres backups on whatever host you land on, and run at least one full restore drill before go-live — don't find out your backup strategy doesn't work during a real incident.

---

## Phase 10 — Go-Live & Post-Launch

1. Set `APP_ENV=production`, `APP_DEBUG=false`
2. `php artisan config:cache && php artisan route:cache && php artisan view:cache` (already automated in `docker/start.sh`)
3. Point your real domain at the host, enforce HTTPS
4. Confirm the queue worker, scheduler cron, and (if used) Reverb process are all running as persistent services, not just started once
5. Watch logs/error tracking closely for the first few days of real traffic

**Ongoing operational habits:**
- Re-run `php artisan roles:sync` any time `config/roles.php` changes, and again whenever a new facility is onboarded
- Re-run `php artisan rbac:audit-permissions` as part of every deploy (it already runs inside the full Pest suite via `tests/Feature/RbacPermissionUsageAuditTest.php`, so this happens automatically in CI)
- Revisit the Phase 9 backlog items on a real schedule, not "eventually"
