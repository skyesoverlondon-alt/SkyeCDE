# Monitoring & Alerting Checklist — Skye Mail Vault — Business Email Center

Effective date: February 21, 2026

## Recommended SLOs
- Availability: 99.9% monthly for auth + submit + inbox list
- p95 latency: < 800ms auth, < 1200ms submit (excluding client encryption)
- Error rate: < 1% 5xx sustained 5 minutes

## Netlify Functions
Monitor: requests, p95 latency, 4xx/5xx counts, error signatures.
Alert:
- 5xx > 1% over 5 min (SEV‑2)
- auth failures spike (SEV‑1)
- submit 429 spike (attack signal)
Action: tighten limits, enable Turnstile, check DB.

## Neon
Monitor: connections, CPU, storage growth, slow queries.
Alert:
- connection saturation (SEV‑1)
- CPU > 80% sustained (SEV‑2)
- storage growth anomaly (SEV‑2)
Action: throttle intake, optimize queries/indexes, archive.

## Resend
Monitor: send success/failure, bounces, complaints.
Alert:
- failures > 2% over 15 min (SEV‑2)
Action: verify DNS, pause or throttle notifications.

## Security signals
Monitor: login failures per IP bucket, reset requests per IP bucket, submit attempts per IP bucket.
Alert: bucket exceeds 10× baseline.
Action: denylist bucket, require Turnstile.

## Weekly checks
- Backup restore drill
- Secret rotation review
- Dependency update review
- Abuse bucket review
