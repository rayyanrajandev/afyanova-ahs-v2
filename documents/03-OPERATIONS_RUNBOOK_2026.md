# Operations Runbook - Tanzania Healthcare System
## Afyanova AHS v2 Deployment & Operations Guide

**Document Version:** 1.0  
**Date:** April 15, 2026  
**Target Environment:** Tanzania Hospital Network

---

## 1. Deployment Prerequisites

### 1.1 System Requirements

**Server Specifications:**
- CPU: 4+ cores (8+ recommended for production)
- RAM: 16GB minimum (32GB recommended)
- Storage: 500GB+ SSD (for audit logs)
- Network: Redundant internet connectivity
- Backup: External secure storage

**Software Stack:**
- PHP 8.2+ (Laravel 11)
- PostgreSQL 14+ (production database)
- Node.js 18+ (Vue/TypeScript frontend)
- Redis (optional, for caching)
- Nginx or Apache (web server)

**Security Requirements:**
- SSL/TLS certificates (valid for domain)
- Firewall configured
- DDoS protection (if public-facing)
- Backup encryption

---

## 2. Pre-Deployment Checklist

### 2.1 Environment Preparation

```bash
# ✅ Configure server environment
SERVER_ENV=production
APP_DEBUG=false
APP_ENV=production

# ✅ Database setup
DB_CONNECTION=pgsql
DB_HOST=db.hospital.tz
DB_PORT=5432
DB_DATABASE=afyanova_ahs_prod
DB_USERNAME=app_user
DB_PASSWORD=${VAULT_SECRET:db_password}  # From secrets manager

# ✅ Session security
SESSION_DRIVER=database
SESSION_LIFETIME=60
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=true  # HTTPS only

# ✅ Security
BCRYPT_ROUNDS=12
APP_KEY=$(php artisan key:generate --show)  # Unique per environment
```

### 2.2 Credentials Management

**Before deployment:**
- [ ] Database password stored in AWS Secrets Manager / Vault
- [ ] Super admin account created in secure vault
- [ ] Email credentials configured (for notifications)
- [ ] SSL certificates installed and validated
- [ ] API keys generated for integrations
- [ ] Backup encryption keys prepared

**After deployment:**
- [ ] All credentials rotated from defaults
- [ ] No credentials in .env or repository
- [ ] Access logs show correct authentication
- [ ] Failed login attempts blocked (rate limiting)

---

## 3. Deployment Process

### 3.1 Step-by-Step Deployment

```bash
#!/bin/bash
# Afyanova AHS v2 Production Deployment Script

# 1. Pull latest code from repository
git clone https://github.com/afyanova/ahs-v2.git /opt/afyanova-ahs
cd /opt/afyanova-ahs

# 2. Install PHP dependencies
composer install --no-dev --optimize-autoloader

# 3. Install Node dependencies
npm ci --production
npm run build

# 4. Set up environment
cp .env.example .env
# IMPORTANT: Update .env with production values from secrets manager

# 5. Generate Laravel key
php artisan key:generate

# 6. Create database
createdb -h db.hospital.tz -U postgres afyanova_ahs_prod

# 7. Run migrations
php artisan migrate --force

# 8. Seed initial data (roles, permissions, etc)
php artisan db:seed --class=RolePermissionSeeder

# 9. Set file permissions
chown -R www-data:www-data /opt/afyanova-ahs
chmod -R 755 /opt/afyanova-ahs/storage
chmod -R 755 /opt/afyanova-ahs/bootstrap/cache

# 10. Cache configuration
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 11. Start queue workers (for async jobs)
php artisan queue:restart
supervisorctl restart afyanova-queue-worker

# 12. Enable application
php artisan up

# 13. Verify deployment
curl -I https://afyanova-ahs.hospital.tz
php artisan health:show
```

### 3.2 Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name afyanova-ahs.hospital.tz;

    # SSL certificates
    ssl_certificate /etc/ssl/certs/afyanova-ahs.hospital.tz.crt;
    ssl_certificate_key /etc/ssl/private/afyanova-ahs.hospital.tz.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Root directory
    root /opt/afyanova-ahs/public;
    index index.php;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # PHP routing
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Deny access to sensitive files
    location ~ /\.env {
        deny all;
    }

    location ~ /\.git {
        deny all;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name afyanova-ahs.hospital.tz;
    return 301 https://$server_name$request_uri;
}
```

---

## 4. Post-Deployment Verification

### 4.1 System Checks

```bash
# Check application status
php artisan health:show
# Expected: Up (all services running)

# Verify database connection
php artisan tinker
>>> DB::connection()->getPdo();
# Expected: Connected

# Check audit logging
>>> App\Models\AuditLog::count();
# Expected: > 0 (some initial logs created)

# Verify encryption
>>> App\Models\User::first()->password;
# Expected: hashed value starting with $2y$12$ (bcrypt)
```

### 4.2 Security Verification

```bash
# Check SSL certificate
openssl s_client -connect afyanova-ahs.hospital.tz:443
# Expected: Certificate valid, expires in 12+ months

# Test CSRF protection
curl -X POST https://afyanova-ahs.hospital.tz/api/v1/auth/csrf-token
# Expected: 200 with token in response

# Test rate limiting
for i in {1..10}; do
    curl -X GET https://afyanova-ahs.hospital.tz/api/v1/auth/csrf-token
done
# Expected: 429 (Too Many Requests) after 30 attempts per minute

# Check session encryption
tail -50 /opt/afyanova-ahs/storage/logs/laravel.log
# Expected: No plain-text session data in logs
```

### 4.3 Backup Configuration

```bash
# Set up automated backups (daily at 2 AM)
0 2 * * * /usr/local/bin/backup-database.sh

# Backup script: /usr/local/bin/backup-database.sh
#!/bin/bash
BACKUP_DIR="/mnt/backups/afyanova-ahs"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/afyanova_ahs_$DATE.sql.gz"

# Backup database
pg_dump -h db.hospital.tz -U app_user afyanova_ahs_prod | gzip > $BACKUP_FILE

# Encrypt backup
gpg --encrypt --recipient backup@hospital.tz $BACKUP_FILE

# Upload to secure storage
aws s3 cp $BACKUP_FILE.gpg s3://afyanova-backups/

# Cleanup local copy
rm -f $BACKUP_FILE $BACKUP_FILE.gpg

# Verify backup
echo "Backup completed: $(ls -lh $BACKUP_FILE.gpg)"
```

---

## 5. Daily Operations

### 5.1 Morning Checks (8 AM)

```bash
# System status
systemctl status nginx
systemctl status php8.2-fpm
systemctl status postgresql

# Application status
curl -I https://afyanova-ahs.hospital.tz
# Expected: HTTP/2 200

# Database disk space
df -h /var/lib/postgresql
# Alert if > 80% full

# Check error logs
tail -100 /opt/afyanova-ahs/storage/logs/laravel.log
# Alert on ERROR or CRITICAL entries

# Monitor failed logins
php artisan tinker
>>> App\Models\FailedLoginAttempt::where('created_at', '>', now()->subDay())->count()
# If > 50 attempts: investigate and alert
```

### 5.2 Weekly Maintenance (Monday 9 AM)

```bash
# Clear expired sessions
php artisan session:prune-stale-sessions

# Clear failed login attempts older than 30 days
php artisan auth:purge-failed-logins

# Check disk space
du -sh /opt/afyanova-ahs/storage
du -sh /var/lib/postgresql

# Verify backup integrity
aws s3 ls s3://afyanova-backups/ --recursive --summarize
# Check that latest backup exists and is recent

# Review audit logs for anomalies
php artisan audit:report --range=last-7-days
```

### 5.3 Monthly Tasks (1st of Month)

```bash
# Rotate credentials
php artisan credentials:rotate

# Update dependencies
composer update
npm update

# Security audit
php artisan security:audit

# Capacity planning
php artisan report:capacity

# MOH compliance check
php artisan compliance:validate-tanzania
```

---

## 6. Monitoring & Alerting

### 6.1 Key Metrics to Monitor

```
Application Performance:
- Response time (target: <200ms for API, <500ms for web)
- Error rate (target: <0.1%)
- Database query time (target: <50ms average)
- Queue job processing (target: <5 min)

Security:
- Failed login attempts (alert if >5 per minute)
- Rate limit violations (alert if >10 per minute)
- Unauthorized access attempts (alert immediately)
- Missing audit logs (alert immediately)

Infrastructure:
- CPU usage (alert if >80%)
- Memory usage (alert if >85%)
- Disk space (alert if >90%)
- Database connections (alert if >80% of max)
```

### 6.2 Alerting Configuration

```yaml
# Prometheus/AlertManager config
groups:
  - name: afyanova_ahs_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        annotations:
          summary: "High error rate detected"
          
      - alert: HighFailedLogins
        expr: rate(failed_logins_total[5m]) > 5
        annotations:
          summary: "High failed login rate - potential attack"
          
      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        annotations:
          summary: "Disk space critically low"
```

---

## 7. Disaster Recovery

### 7.1 Backup & Restore Procedures

**Database Backup:**
```bash
# Full backup
pg_dump -h db.hospital.tz -U app_user afyanova_ahs_prod > backup.sql

# Compressed backup
pg_dump -h db.hospital.tz -U app_user afyanova_ahs_prod | gzip > backup.sql.gz

# Point-in-time recovery (if WAL archiving enabled)
pg_basebackup -h db.hospital.tz -U app_user -D ./backup
```

**Restore from Backup:**
```bash
# Stop application
php artisan down --message="Maintenance mode"

# Restore database
dropdb -h db.hospital.tz -U postgres afyanova_ahs_prod
createdb -h db.hospital.tz -U postgres afyanova_ahs_prod
gunzip < backup.sql.gz | psql -h db.hospital.tz -U app_user afyanova_ahs_prod

# Run migrations (if schema changed)
php artisan migrate --force

# Clear caches
php artisan cache:clear
php artisan config:cache

# Restart application
php artisan up
```

**Recovery Time Objectives (RTO):**
- Database corruption: 1 hour
- Server failure: 4 hours (provision new server)
- Data center failure: 8 hours (failover to backup DC)

### 7.2 Disaster Recovery Testing

**Monthly DR Drill (Last Friday):**
```bash
# 1. Simulate database failure
# 2. Restore from latest backup to test environment
# 3. Verify data integrity
# 4. Test failover procedure
# 5. Document recovery time & issues
# 6. Report to management
```

---

## 8. Incident Response

### 8.1 Security Incident Response

**Upon Detection:**

1. **Immediate (First 15 minutes)**
   - Isolate affected systems
   - Stop potential data exfiltration
   - Preserve evidence (logs, memory dumps)
   - Notify security team

2. **Short-term (First hour)**
   - Assess scope of compromise
   - Identify affected users/data
   - Begin forensic analysis
   - Prepare incident report

3. **Long-term (First 24 hours)**
   - Complete investigation
   - Implement remediation
   - Deploy security patches
   - Notify stakeholders
   - Notify MOH (if PHI affected)

**Escalation:**
```
IT On-Call → Security Lead → Facility Admin → MOH (if required)
```

### 8.2 Performance Incident Response

**Slow Response Time:**
```bash
# 1. Check system resources
top  # CPU/Memory
df -h  # Disk space

# 2. Check database performance
psql -h db.hospital.tz -U app_user -d afyanova_ahs_prod
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

# 3. Check slow query logs
tail -50 /var/log/postgresql/postgresql.log | grep "duration"

# 4. Clear caches if applicable
php artisan cache:clear

# 5. Optimize slow queries or add indexes
php artisan migrate --force  # Run pending migrations if schema updated
```

---

## 9. Maintenance Windows

### 9.1 Scheduled Maintenance

**Monthly Maintenance Window (2nd Sunday, 2-4 AM)**

```bash
# 1. System updates
apt-get update && apt-get upgrade -y

# 2. Database maintenance
VACUUM ANALYZE;  -- Optimize PostgreSQL

# 3. Clear old logs
find /opt/afyanova-ahs/storage/logs -mtime +30 -delete

# 4. Clear expired sessions
php artisan session:prune-stale-sessions

# 5. Verify backups
aws s3 ls s3://afyanova-backups/ --recursive --summarize

# 6. Security updates
php artisan package:audit  # Check for vulnerable packages
```

### 9.2 Maintenance Communication

```
12:00 AM - Staff notification (maintenance window in 2 hours)
02:00 AM - System enters maintenance mode
         php artisan down --secret=secret-key
         
02:00 AM - 04:00 AM - Maintenance work
         
04:00 AM - System back online
         php artisan up
         
04:30 AM - Verification complete
         Post maintenance summary
```

---

## 10. Documentation & Contacts

### 10.1 Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-Call IT | [TBD] | +255 XXX XXX | on-call@hospital.tz |
| Security Lead | [TBD] | +255 XXX XXX | security@hospital.tz |
| Facility Admin | [TBD] | +255 XXX XXX | admin@hospital.tz |
| MOH Contact | [TBD] | +255 XXX XXX | compliance@moh.go.tz |

### 10.2 System Documentation

- Architecture: See `03-SYSTEM_ARCHITECTURE.md`
- Security: See `02-SECURITY_AUDIT_FINDINGS_2026.md`
- Compliance: See `01-COMPLIANCE_TANZANIA_HEALTHCARE_2026.md`
- Credentials: See `02-SECURITY_CREDENTIALS_MANAGEMENT_2026.md`

---

## Document Control

| Version | Date | Changes | Approved By |
|---------|------|---------|------------|
| 1.0 | 2026-04-15 | Initial creation | System |

---

**Classification:** Internal - Operations Team  
**Distribution:** IT Operations, System Administrators  
**Retention:** 3 years (operational reference)  
**Last Updated:** April 15, 2026  
**Next Review:** July 15, 2026
