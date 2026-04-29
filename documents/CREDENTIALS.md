# Credentials & Super Admin Bootstrap

Use this when you need login access for local UI testing.

## Rajani Admin Account

Email:
`rajani.diwani@afyanova-ahs.com`

## Command To (Re)Create Admin + Assign Permissions

```bash
php artisan app:bootstrap-super-admin --email=rajani.diwani@afyanova-ahs.com
```

What it does:
1. Creates or updates the user.
2. Grants all current gate-backed permissions (super-admin style local access).
3. Prints a generated password in terminal output.

Important:
1. Existing password cannot be retrieved (passwords are hashed).
2. Running this command rotates/reset the password for that user.

## Set Your Own Password (Optional)

```bash
php artisan app:bootstrap-super-admin --email=rajani.diwani@afyanova-ahs.com --password="YourStrongPass123!" --show-password
```

## If Command Fails

Run migrations first, then retry:

```bash
php artisan migrate --force
php artisan app:bootstrap-super-admin --email=rajani.diwani@afyanova-ahs.com
```

## Source Of Truth

Command definition:
`routes/console.php` (`app:bootstrap-super-admin`)


Mailpit

cd c:\Portfolio\afyanova-ahs-v2
powershell -ExecutionPolicy Bypass -File .\scripts\start-mailpit.ps1
