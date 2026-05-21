# E2E Test Foundation

Playwright covers browser-level release gates for critical hospital workflows.

## Local Setup

```bash
npm run test:e2e:install
npm run build
php artisan migrate
php artisan app:bootstrap-staging-minimum
npm run test:e2e:smoke
```

By default, Playwright expects the app to already be reachable at `PLAYWRIGHT_BASE_URL` or `http://127.0.0.1:8000`.

To let Playwright start Laravel's local server:

```bash
PLAYWRIGHT_START_SERVER=1 npm run test:e2e:smoke
```

PowerShell:

```powershell
$env:PLAYWRIGHT_START_SERVER = '1'
npm run test:e2e:smoke
```

To use an already running environment:

```bash
PLAYWRIGHT_BASE_URL=https://example.test npm run test:e2e:smoke
```

PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'https://example.test'
npm run test:e2e:smoke
```

Authenticated workflow tests are skipped until credentials are configured:

```bash
E2E_USER_EMAIL=admin@example.test E2E_USER_PASSWORD=secret npm run test:e2e
```

PowerShell:

```powershell
$env:E2E_USER_EMAIL = 'admin@example.test'
$env:E2E_USER_PASSWORD = 'secret'
npm run test:e2e
```

## Current Coverage

- Login page smoke with critical/serious axe checks.
- Unauthenticated protection for P0 clinical and operational routes.
- Authenticated selector-policy guard for appointments, emergency triage, and theatre workflows when E2E credentials are provided.

## CI

`.github/workflows/tests.yml` includes an `e2e-smoke` job that:

- prepares a temporary SQLite Laravel environment.
- builds Vite assets.
- installs Chromium with Playwright system dependencies.
- runs `npm run test:e2e:smoke`.
- uploads Playwright traces, screenshots, videos, and the HTML report when available.

## Expansion Rule

Do not mark a P0 workflow complete until it has:

- one happy-path E2E test.
- one validation/error-path E2E test.
- clinical or operational UAT evidence.
