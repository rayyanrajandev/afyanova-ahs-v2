# Free Testing Deployment

This setup is for early hospital testing. It is not a final production setup.

## 1. Create A GitHub Repo

From this project folder:

```powershell
git init
git add .
git commit -m "Prepare free staging deployment"
```

Create a new private GitHub repository, then connect it:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/afyanova-ahs-v2.git
git branch -M main
git push -u origin main
```

Keep the repository private while the system contains hospital or patient data.

## 2. Create Free PostgreSQL On Neon

1. Go to `https://neon.com`
2. Create a free project.
3. Create or copy the default database connection details.
4. Use the pooled connection if the app host has low connection limits.
5. Keep `sslmode=require`.

Neon free is good for testing, but it has storage and usage limits.

## 3. Deploy The App

Use a free Docker-capable app host such as Koyeb, Render free/trial, or another Docker host that can deploy from GitHub.

Recommended settings:

```text
Runtime / Language: Docker
Branch: main
Dockerfile path: Dockerfile
Port: 10000
```

Add environment variables from `.env.staging.example`.

Important variables:

```text
APP_ENV=staging
APP_DEBUG=false
APP_URL=https://your-host-url
APP_KEY=base64:...
DB_CONNECTION=pgsql
DB_SSLMODE=require
RUN_MIGRATIONS=true
```

Generate `APP_KEY` locally:

```powershell
php artisan key:generate --show
```

Paste the result into the hosting provider's environment variables.

## 4. After Every Change

```powershell
git add .
git commit -m "Describe the change"
git push
```

The hosting service should redeploy automatically from GitHub.

## 5. Safety Notes

- Do not commit `.env`.
- Keep `APP_DEBUG=false` online.
- Use a private GitHub repository.
- Use strong passwords for test users.
- Back up the database before bigger schema changes.
- Free hosting can sleep, slow down, or change limits.
